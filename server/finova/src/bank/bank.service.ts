import { PrismaService } from 'src/prisma/prisma.service';
import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Prisma, User, ReconciliationStatus, MatchType, SuggestionStatus, PaymentStatus, BankAccountType } from '@prisma/client';
import { DataExtractionService } from 'src/data-extraction/data-extraction.service';
import * as AWS from 'aws-sdk';
import { PostingService } from 'src/accounting/posting.service';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

@Injectable()
export class BankService {

    constructor(
        private readonly prisma: PrismaService,
        private readonly dataExtractionService: DataExtractionService,
        private readonly postingService: PostingService,
    ){}

    // Resolve the analytic account code for a bank transaction's IBAN
    private async resolveBankAnalyticCode(
      prisma: any,
      accountingClientId: number,
      bankTransactionId: string,
    ): Promise<string> {
      const tx = await prisma.bankTransaction.findUnique({
        where: { id: bankTransactionId },
        include: { bankAccount: true },
      });
      if (!tx || !tx.bankAccount) {
        throw new BadRequestException(
          'Bank account not associated with the transaction; cannot derive analytic code. Please set bank account analytics.',
        );
      }
      const mapping = await prisma.bankAccountAnalytic.findFirst({
        where: { accountingClientId, iban: tx.bankAccount.iban },
      });
      if (!mapping) {
        throw new BadRequestException(
          `No analytic mapping found for IBAN ${tx.bankAccount.iban}. Please set an analytic code in Bank Settings.`,
        );
      }
      return mapping.fullCode;
    }

    // Very simple counter-account inference for document payments; falls back to clearing
    private inferCounterAccountCode(docType?: string | null): string {
      const t = (docType || '').toLowerCase();
      if (t.includes('invoice_out') || (t.includes('invoice') && !t.includes('invoice_in'))) return '4111'; // Accounts Receivable
      if (t.includes('invoice_in')) return '401'; // Accounts Payable
      if (t.includes('z report') || t.includes('z-report') || t.includes('z_report')) return '707'; // Sales (fallback)
      return '473'; // Clearing/Suspense
    }

    // Safely parse incoming date strings (ISO expected). Returns null if invalid.
    private parseDateSafe(input?: string | null): Date | null {
      if (!input) return null;
      const d = new Date(input);
      return isNaN(d.getTime()) ? null : d;
    }

  // ==================== TRANSFER RECONCILIATION ====================
  async createTransferReconciliation(
    clientEin: string,
    user: User,
    data: {
      sourceTransactionId: string;
      destinationTransactionId: string;
      sourceAccountCode?: string;
      destinationAccountCode?: string;
      fxRate?: number;
      notes?: string;
    }
  ) {
    if (!data?.sourceTransactionId || !data?.destinationTransactionId) {
      throw new BadRequestException('sourceTransactionId and destinationTransactionId are required');
    }
    if (data.sourceTransactionId === data.destinationTransactionId) {
      throw new BadRequestException('Source and destination transactions must be different');
    }

    const clientCompany = await this.prisma.clientCompany.findUnique({ where: { ein: clientEin } });
    if (!clientCompany) throw new NotFoundException('Client company not found');
    const accountingClient = await this.prisma.accountingClients.findFirst({
      where: { accountingCompanyId: user.accountingCompanyId, clientCompanyId: clientCompany.id },
    });
    if (!accountingClient) throw new UnauthorizedException('No access to this client company');

    const [src, dst] = await this.prisma.$transaction([
      this.prisma.bankTransaction.findUnique({
        where: { id: data.sourceTransactionId },
        include: { bankStatementDocument: true, bankAccount: true },
      }),
      this.prisma.bankTransaction.findUnique({
        where: { id: data.destinationTransactionId },
        include: { bankStatementDocument: true, bankAccount: true },
      }),
    ]);
    if (!src || !dst) throw new NotFoundException('One or both transactions not found');
    if (
      src.bankStatementDocument.accountingClientId !== accountingClient.id ||
      dst.bankStatementDocument.accountingClientId !== accountingClient.id
    ) {
      throw new UnauthorizedException('Transactions do not belong to this client');
    }
    // Validate signs and absolute amount equality (within 0.01)
    const srcAmt = Number(src.amount);
    const dstAmt = Number(dst.amount);
    if (!(srcAmt < 0 && dstAmt > 0)) {
      throw new BadRequestException('Source must be negative and destination positive');
    }
    if (!this.amountsEqual(Math.abs(srcAmt), Math.abs(dstAmt))) {
      throw new BadRequestException('Amounts do not match');
    }

    // Prevent duplicates
    const existing = await this.prisma.transferReconciliation.findFirst({
      where: {
        sourceTransactionId: data.sourceTransactionId,
        destinationTransactionId: data.destinationTransactionId,
      },
    });
    if (existing) {
      return existing;
    }

    // Auto-derive analytic account codes if missing
    const resolveAnalyticForTx = async (tx: typeof src): Promise<string> => {
      if (!tx) throw new NotFoundException('Transaction not found');
      if (!tx.bankAccount) {
        throw new BadRequestException('Bank account is not associated with one of the transactions. Please run association and set analytics for the IBAN.');
      }
      const analytic = await this.prisma.bankAccountAnalytic.findFirst({
        where: {
          accountingClientId: accountingClient.id,
          iban: tx.bankAccount.iban,
        },
      });
      if (!analytic) {
        throw new BadRequestException(`No analytic mapping found for IBAN ${tx.bankAccount.iban}. Please set an analytic code for this bank account.`);
      }
      return analytic.fullCode;
    };

    let srcAccountCode = data.sourceAccountCode;
    let dstAccountCode = data.destinationAccountCode;
    if (!srcAccountCode) {
      srcAccountCode = await resolveAnalyticForTx(src);
    }
    if (!dstAccountCode) {
      dstAccountCode = await resolveAnalyticForTx(dst);
    }

    // Default FX rate to 1 when both accounts have the same currency and none provided
    let fxRateToUse: number | null = null;
    if (data.fxRate != null) {
      fxRateToUse = data.fxRate;
    } else if (src.bankAccount && dst.bankAccount && src.bankAccount.currency === dst.bankAccount.currency) {
      fxRateToUse = 1;
    } else {
      fxRateToUse = null;
    }

    const created = await this.prisma.transferReconciliation.create({
      data: {
        sourceTransactionId: data.sourceTransactionId,
        destinationTransactionId: data.destinationTransactionId,
        sourceAccountCode: srcAccountCode,
        destinationAccountCode: dstAccountCode,
        fxRate: fxRateToUse != null ? new Prisma.Decimal(fxRateToUse) : null,
        notes: data.notes || null,
        createdByUserId: user.id,
      },
    });

    // Post ledger entries for the transfer (same-currency or fxRate=1 only)
    try {
      const canPost = fxRateToUse === 1;
      if (!canPost) {
        console.warn('⚠️ Skipping ledger posting for transfer with unsupported FX handling.');
      } else {
        const amt = Math.abs(Number(dst.amount));
        const postingDate = dst.transactionDate || src.transactionDate || new Date();
        const entries = [
          { accountCode: dstAccountCode!, debit: amt }, // money in to destination bank
          { accountCode: srcAccountCode!, credit: amt }, // money out from source bank
        ];
        await this.postingService.postEntries({
          accountingClientId: accountingClient.id,
          postingDate,
          entries,
          sourceType: 'RECONCILIATION',
          sourceId: String(created.id),
          postingKey: `transfer:${created.id}`,
          links: {
            documentId: null,
            bankTransactionId: null,
            reconciliationId: null,
          },
        });
      }
    } catch (e) {
      console.warn('⚠️ Ledger posting failed on createTransferReconciliation:', e);
    }

    return created;
  }

  async getTransferReconciliationCandidates(
    clientEin: string,
    user: User,
    options?: { daysWindow?: number; maxResults?: number; allowCrossCurrency?: boolean; fxTolerancePct?: number }
  ) {
    const daysWindow = options?.daysWindow ?? 2;
    const maxResults = Math.min(options?.maxResults ?? 50, 200);
    const allowCrossCurrency = options?.allowCrossCurrency ?? false;
    const fxTolerancePct = options?.fxTolerancePct ?? 2; // percentage window when comparing implied FX, used for scoring only

    const clientCompany = await this.prisma.clientCompany.findUnique({ where: { ein: clientEin } });
    if (!clientCompany) throw new NotFoundException('Client company not found');
    const accountingClient = await this.prisma.accountingClients.findFirst({
      where: { accountingCompanyId: user.accountingCompanyId, clientCompanyId: clientCompany.id },
    });
    if (!accountingClient) throw new UnauthorizedException('No access to this client company');

    // Fetch recent unreconciled transactions for this client (include bankAccount for currency)
    const txs = await this.prisma.bankTransaction.findMany({
      where: {
        bankStatementDocument: { accountingClientId: accountingClient.id },
        reconciliationStatus: ReconciliationStatus.UNRECONCILED,
      },
      orderBy: { transactionDate: 'desc' },
      take: 1000,
      include: { bankAccount: true },
    });

    // Index by rounded absolute amount for quick matching
    const creditsByAmt = new Map<string, typeof txs>();
    const debits = [] as typeof txs;
    for (const t of txs) {
      const amt = Number(t.amount);
      const key = Math.abs(amt).toFixed(2);
      if (amt > 0) {
        const arr = creditsByAmt.get(key) || ([] as typeof txs);
        arr.push(t);
        creditsByAmt.set(key, arr);
      } else if (amt < 0) {
        debits.push(t);
      }
    }

    // Debug: summarize fetched unreconciled transactions
    let creditsCount = 0;
    for (const arr of creditsByAmt.values()) creditsCount += arr.length;
    const nullCurrency = txs.filter((t) => !t.bankAccount?.currency).length;
    const currenciesSet = new Set((txs.map((t) => t.bankAccount?.currency).filter(Boolean) as string[]));
    console.log('[TransferCandidates] dataset', {
      totalTxs: txs.length,
      debits: debits.length,
      credits: creditsCount,
      nullCurrency,
      currencies: Array.from(currenciesSet),
      options: { daysWindow, maxResults, allowCrossCurrency, fxTolerancePct },
    });

    const results: any[] = [];

    // Helper: keyword boost for descriptions suggesting transfers/FX
    const hasTransferKeyword = (text?: string | null) => {
      if (!text) return false;
      const t = text.toLowerCase();
      return (
        t.includes('transfer') ||
        t.includes('virament') ||
        t.includes('intrabank') ||
        t.includes('interbank') ||
        t.includes('fx') ||
        t.includes('exchange') ||
        t.includes('convert') ||
        t.includes('schimb')
      );
    };

    // Helper: basic IBAN/name/reference matching boosts
    const normalize = (s?: string | null) => (s || '').toLowerCase();
    const containsIbanTail = (hay?: string | null, iban?: string | null) => {
      if (!hay || !iban) return false;
      const tail = iban.replace(/\s|-/g, '').slice(-6);
      return tail.length >= 4 && hay.replace(/\s|-/g, '').toLowerCase().includes(tail.toLowerCase());
    };
    const containsName = (hay?: string | null, name?: string | null) => {
      if (!hay || !name) return false;
      return hay.toLowerCase().includes(name.toLowerCase());
    };
    const sharedLongNumberToken = (a?: string | null, b?: string | null) => {
      if (!a || !b) return false;
      const re = /[0-9]{6,}/g;
      const set = new Set((a.match(re) || []));
      for (const tok of (b.match(re) || [])) {
        if (set.has(tok)) return true;
      }
      return false;
    };

    // Helper: plausible FX ranges per currency pair (from -> to)
    const plausibleFxRange = (from?: string | null, to?: string | null): [number, number] | null => {
      if (!from || !to) return null;
      const key = `${from.toUpperCase()}_${to.toUpperCase()}`;
      const ranges: Record<string, [number, number]> = {
        'RON_EUR': [0.15, 0.30],
        'EUR_RON': [3.0, 7.0],
        'USD_EUR': [0.7, 1.2],
        'EUR_USD': [0.7, 1.5],
        'RON_USD': [0.10, 0.30],
        'USD_RON': [3.0, 7.0],
        'GBP_EUR': [1.0, 1.3],
        'EUR_GBP': [0.7, 1.1],
      };
      return ranges[key] || null;
    };

    // Debug accumulators for analysis
    const stats = {
      sameCurrPairsChecked: 0,
      sameCurrPushed: 0,
      crossCurrPairsChecked: 0,
      crossCurrPushed: 0,
      skippedByDay: 0,
      skippedByFxRange: 0,
      skippedByCurrMissing: 0,
    };
    const samples: any = { same: [] as any[], cross: [] as any[] };
    const pairStats: Record<string, { checked: number; pushed: number; skippedFxRange: number; skippedDay: number }> = {};
    const bumpPair = (key: string, field: keyof typeof pairStats[string]) => {
      if (!pairStats[key]) pairStats[key] = { checked: 0, pushed: 0, skippedFxRange: 0, skippedDay: 0 };
      (pairStats[key][field] as number)++;
    };

    for (const d of debits) {
      const dAmt = Math.abs(Number(d.amount));
      const dCurr = d.bankAccount?.currency || null;

      // Same-currency exact matches (fast path)
      const key = dAmt.toFixed(2);
      const candidates = creditsByAmt.get(key) || [];
      for (const c of candidates) {
        const dayDiff = Math.abs(
          Math.round((+new Date(d.transactionDate) - +new Date(c.transactionDate)) / (1000 * 60 * 60 * 24))
        );
        stats.sameCurrPairsChecked++;
        if (dayDiff <= daysWindow) {
          const differentAccount = (d.bankAccountId || 0) !== (c.bankAccountId || 0);
          const kwBoost = (hasTransferKeyword(d.description) || hasTransferKeyword(c.description)) ? 0.05 : 0;
          const descD = normalize(d.description);
          const descC = normalize(c.description);
          const ibanBoost = (containsIbanTail(descD, c.bankAccount?.iban) || containsIbanTail(descC, d.bankAccount?.iban)) ? 0.05 : 0;
          const nameBoost = (
            containsName(descD, c.bankAccount?.bankName) ||
            containsName(descD, (c.bankAccount as any)?.accountName || (c.bankAccount as any)?.accountAlias) ||
            containsName(descC, d.bankAccount?.bankName) ||
            containsName(descC, (d.bankAccount as any)?.accountName || (d.bankAccount as any)?.accountAlias)
          ) ? 0.03 : 0;
          const refBoost = sharedLongNumberToken(descD, descC) ? 0.04 : 0;
          results.push({
            sourceTransactionId: d.id,
            destinationTransactionId: c.id,
            amount: dAmt,
            crossCurrency: false,
            impliedFxRate: 1,
            dateDiffDays: dayDiff,
            score: (differentAccount ? 1 : 0.9) + kwBoost + ibanBoost + nameBoost + refBoost - dayDiff * 0.05,
          });
          stats.sameCurrPushed++;
          if (samples.same.length < 5) {
            samples.same.push({
              srcId: d.id, dstId: c.id, amt: dAmt, dayDiff,
              srcCurr: dCurr, dstCurr: c.bankAccount?.currency || null,
            });
          }
          if (results.length >= maxResults) break;
        } else {
          stats.skippedByDay++;
        }
      }
      if (results.length >= maxResults) break;

      // Cross-currency heuristic matches
      if (allowCrossCurrency) {
        for (const c of txs) {
          if (Number(c.amount) <= 0) continue; // need a credit counterpart
          const cCurr = c.bankAccount?.currency || null;
          if (!dCurr || !cCurr || dCurr === cCurr) { stats.skippedByCurrMissing++; continue; }
          const dayDiff = Math.abs(
            Math.round((+new Date(d.transactionDate) - +new Date(c.transactionDate)) / (1000 * 60 * 60 * 24))
          );
          if (dayDiff > daysWindow) { stats.skippedByDay++; bumpPair(`${dCurr}_${cCurr}`, 'skippedDay'); continue; }
          stats.crossCurrPairsChecked++;
          bumpPair(`${dCurr}_${cCurr}`, 'checked');
          const cAmt = Math.abs(Number(c.amount));
          if (cAmt === 0 || dAmt === 0) continue;

          const impliedRate = cAmt / dAmt; // how many cCurr per dCurr

          // Basic sanity bounds to avoid absurd ratios
          if (!(impliedRate > 0.05 && impliedRate < 50)) { stats.skippedByFxRange++; bumpPair(`${dCurr}_${cCurr}`, 'skippedFxRange'); continue; }

          // If we know plausible ranges, filter further optionally using fxTolerancePct
          const baseRange = plausibleFxRange(dCurr, cCurr);
          if (baseRange) {
            let [minR, maxR] = baseRange;
            if (fxTolerancePct && fxTolerancePct > 0) {
              const mult = fxTolerancePct / 100;
              minR = minR * (1 - mult);
              maxR = maxR * (1 + mult);
            }
            if (impliedRate < minR || impliedRate > maxR) { stats.skippedByFxRange++; bumpPair(`${dCurr}_${cCurr}`, 'skippedFxRange'); continue; }
          }

          const differentAccount = (d.bankAccountId || 0) !== (c.bankAccountId || 0);
          const kwBoost = (hasTransferKeyword(d.description) || hasTransferKeyword(c.description)) ? 0.1 : 0;
          const descD = normalize(d.description);
          const descC = normalize(c.description);
          const ibanBoost = (containsIbanTail(descD, c.bankAccount?.iban) || containsIbanTail(descC, d.bankAccount?.iban)) ? 0.07 : 0;
          const nameBoost = (
            containsName(descD, c.bankAccount?.bankName) ||
            containsName(descD, (c.bankAccount as any)?.accountName || (c.bankAccount as any)?.accountAlias) ||
            containsName(descC, d.bankAccount?.bankName) ||
            containsName(descC, (d.bankAccount as any)?.accountName || (d.bankAccount as any)?.accountAlias)
          ) ? 0.05 : 0;
          const refBoost = sharedLongNumberToken(descD, descC) ? 0.06 : 0;

          // Score: base lower than same-currency, boosted by keywords and account difference, penalized by day diff
          const base = 0.7;
          const score = base + (differentAccount ? 0.2 : 0.05) + kwBoost + ibanBoost + nameBoost + refBoost - dayDiff * 0.05;

          results.push({
            sourceTransactionId: d.id,
            destinationTransactionId: c.id,
            amountSource: dAmt,
            amountDestination: cAmt,
            sourceCurrency: dCurr,
            destinationCurrency: cCurr,
            crossCurrency: true,
            impliedFxRate: impliedRate,
            dateDiffDays: dayDiff,
            score,
          });
          stats.crossCurrPushed++;
          bumpPair(`${dCurr}_${cCurr}`, 'pushed');
          if (samples.cross.length < 5) {
            samples.cross.push({
              srcId: d.id, dstId: c.id,
              amountSource: dAmt, amountDestination: cAmt,
              sourceCurrency: dCurr, destinationCurrency: cCurr,
              impliedFxRate: Number(impliedRate.toFixed(6)), dayDiff,
            });
          }

          if (results.length >= maxResults) break;
        }
      }
      if (results.length >= maxResults) break;
    }

    // Sort by score desc and return
    results.sort((a, b) => b.score - a.score);
    // Debug summary for this run
    console.log('[TransferCandidates] summary', {
      totals: { results: results.length },
      stats,
      pairStats,
      samples: {
        same: samples.same,
        cross: samples.cross,
      },
    });
    return { total: results.length, items: results };
  }

  async getTransferReconciliationCandidatesForTransaction(
    clientEin: string,
    user: User,
    transactionId: string,
    options?: { daysWindow?: number; maxResults?: number; allowCrossCurrency?: boolean; fxTolerancePct?: number }
  ) {
    const daysWindow = options?.daysWindow ?? 2;
    const maxResults = Math.min(options?.maxResults ?? 50, 200);
    const allowCrossCurrency = options?.allowCrossCurrency ?? false;
    const fxTolerancePct = options?.fxTolerancePct ?? 2;

    const clientCompany = await this.prisma.clientCompany.findUnique({ where: { ein: clientEin } });
    if (!clientCompany) throw new NotFoundException('Client company not found');
    const accountingClient = await this.prisma.accountingClients.findFirst({
      where: { accountingCompanyId: user.accountingCompanyId, clientCompanyId: clientCompany.id },
    });
    if (!accountingClient) throw new UnauthorizedException('No access to this client company');

    const src = await this.prisma.bankTransaction.findFirst({
      where: { id: transactionId, bankStatementDocument: { accountingClientId: accountingClient.id } },
      include: { bankAccount: true },
    });
    if (!src) throw new NotFoundException('Transaction not found');

    // Targeted debug logging can be enabled with env vars:
    //   TRANSFER_DEBUG=[1|true|on|yes] (global) or TRANSFER_DEBUG_TX_ID=<transactionId>
    const debugFlag = /^(1|true|on|yes)$/i.test(process.env.TRANSFER_DEBUG || '');
    const debugTx = (process.env.TRANSFER_DEBUG_TX_ID || '') === String(transactionId);
    const debug = debugFlag || debugTx;
    if (debug) {
      console.log('[TransferCandidatesForTx] debug on', {
        transactionId,
        srcId: src.id,
        srcAmt: Number(src.amount),
        srcCurr: src.bankAccount?.currency || null,
        daysWindow,
        allowCrossCurrency,
        fxTolerancePct,
      });
    }

    // Pull potential counterparts in a time window around src date
    const all = await this.prisma.bankTransaction.findMany({
      where: {
        bankStatementDocument: { accountingClientId: accountingClient.id },
        reconciliationStatus: ReconciliationStatus.UNRECONCILED,
      },
      orderBy: { transactionDate: 'desc' },
      take: 2000,
      include: { bankAccount: true },
    });

    const isDebit = Number(src.amount) < 0;
    const srcAmtAbs = Math.abs(Number(src.amount));
    const srcCurr = src.bankAccount?.currency || null;

    const results: any[] = [];

    const hasTransferKeyword = (text?: string | null) => {
      if (!text) return false;
      const t = text.toLowerCase();
      return t.includes('transfer') || t.includes('virament') || t.includes('fx') || t.includes('exchange') || t.includes('convert') || t.includes('schimb');
    };
    const normalize = (s?: string | null) => (s || '').toLowerCase();
    const containsIbanTail = (hay?: string | null, iban?: string | null) => {
      if (!hay || !iban) return false;
      const tail = iban.replace(/\s|-/g, '').slice(-6);
      return tail.length >= 4 && hay.replace(/\s|-/g, '').toLowerCase().includes(tail.toLowerCase());
    };
    const containsName = (hay?: string | null, name?: string | null) => {
      if (!hay || !name) return false;
      return hay.toLowerCase().includes(name.toLowerCase());
    };
    const sharedLongNumberToken = (a?: string | null, b?: string | null) => {
      if (!a || !b) return false;
      const re = /[0-9]{6,}/g;
      const set = new Set((a.match(re) || []));
      for (const tok of (b.match(re) || [])) {
        if (set.has(tok)) return true;
      }
      return false;
    };
    const plausibleFxRange = (from?: string | null, to?: string | null): [number, number] | null => {
      if (!from || !to) return null;
      const key = `${from.toUpperCase()}_${to.toUpperCase()}`;
      const ranges: Record<string, [number, number]> = {
        'RON_EUR': [0.15, 0.30],
        'EUR_RON': [3.0, 7.0],
        'USD_EUR': [0.7, 1.2],
        'EUR_USD': [0.7, 1.5],
        'RON_USD': [0.10, 0.30],
        'USD_RON': [3.0, 7.0],
        'GBP_EUR': [1.0, 1.3],
        'EUR_GBP': [0.7, 1.1],
      };
      return ranges[key] || null;
    };

    for (const c of all) {
      if (c.id === src.id) { if (debug) console.log('[TransferCandidatesForTx] skip: same transaction', { cId: c.id }); continue; }
      const signOk = isDebit ? Number(c.amount) > 0 : Number(c.amount) < 0;
      if (!signOk) { if (debug) console.log('[TransferCandidatesForTx] skip: sign mismatch', { srcIsDebit: isDebit, cAmt: Number(c.amount) }); continue; }
      const dayDiff = Math.abs(
        Math.round((+new Date(src.transactionDate) - +new Date(c.transactionDate)) / (1000 * 60 * 60 * 24))
      );
      if (dayDiff > daysWindow) { if (debug) console.log('[TransferCandidatesForTx] skip: day window', { dayDiff, daysWindow, cId: c.id }); continue; }

      const cAmtAbs = Math.abs(Number(c.amount));
      const cCurr = c.bankAccount?.currency || null;
      const differentAccount = (src.bankAccountId || 0) !== (c.bankAccountId || 0);
      const descS = normalize(src.description);
      const descC = normalize(c.description);
      const kwBoost = (hasTransferKeyword(src.description) || hasTransferKeyword(c.description)) ? 0.08 : 0;
      const ibanBoost = (containsIbanTail(descS, c.bankAccount?.iban) || containsIbanTail(descC, src.bankAccount?.iban)) ? 0.06 : 0;
      const nameBoost = (
        containsName(descS, c.bankAccount?.bankName) ||
        containsName(descS, (c.bankAccount as any)?.accountName || (c.bankAccount as any)?.accountAlias) ||
        containsName(descC, src.bankAccount?.bankName) ||
        containsName(descC, (src.bankAccount as any)?.accountName || (src.bankAccount as any)?.accountAlias)
      ) ? 0.04 : 0;
      const refBoost = sharedLongNumberToken(descS, descC) ? 0.05 : 0;

      if (srcCurr && cCurr && srcCurr === cCurr) {
        if (Math.abs(srcAmtAbs - cAmtAbs) <= 0.01) {
          const score = (differentAccount ? 1 : 0.9) + kwBoost + ibanBoost + nameBoost + refBoost - dayDiff * 0.05;
          results.push({
            sourceTransactionId: isDebit ? src.id : c.id,
            destinationTransactionId: isDebit ? c.id : src.id,
            amount: Math.min(srcAmtAbs, cAmtAbs),
            crossCurrency: false,
            impliedFxRate: 1,
            dateDiffDays: dayDiff,
            score,
          });
          if (debug) {
            console.log('[TransferCandidatesForTx] add SAME-CURR', {
              srcId: isDebit ? src.id : c.id,
              dstId: isDebit ? c.id : src.id,
              amount: Math.min(srcAmtAbs, cAmtAbs),
              dayDiff,
              differentAccount,
              boosts: { kwBoost, ibanBoost, nameBoost, refBoost },
              score,
            });
          }
        }
        else if (debug) {
          console.log('[TransferCandidatesForTx] skip: amount mismatch same-currency', {
            srcAmtAbs,
            cAmtAbs,
            diff: Math.abs(srcAmtAbs - cAmtAbs),
          });
        }
      } else if (allowCrossCurrency && srcCurr && cCurr && srcCurr !== cCurr) {
        const impliedRate = isDebit ? (cAmtAbs / srcAmtAbs) : (srcAmtAbs / cAmtAbs);
        if (impliedRate <= 0.05 || impliedRate >= 50) { if (debug) console.log('[TransferCandidatesForTx] skip: implied rate absurd', { impliedRate }); continue; }
        const baseRange = plausibleFxRange(isDebit ? srcCurr : cCurr, isDebit ? cCurr : srcCurr);
        if (baseRange) {
          let [minR, maxR] = baseRange;
          if (fxTolerancePct && fxTolerancePct > 0) {
            const mult = fxTolerancePct / 100;
            minR = minR * (1 - mult);
            maxR = maxR * (1 + mult);
          }
          if (impliedRate < minR || impliedRate > maxR) { if (debug) console.log('[TransferCandidatesForTx] skip: implied rate out of plausible range', { impliedRate, minR, maxR, pair: `${isDebit ? srcCurr : cCurr}_${isDebit ? cCurr : srcCurr}` }); continue; }
        }
        const base = 0.7;
        const score = base + (differentAccount ? 0.2 : 0.05) + kwBoost + ibanBoost + nameBoost + refBoost - dayDiff * 0.05;
        results.push({
          sourceTransactionId: isDebit ? src.id : c.id,
          destinationTransactionId: isDebit ? c.id : src.id,
          amountSource: isDebit ? srcAmtAbs : cAmtAbs,
          amountDestination: isDebit ? cAmtAbs : srcAmtAbs,
          sourceCurrency: isDebit ? srcCurr : cCurr,
          destinationCurrency: isDebit ? cCurr : srcCurr,
          crossCurrency: true,
          impliedFxRate: impliedRate,
          dateDiffDays: dayDiff,
          score,
        });
        if (debug) {
          console.log('[TransferCandidatesForTx] add CROSS-CURR', {
            srcId: isDebit ? src.id : c.id,
            dstId: isDebit ? c.id : src.id,
            amountSource: isDebit ? srcAmtAbs : cAmtAbs,
            amountDestination: isDebit ? cAmtAbs : srcAmtAbs,
            sourceCurrency: isDebit ? srcCurr : cCurr,
            destinationCurrency: isDebit ? cCurr : srcCurr,
            impliedFxRate: Number(impliedRate.toFixed(6)),
            dayDiff,
            differentAccount,
            boosts: { kwBoost, ibanBoost, nameBoost, refBoost },
            score,
          });
        }
      }
      if (results.length >= maxResults) break;
    }

    results.sort((a, b) => b.score - a.score);
    if (debug) {
      console.log('[TransferCandidatesForTx] result summary', { total: results.length, top: results.slice(0, Math.min(5, results.length)) });
    }
    return { total: results.length, items: results };
  }

  async getPendingTransferReconciliations(clientEin: string, user: User) {
    const clientCompany = await this.prisma.clientCompany.findUnique({ where: { ein: clientEin } });
    if (!clientCompany) throw new NotFoundException('Client company not found');
    const accountingClient = await this.prisma.accountingClients.findFirst({
      where: { accountingCompanyId: user.accountingCompanyId, clientCompanyId: clientCompany.id },
    });
    if (!accountingClient) throw new UnauthorizedException('No access to this client company');

    const transfers = await this.prisma.transferReconciliation.findMany({
      where: {
        OR: [
          { sourceTransaction: { bankStatementDocument: { accountingClientId: accountingClient.id } } },
          { destinationTransaction: { bankStatementDocument: { accountingClientId: accountingClient.id } } },
        ],
      },
      orderBy: { id: 'desc' },
    });
    return transfers;
  }

  async deleteTransferReconciliation(clientEin: string, id: number, user: User) {
    const clientCompany = await this.prisma.clientCompany.findUnique({ where: { ein: clientEin } });
    if (!clientCompany) throw new NotFoundException('Client company not found');
    const accountingClient = await this.prisma.accountingClients.findFirst({
      where: { accountingCompanyId: user.accountingCompanyId, clientCompanyId: clientCompany.id },
    });
    if (!accountingClient) throw new UnauthorizedException('No access to this client company');

    const tr = await this.prisma.transferReconciliation.findUnique({
      where: { id },
      include: {
        sourceTransaction: { include: { bankStatementDocument: true } },
        destinationTransaction: { include: { bankStatementDocument: true } },
      },
    });
    if (!tr) throw new NotFoundException('Transfer reconciliation not found');
    if (
      tr.sourceTransaction.bankStatementDocument.accountingClientId !== accountingClient.id &&
      tr.destinationTransaction.bankStatementDocument.accountingClientId !== accountingClient.id
    ) {
      throw new UnauthorizedException('No access to this transfer reconciliation');
    }

    await this.prisma.transferReconciliation.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ==================== BANK ACCOUNT ANALYTIC MAPPINGS ====================
  async getBankAccountAnalytics(clientEin: string, user: User) {
    const clientCompany = await this.prisma.clientCompany.findUnique({ where: { ein: clientEin } });
    if (!clientCompany) throw new NotFoundException('Client company not found');
    const accountingClient = await this.prisma.accountingClients.findFirst({
      where: { accountingCompanyId: user.accountingCompanyId, clientCompanyId: clientCompany.id },
    });
    if (!accountingClient) throw new UnauthorizedException('No access to this client company');

    const items = await this.prisma.bankAccountAnalytic.findMany({
      where: { accountingClientId: accountingClient.id },
      orderBy: { id: 'asc' },
    });
    return items;
  }

  async createBankAccountAnalytic(
    clientEin: string,
    user: User,
    data: {
      iban: string;
      currency: string;
      syntheticCode: string;
      analyticSuffix: string;
      bankName?: string;
      accountAlias?: string;
    }
  ) {
    const clientCompany = await this.prisma.clientCompany.findUnique({ where: { ein: clientEin } });
    if (!clientCompany) throw new NotFoundException('Client company not found');
    const accountingClient = await this.prisma.accountingClients.findFirst({
      where: { accountingCompanyId: user.accountingCompanyId, clientCompanyId: clientCompany.id },
    });
    if (!accountingClient) throw new UnauthorizedException('No access to this client company');

    if (!data?.iban || !data?.currency || !data?.syntheticCode || !data?.analyticSuffix) {
      throw new BadRequestException('iban, currency, syntheticCode and analyticSuffix are required');
    }

    const account = await this.prisma.bankAccount.findFirst({
      where: { accountingClientId: accountingClient.id, iban: data.iban },
    });
    if (!account) {
      throw new BadRequestException('IBAN does not belong to this client');
    }

    // Optional: ensure currency match with bank account
    if (account.currency && data.currency && account.currency !== data.currency) {
      // Allow but warn? For now, block to avoid mismatches
      throw new BadRequestException(`Currency mismatch for IBAN ${data.iban}: account=${account.currency}, provided=${data.currency}`);
    }

    const fullCode = `${data.syntheticCode}.${data.analyticSuffix}`;

    // Ensure uniqueness on (accountingClientId, fullCode)
    const existing = await this.prisma.bankAccountAnalytic.findFirst({
      where: { accountingClientId: accountingClient.id, fullCode },
    });
    if (existing) {
      throw new BadRequestException(`Analytic code already exists: ${fullCode}`);
    }

    const created = await this.prisma.bankAccountAnalytic.create({
      data: {
        accountingClientId: accountingClient.id,
        iban: data.iban,
        currency: data.currency || account.currency,
        syntheticCode: data.syntheticCode,
        analyticSuffix: data.analyticSuffix,
        fullCode,
        bankName: data.bankName || account.bankName,
        accountAlias: data.accountAlias || null,
      },
    });
    return created;
  }

  async updateBankAccountAnalytic(
    id: number,
    user: User,
    data: {
      currency?: string;
      syntheticCode?: string;
      analyticSuffix?: string;
      bankName?: string;
      accountAlias?: string;
    }
  ) {
    const item = await this.prisma.bankAccountAnalytic.findUnique({
      where: { id },
      include: { accountingClient: { include: { accountingCompany: true, clientCompany: true } } },
    });
    if (!item) throw new NotFoundException('Analytic mapping not found');
    if (item.accountingClient.accountingCompanyId !== user.accountingCompanyId) {
      throw new UnauthorizedException('No access to this analytic mapping');
    }

    let fullCode: string | undefined = undefined;
    const synthetic = data.syntheticCode ?? item.syntheticCode;
    const suffix = data.analyticSuffix ?? item.analyticSuffix;
    if (data.syntheticCode != null || data.analyticSuffix != null) {
      fullCode = `${synthetic}.${suffix}`;
      const exists = await this.prisma.bankAccountAnalytic.findFirst({
        where: { accountingClientId: item.accountingClientId, fullCode, id: { not: id } },
      });
      if (exists) {
        throw new BadRequestException(`Analytic code already exists: ${fullCode}`);
      }
    }

    const updated = await this.prisma.bankAccountAnalytic.update({
      where: { id },
      data: {
        currency: data.currency ?? item.currency,
        syntheticCode: synthetic,
        analyticSuffix: suffix,
        fullCode: fullCode ?? item.fullCode,
        bankName: data.bankName ?? item.bankName,
        accountAlias: data.accountAlias ?? item.accountAlias,
      },
    });
    return updated;
  }

  async deleteBankAccountAnalytic(id: number, user: User) {
    const item = await this.prisma.bankAccountAnalytic.findUnique({
      where: { id },
      include: { accountingClient: true },
    });
    if (!item) throw new NotFoundException('Analytic mapping not found');
    if (item.accountingClient.accountingCompanyId !== user.accountingCompanyId) {
      throw new UnauthorizedException('No access to this analytic mapping');
    }
    await this.prisma.bankAccountAnalytic.delete({ where: { id } });
    return { id, deleted: true };
  }

    // Utility: compare monetary values with tolerance of 0.01
    private amountsEqual(a: number, b: number, epsilon = 0.01): boolean {
      return Math.abs(a - b) <= epsilon;
    }

  /**
   * Update a document's reconciliationStatus (e.g., mark as IGNORED to exclude from bank rec)
   */
  async updateDocumentReconciliationStatus(
    clientEin: string,
    user: User,
    documentId: number,
    status: 'UNRECONCILED' | 'IGNORED'
  ) {
    const clientCompany = await this.prisma.clientCompany.findUnique({ where: { ein: clientEin } });
    if (!clientCompany) {
      throw new NotFoundException('Client company not found');
    }
    const accountingClientRelation = await this.prisma.accountingClients.findFirst({
      where: { accountingCompanyId: user.accountingCompanyId, clientCompanyId: clientCompany.id }
    });
    if (!accountingClientRelation) {
      throw new UnauthorizedException('No access to this client company');
    }

    const document = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.accountingClientId !== accountingClientRelation.id) {
      throw new NotFoundException('Document not found or no access');
    }

    // Only allow toggling between UNRECONCILED and IGNORED via this endpoint
    if (![ReconciliationStatus.UNRECONCILED, ReconciliationStatus.IGNORED].includes(status)) {
      throw new BadRequestException('Invalid status for this operation');
    }

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: { reconciliationStatus: status }
    });

    return {
      id: updated.id,
      reconciliationStatus: updated.reconciliationStatus
    };
  }

    async getReconciliationStats(clientEin: string, user: User) {
        const clientCompany = await this.prisma.clientCompany.findUnique({
          where: { ein: clientEin }
        });
      
        if (!clientCompany) {
          throw new NotFoundException('Client company not found');
        }
      
        const accountingClientRelation = await this.prisma.accountingClients.findFirst({
          where: {
            accountingCompanyId: user.accountingCompanyId,
            clientCompanyId: clientCompany.id
          }
        });
      
        if (!accountingClientRelation) {
          throw new UnauthorizedException('No access to this client company');
        }
      
        const [totalDocuments, reconciledDocuments, totalTransactions, reconciledTransactions, pendingSuggestions] = await Promise.all([
          this.prisma.document.count({
            where: {
              accountingClientId: accountingClientRelation.id,
              type: { in: ['Invoice', 'Receipt', 'Payment Order', 'Collection Order', 'Z Report'] }
            }
          }),
          this.prisma.document.count({
            where: {
              accountingClientId: accountingClientRelation.id,
              type: { in: ['Invoice', 'Receipt', 'Payment Order', 'Collection Order', 'Z Report'] },
              reconciliationStatus: ReconciliationStatus.MATCHED
            }
          }),
          this.prisma.bankTransaction.count({
            where: {
              bankStatementDocument: {
                accountingClientId: accountingClientRelation.id
              }
            }
          }),
          this.prisma.bankTransaction.count({
            where: {
              bankStatementDocument: {
                accountingClientId: accountingClientRelation.id
              },
              reconciliationStatus: ReconciliationStatus.MATCHED
            }
          }),
          this.prisma.reconciliationSuggestion.count({
            where: {
              document: {
                accountingClientId: accountingClientRelation.id
              },
              status: SuggestionStatus.PENDING
            }
          })
        ]);
      
        // Get unreconciled transactions and sum their amounts
        const unmatchedTransactions = await this.prisma.bankTransaction.findMany({
          where: {
            bankStatementDocument: {
              accountingClientId: accountingClientRelation.id
            },
            reconciliationStatus: ReconciliationStatus.UNRECONCILED
          }
        });
      
        let unmatchedAmount = 0;
        unmatchedTransactions.forEach(transaction => {
          unmatchedAmount += Math.abs(Number(transaction.amount) || 0);
        });
      
        return {
          documents: {
            total: totalDocuments,
            reconciled: reconciledDocuments,
            unreconciled: totalDocuments - reconciledDocuments,
            reconciliationRate: totalDocuments > 0 ? (reconciledDocuments / totalDocuments) * 100 : 0
          },
          transactions: {
            total: totalTransactions,
            reconciled: reconciledTransactions,
            unreconciled: totalTransactions - reconciledTransactions,
            reconciliationRate: totalTransactions > 0 ? (reconciledTransactions / totalTransactions) * 100 : 0
          },
          suggestions: {
            pending: pendingSuggestions
          },
          amounts: {
            unmatchedAmount: unmatchedAmount,
            currency: 'RON'
          }
        };
      }
      
      async getFinancialDocuments(clientEin: string, user: User, status: 'all' | 'reconciled' | 'unreconciled' = 'all', page = 1, size = 25) {
        const clientCompany = await this.prisma.clientCompany.findUnique({
          where: { ein: clientEin }
        });
      
        if (!clientCompany) {
          throw new NotFoundException('Client company not found');
        }
      
        const accountingClientRelation = await this.prisma.accountingClients.findFirst({
          where: {
            accountingCompanyId: user.accountingCompanyId,
            clientCompanyId: clientCompany.id
          }
        });
      
        if (!accountingClientRelation) {
          throw new UnauthorizedException('No access to this client company');
        }
      
        const whereCondition: any = {
          accountingClientId: accountingClientRelation.id,
          type: { in: ['Invoice', 'Receipt', 'Payment Order', 'Collection Order', 'Z Report'] }
        };
      
        if (status === 'reconciled') {
          whereCondition.reconciliationStatus = { in: [ReconciliationStatus.MATCHED] };
        } else if (status === 'unreconciled') {
          whereCondition.reconciliationStatus = { in: [ReconciliationStatus.UNRECONCILED] };
        }
        // If status === 'all', no filter is applied
      
        const [documents, total] = await this.prisma.$transaction([
          this.prisma.document.findMany({
          where: whereCondition,
          include: {
            processedData: true,
            reconciliationRecords: {
              include: {
                bankTransaction: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
            skip: (page - 1) * size,
            take: size
          }),
          this.prisma.document.count({ where: whereCondition })
        ]);
      
        const documentsWithUrls = await Promise.all(documents.map(async (doc) => {
          let extractedData = {};
          
          if (doc.processedData?.extractedFields) {
            try {
              const parsedFields = typeof doc.processedData.extractedFields === 'string'
                ? JSON.parse(doc.processedData.extractedFields)
                : doc.processedData.extractedFields;
              
              extractedData = parsedFields.result || parsedFields || {};
            } catch (e) {
            }
          }
      
          return {
            id: doc.id,
            name: doc.name,
            type: doc.type,
            createdAt: doc.createdAt,
            reconciliation_status: doc.reconciliationStatus,
            ...extractedData,
            matchedTransactions: doc.reconciliationRecords.map(record => record.bankTransaction.id),
            path: doc.path, 
            signedUrl: doc.s3Key ? await s3.getSignedUrlPromise('getObject', {
              Bucket: process.env.AWS_S3_BUCKET_NAME,
              Key: doc.s3Key,
              Expires: 3600 
            }) : doc.path 
          };
        }));
      
        return { total, page, size, items: documentsWithUrls };
      }
      
      async getBankTransactions(clientEin: string, user: User, status: 'all' | 'reconciled' | 'unreconciled' = 'all', page = 1, size = 25) {
      // Auto-associate any unlinked transactions before fetching
      try {
        await this.associateTransactionsWithAccounts(clientEin, user);
      } catch (e) {
        console.warn('⚠️ Auto association failed', e);
      }
        const clientCompany = await this.prisma.clientCompany.findUnique({
          where: { ein: clientEin }
        });
      
        if (!clientCompany) {
          throw new NotFoundException('Client company not found');
        }
      
        const accountingClientRelation = await this.prisma.accountingClients.findFirst({
          where: {
            accountingCompanyId: user.accountingCompanyId,
            clientCompanyId: clientCompany.id
          }
        });
      
        if (!accountingClientRelation) {
          throw new UnauthorizedException('No access to this client company');
        }
      
        const whereCondition: any = {
          bankStatementDocument: {
            accountingClientId: accountingClientRelation.id
          }
        };
      
        if (status === 'reconciled') {
          whereCondition.reconciliationStatus = { in: [ReconciliationStatus.MATCHED] };
        } else if (status === 'unreconciled') {
          whereCondition.reconciliationStatus = { in: [ReconciliationStatus.UNRECONCILED] };
        }
      
        const [transactions, total] = await this.prisma.$transaction([
          this.prisma.bankTransaction.findMany({
          where: whereCondition,
          include: {
            bankStatementDocument: true,
            chartOfAccount: true,
            reconciliationRecords: {
              include: {
                document: true
              }
            }
          },
          orderBy: { transactionDate: 'desc' },
            skip: (page - 1) * size,
            take: size
          }),
          this.prisma.bankTransaction.count({ where: whereCondition })
        ]);
      
        const transactionsWithSignedUrls = await Promise.all(
          transactions.map(async (transaction) => {
            let bankStatementSignedUrl = null;
            
            if (transaction.bankStatementDocument) {
              try {
                bankStatementSignedUrl = transaction.bankStatementDocument.s3Key 
                  ? await s3.getSignedUrlPromise('getObject', {
                      Bucket: process.env.AWS_S3_BUCKET_NAME,
                      Key: transaction.bankStatementDocument.s3Key,
                      Expires: 3600 
                    }) 
                  : transaction.bankStatementDocument.path;
              } catch (error) {
                console.error(`Failed to generate signed URL for bank statement ${transaction.bankStatementDocument.id}:`, error);
                bankStatementSignedUrl = transaction.bankStatementDocument.path;
              }
            }
      
            return {
              id: transaction.id,
              transactionDate: transaction.transactionDate,
              description: transaction.description,
              amount: transaction.amount,
              transactionType: transaction.transactionType,
              referenceNumber: transaction.referenceNumber,
              balanceAfter: transaction.balanceAfter,
              reconciliation_status: transaction.reconciliationStatus,
              chartOfAccount: transaction.chartOfAccount,
              isStandalone: transaction.isStandalone,
              accountingNotes: transaction.accountingNotes,
              bankStatementDocument: {
                id: transaction.bankStatementDocument.id,
                name: transaction.bankStatementDocument.name,
                signedUrl: bankStatementSignedUrl 
              },
              matchedDocuments: transaction.reconciliationRecords.map(record => record.document.id)
            };
          })
        );
      
        return { total, page, size, items: transactionsWithSignedUrls };
      }

      // ==================== TRANSACTION SPLITS ====================
      async getTransactionSplits(transactionId: string, user: User) {
        const tx = await this.prisma.bankTransaction.findUnique({
          where: { id: transactionId },
          include: {
            bankStatementDocument: {
              include: { accountingClient: true },
            },
          },
        });
        if (!tx) throw new NotFoundException('Bank transaction not found');
        if (tx.bankStatementDocument.accountingClient.accountingCompanyId !== user.accountingCompanyId) {
          throw new UnauthorizedException('No access to this bank transaction');
        }
        const splits = await this.prisma.bankTransactionSplit.findMany({
          where: { bankTransactionId: transactionId },
          include: { chartOfAccount: true },
          orderBy: { id: 'asc' },
        });
        return splits.map((s) => ({
          id: s.id,
          amount: Number(s.amount),
          notes: s.notes,
          chartOfAccount: {
            id: s.chartOfAccountId,
            accountCode: s.chartOfAccount.accountCode,
            accountName: s.chartOfAccount.accountName,
          },
        }));
      }

      async setTransactionSplits(
        transactionId: string,
        user: User,
        data: { splits: { amount: number; accountCode: string; notes?: string }[] }
      ) {
        if (!data || !Array.isArray(data.splits)) {
          throw new BadRequestException('Invalid payload: splits array required');
        }

        const tx = await this.prisma.bankTransaction.findUnique({
          where: { id: transactionId },
          include: {
            bankStatementDocument: { include: { accountingClient: true } },
          },
        });
        if (!tx) throw new NotFoundException('Bank transaction not found');
        if (tx.bankStatementDocument.accountingClient.accountingCompanyId !== user.accountingCompanyId) {
          throw new UnauthorizedException('No access to this bank transaction');
        }

        // Validate totals
        const totalSplits = data.splits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
        const txAmount = Number(tx.amount) || 0;
        if (!this.amountsEqual(totalSplits, txAmount)) {
          throw new BadRequestException(`Sum of splits (${totalSplits.toFixed(2)}) must equal transaction amount (${txAmount.toFixed(2)})`);
        }

        // Resolve account codes -> ids, validate all exist
        const codes = Array.from(new Set(data.splits.map((s) => s.accountCode)));
        const accounts = await this.prisma.chartOfAccounts.findMany({ where: { accountCode: { in: codes } } });
        const accountByCode = new Map(accounts.map((a) => [a.accountCode, a]));
        for (const s of data.splits) {
          if (!accountByCode.has(s.accountCode)) {
            throw new BadRequestException(`Account code not found: ${s.accountCode}`);
          }
          const amt = Number(s.amount);
          if (isNaN(amt) || Math.abs(amt) < 0.0) {
            throw new BadRequestException('Invalid split amount');
          }
        }

        // Replace all splits atomically
        await this.prisma.$transaction(async (prisma) => {
          await prisma.bankTransactionSplit.deleteMany({ where: { bankTransactionId: tx.id } });
          if (data.splits.length > 0) {
            await prisma.bankTransactionSplit.createMany({
              data: data.splits.map((s) => ({
                bankTransactionId: tx.id,
                amount: new Prisma.Decimal(s.amount.toFixed(2)),
                notes: s.notes || null,
                chartOfAccountId: accountByCode.get(s.accountCode)!.id,
              })),
            });
          }
        });

        // Return new splits
        return this.getTransactionSplits(transactionId, user);
      }

      async deleteTransactionSplit(splitId: number, user: User) {
        const split = await this.prisma.bankTransactionSplit.findUnique({
          where: { id: splitId },
          include: { bankTransaction: { include: { bankStatementDocument: { include: { accountingClient: true } } } } },
        });
        if (!split) throw new NotFoundException('Split not found');
        if (split.bankTransaction.bankStatementDocument.accountingClient.accountingCompanyId !== user.accountingCompanyId) {
          throw new UnauthorizedException('No access to this split');
        }

        // Delete and return remaining splits for the transaction
        await this.prisma.bankTransactionSplit.delete({ where: { id: splitId } });
        const remaining = await this.prisma.bankTransactionSplit.findMany({
          where: { bankTransactionId: split.bankTransactionId },
          include: { chartOfAccount: true },
          orderBy: { id: 'asc' },
        });
        return remaining.map((s) => ({
          id: s.id,
          amount: Number(s.amount),
          notes: s.notes,
          chartOfAccount: {
            id: s.chartOfAccountId,
            accountCode: s.chartOfAccount.accountCode,
            accountName: s.chartOfAccount.accountName,
          },
        }));
      }

      /**
       * Suggest transaction splits for a bank transaction using simple heuristics:
       * 1) Try to find the most recent prior transaction with the exact same description (case-insensitive) and same sign that already has splits.
       *    If found, scale that split pattern proportionally to the current transaction absolute amount.
       * 2) If no prior split pattern is found, but the current transaction already has a chartOfAccount assigned,
       *    suggest a single split to that account for the full absolute amount.
       * 3) Otherwise return an empty array (frontend can show a message or keep manual entry).
       *
       * Amounts returned are positive numbers to align with UI usage of absolute values.
       */
      async suggestTransactionSplits(transactionId: string, user: User) {
        const tx = await this.prisma.bankTransaction.findUnique({
          where: { id: transactionId },
          include: {
            bankStatementDocument: { include: { accountingClient: true } },
            chartOfAccount: true,
          },
        });
        if (!tx) throw new NotFoundException('Bank transaction not found');
        if (tx.bankStatementDocument.accountingClient.accountingCompanyId !== user.accountingCompanyId) {
          throw new UnauthorizedException('No access to this bank transaction');
        }

        const absAmount = Math.abs(Number(tx.amount) || 0);
        const description = (tx.description || '').trim();
        const isCredit = Number(tx.amount) > 0; // sign for matching history

        // 1) Look for most recent prior transaction with same description and sign that has splits
        if (description.length > 0) {
          const priorTx = await this.prisma.bankTransaction.findFirst({
            where: {
              id: { not: tx.id },
              description: { equals: description, mode: 'insensitive' },
              bankStatementDocument: {
                accountingClientId: tx.bankStatementDocument.accountingClientId,
              },
              // same sign
              amount: isCredit ? { gt: 0 } : { lt: 0 },
            },
            orderBy: { transactionDate: 'desc' },
          });

          if (priorTx) {
            const priorSplits = await this.prisma.bankTransactionSplit.findMany({
              where: { bankTransactionId: priorTx.id },
              include: { chartOfAccount: true },
              orderBy: { id: 'asc' },
            });
            if (priorSplits.length > 0) {
              const priorAbsTotal = priorSplits.reduce((sum, s) => sum + Math.abs(Number(s.amount) || 0), 0);
              const denom = priorAbsTotal > 0 ? priorAbsTotal : Math.abs(Number(priorTx.amount) || 0);
              const ratio = denom > 0 ? absAmount / denom : 1;

              // Scale splits and fix rounding on the last row
              const scaled = priorSplits.map((s) => ({
                accountCode: s.chartOfAccount.accountCode,
                amount: Number((Math.abs(Number(s.amount)) * ratio).toFixed(2)),
                notes: s.notes || undefined,
              }));
              // Adjust last split to ensure exact sum
              let sum = scaled.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
              const diff = Number((absAmount - sum).toFixed(2));
              if (scaled.length > 0 && Math.abs(diff) >= 0.01) {
                scaled[scaled.length - 1].amount = Number((scaled[scaled.length - 1].amount + diff).toFixed(2));
              }

              return { splits: scaled };
            }
          }
        }

        // 2) Fallback: if current transaction already has an account, suggest single split
        if (tx.chartOfAccount) {
          return {
            splits: [
              {
                amount: Number(absAmount.toFixed(2)),
                accountCode: tx.chartOfAccount.accountCode,
                notes: undefined,
              },
            ],
          };
        }

        // 3) No suggestion
        return { splits: [] };
      }

      
      async getReconciliationSuggestions(clientEin: string, user: User, page = 1, size = 25) {
        const clientCompany = await this.prisma.clientCompany.findUnique({
          where: { ein: clientEin }
        });
      
        if (!clientCompany) {
          throw new NotFoundException('Client company not found');
        }
      
        const accountingClientRelation = await this.prisma.accountingClients.findFirst({
          where: {
            accountingCompanyId: user.accountingCompanyId,
            clientCompanyId: clientCompany.id
          }
        });
      
        if (!accountingClientRelation) {
          throw new UnauthorizedException('No access to this client company');
        }
      
        const [suggestions, total] = await this.prisma.$transaction([
          this.prisma.reconciliationSuggestion.findMany({
          where: {
            status: SuggestionStatus.PENDING,
            OR: [
              {
                document: {
                  accountingClientId: accountingClientRelation.id,
                },
              },
              {
                documentId: null,
                bankTransaction: {
                  bankStatementDocument: {
                    accountingClientId: accountingClientRelation.id,
                  },
                },
              },
            ],
          },
          include: {
            document: {
              include: {
                processedData: true,
              },
            },
            bankTransaction: {
              include: {
                bankStatementDocument: true,
              },
            },
            chartOfAccount: true,
          },
          orderBy: { confidenceScore: 'desc' },
            skip: (page - 1) * size,
            take: size
          }),
          this.prisma.reconciliationSuggestion.count({
            where: {
              status: SuggestionStatus.PENDING,
              OR: [
                {
                  document: { accountingClientId: accountingClientRelation.id },
                },
                {
                  documentId: null,
                  bankTransaction: {
                    bankStatementDocument: { accountingClientId: accountingClientRelation.id },
                  },
                },
                {
                  documentId: null,
                  chartOfAccountId: { not: null },
                  bankTransaction: {
                    bankStatementDocument: { accountingClientId: accountingClientRelation.id },
                  },
                },
              ],
            },
          })
        ]);
        
        // Debug Z Report data in suggestions
        const zReportSuggestions = suggestions.filter(s => s.document?.type === 'Z Report');
        if (zReportSuggestions.length > 0) {
          console.log(`🔍 Z REPORT SUGGESTIONS DEBUG (${zReportSuggestions.length} found):`);
          for (const zSugg of zReportSuggestions) {
            console.log(`📊 Z Report: ${zSugg.document?.name}`, {
              documentId: zSugg.document?.id,
              processedDataExists: !!zSugg.document?.processedData,
              processedDataCount: Array.isArray(zSugg.document?.processedData) ? zSugg.document.processedData.length : 'not array',
              processedDataType: typeof zSugg.document?.processedData,
              extractedFields: zSugg.document?.processedData?.extractedFields || 'not found',
              firstProcessedData: Array.isArray(zSugg.document?.processedData) ? zSugg.document.processedData[0] : 'not array',
              rawProcessedData: zSugg.document?.processedData
            });
          }
        }

        // Debug transfer suggestions retrieved from database
        const transferSuggestions = suggestions.filter(s => (s.matchingCriteria as any)?.type === 'TRANSFER');
        console.log(`🔥 DATABASE TRANSFER SUGGESTIONS DEBUG: Found ${transferSuggestions.length} transfer suggestions`);
        for (const ts of transferSuggestions) {
          console.log(`🔥 Transfer Suggestion ID: ${ts.id}, BankTransactionId: ${ts.bankTransactionId}, MatchingCriteria:`, ts.matchingCriteria);
        }
        
        // Debug: Check all suggestions to see what we got
        console.log(`🔥 ALL SUGGESTIONS DEBUG: Total ${suggestions.length} suggestions retrieved`);
        for (const s of suggestions) {
          const matchingCriteria = s.matchingCriteria as any;
          console.log(`🔥 Suggestion ${s.id}: BankTransactionId=${s.bankTransactionId}, DocumentId=${s.documentId}, ChartOfAccountId=${s.chartOfAccountId}, MatchingCriteriaType=${matchingCriteria?.type}`);
        }

        const items = await Promise.all(
          suggestions.map(async (s) => {
            // Build signed URL for document
            let documentSignedUrl: string | null = null;
            if (s.document) {
              documentSignedUrl = s.document.s3Key
                ? await s3.getSignedUrlPromise('getObject', {
                  Bucket: process.env.AWS_S3_BUCKET_NAME,
                  Key: s.document.s3Key,
                  Expires: 3600,
                })
                : s.document.path;
            }

            // Build signed URL for bank statement
            let bankStatementSignedUrl: string | null = null;
            if (s.bankTransaction?.bankStatementDocument) {
              const bsDoc = s.bankTransaction.bankStatementDocument;
              bankStatementSignedUrl = bsDoc.s3Key
                ? await s3.getSignedUrlPromise('getObject', {
                  Bucket: process.env.AWS_S3_BUCKET_NAME,
                  Key: bsDoc.s3Key,
                  Expires: 3600,
                })
                : bsDoc.path;
            }

            // Check if this is a transfer suggestion from the database
            const matchingCriteria = s.matchingCriteria as any;
            const isTransferSuggestion = matchingCriteria?.type === 'TRANSFER' && matchingCriteria?.transfer?.destinationTransactionId;
            
            let transferData = null;
            if (isTransferSuggestion) {
              console.log(`🔥 PROCESSING TRANSFER SUGGESTION: ${s.bankTransactionId} -> ${matchingCriteria.transfer.destinationTransactionId}`);
              // Get the destination transaction details
              const destinationTransaction = await this.prisma.bankTransaction.findUnique({
                where: { id: matchingCriteria.transfer.destinationTransactionId },
                include: {
                  bankStatementDocument: true,
                },
              });
              
              console.log(`🔥 DESTINATION TRANSACTION QUERY RESULT:`, destinationTransaction ? 'FOUND' : 'NOT FOUND');
              if (destinationTransaction) {
                console.log(`🔥 DESTINATION TRANSACTION DETAILS:`, {
                  id: destinationTransaction.id,
                  description: destinationTransaction.description,
                  amount: destinationTransaction.amount,
                  transactionType: destinationTransaction.transactionType
                });
              }

              if (destinationTransaction) {
                // Build signed URL for destination transaction's bank statement
                let dstBankStmtUrl: string | null = null;
                if (destinationTransaction.bankStatementDocument) {
                  dstBankStmtUrl = destinationTransaction.bankStatementDocument.s3Key
                    ? await s3.getSignedUrlPromise('getObject', {
                        Bucket: process.env.AWS_S3_BUCKET_NAME,
                        Key: destinationTransaction.bankStatementDocument.s3Key,
                        Expires: 3600,
                      })
                    : destinationTransaction.bankStatementDocument.path;
                }

                transferData = {
                  sourceTransactionId: s.bankTransactionId,
                  destinationTransactionId: matchingCriteria.transfer.destinationTransactionId,
                  counterpartyTransaction: {
                    id: destinationTransaction.id,
                    description: destinationTransaction.description,
                    amount: destinationTransaction.amount,
                    transactionDate: destinationTransaction.transactionDate,
                    transactionType: destinationTransaction.transactionType,
                    bankStatementDocument: destinationTransaction.bankStatementDocument
                      ? {
                          id: destinationTransaction.bankStatementDocument.id,
                          name: destinationTransaction.bankStatementDocument.name,
                          signedUrl: dstBankStmtUrl,
                        }
                      : null,
                  },
                  crossCurrency: matchingCriteria.transfer.crossCurrency,
                  impliedFxRate: matchingCriteria.transfer.impliedFxRate,
                  dateDiffDays: matchingCriteria.transfer.daysApart,
                };
                console.log(`🔥 BUILT TRANSFER DATA:`, transferData);
              } else {
                console.log(`🔥 DESTINATION TRANSACTION NOT FOUND: ${matchingCriteria.transfer.destinationTransactionId}`);
              }
            }

            const responseItem = {
              id: s.id,
              confidenceScore: s.confidenceScore,
              matchingCriteria: s.matchingCriteria,
              reasons: s.reasons,
              createdAt: s.createdAt,
              document: s.document
                ? {
                  id: s.document.id,
                  name: s.document.name,
                  type: s.document.type,
                  signedUrl: documentSignedUrl,
                  total_amount: this.extractDocumentAmount(s.document),
                }
                : null,
              bankTransaction: s.bankTransaction
                ? {
                  id: s.bankTransaction.id,
                  description: s.bankTransaction.description,
                  amount: s.bankTransaction.amount,
                  transactionDate: s.bankTransaction.transactionDate,
                  transactionType: s.bankTransaction.transactionType,
                  bankStatementDocument: s.bankTransaction.bankStatementDocument
                    ? {
                      id: s.bankTransaction.bankStatementDocument.id,
                      name: s.bankTransaction.bankStatementDocument.name,
                      signedUrl: bankStatementSignedUrl,
                    }
                    : null,
                }
                : null,
              chartOfAccount: s.chartOfAccount
                ? {
                  code: s.chartOfAccount.accountCode,
                  name: s.chartOfAccount.accountName,
                  accountCode: s.chartOfAccount.accountCode,
                  accountName: s.chartOfAccount.accountName,
                }
                : null,
              transfer: transferData,
            };
            
            if (isTransferSuggestion) {
              console.log(`🔥 FINAL RESPONSE ITEM FOR TRANSFER:`, {
                id: responseItem.id,
                hasTransfer: !!responseItem.transfer,
                transfer: responseItem.transfer,
                transferData: transferData,
                isTransferDataNull: transferData === null,
                isTransferDataUndefined: transferData === undefined
              });
            }
            
            return responseItem;
          })
        );

        // === Augment with unified TRANSFER suggestions (debit-side only, no DB insert) ===
        // First, identify transactions that already have transfer suggestions in the database
        const existingTransferTransactionIds = new Set<string>();
        for (const item of items) {
          if (item.transfer) {
            existingTransferTransactionIds.add(item.transfer.sourceTransactionId);
            existingTransferTransactionIds.add(item.transfer.destinationTransactionId);
          }
        }
        
        // 1) Fetch top transfer candidates (service already scans debit->credit)
        const transferCand = await this.getTransferReconciliationCandidates(clientEin, user, {
          daysWindow: 2,
          maxResults: 200,
          allowCrossCurrency: true,
          fxTolerancePct: 2,
        });
        console.log('[TransferSuggestions] normal transferCand.items count =', (transferCand.items || []).length);
        console.log('[TransferSuggestions] existing database transfer transactions =', Array.from(existingTransferTransactionIds));
        if ((transferCand.items || []).length) {
          console.log('[TransferSuggestions] normal sample transferCand.items (max 3) =', (transferCand.items || []).slice(0, 3));
        }

        // 2) Keep the best candidate per source (debit) to avoid duplicates, but exclude transactions already covered by database suggestions
        const bestBySource = new Map<string, any>();
        for (const it of transferCand.items || []) {
          // Skip if either transaction is already covered by a database transfer suggestion
          if (existingTransferTransactionIds.has(it.sourceTransactionId) || 
              existingTransferTransactionIds.has(it.destinationTransactionId)) {
            console.log(`[TransferSuggestions] Skipping dynamic transfer ${it.sourceTransactionId} -> ${it.destinationTransactionId} (already covered by database suggestion)`);
            continue;
          }
          
          const prev = bestBySource.get(it.sourceTransactionId);
          if (!prev || (it.score ?? 0) > (prev.score ?? 0)) {
            bestBySource.set(it.sourceTransactionId, it);
          }
        }

        // 3) Load involved transactions in bulk (src + dst) with bank statements for signed URLs
        const srcIds = Array.from(bestBySource.keys());
        const dstIds = Array.from(new Set(Array.from(bestBySource.values()).map((v: any) => v.destinationTransactionId)));
        const allIds = Array.from(new Set([...srcIds, ...dstIds]));
        console.log('[TransferSuggestions] normal bestBySource size =', bestBySource.size, 'srcIds =', srcIds.length, 'dstIds =', dstIds.length);

        const txs = await this.prisma.bankTransaction.findMany({
          where: { id: { in: allIds } },
          include: { bankStatementDocument: true },
        });
        console.log('[TransferSuggestions] normal fetched txs count =', txs.length, 'for allIds =', allIds.length);
        const txById = new Map<string, typeof txs[number]>();
        for (const t of txs) txById.set(t.id, t);

        // 4) Build transfer suggestion items
        const extraTransferItems = await Promise.all(
          Array.from(bestBySource.values()).map(async (cand: any) => {
            const src = txById.get(cand.sourceTransactionId);
            const dst = txById.get(cand.destinationTransactionId);
            if (!src || !dst) {
              console.log('[TransferSuggestions] normal missing tx for cand', {
                srcExists: !!src, dstExists: !!dst,
                srcId: cand.sourceTransactionId, dstId: cand.destinationTransactionId,
              });
              return null;
            }

            // Signed URL for source bank statement
            let srcBankStmtUrl: string | null = null;
            if (src.bankStatementDocument) {
              srcBankStmtUrl = src.bankStatementDocument.s3Key
                ? await s3.getSignedUrlPromise('getObject', {
                  Bucket: process.env.AWS_S3_BUCKET_NAME,
                  Key: src.bankStatementDocument.s3Key,
                  Expires: 3600,
                })
                : src.bankStatementDocument.path;
            }

            // Signed URL for destination bank statement (for counterparty preview if needed)
            let dstBankStmtUrl: string | null = null;
            if (dst.bankStatementDocument) {
              dstBankStmtUrl = dst.bankStatementDocument.s3Key
                ? await s3.getSignedUrlPromise('getObject', {
                  Bucket: process.env.AWS_S3_BUCKET_NAME,
                  Key: dst.bankStatementDocument.s3Key,
                  Expires: 3600,
                })
                : dst.bankStatementDocument.path;
            }

            return {
              // Synthetic id to avoid clashing with DB suggestion ids
              id: `transfer:${cand.sourceTransactionId}:${cand.destinationTransactionId}`,
              confidenceScore: cand.score ?? 0.75,
              matchingCriteria: {
                type: 'TRANSFER',
                dateDiffDays: cand.dateDiffDays,
                crossCurrency: !!cand.crossCurrency,
                impliedFxRate: cand.impliedFxRate ?? 1,
              },
              reasons: [{ label: 'Transfer candidate', value: 'System-detected inter-account transfer' }],
              createdAt: new Date(),
              document: null,
              // Keep the main bankTransaction as the source (debit) side for consistency and deduplication
              bankTransaction: {
                id: src.id,
                description: src.description,
                amount: src.amount,
                transactionDate: src.transactionDate,
                transactionType: src.transactionType,
                bankStatementDocument: src.bankStatementDocument
                  ? {
                    id: src.bankStatementDocument.id,
                    name: src.bankStatementDocument.name,
                    signedUrl: srcBankStmtUrl,
                  }
                  : null,
              },
              chartOfAccount: null,
              // Embed counterparty so UI can render it on the left like a document
              transfer: {
                sourceTransactionId: cand.sourceTransactionId,
                destinationTransactionId: cand.destinationTransactionId,
                counterpartyTransaction: {
                  id: dst.id,
                  description: dst.description,
                  amount: dst.amount,
                  transactionDate: dst.transactionDate,
                  transactionType: dst.transactionType,
                  bankStatementDocument: dst.bankStatementDocument
                    ? {
                      id: dst.bankStatementDocument.id,
                      name: dst.bankStatementDocument.name,
                      signedUrl: dstBankStmtUrl,
                    }
                    : null,
                },
                crossCurrency: !!cand.crossCurrency,
                impliedFxRate: cand.impliedFxRate ?? 1,
                dateDiffDays: cand.dateDiffDays,
              },
            } as any;
          })
        );

        const transferItems = (extraTransferItems.filter(Boolean) as any[]);
        console.log('[TransferSuggestions] normal built transferItems count =', transferItems.length);
        if (transferItems.length) {
          console.log('[TransferSuggestions] normal sample transferItems ids (max 5) =', transferItems.slice(0, 5).map((i: any) => i.id));
        }
        
        // Debug: Check what's in the items array before merging
        const dbTransferItems = items.filter((item: any) => item.matchingCriteria?.type === 'TRANSFER');
        console.log('[TransferSuggestions] DB transfer items count =', dbTransferItems.length);
        if (dbTransferItems.length) {
          console.log('[TransferSuggestions] DB transfer items sample:', dbTransferItems.slice(0, 3).map((item: any) => ({
            id: item.id,
            hasTransfer: !!item.transfer,
            transfer: item.transfer
          })));
        }

        // Merge and adjust totals. Keep original order by confidenceScore across both.
        const merged = [...items, ...transferItems].sort((a, b) => (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0));
        const mergedTotal = total + transferItems.length;
        console.log('[TransferSuggestions] normal merged suggestions =', { base: items.length, transfers: transferItems.length, total: mergedTotal });
        // Service-level summary for frontend correlation
        try {
          console.log('[SVC][TRANSFER][augmented]', {
            added: transferItems.length,
            sample: transferItems.slice(0, 3).map((x: any) => ({
              id: x?.id,
              type: x?.matchingCriteria?.type,
              bankTxnId: x?.bankTransaction?.id,
              srcId: x?.transfer?.sourceTransactionId,
              dstId: x?.transfer?.destinationTransactionId,
            }))
          });
        } catch {}

        // NOTE: We return merged for the normal path below unless regeneration triggers.

        // Check if we need to regenerate suggestions based on unreconciled transactions
        const unreconciliedTransactionCount = await this.prisma.bankTransaction.count({
          where: {
            bankStatementDocument: { accountingClientId: accountingClientRelation.id },
            reconciliationStatus: ReconciliationStatus.UNRECONCILED
          }
        });
        
        console.log(`🔍 SUGGESTION REGENERATION CHECK:`);
        console.log(`📊 Current suggestions: ${total}`);
        console.log(`💳 Unreconciled transactions: ${unreconciliedTransactionCount}`);
        console.log(`📄 Page: ${page}`);
        console.log(`🔄 Should regenerate: ${total < unreconciliedTransactionCount && page === 1}`);
        
        const unreconciliedTransactions = await this.prisma.bankTransaction.findMany({
          where: {
            bankStatementDocument: { accountingClientId: accountingClientRelation.id },
            reconciliationStatus: ReconciliationStatus.UNRECONCILED
          },
          select: {
            id: true,
            description: true,
            amount: true,
            transactionDate: true
          },
          take: 5 // Just show first 5 for debugging
        });
        console.log(`🔍 Sample unreconciled transactions:`, unreconciliedTransactions);
        
        if (total < unreconciliedTransactionCount && page === 1) {
          try {
            console.log(`🔄 REGENERATING SUGGESTIONS: Found ${total} suggestions for ${unreconciliedTransactionCount} unreconciled transactions, regenerating...`);
            await this.dataExtractionService.generateReconciliationSuggestions(accountingClientRelation.id);
            
            const [newSuggestions, newTotal] = await this.prisma.$transaction([
              this.prisma.reconciliationSuggestion.findMany({
                where: {
                  status: SuggestionStatus.PENDING,
                  OR: [
                    {
                      document: {
                        accountingClientId: accountingClientRelation.id,
                      },
                    },
                    {
                      documentId: null,
                      bankTransaction: {
                        bankStatementDocument: {
                          accountingClientId: accountingClientRelation.id,
                        },
                      },
                    },
                  ],
                },
                include: {
                  document: {
                    include: {
                      processedData: true,
                    },
                  },
                  bankTransaction: {
                    include: {
                      bankStatementDocument: true,
                    },
                  },
                  chartOfAccount: true,
                },
                orderBy: { confidenceScore: 'desc' },
                skip: (page - 1) * size,
                take: size
              }),
              this.prisma.reconciliationSuggestion.count({
                where: {
                  status: SuggestionStatus.PENDING,
                  OR: [
                    {
                      document: { accountingClientId: accountingClientRelation.id },
                    },
                    {
                      documentId: null,
                      bankTransaction: {
                        bankStatementDocument: { accountingClientId: accountingClientRelation.id },
                      },
                    },
                    {
                      documentId: null,
                      chartOfAccountId: { not: null },
                      bankTransaction: {
                        bankStatementDocument: { accountingClientId: accountingClientRelation.id },
                      },
                    },
                  ],
                },
              })
            ]);
            
            const newItems = newSuggestions.map(s => ({
              id: s.id,
              confidenceScore: s.confidenceScore,
              matchingCriteria: s.matchingCriteria,
              reasons: s.reasons,
              createdAt: s.createdAt,
              document: s.document
                ? (() => {
                    let totalAmount: number | null = null;
                    try {
                      const extracted = s.document.processedData?.extractedFields;
                      if (extracted) {
                        const parsed = typeof extracted === 'string' ? JSON.parse(extracted) : extracted;
                        const result = (parsed as any).result || parsed;
                        totalAmount = result?.total_amount ?? null;
                      }
                    } catch (_) {
                    }
                    return {
                      id: s.document.id,
                      name: s.document.name,
                      type: s.document.type,
                      total_amount: totalAmount,
                    };
                  })()
                : null,
              bankTransaction: s.bankTransaction
                ? {
                    id: s.bankTransaction.id,
                    description: s.bankTransaction.description,
                    amount: s.bankTransaction.amount,
                    transactionDate: s.bankTransaction.transactionDate,
                    transactionType: s.bankTransaction.transactionType,
                  }
                : null,
              chartOfAccount: s.chartOfAccount
                ? ({
                    code: s.chartOfAccount.accountCode,
                    name: s.chartOfAccount.accountName,
                    accountCode: s.chartOfAccount.accountCode,
                    accountName: s.chartOfAccount.accountName,
                  } as any)
                : null,
            }));
            // Also augment regenerated items with transfer suggestions
            const regenAug = await this.getTransferReconciliationCandidates(clientEin, user, {
              daysWindow: 2,
              maxResults: 200,
              allowCrossCurrency: true,
              fxTolerancePct: 2,
            });
            const bestBySrc2 = new Map<string, any>();
            console.log('[TransferSuggestions] regenAug.items count =', (regenAug.items || []).length);
            if ((regenAug.items || []).length) {
              console.log('[TransferSuggestions] sample regenAug.items (max 3) =', (regenAug.items || []).slice(0, 3));
            }
            for (const it of regenAug.items || []) {
              const prev = bestBySrc2.get(it.sourceTransactionId);
              if (!prev || (it.score ?? 0) > (prev.score ?? 0)) bestBySrc2.set(it.sourceTransactionId, it);
            }
            const srcIds2 = Array.from(bestBySrc2.keys());
            const dstIds2 = Array.from(new Set(Array.from(bestBySrc2.values()).map((v: any) => v.destinationTransactionId)));
            const allIds2 = Array.from(new Set([...srcIds2, ...dstIds2]));
            console.log('[TransferSuggestions] bestBySrc2 size =', bestBySrc2.size, 'srcIds2 =', srcIds2.length, 'dstIds2 =', dstIds2.length);
            const txs2 = await this.prisma.bankTransaction.findMany({ where: { id: { in: allIds2 } }, include: { bankStatementDocument: true } });
            const byId2 = new Map<string, typeof txs2[number]>();
            for (const t of txs2) byId2.set(t.id, t);
            const extra2 = await Promise.all(Array.from(bestBySrc2.values()).map(async (cand: any) => {
              const src = byId2.get(cand.sourceTransactionId);
              const dst = byId2.get(cand.destinationTransactionId);
              if (!src || !dst) return null;
              let srcUrl: string | null = null;
              if (src.bankStatementDocument) {
                srcUrl = src.bankStatementDocument.s3Key
                  ? await s3.getSignedUrlPromise('getObject', { Bucket: process.env.AWS_S3_BUCKET_NAME, Key: src.bankStatementDocument.s3Key, Expires: 3600 })
                  : src.bankStatementDocument.path;
              }
              let dstUrl: string | null = null;
              if (dst.bankStatementDocument) {
                dstUrl = dst.bankStatementDocument.s3Key
                  ? await s3.getSignedUrlPromise('getObject', { Bucket: process.env.AWS_S3_BUCKET_NAME, Key: dst.bankStatementDocument.s3Key, Expires: 3600 })
                  : dst.bankStatementDocument.path;
              }
              return {
                id: `transfer:${cand.sourceTransactionId}:${cand.destinationTransactionId}`,
                confidenceScore: cand.score ?? 0.75,
                matchingCriteria: { type: 'TRANSFER', dateDiffDays: cand.dateDiffDays, crossCurrency: !!cand.crossCurrency, impliedFxRate: cand.impliedFxRate ?? 1 },
                reasons: [{ label: 'Transfer candidate', value: 'System-detected inter-account transfer' }],
                createdAt: new Date(),
                document: null,
                bankTransaction: {
                  id: src.id,
                  description: src.description,
                  amount: src.amount,
                  transactionDate: src.transactionDate,
                  transactionType: src.transactionType,
                  bankStatementDocument: src.bankStatementDocument ? { id: src.bankStatementDocument.id, name: src.bankStatementDocument.name, signedUrl: srcUrl } : null,
                },
                chartOfAccount: null,
                transfer: {
                  sourceTransactionId: cand.sourceTransactionId,
                  destinationTransactionId: cand.destinationTransactionId,
                  counterpartyTransaction: {
                    id: dst.id,
                    description: dst.description,
                    amount: dst.amount,
                    transactionDate: dst.transactionDate,
                    transactionType: dst.transactionType,
                    bankStatementDocument: dst.bankStatementDocument ? { id: dst.bankStatementDocument.id, name: dst.bankStatementDocument.name, signedUrl: dstUrl } : null,
                  },
                  crossCurrency: !!cand.crossCurrency,
                  impliedFxRate: cand.impliedFxRate ?? 1,
                  dateDiffDays: cand.dateDiffDays,
                },
              } as any;
            }));
            const transferItems2 = (extra2.filter(Boolean) as any[]);
            console.log('[TransferSuggestions] built transferItems2 count =', transferItems2.length);
            if (transferItems2.length) {
              console.log('[TransferSuggestions] sample transferItems2 ids (max 5) =', transferItems2.slice(0, 5).map((i: any) => i.id));
            }
            const merged2 = [...newItems, ...transferItems2].sort((a, b) => (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0));
            console.log('[TransferSuggestions] merged suggestions =', { base: newItems.length, transfers: transferItems2.length, total: newTotal + transferItems2.length });
            try {
              console.log('[SVC][TRANSFER][augmented]', {
                added: transferItems2.length,
                sample: transferItems2.slice(0, 3).map((x: any) => ({
                  id: x?.id,
                  type: x?.matchingCriteria?.type,
                  bankTxnId: x?.bankTransaction?.id,
                  srcId: x?.transfer?.sourceTransactionId,
                  dstId: x?.transfer?.destinationTransactionId,
                }))
              });
            } catch {}
            try {
              console.log('[SVC][suggestions][out]', { count: merged2.length });
            } catch {}
            return { items: merged2, total: newTotal + transferItems2.length };
          } catch (error) {
            console.error('Failed to generate suggestions:', error);
            return { items: merged, total: mergedTotal };
          }
        }
        
        try {
          console.log('[SVC][suggestions][out]', { count: merged.length });
        } catch {}
        
        // Debug: Check final response before sending
        const finalTransferItems = merged.filter((item: any) => item.matchingCriteria?.type === 'TRANSFER');
        console.log('[SVC][suggestions][final] transfer items:', finalTransferItems.length);
        if (finalTransferItems.length > 0) {
          console.log('[SVC][suggestions][final] transfer sample:', {
            id: finalTransferItems[0].id,
            hasTransfer: !!finalTransferItems[0].transfer,
            transfer: finalTransferItems[0].transfer,
            keys: Object.keys(finalTransferItems[0])
          });
        }
        
        // Debug: Check if transfer field exists in all items
        const allItemsWithTransfer = merged.filter((item: any) => item.transfer);
        console.log('[SVC][suggestions][final] items with transfer field:', allItemsWithTransfer.length);
        
        return { items: merged, total: mergedTotal };
      }

      async createManualMatch(matchData: { documentId: number; bankTransactionId: string; notes?: string }, user: User) {
        const updated = await this.prisma.$transaction(async (prisma) => {
          const document = await prisma.document.findUnique({
            where: { id: matchData.documentId },
            include: {
              accountingClient: true,
              processedData: true
            }
          });
      
          if (!document) {
            throw new NotFoundException('Document not found');
          }
      
          if (document.accountingClient.accountingCompanyId !== user.accountingCompanyId) {
            throw new UnauthorizedException('No access to this document');
          }
      
          const bankTransaction = await prisma.bankTransaction.findUnique({
            where: { id: matchData.bankTransactionId },
            include: {
              bankStatementDocument: {
                include: {
                  accountingClient: true
                }
              }
            }
          });
      
          if (!bankTransaction) {
            throw new NotFoundException('Bank transaction not found');
          }
      
          if (bankTransaction.bankStatementDocument.accountingClient.accountingCompanyId !== user.accountingCompanyId) {
            throw new UnauthorizedException('No access to this bank transaction');
          }
      
          const existingMatch = await prisma.reconciliationRecord.findUnique({
            where: {
              documentId_bankTransactionId: {
                documentId: matchData.documentId,
                bankTransactionId: matchData.bankTransactionId
              }
            }
          });
      
          if (existingMatch) {
            throw new Error('This document and transaction are already matched');
          }
      
          const reconciliationRecord = await prisma.reconciliationRecord.create({
            data: {
              documentId: matchData.documentId,
              bankTransactionId: matchData.bankTransactionId,
              matchType: MatchType.MANUAL,
              reconciledById: user.id,
              notes: matchData.notes
            }
          });
      
          await prisma.document.update({
            where: { id: matchData.documentId },
            data: { reconciliationStatus: ReconciliationStatus.MATCHED }
          });
      
          await prisma.bankTransaction.update({
            where: { id: matchData.bankTransactionId },
            data: { reconciliationStatus: ReconciliationStatus.MATCHED }
          });
      
          await prisma.reconciliationSuggestion.updateMany({
            where: {
              OR: [
                { documentId: matchData.documentId },
                { bankTransactionId: matchData.bankTransactionId }
              ],
              status: SuggestionStatus.PENDING
            },
            data: { status: SuggestionStatus.REJECTED }
          });

          // Auto-clear any related outstanding item when a manual match is created
          try {
            const accountingClientId = document.accountingClient.id;
            const txDate = bankTransaction.transactionDate || new Date();

            // 1) Prefer item explicitly linked to the document
            let outstanding = await prisma.outstandingItem.findFirst({
              where: {
                accountingClientId,
                status: 'OUTSTANDING',
                relatedDocumentId: document.id
              }
            });

            // 2) If none, try to find by amount and optional reference number
            if (!outstanding) {
              const amountNumber = Number(bankTransaction.amount);
              const reference = bankTransaction.referenceNumber || undefined;
              const whereAmount: any = {
                accountingClientId,
                status: 'OUTSTANDING',
                relatedDocumentId: null,
                amount: amountNumber
              };
              if (reference) {
                whereAmount.referenceNumber = reference;
              }
              outstanding = await prisma.outstandingItem.findFirst({ where: whereAmount });
            }

            if (outstanding) {
              // Recalculate days outstanding similar to updateOutstandingItem()
              const issueDate = new Date(outstanding.issueDate);
              const today = new Date();
              const daysOutstanding = Math.floor((today.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));

              await prisma.outstandingItem.update({
                where: { id: outstanding.id },
                data: {
                  status: 'CLEARED',
                  actualClearDate: new Date(txDate),
                  relatedTransactionId: bankTransaction.id,
                  daysOutstanding
                }
              });
            }
          } catch (e) {
            console.warn('⚠️ Failed to auto-clear outstanding item on manual match:', e);
          }

          if (document.type.toLowerCase().includes('invoice')) {
            const parseAmount = (value: any): number => {
              if (!value) return 0;
              if (typeof value === 'number') return value;
              const numStr = value.toString().replace(/[^0-9.,-]/g, '').replace(',', '.');
              const parsed = parseFloat(numStr);
              return isNaN(parsed) ? 0 : parsed;
            };

            let paymentSummary = await prisma.paymentSummary.findUnique({
              where: { documentId: document.id }
            });

            let totalAmount = paymentSummary ? paymentSummary.totalAmount : 0;
            if (!totalAmount && document.processedData?.extractedFields) {
              try {
                const extractedFields = typeof document.processedData.extractedFields === 'string'
                  ? JSON.parse(document.processedData.extractedFields)
                  : document.processedData.extractedFields;
                const result = (extractedFields as any).result || extractedFields;
                totalAmount = parseAmount(result?.total_amount);
              } catch (error) {
                console.error('Error parsing document total amount:', error);
              }
            }

            const transactionAmount = parseAmount(bankTransaction.amount);
            const currentPaidAmount = paymentSummary ? paymentSummary.paidAmount : 0;
            const newPaidAmount = currentPaidAmount + transactionAmount;
            const remainingAmount = totalAmount - newPaidAmount;
            let paymentStatus: PaymentStatus = PaymentStatus.UNPAID;
            if (newPaidAmount > 0) {
              if (Math.abs(remainingAmount) <= 0.01) {
                paymentStatus = PaymentStatus.FULLY_PAID;
              } else if (remainingAmount < -0.01) {
                paymentStatus = PaymentStatus.OVERPAID;
              } else if (remainingAmount > 0.01) {
                paymentStatus = PaymentStatus.PARTIALLY_PAID;
              }
            }

            if (paymentSummary) {
              await prisma.paymentSummary.update({
                where: { documentId: document.id },
                data: {
                  totalAmount,
                  paidAmount: newPaidAmount,
                  remainingAmount,
                  paymentStatus,
                  lastPaymentDate: bankTransaction.transactionDate
                }
              });
            } else {
              await prisma.paymentSummary.create({
                data: {
                  documentId: document.id,
                  totalAmount,
                  paidAmount: newPaidAmount,
                  remainingAmount,
                  paymentStatus,
                  lastPaymentDate: bankTransaction.transactionDate
                }
              });
            }

            await prisma.document.update({
              where: { id: document.id },
              data: {
                paymentStatus,
                totalPaidAmount: newPaidAmount,
                lastPaymentDate: bankTransaction.transactionDate
              }
            });
          }
      
          return reconciliationRecord;
        });
      }
      
      async createBulkMatches(matches: Array<{ documentId: number; bankTransactionId: string; notes?: string }>, user: User) {
        const results = [];
        const errors = [];
      
        for (const match of matches) {
          try {
            const result = await this.createManualMatch(match, user);
            results.push({ success: true, match, result });
          } catch (error) {
            errors.push({ success: false, match, error: error.message });
          }
        }
      
        return {
          successful: results.length,
          failed: errors.length,
          results,
          errors
        };
      }
      
      async acceptSuggestion(suggestionId: number, user: User, notes?: string) {
        return await this.prisma.$transaction(async (prisma) => {
          const suggestion = await prisma.reconciliationSuggestion.findUnique({
            where: { id: suggestionId },
            include: {
              document: {
                include: {
                  accountingClient: true,
                  processedData: true
                }
              },
              bankTransaction: {
                include: {
                  bankStatementDocument: {
                    include: {
                      accountingClient: true
                    }
                  }
                }
              }
            }
          });

          if (!suggestion) {
            throw new NotFoundException('Suggestion not found');
          }
      
          const suggestionCompanyId = suggestion.document
           ? suggestion.document.accountingClient.accountingCompanyId
           : suggestion.bankTransaction?.bankStatementDocument?.accountingClient?.accountingCompanyId;
         const userCompanyId = user.accountingCompanyId;
         if (process.env.SUGGESTIONS_DEBUG === '1') {
           console.log('🔐 Authorization check for suggestion', {
             suggestionId,
             userCompanyId,
             suggestionCompanyId
           });
         }
         if (!userCompanyId || suggestionCompanyId !== userCompanyId) {
           throw new UnauthorizedException('You do not have access to this company');
         }
         console.log('✅ Authorization passed for suggestion', suggestionId);
      
          if (suggestion.status !== SuggestionStatus.PENDING) {
            throw new Error('Suggestion is no longer pending');
          }

          // Detect TRANSFER suggestion: no document/account and matchingCriteria.transfer present
          const mc: any = (suggestion as any).matchingCriteria || {};
          const isTransfer = !suggestion.documentId && !suggestion.chartOfAccountId && !!mc.transfer;

          if (isTransfer) {
            const dbg = process.env.SUGGESTIONS_DEBUG === '1';
            if (dbg) {
              console.log('[ACCEPT TRANSFER] Suggestion', {
                suggestionId,
                sourceBankTransactionId: suggestion.bankTransactionId,
                transferMeta: mc.transfer,
              });
            }

            const sourceTx = suggestion.bankTransaction;
            if (!sourceTx) throw new NotFoundException('Source bank transaction not found');

            const destinationTransactionId: string | undefined = mc.transfer?.destinationTransactionId;
            if (!destinationTransactionId) {
              throw new BadRequestException('Transfer suggestion missing destinationTransactionId');
            }

            // Load destination transaction to authorize and proceed
            const destinationTx = await prisma.bankTransaction.findUnique({
              where: { id: destinationTransactionId },
              include: {
                bankStatementDocument: { include: { accountingClient: true } },
                bankAccount: true,
              },
            });
            if (!destinationTx) throw new NotFoundException('Destination bank transaction not found');

            const companyIdSrc = sourceTx.bankStatementDocument.accountingClient.accountingCompanyId;
            const companyIdDst = destinationTx.bankStatementDocument.accountingClient.accountingCompanyId;
            if (companyIdSrc !== user.accountingCompanyId || companyIdDst !== user.accountingCompanyId) {
              throw new UnauthorizedException('No access to one of the transactions in this transfer');
            }

            // Derive client EIN to call createTransferReconciliation()
            const accountingClientId = sourceTx.bankStatementDocument.accountingClient.id;
            const accountingClient = await prisma.accountingClients.findUnique({ where: { id: accountingClientId } });
            if (!accountingClient) throw new NotFoundException('Accounting client not found');
            const clientCompany = await prisma.clientCompany.findUnique({ where: { id: accountingClient.clientCompanyId } });
            if (!clientCompany) throw new NotFoundException('Client company not found');

            // Create transfer reconciliation via existing method (validates signs/amounts and analytics)
            const createdTransfer = await this.createTransferReconciliation(
              clientCompany.ein,
              user,
              {
                sourceTransactionId: suggestion.bankTransactionId!,
                destinationTransactionId,
                fxRate: mc.transfer?.impliedFxRate ?? null,
                notes: notes || mc.transfer?.note || `Accepted transfer suggestion (${Math.round(Number(suggestion.confidenceScore) * 100)}% confidence)`,
              }
            );

            // Mark both transactions as matched
            await prisma.bankTransaction.updateMany({
              where: { id: { in: [suggestion.bankTransactionId!, destinationTransactionId] } },
              data: { reconciliationStatus: ReconciliationStatus.MATCHED },
            });

            // Mark this suggestion accepted
            await prisma.reconciliationSuggestion.update({
              where: { id: suggestionId },
              data: { status: SuggestionStatus.ACCEPTED },
            });

            // Reject competing suggestions for either transaction
            await prisma.reconciliationSuggestion.updateMany({
              where: {
                id: { not: suggestionId },
                status: SuggestionStatus.PENDING,
                OR: [
                  { bankTransactionId: suggestion.bankTransactionId },
                  { bankTransactionId: destinationTransactionId },
                ],
              },
              data: { status: SuggestionStatus.REJECTED },
            });

            if (dbg) {
              console.log('[ACCEPT TRANSFER] Completed', {
                suggestionId,
                transferId: createdTransfer.id,
                source: suggestion.bankTransactionId,
                destination: destinationTransactionId,
              });
            }

            return createdTransfer;
          }

          // Handle ACCOUNT-CODE suggestion (transaction ↔ account), when there's no document but a chartOfAccountId exists
          if (!suggestion.documentId && suggestion.chartOfAccountId) {
            try {
              console.log('[ACCEPT ACCOUNT-CODE] Entered branch', {
                suggestionId,
                bankTransactionId: suggestion.bankTransactionId,
                chartOfAccountId: suggestion.chartOfAccountId,
              });
            } catch {}
            // Update the transaction with the chosen account code and mark as matched
            const updatedTx = await prisma.bankTransaction.update({
              where: { id: suggestion.bankTransactionId! },
              data: {
                chartOfAccountId: suggestion.chartOfAccountId,
                reconciliationStatus: ReconciliationStatus.MATCHED,
              },
            });

            // Mark this suggestion accepted and reject competing ones for the same transaction
            await prisma.reconciliationSuggestion.update({
              where: { id: suggestionId },
              data: { status: SuggestionStatus.ACCEPTED },
            });
            await prisma.reconciliationSuggestion.updateMany({
              where: {
                id: { not: suggestionId },
                bankTransactionId: suggestion.bankTransactionId!,
                status: SuggestionStatus.PENDING,
              },
              data: { status: SuggestionStatus.REJECTED },
            });

            // Post ledger entries for this accepted account-code suggestion
            try {
              const accountingClientId = suggestion.bankTransaction?.bankStatementDocument?.accountingClient?.id
                || (suggestion.document ? suggestion.document.accountingClient.id : undefined);
              if (accountingClientId) {
                const bankAccountCode = await this.resolveBankAnalyticCode(prisma as any, accountingClientId, suggestion.bankTransactionId!);
                const chart = await prisma.chartOfAccounts.findUnique({ where: { id: suggestion.chartOfAccountId } });
                const counter = chart?.accountCode?.trim() || '';
                const amt = Math.abs(Number(updatedTx.amount));
                const postingDate = updatedTx.transactionDate || new Date();
                const isCreditToBank = Number(updatedTx.amount) > 0; // money in
                const entries = isCreditToBank
                  ? [
                      { accountCode: bankAccountCode, debit: amt },
                      { accountCode: counter, credit: amt },
                    ]
                  : [
                      { accountCode: counter, debit: amt },
                      { accountCode: bankAccountCode, credit: amt },
                    ];
                try {
                  console.log('[ACCEPT ACCOUNT-CODE] Posting input', {
                    accountingClientId,
                    postingDate,
                    bankAccountCode,
                    counter,
                    amt,
                    isCreditToBank,
                    entries,
                  });
                } catch {}
                await this.postingService.postEntries({
                  accountingClientId,
                  postingDate,
                  entries,
                  sourceType: 'RECONCILIATION',
                  sourceId: String(updatedTx.id),
                  postingKey: `account-suggestion:${suggestion.id}`,
                  links: {
                    documentId: null,
                    bankTransactionId: suggestion.bankTransactionId || null,
                    reconciliationId: null,
                  },
                });
                try {
                  console.log('[ACCEPT ACCOUNT-CODE] Posting done', {
                    postingKey: `account-suggestion:${suggestion.id}`,
                    bankTransactionId: suggestion.bankTransactionId,
                  });
                } catch {}
              }
            } catch (e) {
              console.warn('⚠️ Ledger posting failed on acceptSuggestion (account-code):', e);
            }

            return updatedTx;
          }

          // Non-transfer suggestions (document ↔ transaction) continue with existing flow
          const existingMatch = await prisma.reconciliationRecord.findUnique({
            where: {
              documentId_bankTransactionId: {
                documentId: suggestion.documentId!,
                bankTransactionId: suggestion.bankTransactionId!,
              },
            },
          });
      
          if (existingMatch) {
            throw new Error('This document and transaction are already matched');
          }
      
          const reconciliationRecord = await prisma.reconciliationRecord.create({
            data: {
              documentId: suggestion.documentId,
              bankTransactionId: suggestion.bankTransactionId,
              matchType: MatchType.SUGGESTED,
              confidenceScore: suggestion.confidenceScore,
              reconciledById: user.id,
              notes: notes || `Auto-matched suggestion (${Math.round(Number(suggestion.confidenceScore) * 100)}% confidence)`
            }
          });
      
          await prisma.reconciliationSuggestion.update({
            where: { id: suggestionId },
            data: { status: SuggestionStatus.ACCEPTED }
          });
      
          await prisma.document.update({
            where: { id: suggestion.documentId },
            data: { reconciliationStatus: ReconciliationStatus.MATCHED }
          });
      
          await prisma.bankTransaction.update({
            where: { id: suggestion.bankTransactionId },
            data: { reconciliationStatus: ReconciliationStatus.MATCHED }
          });
      
          await prisma.reconciliationSuggestion.updateMany({
            where: {
              id: { not: suggestionId },
              OR: [
                { documentId: suggestion.documentId },
                { bankTransactionId: suggestion.bankTransactionId }
              ],
              status: SuggestionStatus.PENDING
            },
            data: { status: SuggestionStatus.REJECTED }
          });

          // Post ledger entries synchronously (non-transfer)
          try {
            const bankTx = await prisma.bankTransaction.findUnique({
              where: { id: suggestion.bankTransactionId! },
            });
            if (bankTx) {
              const accountingClientId = suggestion.document
                ? suggestion.document.accountingClient.id
                : suggestion.bankTransaction?.bankStatementDocument?.accountingClient?.id;
              if (accountingClientId) {
                const bankAccountCode = await this.resolveBankAnalyticCode(prisma as any, accountingClientId, suggestion.bankTransactionId!);
                const amt = Math.abs(Number(bankTx.amount));
                const postingDate = bankTx.transactionDate || new Date();
                const counter = this.inferCounterAccountCode(suggestion.document?.type);
                const isCreditToBank = Number(bankTx.amount) > 0; // money in
                const entries = isCreditToBank
                  ? [
                      { accountCode: bankAccountCode, debit: amt },
                      { accountCode: counter, credit: amt },
                    ]
                  : [
                      { accountCode: counter, debit: amt },
                      { accountCode: bankAccountCode, credit: amt },
                    ];
                await this.postingService.postEntries({
                  accountingClientId,
                  postingDate,
                  entries,
                  sourceType: 'RECONCILIATION',
                  sourceId: String(reconciliationRecord.id),
                  postingKey: `recon:${reconciliationRecord.id}`,
                  links: {
                    documentId: suggestion.documentId || null,
                    bankTransactionId: suggestion.bankTransactionId || null,
                    reconciliationId: reconciliationRecord.id,
                  },
                });
              }
            }
          } catch (e) {
            console.warn('⚠️ Ledger posting failed on acceptSuggestion:', e);
          }

          // Auto-clear any related outstanding item when a suggestion is accepted
          try {
            const doc = suggestion.document;
            const bankTx = suggestion.bankTransaction;
            const accountingClientId = doc
              ? doc.accountingClient.id
              : bankTx?.bankStatementDocument?.accountingClient?.id;

            if (accountingClientId && bankTx) {
              const txDate = bankTx.transactionDate || new Date();

              // 1) Prefer item explicitly linked to the document
              let outstanding = doc
                ? await prisma.outstandingItem.findFirst({
                    where: {
                      accountingClientId,
                      status: 'OUTSTANDING',
                      relatedDocumentId: doc.id
                    }
                  })
                : null;

              // 2) If none, try to find by amount and optional reference number
              if (!outstanding) {
                const amountNumber = Number(bankTx.amount);
                const reference = bankTx.referenceNumber || undefined;
                const whereAmount: any = {
                  accountingClientId,
                  status: 'OUTSTANDING',
                  relatedDocumentId: null,
                  amount: amountNumber
                };
                if (reference) {
                  whereAmount.referenceNumber = reference;
                }
                outstanding = await prisma.outstandingItem.findFirst({ where: whereAmount });
              }

              if (outstanding) {
                // Recalculate days outstanding similar to updateOutstandingItem()
                const issueDate = new Date(outstanding.issueDate);
                const today = new Date();
                const daysOutstanding = Math.floor((today.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));

                await prisma.outstandingItem.update({
                  where: { id: outstanding.id },
                  data: {
                    status: 'CLEARED',
                    actualClearDate: new Date(txDate),
                    relatedTransactionId: bankTx.id,
                    daysOutstanding
                  }
                });
              }
            }
          } catch (e) {
            console.warn('⚠️ Failed to auto-clear outstanding item on suggestion acceptance:', e);
          }

          console.log('💰 PAYMENT STATUS UPDATE:', {
            hasDocument: !!suggestion.document,
            documentType: suggestion.document?.type,
            isInvoice: suggestion.document?.type.toLowerCase().includes('invoice'),
            documentId: suggestion.document?.id,
            transactionAmount: suggestion.bankTransaction.amount
          });
          
          if (suggestion.document && suggestion.document.type.toLowerCase().includes('invoice')) {
            const parseAmount = (value: any): number => {
              if (!value) return 0;
              if (typeof value === 'number') return value;
              const numStr = value.toString().replace(/[^0-9.,-]/g, '').replace(',', '.');
              const parsed = parseFloat(numStr);
              return isNaN(parsed) ? 0 : parsed;
            };

            let paymentSummary = await prisma.paymentSummary.findUnique({
              where: { documentId: suggestion.document.id }
            });
            let totalAmount = paymentSummary ? paymentSummary.totalAmount : 0;
            if (!totalAmount && suggestion.document.processedData?.extractedFields) {
              try {
                const extractedFields = typeof suggestion.document.processedData.extractedFields === 'string'
                  ? JSON.parse(suggestion.document.processedData.extractedFields)
                  : suggestion.document.processedData.extractedFields;
                const result = (extractedFields as any).result || extractedFields;
                totalAmount = parseAmount(result?.total_amount);
              } catch (error) {
                console.error('Error parsing document total amount:', error);
              }
            }

            const transactionAmount = parseAmount(suggestion.bankTransaction.amount);
            const currentPaidAmount = paymentSummary ? paymentSummary.paidAmount : 0;
            const newPaidAmount = currentPaidAmount + transactionAmount;
            const remainingAmount = totalAmount - newPaidAmount;
            let paymentStatus: PaymentStatus = PaymentStatus.UNPAID;
            
            console.log('💰 PAYMENT CALCULATION:', {
              totalAmount,
              transactionAmount,
              currentPaidAmount,
              newPaidAmount,
              remainingAmount,
              hasPaymentSummary: !!paymentSummary
            });
            
            if (newPaidAmount > 0) {
              if (Math.abs(remainingAmount) <= 0.01) {
                paymentStatus = PaymentStatus.FULLY_PAID;
              } else if (remainingAmount < -0.01) {
                paymentStatus = PaymentStatus.OVERPAID;
              } else if (remainingAmount > 0.01) {
                paymentStatus = PaymentStatus.PARTIALLY_PAID;
              }
            }
            
            console.log('💰 PAYMENT STATUS RESULT:', {
              paymentStatus,
              willUpdate: !!paymentSummary,
              willCreate: !paymentSummary
            });

            if (paymentSummary) {
              const updatedPayment = await prisma.paymentSummary.update({
                where: { documentId: suggestion.document.id },
                data: {
                  totalAmount,
                  paidAmount: newPaidAmount,
                  remainingAmount,
                  paymentStatus,
                  lastPaymentDate: suggestion.bankTransaction.transactionDate
                }
              });
              console.log('✅ PAYMENT SUMMARY UPDATED:', updatedPayment);
            } else {
              const createdPayment = await prisma.paymentSummary.create({
                data: {
                  documentId: suggestion.document.id,
                  totalAmount,
                  paidAmount: newPaidAmount,
                  remainingAmount,
                  paymentStatus,
                  lastPaymentDate: suggestion.bankTransaction.transactionDate
                }
              });
              console.log('✅ PAYMENT SUMMARY CREATED:', createdPayment);
            }

            const updatedDocument = await prisma.document.update({
              where: { id: suggestion.document.id },
              data: {
                paymentStatus,
                totalPaidAmount: newPaidAmount,
                lastPaymentDate: suggestion.bankTransaction.transactionDate
              }
            });
            console.log('✅ DOCUMENT PAYMENT STATUS UPDATED:', {
              documentId: updatedDocument.id,
              paymentStatus: updatedDocument.paymentStatus,
              totalPaidAmount: updatedDocument.totalPaidAmount,
              lastPaymentDate: updatedDocument.lastPaymentDate
            });
          }
      
          return reconciliationRecord;
        });
      }
      
      async rejectSuggestion(suggestionId: number, user: User, reason?: string) {
        const suggestion = await this.prisma.reconciliationSuggestion.findUnique({
          where: { id: suggestionId },
          include: {
            document: {
              include: {
                accountingClient: true
              }
            },
            bankTransaction: {
              include: {
                bankStatementDocument: {
                  include: {
                    accountingClient: true
                  }
                }
              }
            }
          }
        });
      
        const updatedSuggestion = await this.prisma.reconciliationSuggestion.update({
          where: { id: suggestionId },
          data: { 
            status: SuggestionStatus.REJECTED,
            reasons: reason ? [...(suggestion.reasons || []), `Rejected: ${reason}`] : suggestion.reasons
          }
        });
      
        return updatedSuggestion;
      }
      
      async getBalanceReconciliationStatement(
        clientEin: string, 
        user: User, 
        startDate: string, 
        endDate: string
      ) {
        const clientCompany = await this.prisma.clientCompany.findUnique({
          where: { ein: clientEin }
        });
      
        if (!clientCompany) {
          throw new NotFoundException('Client company not found');
        }
      
        const accountingClientRelation = await this.prisma.accountingClients.findFirst({
          where: {
            accountingCompanyId: user.accountingCompanyId,
            clientCompanyId: clientCompany.id
          }
        });
      
        if (!accountingClientRelation) {
          throw new UnauthorizedException('No access to this client company');
        }
      
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // End of day
      
        // Get opening balance (balance before the start date)
        const openingBalanceTransaction = await this.prisma.bankTransaction.findFirst({
          where: {
            bankStatementDocument: { accountingClientId: accountingClientRelation.id },
            transactionDate: { lt: start },
            balanceAfter: { not: null }
          },
          orderBy: { transactionDate: 'desc' }
        });
      
        const openingBalance = openingBalanceTransaction?.balanceAfter || 0;
      
        // Get all transactions in the period
        const periodTransactions = await this.prisma.bankTransaction.findMany({
          where: {
            bankStatementDocument: { accountingClientId: accountingClientRelation.id },
            transactionDate: {
              gte: start,
              lte: end
            }
          },
          orderBy: { transactionDate: 'asc' },
          include: {
            chartOfAccount: true,
            reconciliationRecords: {
              include: {
                document: true
              }
            }
          }
        });
      
        // Calculate totals
        let totalDebits = 0;
        let totalCredits = 0;
        let reconciledDebits = 0;
        let reconciledCredits = 0;
        let unreconciledCount = 0;
      
        periodTransactions.forEach(transaction => {
          const amount = Number(transaction.amount);
          
          if (transaction.transactionType === 'DEBIT') {
            totalDebits += amount;
            if (transaction.reconciliationStatus === ReconciliationStatus.MATCHED) {
              reconciledDebits += amount;
            }
          } else {
            totalCredits += Math.abs(amount);
            if (transaction.reconciliationStatus === ReconciliationStatus.MATCHED) {
              reconciledCredits += Math.abs(amount);
            }
          }
          
          if (transaction.reconciliationStatus === ReconciliationStatus.UNRECONCILED) {
            unreconciledCount++;
          }
        });
      
        // Get closing balance (last transaction's balance after)
        const closingBalanceTransaction = await this.prisma.bankTransaction.findFirst({
          where: {
            bankStatementDocument: { accountingClientId: accountingClientRelation.id },
            transactionDate: { lte: end },
            balanceAfter: { not: null }
          },
          orderBy: { transactionDate: 'desc' }
        });
      
        const actualClosingBalance = closingBalanceTransaction?.balanceAfter || 0;
        
        // Calculate expected closing balance
        const calculatedClosingBalance = Number(openingBalance) + totalDebits - totalCredits;
        
        // Calculate reconciliation difference
        const reconciliationDifference = Number(actualClosingBalance) - calculatedClosingBalance;
        
        // Reconciliation status
        const isBalanced = Math.abs(reconciliationDifference) < 0.01; // Allow for rounding differences
        const reconciliationPercentage = periodTransactions.length > 0 
          ? ((periodTransactions.length - unreconciledCount) / periodTransactions.length) * 100 
          : 100;
      
        return {
          period: {
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0]
          },
          balances: {
            openingBalance: Number(openingBalance),
            actualClosingBalance: Number(actualClosingBalance),
            calculatedClosingBalance,
            difference: reconciliationDifference,
            isBalanced: Math.abs(reconciliationDifference) < 0.01
          },
          transactions: {
            total: periodTransactions.length,
            totalDebits,
            totalCredits,
            reconciledCount: periodTransactions.length - unreconciledCount,
            reconciledPercentage: periodTransactions.length > 0 ? ((periodTransactions.length - unreconciledCount) / periodTransactions.length) * 100 : 0
          },
          reconciliationStatus: {
            isBalanced: Math.abs(reconciliationDifference) < 0.01,
            reconciledPercentage: periodTransactions.length > 0 ? ((periodTransactions.length - unreconciledCount) / periodTransactions.length) * 100 : 0
          },
          transactionDetails: periodTransactions.map(t => ({
            id: t.id,
            date: t.transactionDate,
            description: t.description,
            amount: Number(t.amount),
            type: t.transactionType,
            balanceAfter: t.balanceAfter ? Number(t.balanceAfter) : null,
            reconciliationStatus: t.reconciliationStatus,
            chartOfAccount: t.chartOfAccount ? {
              code: t.chartOfAccount.accountCode,
              name: t.chartOfAccount.accountName
            } : null,
            reconciliationRecords: t.reconciliationRecords.map(r => ({
              id: r.id,
              document: r.document ? {
                id: r.document.id,
                name: r.document.name,
                type: r.document.type
              } : null
            }))
          }))
        };
      }
      
      async unreconcileTransaction(transactionId: string, user: User, reason?: string) {
        // Find the transaction and verify access
        const transaction = await this.prisma.bankTransaction.findUnique({
          where: { id: transactionId },
          include: {
            bankStatementDocument: {
              include: {
                accountingClient: true
              }
            },
            reconciliationRecords: {
              include: {
                document: true
              }
            }
          }
        });
      
        if (!transaction) {
          throw new NotFoundException('Transaction not found');
        }
      
        // Verify user has access to this transaction's client
        if (transaction.bankStatementDocument.accountingClient.accountingCompanyId !== user.accountingCompanyId) {
          throw new UnauthorizedException('No access to this transaction');
        }
      
        // Check if transaction is currently reconciled
        if (transaction.reconciliationStatus !== ReconciliationStatus.MATCHED) {
          throw new BadRequestException('Transaction is not currently reconciled');
        }
      
        console.log(`🔄 UNRECONCILING transaction ${transactionId} - Amount: ${transaction.amount}`);
      
        // Start a database transaction to ensure consistency
        const result = await this.prisma.$transaction(async (prisma) => {
          // Update transaction status to unreconciled
          const updatedTransaction = await prisma.bankTransaction.update({
            where: { id: transactionId },
            data: { 
              reconciliationStatus: ReconciliationStatus.UNRECONCILED
            }
          });

          // Find and update any associated documents through reconciliation records
          const reconciliationRecords = transaction.reconciliationRecords;
          for (const record of reconciliationRecords) {
            if (record.documentId) {
              await prisma.document.update({
                where: { id: record.documentId },
                data: { 
                  reconciliationStatus: ReconciliationStatus.UNRECONCILED
                }
              });
              console.log(`📄 Updated document ${record.documentId} status to UNRECONCILED`);
            }
          }

          // Remove reconciliation records for this transaction
          await prisma.reconciliationRecord.deleteMany({
            where: { bankTransactionId: transactionId }
          });

          // Remove any payment summary entries for documents associated with this transaction
          const documentIds = reconciliationRecords.map(record => record.documentId).filter(Boolean);
          const deletedPayments = await prisma.paymentSummary.deleteMany({
            where: { documentId: { in: documentIds } }
          });

          console.log(`💰 Removed ${deletedPayments.count} payment summary entries for transaction ${transactionId}`);

          console.log(`✅ Successfully unreconciled transaction ${transactionId}${reason ? ` - Reason: ${reason}` : ''}`);

          return updatedTransaction;
        });

        // Reverse any postings linked to this transaction/reconciliation
        try {
          const accountingClientId = transaction.bankStatementDocument.accountingClient.id;
          // Unpost by reconciliation records (document + transaction matches)
          if (Array.isArray(transaction.reconciliationRecords)) {
            for (const rec of transaction.reconciliationRecords) {
              if (rec?.id) {
                await this.postingService.unpostByLinks({
                  accountingClientId,
                  reconciliationId: rec.id,
                });
              }
            }
          }
          // Also unpost any manual postings tied only to the bankTransactionId
          await this.postingService.unpostByLinks({
            accountingClientId,
            bankTransactionId: transactionId,
          });
        } catch (unpostErr) {
          console.warn(`⚠️ Failed to unpost ledger entries for transaction ${transactionId}:`, unpostErr);
        }

        try {
          console.log(`🔄 REGENERATING SUGGESTIONS after unreconciling transaction ${transactionId}`);
          const accountingClientId = transaction.bankStatementDocument.accountingClient.id;
          await this.dataExtractionService.generateReconciliationSuggestions(accountingClientId);
          console.log(`✅ Successfully regenerated suggestions after unreconciling transaction ${transactionId}`);
        } catch (error) {
          console.error(`❌ Failed to regenerate suggestions after unreconciling transaction ${transactionId}:`, error);
        }

        return result;
      }
      
      async unreconcileDocument(documentId: number, user: User, reason?: string) {
        const document = await this.prisma.document.findUnique({
          where: { id: documentId },
          include: {
            accountingClient: true,
            reconciliationRecords: {
              include: {
                bankTransaction: true
              }
            }
          }
        });
      
        if (!document) {
          throw new NotFoundException('Document not found');
        }
      
        // Verify user has access to this document's client
        if (document.accountingClient.accountingCompanyId !== user.accountingCompanyId) {
          throw new UnauthorizedException('No access to this document');
        }
      
        // Check if document is currently reconciled
        if (!['AUTO_MATCHED', 'MANUALLY_MATCHED', 'MATCHED'].includes(document.reconciliationStatus)) {
          throw new BadRequestException('Document is not currently reconciled');
        }
      
        console.log(`🔄 UNRECONCILING document ${documentId} - Type: ${document.type}`);
      
        // Start a database transaction to ensure consistency
        const updated = await this.prisma.$transaction(async (prisma) => {
          // Update document status to unreconciled
          const updatedDocument = await prisma.document.update({
            where: { id: documentId },
            data: { 
              reconciliationStatus: ReconciliationStatus.UNRECONCILED
            }
          });
      
          // Find and update any associated transactions through reconciliation records
          const reconciliationRecords = document.reconciliationRecords;
          for (const record of reconciliationRecords) {
            if (record.bankTransactionId) {
              await prisma.bankTransaction.update({
                where: { id: record.bankTransactionId },
                data: { 
                  reconciliationStatus: ReconciliationStatus.UNRECONCILED
                }
              });
              console.log(`💳 Updated transaction ${record.bankTransactionId} status to UNRECONCILED`);
            }
          }
      
          // Remove reconciliation records for this document
          await prisma.reconciliationRecord.deleteMany({
            where: { documentId: documentId }
          });
      
          // Remove any payment summary entries for this document
          const deletedPayments = await prisma.paymentSummary.deleteMany({
            where: { documentId: documentId }
          });
      
          console.log(`💰 Removed ${deletedPayments.count} payment summary entries for document ${documentId}`);
      
          // Log the unreconciliation action
          console.log(`✅ Successfully unreconciled document ${documentId}${reason ? ` - Reason: ${reason}` : ''}`);
      
          return updatedDocument;
        });
        // Reverse any postings linked to this document/reconciliation
        try {
          const accountingClientId = document.accountingClient.id;
          // Unpost by reconciliation records tying this doc to transactions
          if (Array.isArray(document.reconciliationRecords)) {
            for (const rec of document.reconciliationRecords) {
              if (rec?.id) {
                await this.postingService.unpostByLinks({
                  accountingClientId,
                  reconciliationId: rec.id,
                });
              }
            }
          }
          // Also unpost any postings tied directly to the documentId
          await this.postingService.unpostByLinks({
            accountingClientId,
            documentId,
          });
        } catch (unpostErr) {
          console.warn(`⚠️ Failed to unpost ledger entries for document ${documentId}:`, unpostErr);
        }
        return updated;
      }
      
      async regenerateAllSuggestions(clientEin: string, user: User) {
        const clientCompany = await this.prisma.clientCompany.findUnique({
          where: { ein: clientEin }
        });
      
        if (!clientCompany) {
          throw new NotFoundException('Client company not found');
        }
      
        const accountingClientRelation = await this.prisma.accountingClients.findFirst({
          where: {
            accountingCompanyId: user.accountingCompanyId,
            clientCompanyId: clientCompany.id
          }
        });
      
        if (!accountingClientRelation) {
          throw new UnauthorizedException('No access to this client company');
        }
        
        console.log(`🔄 FORCE REGENERATING ALL SUGGESTIONS for client ${clientEin}`);
        
        // Force regenerate all suggestions
        await this.dataExtractionService.generateReconciliationSuggestions(accountingClientRelation.id);
        
        return { message: 'All suggestions regenerated successfully' };
      }
      
      async regenerateTransactionSuggestions(transactionId: string, user: User) {
        const transaction = await this.prisma.bankTransaction.findUnique({
          where: { id: transactionId },
          include: {
            bankStatementDocument: {
              include: {
                accountingClient: true
              }
            }
          }
        });
        
        if (!transaction) {
          throw new NotFoundException('Transaction not found');
        }
        
        const transactionCompanyId = transaction.bankStatementDocument.accountingClient.accountingCompanyId;
        if (transactionCompanyId !== user.accountingCompanyId) {
          throw new UnauthorizedException('No access to this transaction');
        }
        
        console.log(`🔄 REGENERATING SUGGESTIONS for transaction ${transactionId}`);
        
        // Delete existing suggestions for this transaction
        await this.prisma.reconciliationSuggestion.deleteMany({
          where: {
            bankTransactionId: transactionId,
            status: SuggestionStatus.PENDING
          }
        });
        
        // Regenerate suggestions for this specific transaction
        await this.dataExtractionService.generateReconciliationSuggestions(
          transaction.bankStatementDocument.accountingClientId
        );
        // After regeneration, if transfer candidates exist, avoid showing standalone account-code suggestions
        try {
          const pendingStandalone = await this.prisma.reconciliationSuggestion.findMany({
            where: {
              bankTransactionId: transactionId,
              status: SuggestionStatus.PENDING,
              documentId: null,
              chartOfAccountId: { not: null }
            },
            select: { id: true }
          });

          if (pendingStandalone.length > 0) {
            // Fetch client EIN
            const clientCompany = await this.prisma.clientCompany.findUnique({
              where: { id: transaction.bankStatementDocument.accountingClient.clientCompanyId },
              select: { ein: true }
            });
            const clientEin = clientCompany?.ein || '';
            const candidates = await this.getTransferReconciliationCandidatesForTransaction(
              clientEin,
              user,
              transactionId,
              {
                daysWindow: 3,
                maxResults: 50,
                allowCrossCurrency: true,
              }
            );

            if (Array.isArray(candidates) && candidates.length > 0) {
              await this.prisma.reconciliationSuggestion.deleteMany({
                where: {
                  id: { in: pendingStandalone.map(s => s.id) }
                }
              });
              console.log(`🧹 Removed ${pendingStandalone.length} standalone account-code suggestions for transaction ${transactionId} due to available transfer candidates (${candidates.length}).`);
            } else {
              console.log(`ℹ️ No transfer candidates found for transaction ${transactionId}; keeping ${pendingStandalone.length} standalone account-code suggestions.`);
            }
          }
        } catch (postProcessErr) {
          console.warn(`⚠️ Post-regeneration transfer check failed for transaction ${transactionId}:`, postProcessErr);
        }

        return { message: 'Transaction suggestions regenerated successfully' };
      }

    async getReconciliationSummaryReport(clientEin: string, user: User, month: string, year: string) {
      const clientCompany = await this.prisma.clientCompany.findUnique({
        where: { ein: clientEin }
      });
    
      if (!clientCompany) {
        throw new NotFoundException('Client company not found');
      }
    
      const accountingClientRelation = await this.prisma.accountingClients.findFirst({
        where: {
          accountingCompanyId: user.accountingCompanyId,
          clientCompanyId: clientCompany.id
        }
      });
    
      if (!accountingClientRelation) {
        throw new UnauthorizedException('No access to this client company');
      }
    
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0);
    
      const [documentsStats, transactionsStats, reconciliationRecords] = await Promise.all([
        this.prisma.document.groupBy({
          by: ['reconciliationStatus'],
          where: {
            accountingClientId: accountingClientRelation.id,
            type: { in: ['Invoice', 'Receipt', 'Payment Order', 'Collection Order', 'Z Report'] },
            createdAt: { gte: startDate, lte: endDate }
          },
          _count: { id: true },
          _sum: { 
          }
        }),
    
        this.prisma.bankTransaction.groupBy({
          by: ['reconciliationStatus', 'transactionType'],
          where: {
            bankStatementDocument: {
              accountingClientId: accountingClientRelation.id
            },
            transactionDate: { gte: startDate, lte: endDate }
          },
          _count: { id: true },
          _sum: { amount: true }
        }),
    
        this.prisma.reconciliationRecord.findMany({
          where: {
            reconciledAt: { gte: startDate, lte: endDate },
            document: {
              accountingClientId: accountingClientRelation.id
            }
          },
          include: {
            document: { include: { processedData: true } },
            bankTransaction: true,
            reconciledBy: { select: { name: true } }
          }
        })
      ]);
    
      const documentsWithAmounts = await this.prisma.document.findMany({
        where: {
          accountingClientId: accountingClientRelation.id,
          type: { in: ['Invoice', 'Receipt', 'Payment Order', 'Collection Order', 'Z Report'] },
          createdAt: { gte: startDate, lte: endDate }
        },
        include: { processedData: true }
      });
    
      const documentsSummary = {
        matched: { count: 0, amount: 0 },
        unmatched: { count: 0, amount: 0 },
        total: { count: 0, amount: 0 }
      };
    
      documentsWithAmounts.forEach(doc => {
        let amount = 0;
        try {
          const extractedFields = doc.processedData?.extractedFields;
          if (typeof extractedFields === 'string') {
            const parsed = JSON.parse(extractedFields);
            amount = parsed.result?.total_amount || parsed.total_amount || 0;
          } else if (extractedFields && typeof extractedFields === 'object') {
            const result = (extractedFields as any).result || extractedFields;
            amount = result.total_amount || 0;
          }
        } catch (e) {}
    
        documentsSummary.total.count++;
        documentsSummary.total.amount += Number(amount);
    
        if (doc.reconciliationStatus === 'MATCHED') {
          documentsSummary.matched.count++;
          documentsSummary.matched.amount += Number(amount);
        } else {
          documentsSummary.unmatched.count++;
          documentsSummary.unmatched.amount += Number(amount);
        }
      });
    
      const transactionsSummary = {
        matched: { count: 0, debit: 0, credit: 0 },
        unmatched: { count: 0, debit: 0, credit: 0 },
        total: { count: 0, debit: 0, credit: 0 }
      };
    
      transactionsStats.forEach(stat => {
        const amount = Number(stat._sum.amount) || 0;
        const count = stat._count.id;
        
        transactionsSummary.total.count += count;
        
        if (stat.transactionType === 'DEBIT') {
          transactionsSummary.total.debit += Math.abs(amount);
          if (stat.reconciliationStatus === 'MATCHED') {
            transactionsSummary.matched.count += count;
            transactionsSummary.matched.debit += Math.abs(amount);
          } else {
            transactionsSummary.unmatched.count += count;
            transactionsSummary.unmatched.debit += Math.abs(amount);
          }
        } else {
          transactionsSummary.total.credit += amount;
          if (stat.reconciliationStatus === 'MATCHED') {
            transactionsSummary.matched.count += count;
            transactionsSummary.matched.credit += amount;
          } else {
            transactionsSummary.unmatched.count += count;
            transactionsSummary.unmatched.credit += amount;
          }
        }
      });
    
      return {
        period: `${month}/${year}`,
        companyName: clientCompany.name,
        companyEin: clientCompany.ein,
        documents: documentsSummary,
        transactions: transactionsSummary,
        reconciliationActivity: reconciliationRecords.map(record => ({
          documentName: record.document.name,
          transactionDescription: record.bankTransaction.description,
          amount: record.bankTransaction.amount,
          matchType: record.matchType,
          reconciledBy: record.reconciledBy?.name,
          reconciledAt: record.reconciledAt
        })),
        reconciliationRate: {
          documents: documentsSummary.total.count > 0 ? 
            (documentsSummary.matched.count / documentsSummary.total.count) * 100 : 0,
          transactions: transactionsSummary.total.count > 0 ? 
            (transactionsSummary.matched.count / transactionsSummary.total.count) * 100 : 0
        }
      };
    }
    
    async getAccountAttributionReport(clientEin: string, user: User, month: string, year: string) {
      const clientCompany = await this.prisma.clientCompany.findUnique({
        where: { ein: clientEin }
      });
    
      if (!clientCompany) {
        throw new NotFoundException('Client company not found');
      }
    
      const accountingClientRelation = await this.prisma.accountingClients.findFirst({
        where: {
          accountingCompanyId: user.accountingCompanyId,
          clientCompanyId: clientCompany.id
        }
      });
    
      if (!accountingClientRelation) {
        throw new UnauthorizedException('No access to this client company');
      }
    
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0);
    
      const transactionsWithAccounts = await this.prisma.bankTransaction.findMany({
        where: {
          bankStatementDocument: {
            accountingClientId: accountingClientRelation.id
          },
          transactionDate: { gte: startDate, lte: endDate }
        },
        include: {
          chartOfAccount: true,
          bankStatementDocument: true
        }
      });
    
      const accountBreakdown = {};
      const unassignedTransactions = [];
      let totalDebit = 0;
      let totalCredit = 0;
    
      transactionsWithAccounts.forEach(transaction => {
        const amount = Number(transaction.amount);
        
        if (transaction.transactionType === 'DEBIT') {
          totalDebit += Math.abs(amount);
        } else {
          totalCredit += amount;
        }
    
        if (transaction.chartOfAccount) {
          const accountCode = transaction.chartOfAccount.accountCode;
          if (!accountBreakdown[accountCode]) {
            accountBreakdown[accountCode] = {
              accountCode,
              accountName: transaction.chartOfAccount.accountName,
              accountType: transaction.chartOfAccount.accountType,
              debit: 0,
              credit: 0,
              count: 0,
              transactions: []
            };
          }
        
          if (transaction.transactionType === 'DEBIT') {
            accountBreakdown[accountCode].debit += Math.abs(amount);
          } else {
            accountBreakdown[accountCode].credit += amount;
          }
          
          accountBreakdown[accountCode].count++;
          accountBreakdown[accountCode].transactions.push({
            id: transaction.id,
            date: transaction.transactionDate,
            description: transaction.description,
            amount: amount,
            type: transaction.transactionType
          });
        } else {
          unassignedTransactions.push({
            id: transaction.id,
            date: transaction.transactionDate,
            description: transaction.description,
            amount: amount,
            type: transaction.transactionType,
            isStandalone: transaction.isStandalone
          });
        }
      });
    
      return {
        period: `${month}/${year}`,
        companyName: clientCompany.name,
        companyEin: clientCompany.ein,
        summary: {
          totalDebit,
          totalCredit,
          netPosition: totalCredit - totalDebit,
          totalTransactions: transactionsWithAccounts.length,
          assignedTransactions: transactionsWithAccounts.length - unassignedTransactions.length,
          unassignedTransactions: unassignedTransactions.length
        },
        accountBreakdown: Object.values(accountBreakdown),
        unassignedTransactions,
        chartOfAccountsUsage: Object.keys(accountBreakdown).length
      };
    }
    
    async getExceptionReport(clientEin: string, user: User, month: string, year: string) {
      const clientCompany = await this.prisma.clientCompany.findUnique({
        where: { ein: clientEin }
      });
    
      if (!clientCompany) {
        throw new NotFoundException('Client company not found');
      }
    
      const accountingClientRelation = await this.prisma.accountingClients.findFirst({
        where: {
          accountingCompanyId: user.accountingCompanyId,
          clientCompanyId: clientCompany.id
        }
      });
    
      if (!accountingClientRelation) {
        throw new UnauthorizedException('No access to this client company');
      }
    
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0);
      const today = new Date();
      const thresholdDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
      const [oldUnmatchedDocuments, oldUnmatchedTransactions, largeDiscrepancies, complianceIssues] = await Promise.all([
        this.prisma.document.findMany({
          where: {
            accountingClientId: accountingClientRelation.id,
            type: { in: ['Invoice', 'Receipt', 'Payment Order', 'Collection Order', 'Z Report'] },
            reconciliationStatus: 'UNRECONCILED',
            createdAt: { lt: thresholdDate, gte: startDate, lte: endDate }
          },
          include: { processedData: true }
        }),
    
        this.prisma.bankTransaction.findMany({
          where: {
            bankStatementDocument: {
              accountingClientId: accountingClientRelation.id
            },
            reconciliationStatus: 'UNRECONCILED',
            transactionDate: { lt: thresholdDate, gte: startDate, lte: endDate }
          },
          include: { bankStatementDocument: true }
        }),
    
        this.prisma.bankTransaction.findMany({
          where: {
            bankStatementDocument: {
              accountingClientId: accountingClientRelation.id
            },
            transactionDate: { gte: startDate, lte: endDate },
            OR: [
              { amount: { gt: 10000 } },
              { amount: { lt: -10000 } }
            ]
          }
        }),
    
        this.prisma.complianceValidation.findMany({
          where: {
            document: {
              accountingClientId: accountingClientRelation.id,
              createdAt: { gte: startDate, lte: endDate }
            },
            overallStatus: { in: ['NON_COMPLIANT', 'WARNING'] }
          },
          include: {
            document: true
          }
        })
      ]);
    
      return {
        period: `${month}/${year}`,
        companyName: clientCompany.name,
        companyEin: clientCompany.ein,
        summary: {
          oldUnmatchedDocuments: oldUnmatchedDocuments.length,
          oldUnmatchedTransactions: oldUnmatchedTransactions.length,
          largeTransactions: largeDiscrepancies.length,
          complianceIssues: complianceIssues.length
        },
        exceptions: {
          oldUnmatchedDocuments: oldUnmatchedDocuments.map(doc => {
            let amount = 0;
            try {
              const extractedFields = doc.processedData?.extractedFields;
              if (typeof extractedFields === 'string') {
                const parsed = JSON.parse(extractedFields);
                amount = parsed.result?.total_amount || parsed.total_amount || 0;
              } else if (extractedFields && typeof extractedFields === 'object') {
                const result = (extractedFields as any).result || extractedFields;
                amount = result.total_amount || 0;
              }
            } catch (e) {}
        
            return {
              id: doc.id,
              name: doc.name,
              type: doc.type,
              amount: Number(amount),
              createdAt: doc.createdAt,
              daysOld: Math.floor((today.getTime() - doc.createdAt.getTime()) / (1000 * 60 * 60 * 24))
            };
          }),
          oldUnmatchedTransactions: oldUnmatchedTransactions.map(txn => ({
            id: txn.id,
            description: txn.description,
            amount: txn.amount,
            transactionDate: txn.transactionDate,
            daysOld: Math.floor((today.getTime() - txn.transactionDate.getTime()) / (1000 * 60 * 60 * 24))
          })),
          largeTransactions: largeDiscrepancies.map(txn => ({
            id: txn.id,
            description: txn.description,
            amount: txn.amount,
            transactionDate: txn.transactionDate,
            reconciliationStatus: txn.reconciliationStatus
          })),
          complianceIssues: complianceIssues.map(issue => ({
            documentId: issue.document.id,
            documentName: issue.document.name,
            status: issue.overallStatus,
            errors: issue.errors,
            warnings: issue.warnings
          }))
        }
      };
    }

    private extractDocumentAmount(document: any): number {
      if (!document?.processedData?.extractedFields) {
        console.log(`📊 No processedData for document ${document.id} (${document.name})`);
        return 0;
      }

      try {
        const extractedFields = typeof document.processedData.extractedFields === 'string'
          ? JSON.parse(document.processedData.extractedFields)
          : document.processedData.extractedFields;

        const documentData = extractedFields.result || extractedFields || {};
        
        console.log(`📊 Extracting amount for ${document.type} document ${document.id} (${document.name})`);
        console.log(`📊 Available keys: ${Object.keys(documentData).join(', ')}`);

        let amount = this.parseAmount(documentData.total_amount);
        if (amount !== 0) {
          console.log(`📊 Found amount ${amount} in total_amount for ${document.name}`);
          return Math.abs(amount);
        }

        const candidateKeys = [
          'amount', 'value', 'payment_amount', 'transaction_amount',
          'grand_total', 'total_z', 'sum', 'net_amount', 'final_amount'
        ];

        for (const key of candidateKeys) {
          if (documentData[key]) {
            amount = this.parseAmount(documentData[key]);
            if (amount !== 0) {
              console.log(`📊 Found amount ${amount} in field '${key}' for ${document.name}`);
              return Math.abs(amount);
            }
          }
        }

        console.log(`📊 No valid amount found for ${document.name}`);
        return 0;
      } catch (error) {
        console.error(`Error extracting document amount for document ${document.id}:`, error);
        return 0;
      }
    }

    private parseAmount(amount: any): number {
      if (!amount) return 0;
      
      if (typeof amount === 'number') {
        return amount;
      }
      
      if (typeof amount === 'string') {
        const cleaned = amount.replace(/[^\d.-]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
      }
      
      return 0;
    }

    async createManualAccountReconciliation(
      transactionId: string,
      accountCode: string,
      notes: string,
      user: User
    ) {
      const transaction = await this.prisma.bankTransaction.findUnique({
        where: { id: transactionId },
        include: {
          bankStatementDocument: {
            include: {
              accountingClient: {
                include: {
                  clientCompany: true
                }
              }
            }
          }
        }
      });

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      const accountingClientRelation = await this.prisma.accountingClients.findFirst({
        where: {
          accountingCompanyId: user.accountingCompanyId,
          clientCompanyId: transaction.bankStatementDocument.accountingClient.clientCompany.id
        }
      });

      if (!accountingClientRelation) {
        throw new UnauthorizedException('No access to this client company');
      }

      let chartOfAccount = await this.prisma.chartOfAccounts.findFirst({
        where: {
          accountCode: accountCode.trim()
        }
      });

      if (!chartOfAccount) {
        chartOfAccount = await this.prisma.chartOfAccounts.create({
          data: {
            accountCode: accountCode.trim(),
            accountName: `Account ${accountCode.trim()}`,
            accountType: 'ASSETS' 
          }
        });
      }

      const updatedTransaction = await this.prisma.bankTransaction.update({
        where: { id: transactionId },
        data: {
          chartOfAccountId: chartOfAccount.id,
          reconciliationStatus: ReconciliationStatus.MATCHED,
          accountingNotes: notes || null
        }
      });

      await this.prisma.reconciliationSuggestion.updateMany({
        where: {
          bankTransactionId: transactionId,
          status: SuggestionStatus.PENDING
        },
        data: {
          status: SuggestionStatus.REJECTED
        }
      });

      console.log(`✅ Manual account reconciliation created: Transaction ${transactionId} → Account ${accountCode}`);

      // Post ledger entries for manual reconciliation
      try {
        const accountingClientId = transaction.bankStatementDocument.accountingClient.id;
        const bankAccountCode = await this.resolveBankAnalyticCode(this.prisma, accountingClientId, transactionId);
        const amt = Math.abs(Number(transaction.amount));
        const postingDate = transaction.transactionDate || new Date();
        const isCreditToBank = Number(transaction.amount) > 0;
        const counter = accountCode.trim();
        const entries = isCreditToBank
          ? [
              { accountCode: bankAccountCode, debit: amt },
              { accountCode: counter, credit: amt },
            ]
          : [
              { accountCode: counter, debit: amt },
              { accountCode: bankAccountCode, credit: amt },
            ];
        await this.postingService.postEntries({
          accountingClientId,
          postingDate,
          entries,
          sourceType: 'RECONCILIATION',
          sourceId: String(updatedTransaction.id),
          postingKey: `manual:${transactionId}:${counter}:${postingDate.toISOString().slice(0,10)}`,
          links: {
            documentId: null,
            bankTransactionId: transactionId,
            reconciliationId: null,
          },
        });
      } catch (e) {
        console.warn('⚠️ Ledger posting failed on manual reconciliation:', e);
      }

      return {
        success: true,
        transaction: updatedTransaction,
        chartOfAccount,
        message: 'Transaction successfully reconciled with account code'
      };
    }

    async getBankReconciliationSummaryReport(clientEin: string, user: User, startDate?: string, endDate?: string) {
      const clientCompany = await this.prisma.clientCompany.findUnique({
        where: { ein: clientEin }
      });

      if (!clientCompany) {
        throw new NotFoundException('Client company not found');
      }

      const accountingClientRelation = await this.prisma.accountingClients.findFirst({
        where: {
          accountingCompanyId: user.accountingCompanyId,
          clientCompanyId: clientCompany.id
        }
      });

      if (!accountingClientRelation) {
        throw new UnauthorizedException('No access to this client company');
      }

      // Default to current month if no dates provided
      const now = new Date();
      const defaultStartDate = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const defaultEndDate = endDate || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      // Get balance reconciliation data
      const balanceData = await this.getBalanceReconciliationStatement(clientEin, user, defaultStartDate, defaultEndDate);

      // Get reconciliation statistics
      const stats = await this.getReconciliationStats(clientEin, user);

      // Get outstanding items count by age (simplified)
      const outstandingItemsCount = {
        totalItems: 0,
        totalAmount: 0,
        byAge: {
          current: 0,
          thirtyDays: 0,
          sixtyDays: 0,
          ninetyDays: 0,
          overNinety: 0
        }
      };

      // Get recent reconciliation activity (simplified)
      const recentActivity = await this.prisma.reconciliationSuggestion.findMany({
        where: {
          bankTransaction: {
            bankStatementDocument: {
              accountingClientId: accountingClientRelation.id
            }
          },
          createdAt: {
            gte: new Date(defaultStartDate),
            lte: new Date(defaultEndDate + 'T23:59:59.999Z')
          }
        },
        select: {
          id: true,
          createdAt: true,
          status: true,
          documentId: true,
          bankTransactionId: true,
          chartOfAccountId: true,
          confidenceScore: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      return {
        summary: {
          period: {
            startDate: defaultStartDate,
            endDate: defaultEndDate
          },
          balances: balanceData.balances,
          reconciliationHealth: {
            documentsReconciled: stats.documents.reconciled,
            totalDocuments: stats.documents.total,
            transactionsReconciled: stats.transactions.reconciled,
            totalTransactions: stats.transactions.total,
            pendingSuggestions: stats.suggestions.pending,
            documentReconciliationRate: stats.documents.total > 0 ? (stats.documents.reconciled / stats.documents.total) * 100 : 0,
            transactionReconciliationRate: stats.transactions.total > 0 ? (stats.transactions.reconciled / stats.transactions.total) * 100 : 0
          },
          outstandingItemsSummary: {
            total: outstandingItemsCount.totalItems,
            totalAmount: outstandingItemsCount.totalAmount,
            byAge: outstandingItemsCount.byAge
          }
        },
        recentActivity: recentActivity.map(activity => ({
          id: activity.id,
          timestamp: activity.createdAt,
          action: 'SUGGESTION_CREATED',
          description: `Reconciliation suggestion created with ${(Number(activity.confidenceScore) * 100).toFixed(1)}% confidence`,
          details: {
            documentId: activity.documentId,
            transactionId: activity.bankTransactionId,
            chartOfAccountId: activity.chartOfAccountId,
            confidence: Number(activity.confidenceScore),
            status: activity.status
          },
          relatedItems: {
            documentId: activity.documentId,
            transactionId: activity.bankTransactionId,
            chartOfAccountId: activity.chartOfAccountId
          }
        })),
        generatedAt: new Date().toISOString()
      };
    }

    async getReconciliationHistoryAndAuditTrail(clientEin: string, user: User, startDate?: string, endDate?: string, page: number = 1, size: number = 50) {
      const clientCompany = await this.prisma.clientCompany.findUnique({
        where: { ein: clientEin }
      });

      if (!clientCompany) {
        throw new NotFoundException('Client company not found');
      }

      const accountingClientRelation = await this.prisma.accountingClients.findFirst({
        where: {
          accountingCompanyId: user.accountingCompanyId,
          clientCompanyId: clientCompany.id
        }
      });

      if (!accountingClientRelation) {
        throw new UnauthorizedException('No access to this client company');
      }

      // Build date filter
      const dateFilter: any = {};
      if (startDate) {
        dateFilter.gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.lte = new Date(endDate + 'T23:59:59.999Z');
      }

      const whereClause: any = {
        accountingClientId: accountingClientRelation.id
      };

      if (Object.keys(dateFilter).length > 0) {
        whereClause.createdAt = dateFilter;
      }

      // Get total count for pagination
      const totalCount = await this.prisma.reconciliationSuggestion.count({
        where: whereClause
      });

      // Get reconciliation suggestions for audit trail
      const reconciliations = await this.prisma.reconciliationSuggestion.findMany({
        where: whereClause,
        select: {
          id: true,
          createdAt: true,
          status: true,
          confidenceScore: true,
          documentId: true,
          bankTransactionId: true,
          chartOfAccountId: true,
          matchingCriteria: true,
          reasons: true
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size
      });

      // Get reconciliation suggestions history (simplified for now)
      const suggestionsHistory = await this.prisma.reconciliationSuggestion.findMany({
        where: {
          ...whereClause,
          status: { in: ['ACCEPTED', 'REJECTED'] }
        },
        select: {
          id: true,
          createdAt: true,
          status: true,
          documentId: true,
          bankTransactionId: true,
          chartOfAccountId: true
        },
        orderBy: { createdAt: 'desc' },
        take: 100 // Limit suggestions history
      });

      // Format audit trail entries (simplified)
      const auditTrail = [
        // Reconciliation suggestions
        ...reconciliations.map(rec => ({
          id: rec.id,
          timestamp: rec.createdAt,
          action: 'RECONCILIATION_SUGGESTION',
          description: `Reconciliation suggestion created with ${(Number(rec.confidenceScore) * 100).toFixed(1)}% confidence`,
          details: {
            suggestionId: rec.id,
            documentId: rec.documentId,
            transactionId: rec.bankTransactionId,
            chartOfAccountId: rec.chartOfAccountId,
            confidence: Number(rec.confidenceScore),
            status: rec.status,
            reasons: rec.reasons
          },
          user: 'System',
          relatedItems: {
            documentId: rec.documentId,
            transactionId: rec.bankTransactionId,
            chartOfAccountId: rec.chartOfAccountId
          }
        })),
        // Suggestion history
        ...suggestionsHistory.map(suggestion => ({
          id: `suggestion-${suggestion.id}`,
          timestamp: suggestion.createdAt,
          action: suggestion.status === 'ACCEPTED' ? 'SUGGESTION_ACCEPTED' : 'SUGGESTION_REJECTED',
          description: `Reconciliation suggestion ${suggestion.status.toLowerCase()}`,
          details: {
            suggestionId: suggestion.id,
            documentId: suggestion.documentId,
            transactionId: suggestion.bankTransactionId,
            chartOfAccountId: suggestion.chartOfAccountId,
            status: suggestion.status
          },
          user: 'System',
          relatedItems: {
            documentId: suggestion.documentId,
            transactionId: suggestion.bankTransactionId,
            chartOfAccountId: suggestion.chartOfAccountId
          }
        }))
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return {
        auditTrail,
        pagination: {
          page,
          size,
          totalCount,
          totalPages: Math.ceil(totalCount / size),
          hasNext: page * size < totalCount,
          hasPrevious: page > 1
        },
        summary: {
          totalReconciliations: reconciliations.length,
          totalSuggestions: suggestionsHistory.length,
          period: {
            startDate: startDate || 'All time',
            endDate: endDate || 'Present'
          }
        },
        generatedAt: new Date().toISOString()
      };
    }

    // Outstanding Items Management Methods
    async getOutstandingItems(clientEin: string, user: User, type?: string, status?: string, startDate?: string, endDate?: string) {
      const clientCompany = await this.prisma.clientCompany.findUnique({
        where: { ein: clientEin }
      });

      if (!clientCompany) {
        throw new NotFoundException('Client company not found');
      }

      const accountingClientRelation = await this.prisma.accountingClients.findFirst({
        where: {
          accountingCompanyId: user.accountingCompanyId,
          clientCompanyId: clientCompany.id
        }
      });

      if (!accountingClientRelation) {
        throw new UnauthorizedException('No access to this client company');
      }

      // Build filters
      const whereClause: any = {
        accountingClientId: accountingClientRelation.id
      };

      if (type) {
        whereClause.type = type;
      }

      if (status) {
        whereClause.status = status;
      }

      if (startDate || endDate) {
        whereClause.issueDate = {};
        if (startDate) {
          whereClause.issueDate.gte = new Date(startDate);
        }
        if (endDate) {
          whereClause.issueDate.lte = new Date(endDate + 'T23:59:59.999Z');
        }
      }

      const outstandingItems = await this.prisma.outstandingItem.findMany({
        where: whereClause,
        include: {
          relatedDocument: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
          relatedTransaction: {
            select: {
              id: true,
              description: true,
              amount: true,
              transactionDate: true
            }
          },
          createdByUser: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: [
          { status: 'asc' },
          { daysOutstanding: 'desc' },
          { issueDate: 'desc' }
        ]
      });

      // Calculate days outstanding for each item
      const itemsWithAging = outstandingItems.map(item => {
        const today = new Date();
        const issueDate = new Date(item.issueDate);
        const daysOutstanding = Math.floor((today.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          ...item,
          daysOutstanding,
          amount: Number(item.amount)
        };
      });

      return {
        items: itemsWithAging,
        summary: {
          totalItems: itemsWithAging.length,
          totalAmount: itemsWithAging.reduce((sum, item) => sum + Number(item.amount), 0),
          byType: {
            OUTSTANDING_CHECK: itemsWithAging.filter(item => item.type === 'OUTSTANDING_CHECK').length,
            DEPOSIT_IN_TRANSIT: itemsWithAging.filter(item => item.type === 'DEPOSIT_IN_TRANSIT').length,
            PENDING_TRANSFER: itemsWithAging.filter(item => item.type === 'PENDING_TRANSFER').length
          },
          byStatus: {
            OUTSTANDING: itemsWithAging.filter(item => item.status === 'OUTSTANDING').length,
            CLEARED: itemsWithAging.filter(item => item.status === 'CLEARED').length,
            STALE: itemsWithAging.filter(item => item.status === 'STALE').length,
            VOIDED: itemsWithAging.filter(item => item.status === 'VOIDED').length
          }
        },
        generatedAt: new Date().toISOString()
      };
    };

    async getOutstandingItemsAging(clientEin: string, user: User) {
      const items = await this.getOutstandingItems(clientEin, user);
      
      const agingBuckets = {
        current: { count: 0, totalAmount: 0, items: [] },
        thirtyDays: { count: 0, totalAmount: 0, items: [] },
        sixtyDays: { count: 0, totalAmount: 0, items: [] },
        ninetyDays: { count: 0, totalAmount: 0, items: [] },
        overNinety: { count: 0, totalAmount: 0, items: [] }
      };

      items.items.forEach(item => {
        const amount = Number(item.amount);
        const days = item.daysOutstanding;

        if (days <= 30) {
          agingBuckets.current.count++;
          agingBuckets.current.totalAmount += amount;
          agingBuckets.current.items.push(item);
        } else if (days <= 60) {
          agingBuckets.thirtyDays.count++;
          agingBuckets.thirtyDays.totalAmount += amount;
          agingBuckets.thirtyDays.items.push(item);
        } else if (days <= 90) {
          agingBuckets.sixtyDays.count++;
          agingBuckets.sixtyDays.totalAmount += amount;
          agingBuckets.sixtyDays.items.push(item);
        } else if (days <= 120) {
          agingBuckets.ninetyDays.count++;
          agingBuckets.ninetyDays.totalAmount += amount;
          agingBuckets.ninetyDays.items.push(item);
        } else {
          agingBuckets.overNinety.count++;
          agingBuckets.overNinety.totalAmount += amount;
          agingBuckets.overNinety.items.push(item);
        }
      });

      return {
        agingBuckets,
        summary: {
          totalOutstandingItems: items.items.filter(item => item.status === 'OUTSTANDING').length,
          totalOutstandingAmount: items.items
            .filter(item => item.status === 'OUTSTANDING')
            .reduce((sum, item) => sum + Number(item.amount), 0),
          oldestItem: items.items.length > 0 ? Math.max(...items.items.map(item => item.daysOutstanding)) : 0,
          averageAge: items.items.length > 0 
            ? Math.round(items.items.reduce((sum, item) => sum + item.daysOutstanding, 0) / items.items.length)
            : 0
        },
        generatedAt: new Date().toISOString()
      };
    }

    async createOutstandingItem(clientEin: string, user: User, data: {
      type: 'OUTSTANDING_CHECK' | 'DEPOSIT_IN_TRANSIT' | 'PENDING_TRANSFER';
      referenceNumber: string;
      description: string;
      amount: number;
      issueDate: string;
      expectedClearDate?: string;
      payeeBeneficiary?: string;
      bankAccount?: string;
      notes?: string;
      relatedDocumentId?: number;
    }) {
      const clientCompany = await this.prisma.clientCompany.findUnique({
        where: { ein: clientEin }
      });

      if (!clientCompany) {
        throw new NotFoundException('Client company not found');
      }

      const accountingClientRelation = await this.prisma.accountingClients.findFirst({
        where: {
          accountingCompanyId: user.accountingCompanyId,
          clientCompanyId: clientCompany.id
        }
      });

      if (!accountingClientRelation) {
        throw new UnauthorizedException('No access to this client company');
      }

      // Calculate initial days outstanding with safe date parsing and fallbacks
      const today = new Date();
      const parsedIssueDate = this.parseDateSafe(data.issueDate) || today;
      const daysOutstanding = Math.max(0, Math.floor((today.getTime() - parsedIssueDate.getTime()) / (1000 * 60 * 60 * 24)));

      const outstandingItem = await this.prisma.outstandingItem.create({
        data: {
          accountingClientId: accountingClientRelation.id,
          type: data.type,
          referenceNumber: data.referenceNumber,
          description: data.description,
          amount: Number(data.amount),
          issueDate: parsedIssueDate,
          expectedClearDate: this.parseDateSafe(data.expectedClearDate) || null,
          daysOutstanding,
          payeeBeneficiary: data.payeeBeneficiary,
          bankAccountString: data.bankAccount ?? null,
          notes: data.notes,
          relatedDocumentId: data.relatedDocumentId,
          createdBy: user.id
        },
        include: {
          relatedDocument: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
          createdByUser: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      return {
        ...outstandingItem,
        amount: Number(outstandingItem.amount)
      };
    }

    async updateOutstandingItem(itemId: number, user: User, data: {
      status?: 'OUTSTANDING' | 'CLEARED' | 'STALE' | 'VOIDED';
      actualClearDate?: string;
      notes?: string;
      relatedTransactionId?: string;
    }) {
      // Verify the item exists and user has access
      const existingItem = await this.prisma.outstandingItem.findFirst({
        where: {
          id: itemId,
          accountingClient: {
            accountingCompanyId: user.accountingCompanyId
          }
        }
      });

      if (!existingItem) {
        throw new NotFoundException('Outstanding item not found or no access');
      }

      const updateData: any = {};
      
      if (data.status) {
        updateData.status = data.status;
      }
      
      if (data.actualClearDate) {
        updateData.actualClearDate = new Date(data.actualClearDate);
      }
      
      if (data.notes !== undefined) {
        updateData.notes = data.notes;
      }
      
      if (data.relatedTransactionId) {
        updateData.relatedTransactionId = data.relatedTransactionId;
      }

      // Recalculate days outstanding
      const today = new Date();
      const issueDate = new Date(existingItem.issueDate);
      updateData.daysOutstanding = Math.floor((today.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));

      const updatedItem = await this.prisma.outstandingItem.update({
        where: { id: itemId },
        data: updateData,
        include: {
          relatedDocument: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
          relatedTransaction: {
            select: {
              id: true,
              description: true,
              amount: true,
              transactionDate: true
            }
          },
          createdByUser: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      return {
        ...updatedItem,
        amount: Number(updatedItem.amount)
      };
    }

    async deleteOutstandingItem(itemId: number, user: User) {
      // Verify the item exists and user has access
      const existingItem = await this.prisma.outstandingItem.findFirst({
        where: {
          id: itemId,
          accountingClient: {
            accountingCompanyId: user.accountingCompanyId
          }
        }
      });

      if (!existingItem) {
        throw new NotFoundException('Outstanding item not found or no access');
      }

      await this.prisma.outstandingItem.delete({
        where: { id: itemId }
      });

      return { success: true, message: 'Outstanding item deleted successfully' };
    }

    async markOutstandingItemAsCleared(itemId: number, user: User, transactionId?: string, clearDate?: string) {
      return this.updateOutstandingItem(itemId, user, {
        status: 'CLEARED',
        actualClearDate: clearDate || new Date().toISOString(),
        relatedTransactionId: transactionId
      });
    }

    async markOutstandingItemAsStale(itemId: number, user: User, notes?: string) {
      return this.updateOutstandingItem(itemId, user, {
        status: 'STALE',
        notes: notes || 'Marked as stale - requires follow-up'
      });
    }

    async voidOutstandingItem(itemId: number, user: User, notes?: string) {
      return this.updateOutstandingItem(itemId, user, {
        status: 'VOIDED',
        notes: notes || 'Item voided'
      });
    }

    // ==================== OTHER METHODS ====================

  /**
   * Deactivate (soft delete) a bank account
   */
  async deactivateBankAccount(accountId: number, user: User) {
    const ownerAccount = await this.prisma.bankAccount.findUnique({ where: { id: accountId } });
    if (!ownerAccount) throw new Error('Bank account not found');
    // TODO: add permission check for user
    return this.prisma.bankAccount.update({
      where: { id: accountId },
      data: { isActive: false }
    });
  }

    /**
     * Get all bank accounts for a client company
     */
    async getBankAccounts(clientEin: string, user: User) {
      await this.associateTransactionsWithAccounts(clientEin, user);
      const clientCompany = await this.prisma.clientCompany.findUnique({
        where: { ein: clientEin }
      });

      if (!clientCompany) {
        throw new NotFoundException('Client company not found');
      }

      const accountingClientRelation = await this.prisma.accountingClients.findFirst({
        where: {
          accountingCompanyId: user.accountingCompanyId,
          clientCompanyId: clientCompany.id
        }
      });

      if (!accountingClientRelation) {
        throw new UnauthorizedException('No access to this client company');
      }

      const bankAccounts = await this.prisma.bankAccount.findMany({
        where: {
          accountingClientId: accountingClientRelation.id,
          isActive: true
        },
        include: {
          _count: {
            select: {
              bankTransactions: {
                where: {
                  reconciliationStatus: ReconciliationStatus.UNRECONCILED
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      });

      return bankAccounts.map(account => ({
        id: account.id,
        iban: account.iban,
        accountName: account.accountName,
        bankName: account.bankName,
        currency: account.currency,
        accountType: account.accountType,
        isActive: account.isActive,
        unreconciledTransactionsCount: account._count.bankTransactions,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt
      }));
    }

    /**
     * Create a new bank account
     */
    async createBankAccount(clientEin: string, user: User, accountData: {
      iban: string;
      accountName: string;
      bankName: string;
      currency?: string;
      accountType?: BankAccountType;
    }) {
      const clientCompany = await this.prisma.clientCompany.findUnique({
        where: { ein: clientEin }
      });

      if (!clientCompany) {
        throw new NotFoundException('Client company not found');
      }

      const accountingClientRelation = await this.prisma.accountingClients.findFirst({
        where: {
          accountingCompanyId: user.accountingCompanyId,
          clientCompanyId: clientCompany.id
        }
      });

      if (!accountingClientRelation) {
        throw new UnauthorizedException('No access to this client company');
      }

      // Normalize IBAN to avoid duplicates due to casing/whitespace
      const normalizedIban = (accountData.iban || '').trim().toUpperCase();

      // Check if IBAN already exists (case-insensitive)
      const existingAccount = await this.prisma.bankAccount.findFirst({
        where: { iban: { equals: normalizedIban, mode: 'insensitive' } },
        include: { accountingClient: true }
      });

      if (existingAccount) {
        // If it belongs to another client, do not allow reuse
        if (existingAccount.accountingClientId !== accountingClientRelation.id) {
          throw new BadRequestException('Bank account with this IBAN belongs to another client');
        }

        // If belongs to same client and is inactive, reactivate and update props
        if (!existingAccount.isActive) {
          return this.prisma.bankAccount.update({
            where: { id: existingAccount.id },
            data: {
              isActive: true,
              accountName: accountData.accountName,
              bankName: accountData.bankName,
              currency: accountData.currency || existingAccount.currency || 'RON',
              accountType: accountData.accountType || existingAccount.accountType || BankAccountType.CURRENT
            }
          });
        }

        // Already active for this client
        throw new BadRequestException('Bank account with this IBAN already exists');
      }

      const bankAccount = await this.prisma.bankAccount.create({
        data: {
          iban: normalizedIban,
          accountName: accountData.accountName,
          bankName: accountData.bankName,
          currency: accountData.currency || 'RON',
          accountType: accountData.accountType || BankAccountType.CURRENT,
          accountingClientId: accountingClientRelation.id
        }
      });

      return bankAccount;
    }

    /**
     * Update a bank account
     */
    async updateBankAccount(accountId: number, user: User, updateData: {
      accountName?: string;
      bankName?: string;
      currency?: string;
      accountType?: BankAccountType;
      isActive?: boolean;
    }) {
      const bankAccount = await this.prisma.bankAccount.findUnique({
        where: { id: accountId },
        include: { accountingClient: true }
      });

      if (!bankAccount) {
        throw new NotFoundException('Bank account not found');
      }

      if (bankAccount.accountingClient.accountingCompanyId !== user.accountingCompanyId) {
        throw new UnauthorizedException('No access to this bank account');
      }

      const updatedAccount = await this.prisma.bankAccount.update({
        where: { id: accountId },
        data: updateData
      });

      return updatedAccount;
    }

    /**
     * Get bank transactions filtered by account
     */
    async getBankTransactionsByAccount(clientEin: string, user: User, accountId?: number, status: 'all' | 'reconciled' | 'unreconciled' = 'all', page = 1, size = 25) {
      // Auto-associate unlinked transactions so data is always fresh
      try {
        await this.associateTransactionsWithAccounts(clientEin, user);
      } catch (e) {
        console.warn('⚠️ Auto association failed', e);
      }
      const clientCompany = await this.prisma.clientCompany.findUnique({
        where: { ein: clientEin }
      });

      if (!clientCompany) {
        throw new NotFoundException('Client company not found');
      }

      const accountingClientRelation = await this.prisma.accountingClients.findFirst({
        where: {
          accountingCompanyId: user.accountingCompanyId,
          clientCompanyId: clientCompany.id
        }
      });

      if (!accountingClientRelation) {
        throw new UnauthorizedException('No access to this client company');
      }

      const whereCondition: any = {
        bankStatementDocument: {
          accountingClientId: accountingClientRelation.id
        }
      };

      // Filter by specific bank account if provided
      if (accountId) {
        whereCondition.bankAccountId = accountId;
      }

      if (status === 'reconciled') {
        whereCondition.reconciliationStatus = { in: [ReconciliationStatus.MATCHED] };
      } else if (status === 'unreconciled') {
        whereCondition.reconciliationStatus = { in: [ReconciliationStatus.UNRECONCILED] };
      }

      const [transactions, total] = await this.prisma.$transaction([
        this.prisma.bankTransaction.findMany({
          where: whereCondition,
          include: {
            bankStatementDocument: true,
            bankAccount: true,
            chartOfAccount: true,
            reconciliationRecords: {
              include: {
                document: true
              }
            }
          },
          orderBy: { transactionDate: 'desc' },
          skip: (page - 1) * size,
          take: size
        }),
        this.prisma.bankTransaction.count({ where: whereCondition })
      ]);

      const transactionsWithSignedUrls = await Promise.all(
        transactions.map(async (transaction) => {
          let bankStatementSignedUrl = null;
          
          if (transaction.bankStatementDocument) {
            try {
              bankStatementSignedUrl = transaction.bankStatementDocument.s3Key 
                ? await s3.getSignedUrlPromise('getObject', {
                    Bucket: process.env.AWS_S3_BUCKET_NAME,
                    Key: transaction.bankStatementDocument.s3Key,
                    Expires: 3600 
                  }) 
                : transaction.bankStatementDocument.path;
            } catch (error) {
              console.error(`Failed to generate signed URL for bank statement ${transaction.bankStatementDocument.id}:`, error);
              bankStatementSignedUrl = transaction.bankStatementDocument.path;
            }
          }

          return {
            id: transaction.id,
            transactionDate: transaction.transactionDate,
            description: transaction.description,
            amount: transaction.amount,
            transactionType: transaction.transactionType,
            referenceNumber: transaction.referenceNumber,
            balanceAfter: transaction.balanceAfter,
            reconciliation_status: transaction.reconciliationStatus,
            chartOfAccount: transaction.chartOfAccount,
            bankAccount: transaction.bankAccount,
            isStandalone: transaction.isStandalone,
            accountingNotes: transaction.accountingNotes,
            bankStatementDocument: {
              id: transaction.bankStatementDocument.id,
              name: transaction.bankStatementDocument.name,
              signedUrl: bankStatementSignedUrl 
            },
            matchedDocuments: transaction.reconciliationRecords.map(record => record.document.id)
          };
        })
      );

      return { total, page, size, items: transactionsWithSignedUrls };
    }

    /**
     * Get consolidated view across all accounts
     */
    async getConsolidatedAccountView(clientEin: string, user: User) {
      const clientCompany = await this.prisma.clientCompany.findUnique({
        where: { ein: clientEin }
      });

      if (!clientCompany) {
        throw new NotFoundException('Client company not found');
      }

      const accountingClientRelation = await this.prisma.accountingClients.findFirst({
        where: {
          accountingCompanyId: user.accountingCompanyId,
          clientCompanyId: clientCompany.id
        }
      });

      if (!accountingClientRelation) {
        throw new UnauthorizedException('No access to this client company');
      }

      const bankAccounts = await this.prisma.bankAccount.findMany({
        where: {
          accountingClientId: accountingClientRelation.id,
          isActive: true
        },
        include: {
          bankTransactions: {
            where: {
              reconciliationStatus: ReconciliationStatus.UNRECONCILED
            },
            orderBy: { transactionDate: 'desc' },
            take: 5
          },
          _count: {
            select: {
              bankTransactions: {
                where: {
                  reconciliationStatus: ReconciliationStatus.UNRECONCILED
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      });

      const consolidatedStats = {
        totalAccounts: bankAccounts.length,
        totalUnreconciledTransactions: bankAccounts.reduce((sum, account) => sum + account._count.bankTransactions, 0),
        accountSummaries: bankAccounts.map(account => ({
          id: account.id,
          iban: account.iban,
          accountName: account.accountName,
          bankName: account.bankName,
          currency: account.currency,
          accountType: account.accountType,
          unreconciledCount: account._count.bankTransactions,
          recentTransactions: account.bankTransactions.map(tx => ({
            id: tx.id,
            date: tx.transactionDate,
            description: tx.description,
            amount: tx.amount,
            type: tx.transactionType
          }))
        }))
      };

      return consolidatedStats;
    }

    /**
     * Associate transactions with bank accounts based on IBAN extraction
     */
    async associateTransactionsWithAccounts(clientEin: string, user: User) {
      console.log(`🏦 Starting transaction association for client: ${clientEin}`);
      
      const clientCompany = await this.prisma.clientCompany.findUnique({
        where: { ein: clientEin }
      });

      if (!clientCompany) {
        throw new NotFoundException('Client company not found');
      }

      const accountingClientRelation = await this.prisma.accountingClients.findFirst({
        where: {
          accountingCompanyId: user.accountingCompanyId,
          clientCompanyId: clientCompany.id
        }
      });

      if (!accountingClientRelation) {
        throw new UnauthorizedException('No access to this client company');
      }

      // Get all unassociated transactions
      const unassociatedTransactions = await this.prisma.bankTransaction.findMany({
        where: {
          bankStatementDocument: {
            accountingClientId: accountingClientRelation.id
          },
          bankAccountId: null
        },
        include: {
          bankStatementDocument: {
            include: {
              processedData: true
            }
          }
        }
      });

      // Get all bank accounts for this client
      const bankAccounts = await this.prisma.bankAccount.findMany({
        where: {
          accountingClientId: accountingClientRelation.id,
          isActive: true
        }
      });

      console.log(`📊 Found ${unassociatedTransactions.length} unassociated transactions`);
      console.log(`🏦 Found ${bankAccounts.length} bank accounts:`, bankAccounts.map(acc => ({ id: acc.id, iban: acc.iban, name: acc.accountName })));

      let associatedCount = 0;

      for (const transaction of unassociatedTransactions) {
        console.log(`\n🔍 Processing transaction ${transaction.id} (${transaction.amount} RON)`);
        
        // Try to extract IBAN from bank statement document
        let extractedIban: string | null = null;
        
        if (transaction.bankStatementDocument) {
          const document = transaction.bankStatementDocument as any;
          console.log(`📄 Bank statement document: ${document.name}`);
          
          // Helper function to extract IBAN from any object
          const findIbanInObject = (obj: any, source: string): string | null => {
            if (!obj || typeof obj !== 'object') return null;
            
            // Direct IBAN fields
            const ibanFields = [
              'iban', 'account_iban', 'account_number', 'bank_account', 
              'account_info', 'bank_details', 'account', 'accountNumber',
              'bankAccount', 'accountIban', 'bankIban', 'iban_account'
            ];
            
            for (const field of ibanFields) {
              if (obj[field] && typeof obj[field] === 'string') {
                const value = obj[field].trim();
                // Check if it looks like an IBAN (starts with RO and has correct length)
                if (value.match(/^RO\d{2}[A-Z]{4}\d{16}$/i) || value.match(/^RO\d{2}\s?[A-Z]{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}$/i)) {
                  console.log(`✅ Found IBAN in ${source}.${field}: ${value}`);
                  return value;
                }
              }
            }
            
            // Search recursively in nested objects
            for (const key of Object.keys(obj)) {
              if (typeof obj[key] === 'object' && obj[key] !== null) {
                const nestedIban = findIbanInObject(obj[key], `${source}.${key}`);
                if (nestedIban) return nestedIban;
              }
            }
            
            return null;
          };
          
          // Check extractedData first
          // If extractedData is a JSON string, parse it
          if (typeof document.extractedData === 'string') {
            try {
              document.extractedData = JSON.parse(document.extractedData);
            } catch (_) {
              console.warn(`⚠️ Could not parse extractedData JSON for document ${document.id}`);
            }
          }
          if (document.extractedData) {
            console.log(`📋 Extracted data fields:`, Object.keys(document.extractedData));
            extractedIban = findIbanInObject(document.extractedData, 'extractedData');
          }
          
          // Check processedData if available (can be object or array)
          if (!extractedIban && document.processedData) {
            const pd = document.processedData;            
            if (!Array.isArray(pd)) {
              // processedData is a single object (Prisma relation). Extract its extractedFields json
              let fieldsBlock: any = (pd as any).extractedFields ?? pd;
              if (typeof fieldsBlock === 'string') {
                try {
                  fieldsBlock = JSON.parse(fieldsBlock);
                } catch (_) {
                  console.warn(`⚠️ Could not parse processedData.extractedFields JSON for document ${document.id}`);
                }
              }
              extractedIban = findIbanInObject(fieldsBlock, 'processedData.extractedFields');
            } else {
            console.log(`📋 Processing ${document.processedData.length} processedData items`);
            for (let i = 0; i < document.processedData.length; i++) {
              let processedItem = document.processedData[i];
              // If the item wraps extractedFields, unwrap it
              if (processedItem && typeof processedItem === 'object' && 'extractedFields' in processedItem) {
                processedItem = (processedItem as any).extractedFields;
              }
              if (typeof processedItem === 'string') {
                try {
                  processedItem = JSON.parse(processedItem);
                } catch (_) {
                  console.warn(`⚠️ Could not parse processedData[${i}] JSON for document ${document.id}`);
                  continue;
                }
              }
              extractedIban = findIbanInObject(processedItem, `processedData[${i}]`);
              if (extractedIban) break;
            }
          }
        }
          
          // Last resort: search in the entire document object
          if (!extractedIban) {
            console.log(`📋 Last resort: searching entire document object`);
            extractedIban = findIbanInObject(document, 'document');
          }
          if (!extractedIban) {
            console.log(`❌ No IBAN found in any data source for document ${document.name}`);
            console.log(`📋 Available document keys:`, Object.keys(document));
          }
        }

        // If we found an IBAN, try to match it with existing bank accounts
        if (extractedIban) {
          console.log(`🔍 Trying to match IBAN: ${extractedIban}`);
          
          const matchingAccount = bankAccounts.find(account => {
            const accountIban = account.iban.replace(/\s/g, '');
            const extractedIbanClean = extractedIban.replace(/\s/g, '');
            const matches = accountIban === extractedIbanClean || account.iban === extractedIban;
            
            if (matches) {
              console.log(`✅ MATCHED with account ${account.id} (${account.accountName}): ${account.iban}`);
            }
            
            return matches;
          });

          if (matchingAccount) {
            await this.prisma.bankTransaction.update({
              where: { id: transaction.id },
              data: { bankAccountId: matchingAccount.id }
            });
            associatedCount++;
            console.log(`✅ Transaction ${transaction.id} associated with account ${matchingAccount.id}`);
          } else {
            console.log(`❌ No matching account found for IBAN: ${extractedIban}`);
            console.log(`Available IBANs:`, bankAccounts.map(acc => acc.iban));
          }
        } else {
          console.log(`❌ No IBAN extracted from transaction ${transaction.id}`);
        }
      }

      console.log(`\n🎉 Association complete: ${associatedCount}/${unassociatedTransactions.length} transactions associated`);

      return {
        message: `Successfully associated ${associatedCount} transactions with bank accounts`,
        associatedCount,
        totalProcessed: unassociatedTransactions.length
      };
    }
      
}

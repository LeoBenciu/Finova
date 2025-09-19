import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

export type PostingEntry = {
  accountCode: string;
  debit?: number; // RON
  credit?: number; // RON
};

// Use the Prisma generated enum
import { LedgerSourceType } from '@prisma/client';

export interface PostEntriesInput {
  accountingClientId: number;
  postingDate: Date;
  entries: PostingEntry[]; // must be balanced by caller
  sourceType: LedgerSourceType;
  sourceId: string; // e.g. reconciliationId, documentId, transactionId
  postingKey: string; // idempotency key to ensure we don't double post
  links?: {
    documentId?: number | null;
    bankTransactionId?: string | null;
    reconciliationId?: number | null;
  };
}

@Injectable()
export class PostingService {
  constructor(private readonly prisma: PrismaService) {}

  // Reverse ledger entries for a specific document
  async reverseDocumentEntries(accountingClientId: number, documentId: number, postingDate: Date) {
    console.log('[POSTING SERVICE] Starting document reversal:', { accountingClientId, documentId, postingDate });
    
    try {
      // First, let's check ALL ledger entries for this accounting client to see what we have
      const allEntries = await this.prisma.generalLedgerEntry.findMany({
        where: { accountingClientId },
        select: {
          id: true,
          documentId: true,
          accountCode: true,
          debit: true,
          credit: true,
          sourceType: true,
          sourceId: true,
          postingKey: true,
          createdAt: true
        }
      });
      
      console.log('[POSTING SERVICE] ALL ledger entries for accounting client:', {
        totalEntries: allEntries.length,
        entries: allEntries.map(e => ({
          id: e.id,
          documentId: e.documentId,
          accountCode: e.accountCode,
          debit: e.debit.toString(),
          credit: e.credit.toString(),
          sourceType: e.sourceType,
          sourceId: e.sourceId,
          postingKey: e.postingKey
        }))
      });

      // Find all ledger entries for this document
      const existingEntries = await this.prisma.generalLedgerEntry.findMany({
        where: {
          accountingClientId,
          documentId
        }
      });

      console.log('[POSTING SERVICE] Query for document-specific entries:', {
        query: { accountingClientId, documentId },
        foundEntries: existingEntries.length,
        entries: existingEntries.map(e => ({
          id: e.id,
          documentId: e.documentId,
          accountCode: e.accountCode,
          debit: e.debit.toString(),
          credit: e.credit.toString(),
          sourceType: e.sourceType,
          sourceId: e.sourceId,
          postingKey: e.postingKey
        }))
      });

      if (existingEntries.length === 0) {
        console.log('[POSTING SERVICE] No ledger entries found for document:', documentId);
        return { reversed: 0, message: 'No entries to reverse' };
      }

      console.log('[POSTING SERVICE] Found entries to reverse:', existingEntries.length);

      // Create reversal entries (swap debit/credit)
      const reversalEntries: PostingEntry[] = existingEntries.map(entry => ({
        accountCode: entry.accountCode,
        debit: entry.credit.toNumber(), // Swap: original credit becomes debit
        credit: entry.debit.toNumber()   // Swap: original debit becomes credit
      }));

      // Post the reversal entries
      const reversalKey = `reversal:document:${documentId}:${Date.now()}`;
      const result = await this.postEntries({
        accountingClientId,
        postingDate,
        entries: reversalEntries,
        sourceType: LedgerSourceType.DOCUMENT_REVERSAL,
        sourceId: `document-${documentId}`,
        postingKey: reversalKey,
        links: {
          documentId: documentId
        }
      });

      console.log('[POSTING SERVICE] Document reversal completed:', { 
        documentId, 
        originalEntries: existingEntries.length, 
        reversalEntries: result.created.length 
      });

      return {
        reversed: result.created.length,
        originalEntries: existingEntries.length,
        message: `Reversed ${result.created.length} ledger entries for document ${documentId}`
      };

    } catch (error: any) {
      console.error('[POSTING SERVICE] Document reversal failed:', error);
      throw new Error(`Failed to reverse ledger entries for document ${documentId}: ${error.message}`);
    }
  }

  // Synchronous, idempotent post. If postingKey exists, returns existing entries.
  async postEntries(input: PostEntriesInput) {
    const { accountingClientId, postingDate, entries, sourceType, sourceId, postingKey, links } = input;

    if (!entries?.length) return { created: [], reused: true };

    // Basic balance validation
    const sumDebit = entries.reduce((s, e) => s + (e.debit ? Number(e.debit) : 0), 0);
    const sumCredit = entries.reduce((s, e) => s + (e.credit ? Number(e.credit) : 0), 0);
    const diff = Math.abs(sumDebit - sumCredit);
    if (diff > 0.005) {
      throw new Error(`Posting not balanced: debit=${sumDebit.toFixed(2)} credit=${sumCredit.toFixed(2)}`);
    }

    // Debug: input summary
    try {
      const totalDebit = entries.reduce((s, e) => s + (e.debit ? Number(e.debit) : 0), 0);
      const totalCredit = entries.reduce((s, e) => s + (e.credit ? Number(e.credit) : 0), 0);
      console.log('[Ledger] postEntries attempt', {
        accountingClientId,
        postingDate,
        sourceType,
        sourceId,
        postingKey,
        entriesCount: entries.length,
        totalDebit: Number(totalDebit.toFixed(2)),
        totalCredit: Number(totalCredit.toFixed(2)),
        links,
      });
    } catch {}

    // Try to find existing by unique postingKey
    const existing = await this.prisma.generalLedgerEntry.findFirst({ where: { postingKey } });
    if (existing) {
      const siblings = await this.prisma.generalLedgerEntry.findMany({ where: { accountingClientId, postingKey } });
      try {
        console.log('[Ledger] postEntries idempotent reuse', {
          postingKey,
          accountingClientId,
          count: siblings?.length ?? 0,
          firstIds: (siblings || []).slice(0, 5).map((r: any) => r.id),
        });
      } catch {}
      return { created: siblings, reused: true };
    }

    console.log('[POSTING SERVICE] Starting transaction to create ledger entries');
    const created = await this.prisma.$transaction(async (tx) => {
      const createdRows = [] as any[];

      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const uniquePostingKey = `${postingKey}:${i}`;
        
        console.log('[POSTING SERVICE] Creating ledger entry:', {
          accountingClientId,
          postingDate,
          accountCode: e.accountCode,
          debit: e.debit,
          credit: e.credit,
          sourceType,
          sourceId,
          postingKey: uniquePostingKey
        });

        const row = await tx.generalLedgerEntry.create({
          data: {
            accountingClientId,
            postingDate,
            accountCode: e.accountCode,
            debit: new Prisma.Decimal(e.debit ?? 0),
            credit: new Prisma.Decimal(e.credit ?? 0),
            currency: 'RON',
            sourceType,
            sourceId: String(sourceId),
            postingKey: uniquePostingKey,
            documentId: links?.documentId ?? null,
            bankTransactionId: links?.bankTransactionId ?? null,
            reconciliationId: links?.reconciliationId ?? null,
          },
        });
        createdRows.push(row);
        // Per-row debug
        try {
          console.log('[Ledger] postEntries created row', {
            id: row.id,
            accountingClientId: row.accountingClientId,
            postingDate: row.postingDate,
            accountCode: row.accountCode,
            debit: String(row.debit),
            credit: String(row.credit),
            sourceType: row.sourceType,
            sourceId: row.sourceId,
            postingKey: row.postingKey,
            links: {
              documentId: row.documentId,
              bankTransactionId: row.bankTransactionId,
              reconciliationId: row.reconciliationId,
            },
          });
        } catch {}

        // Update Daily balance (increment by debit-credit)
        const delta = new Prisma.Decimal((e.debit ?? 0) - (e.credit ?? 0));
        await tx.accountBalanceDaily.upsert({
          where: {
            accountingClientId_accountCode_date: {
              accountingClientId,
              accountCode: e.accountCode,
              date: new Date(new Date(postingDate).toDateString()), // normalize to day
            },
          },
          update: {
            endingBalance: { increment: delta },
            lastUpdatedAt: new Date(),
          },
          create: {
            accountingClientId,
            date: new Date(new Date(postingDate).toDateString()),
            accountCode: e.accountCode,
            endingBalance: delta,
          },
        });

        // Update Monthly balance
        const y = postingDate.getFullYear();
        const m = postingDate.getMonth() + 1;
        await tx.accountBalanceMonthly.upsert({
          where: {
            accountingClientId_accountCode_year_month: {
              accountingClientId,
              accountCode: e.accountCode,
              year: y,
              month: m,
            },
          },
          update: {
            endingBalance: { increment: delta },
            lastUpdatedAt: new Date(),
          },
          create: {
            accountingClientId,
            year: y,
            month: m,
            accountCode: e.accountCode,
            endingBalance: delta,
          },
        });
      }

      console.log('[POSTING SERVICE] Transaction completed, created rows:', createdRows.length);
      return createdRows;
    });

    try {
      console.log('[POSTING SERVICE] Posting completed successfully:', {
        accountingClientId,
        postingKey,
        createdCount: created.length,
        firstIds: created.slice(0, 5).map((r: any) => r.id),
      });
    } catch (e) {
      console.error('[POSTING SERVICE] Error logging completion:', e);
    }

    return { created, reused: false };
  }

  // Reverse postings identified by link fields. Idempotent: if none found, it's a no-op.
  async unpostByLinks(params: {
    accountingClientId: number;
    documentId?: number | null;
    bankTransactionId?: string | null;
    reconciliationId?: number | null;
  }) {
    const { accountingClientId, documentId = null, bankTransactionId = null, reconciliationId = null } = params;

    // Find entries by links
    const entries = await this.prisma.generalLedgerEntry.findMany({
      where: {
        accountingClientId,
        documentId: documentId,
        bankTransactionId: bankTransactionId,
        reconciliationId: reconciliationId,
      },
    });

    try {
      console.log('[Ledger] unpostByLinks lookup', {
        accountingClientId,
        documentId,
        bankTransactionId,
        reconciliationId,
        found: entries?.length ?? 0,
      });
    } catch {}

    if (!entries || entries.length === 0) {
      return { reversed: 0 };
    }

    await this.prisma.$transaction(async (tx) => {
      for (const row of entries) {
        const delta = new Prisma.Decimal(Number(row.debit || 0) - Number(row.credit || 0));

        // Reverse Daily balance
        await tx.accountBalanceDaily.update({
          where: {
            accountingClientId_accountCode_date: {
              accountingClientId,
              accountCode: row.accountCode,
              date: new Date(new Date(row.postingDate).toDateString()),
            },
          },
          data: {
            endingBalance: { decrement: delta },
            lastUpdatedAt: new Date(),
          },
        }).catch(async () => {
          // If daily balance row doesn't exist (edge case), create with negative delta
          await tx.accountBalanceDaily.create({
            data: {
              accountingClientId,
              date: new Date(new Date(row.postingDate).toDateString()),
              accountCode: row.accountCode,
              endingBalance: new Prisma.Decimal(0).minus(delta),
            },
          });
        });

        // Reverse Monthly balance
        const y = new Date(row.postingDate).getFullYear();
        const m = new Date(row.postingDate).getMonth() + 1;
        await tx.accountBalanceMonthly.update({
          where: {
            accountingClientId_accountCode_year_month: {
              accountingClientId,
              accountCode: row.accountCode,
              year: y,
              month: m,
            },
          },
          data: {
            endingBalance: { decrement: delta },
            lastUpdatedAt: new Date(),
          },
        }).catch(async () => {
          // If monthly balance row doesn't exist, create with negative delta
          await tx.accountBalanceMonthly.create({
            data: {
              accountingClientId,
              accountCode: row.accountCode,
              year: y,
              month: m,
              endingBalance: new Prisma.Decimal(0).minus(delta),
            },
          });
        });

        // Delete ledger entry row
        await tx.generalLedgerEntry.delete({ where: { id: row.id } });
      }
    });

    try {
      console.log('[Ledger] unpostByLinks completed', {
        accountingClientId,
        documentId,
        bankTransactionId,
        reconciliationId,
        reversed: entries.length,
      });
    } catch {}

    return { reversed: entries.length };
  }
}

import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { User } from '@prisma/client';
import { PostingService } from './posting.service';
import { LedgerSourceType } from '@prisma/client';

interface LedgerQuery {
  startDate?: string;
  endDate?: string;
  accountCode?: string;
  page: number;
  size: number;
}

@Injectable()
export class AccountingService {
  constructor(
    private prisma: PrismaService,
    private postingService: PostingService
  ) {}

  private async resolveAccountingClientId(clientEin: string, user: User) {
    const clientCompany = await this.prisma.clientCompany.findUnique({
      where: { ein: clientEin },
      select: { id: true },
    });
    if (!clientCompany) throw new NotFoundException('Client company not found');

    const relation = await this.prisma.accountingClients.findFirst({
      where: {
        clientCompanyId: clientCompany.id,
        accountingCompanyId: user.accountingCompanyId || undefined,
      },
      select: { id: true },
    });
    if (!relation) throw new UnauthorizedException('You are not authorized to access this client');
    // Debug mapping
    try {
      console.log('[Ledger] resolveAccountingClientId', {
        clientEin,
        clientCompanyId: clientCompany.id,
        userCompanyId: user.accountingCompanyId,
        accountingClientId: relation.id,
      });
    } catch {}
    return relation.id;
  }

  async getLedgerEntries(clientEin: string, user: User, q: LedgerQuery) {
    const accountingClientId = await this.resolveAccountingClientId(clientEin, user);

    const where: any = { accountingClientId };
    if (q.startDate || q.endDate) {
      where.postingDate = {};
      if (q.startDate) where.postingDate.gte = new Date(q.startDate);
      if (q.endDate) where.postingDate.lte = new Date(q.endDate);
    }
    if (q.accountCode) {
      where.accountCode = q.accountCode;
    }

    // Debug input filters
    try {
      console.log('[Ledger] getLedgerEntries query', {
        clientEin,
        accountingClientId,
        filters: {
          startDate: q.startDate,
          endDate: q.endDate,
          accountCode: q.accountCode,
        },
        pagination: { page: q.page, size: q.size },
        where,
      });
    } catch {}

    const [items, total] = await this.prisma.$transaction([
      this.prisma.generalLedgerEntry.findMany({
        where,
        orderBy: [{ postingDate: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.size,
        take: q.size,
        select: {
          id: true,
          accountingClientId: true,
          postingDate: true,
          accountCode: true,
          debit: true,
          credit: true,
          currency: true,
          sourceType: true,
          sourceId: true,
          postingKey: true,
          documentId: true,
          bankTransactionId: true,
          reconciliationId: true,
          createdAt: true,
        },
      }),
      this.prisma.generalLedgerEntry.count({ where }),
    ]);

    // Debug results
    try {
      console.log('[Ledger] getLedgerEntries result', {
        accountingClientId,
        returned: items.length,
        total,
        firstIds: items.slice(0, 5).map((it: any) => it.id),
      });
    } catch {}

    return { items, total, page: q.page, size: q.size };
  }

  async createManualJournalEntry(
    clientEin: string, 
    user: User, 
    body: {
      postingDate: string;
      entries: Array<{
        accountCode: string;
        debit?: number;
        credit?: number;
        description?: string;
      }>;
      reference?: string;
    }
  ) {
    const accountingClientId = await this.resolveAccountingClientId(clientEin, user);

    // Validate entries
    if (!body.entries || body.entries.length === 0) {
      throw new BadRequestException('At least one entry is required');
    }

    // Validate that each entry has either debit or credit (but not both)
    for (const entry of body.entries) {
      if ((entry.debit && entry.credit) || (!entry.debit && !entry.credit)) {
        throw new BadRequestException('Each entry must have either debit or credit (but not both)');
      }
      if (entry.debit && entry.debit <= 0) {
        throw new BadRequestException('Debit amount must be positive');
      }
      if (entry.credit && entry.credit <= 0) {
        throw new BadRequestException('Credit amount must be positive');
      }
    }

    // Validate that total debits equal total credits
    const totalDebit = body.entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
    const totalCredit = body.entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new BadRequestException(`Entries must be balanced. Total debit: ${totalDebit}, Total credit: ${totalCredit}`);
    }

    // Validate account codes exist
    const accountCodes = body.entries.map(e => e.accountCode);
    const existingAccounts = await this.prisma.chartOfAccounts.findMany({
      where: { accountCode: { in: accountCodes } }
    });

    if (existingAccounts.length !== accountCodes.length) {
      const existingCodes = existingAccounts.map(a => a.accountCode);
      const missingCodes = accountCodes.filter(code => !existingCodes.includes(code));
      throw new BadRequestException(`Account codes not found: ${missingCodes.join(', ')}`);
    }

    // Create the manual journal entry
    const postingDate = new Date(body.postingDate);
    const postingKey = `manual:${Date.now()}:${user.id}`;
    
    const result = await this.postingService.postEntries({
      accountingClientId,
      postingDate,
      entries: body.entries.map(entry => ({
        accountCode: entry.accountCode,
        debit: entry.debit || 0,
        credit: entry.credit || 0
      })),
      sourceType: LedgerSourceType.MANUAL_ENTRY,
      sourceId: `manual-${user.id}-${Date.now()}`,
      postingKey,
      links: {
        documentId: null,
        bankTransactionId: null,
        reconciliationId: null
      }
    });

    console.log('[ACCOUNTING SERVICE] Manual journal entry created:', {
      accountingClientId,
      entriesCount: body.entries.length,
      totalDebit,
      totalCredit,
      postingKey,
      result
    });

    return {
      success: true,
      message: 'Manual journal entry created successfully',
      entriesCreated: result.created.length,
      postingKey
    };
  }

  async deleteJournalEntry(clientEin: string, entryId: number, user: User) {
    const accountingClientId = await this.resolveAccountingClientId(clientEin, user);

    // Find the entry
    const entry = await this.prisma.generalLedgerEntry.findFirst({
      where: {
        id: entryId,
        accountingClientId
      }
    });

    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }

    // Only allow deletion of manual entries or entries created by the same user
    if (entry.sourceType !== LedgerSourceType.MANUAL_ENTRY && 
        !entry.sourceId?.includes(`manual-${user.id}`)) {
      throw new BadRequestException('Only manual journal entries can be deleted');
    }

    // Delete the entry
    await this.prisma.generalLedgerEntry.delete({
      where: { id: entryId }
    });

    console.log('[ACCOUNTING SERVICE] Journal entry deleted:', {
      entryId,
      accountingClientId,
      sourceType: entry.sourceType,
      sourceId: entry.sourceId
    });

    return {
      success: true,
      message: 'Journal entry deleted successfully'
    };
  }
}

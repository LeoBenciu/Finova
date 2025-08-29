import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { User } from '@prisma/client';

interface LedgerQuery {
  startDate?: string;
  endDate?: string;
  accountCode?: string;
  page: number;
  size: number;
}

@Injectable()
export class AccountingService {
  constructor(private prisma: PrismaService) {}

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
}

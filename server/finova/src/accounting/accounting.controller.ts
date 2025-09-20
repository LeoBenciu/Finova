import { Controller, Get, Post, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard';
import { GetUser } from 'src/auth/decorator';
import { User } from '@prisma/client';
import { AccountingService } from 'src/accounting/accounting.service';

@UseGuards(JwtGuard)
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get(':clientEin/ledger')
  async getLedgerEntries(
    @Param('clientEin') clientEin: string,
    @GetUser() user: User,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('accountCode') accountCode?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    const p = Number(page) || 1;
    const s = Math.min(Number(size) || 50, 200);
    return this.accountingService.getLedgerEntries(clientEin, user, { startDate, endDate, accountCode, page: p, size: s });
  }

  @Post(':clientEin/ledger/manual')
  async createManualJournalEntry(
    @Param('clientEin') clientEin: string,
    @GetUser() user: User,
    @Body() body: {
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
    return this.accountingService.createManualJournalEntry(clientEin, user, body);
  }

  @Delete(':clientEin/ledger/:entryId')
  async deleteJournalEntry(
    @Param('clientEin') clientEin: string,
    @Param('entryId') entryId: string,
    @GetUser() user: User
  ) {
    return this.accountingService.deleteJournalEntry(clientEin, parseInt(entryId), user);
  }
}

import { Controller, UseGuards, Get, Post, Put, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { GetUser } from 'src/auth/decorator';
import { User } from '@prisma/client';
import { JwtGuard } from 'src/auth/guard';
import { BankService } from './bank.service';

@UseGuards(JwtGuard)
@Controller('bank')
export class BankController {
    constructor(private readonly bankService: BankService){}

    @Get(':clientEin/dashboard')
    async getReconciliationDashboard(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User
    ) {
      return this.bankService.getReconciliationStats(clientEin, user);
    }
    
    @Get(':clientEin/documents')
    async getFinancialDocuments(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User,
      @Query('unreconciled') unreconciled?: string,
      @Query('status') status?: string,
      @Query('page') page?: string,
      @Query('size') size?: string
    ) {
      // Support both old 'unreconciled' param and new 'status' param for backwards compatibility
      let filterStatus: 'all' | 'reconciled' | 'unreconciled' = 'all';
      if (status) {
        filterStatus = status as 'all' | 'reconciled' | 'unreconciled';
      } else if (unreconciled === 'true') {
        filterStatus = 'unreconciled';
      }
      
      return this.bankService.getFinancialDocuments(
        clientEin,
        user,
        filterStatus,
        Number(page) || 1,
        Number(size) || 25
      );
    }
    
    @Get(':clientEin/transactions')
    async getBankTransactions(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User,
      @Query('unreconciled') unreconciled?: string,
      @Query('status') status?: string,
      @Query('page') page?: string,
      @Query('size') size?: string
    ) {
      // Support both old 'unreconciled' param and new 'status' param for backwards compatibility
      let filterStatus: 'all' | 'reconciled' | 'unreconciled' = 'all';
      if (status) {
        filterStatus = status as 'all' | 'reconciled' | 'unreconciled';
      } else if (unreconciled === 'true') {
        filterStatus = 'unreconciled';
      }
      
      return this.bankService.getBankTransactions(
        clientEin,
        user,
        filterStatus,
        Number(page) || 1,
        Number(size) || 25
      );
    }
    
    @Get(':clientEin/suggestions')
    async getReconciliationSuggestions(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User,
      @Query('page') page?: string,
      @Query('size') size?: string
    ) {
      return this.bankService.getReconciliationSuggestions(
        clientEin,
        user,
        Number(page) || 1,
        Number(size) || 25
      );
    }
    
    @Post('match')
    async createManualMatch(
      @Body() matchData: {
        documentId: number;
        bankTransactionId: string;
        notes?: string;
      },
      @GetUser() user: User
    ) {
      return this.bankService.createManualMatch(matchData, user);
    }
    
    @Post('bulk-match')
    async createBulkMatches(
      @Body() bulkData: {
        matches: Array<{
          documentId: number;
          bankTransactionId: string;
          notes?: string;
        }>;
      },
      @GetUser() user: User
    ) {
      return this.bankService.createBulkMatches(bulkData.matches, user);
    }
    
    @Put('suggestion/:id/accept')
    async acceptSuggestion(
      @Param('id', ParseIntPipe) suggestionId: number,
      @GetUser() user: User,
      @Body() data: { notes?: string }
    ) {
      return this.bankService.acceptSuggestion(suggestionId, user, data.notes);
    }
    
    @Put('suggestion/:id/reject')
    async rejectSuggestion(
      @Param('id', ParseIntPipe) suggestionId: number,
      @GetUser() user: User,
      @Body() data: { reason?: string }
    ) {
      return this.bankService.rejectSuggestion(suggestionId, user, data.reason);
    }
    
    @Put('transaction/:transactionId/unreconcile')
    async unreconcileTransaction(
      @Param('transactionId') transactionId: string,
      @GetUser() user: User,
      @Body() data: { reason?: string }
    ) {
      return this.bankService.unreconcileTransaction(transactionId, user, data.reason);
    }
    
    @Put('document/:documentId/unreconcile')
    async unreconcileDocument(
      @Param('documentId') documentId: string,
      @GetUser() user: User,
      @Body() data: { reason?: string }
    ) {
      return this.bankService.unreconcileDocument(parseInt(documentId), user, data.reason);
    }
    
    @Post(':clientEin/suggestions/regenerate')
    async regenerateAllSuggestions(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User
    ) {
      return this.bankService.regenerateAllSuggestions(clientEin, user);
    }
    
    @Post('transaction/:transactionId/suggestions/regenerate')
    async regenerateTransactionSuggestions(
      @Param('transactionId') transactionId: string,
      @GetUser() user: User
    ) {
      return this.bankService.regenerateTransactionSuggestions(transactionId, user);
    }

    @Get(':clientEin/reports/reconciliation-summary')
    async getReconciliationSummaryReport(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User,
      @Query('month') month: string,
      @Query('year') year: string
    ) {
      return this.bankService.getReconciliationSummaryReport(clientEin, user, month, year);
    }

    @Get(':clientEin/reports/account-attribution')
    async getAccountAttributionReport(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User,
      @Query('month') month: string,
      @Query('year') year: string
    ) {
      return this.bankService.getAccountAttributionReport(clientEin, user, month, year);
    }

    @Get(':clientEin/reports/exceptions')
    async getExceptionReport(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User,
      @Query('month') month: string,
      @Query('year') year: string
    ) {
      return this.bankService.getExceptionReport(clientEin, user, month, year);
    }

    
}

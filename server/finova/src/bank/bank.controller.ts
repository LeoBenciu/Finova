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
      @Body() data: { reason?: string },
      @GetUser() user: User
    ) {
      return this.bankService.rejectSuggestion(suggestionId, user, data.reason);
    }

    @Get(':clientEin/balance-reconciliation')
    async getBalanceReconciliationStatement(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User,
      @Query('startDate') startDate?: string,
      @Query('endDate') endDate?: string
    ) {
      return this.bankService.getBalanceReconciliationStatement(clientEin, user, startDate, endDate);
    }

    @Get(':clientEin/reports/summary')
    async getBankReconciliationSummaryReport(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User,
      @Query('startDate') startDate?: string,
      @Query('endDate') endDate?: string
    ) {
      return this.bankService.getBankReconciliationSummaryReport(clientEin, user, startDate, endDate);
    }

    @Get(':clientEin/reports/outstanding-items')
    async getOutstandingItemsAging(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User
    ) {
      return this.bankService.getOutstandingItemsAging(clientEin, user);
    }

    @Get(':clientEin/reports/audit-trail')
    async getReconciliationHistoryAndAuditTrail(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User,
      @Query('startDate') startDate?: string,
      @Query('endDate') endDate?: string,
      @Query('page') page?: string,
      @Query('size') size?: string
    ) {
      return this.bankService.getReconciliationHistoryAndAuditTrail(
        clientEin, 
        user, 
        startDate, 
        endDate, 
        Number(page) || 1, 
        Number(size) || 50
      );
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
    
    /**
     * Update a document's reconciliation status (toggle exclude/include from bank rec)
     * Allowed statuses via this endpoint: IGNORED, UNRECONCILED
     */
    @Put(':clientEin/document/:documentId/status')
    async updateDocumentReconciliationStatus(
      @Param('clientEin') clientEin: string,
      @Param('documentId', ParseIntPipe) documentId: number,
      @GetUser() user: User,
      @Body() data: { status: 'IGNORED' | 'UNRECONCILED' }
    ) {
      return this.bankService.updateDocumentReconciliationStatus(clientEin, user, documentId, data.status);
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

    @Put('transaction/:transactionId/reconcile-account')
    async reconcileTransactionWithAccount(
      @Param('transactionId') transactionId: string,
      @Body() reconciliationData: { accountCode: string; notes?: string },
      @GetUser() user: User
    ) {
      return this.bankService.createManualAccountReconciliation(
        transactionId,
        reconciliationData.accountCode,
        reconciliationData.notes || '',
        user
      );
    }

    // Outstanding Items Management Endpoints
    @Get(':clientEin/outstanding-items')
    async getOutstandingItems(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User,
      @Query('type') type?: string,
      @Query('status') status?: string,
      @Query('startDate') startDate?: string,
      @Query('endDate') endDate?: string
    ) {
      return this.bankService.getOutstandingItems(clientEin, user, type, status, startDate, endDate);
    }



    @Post(':clientEin/outstanding-items')
    async createOutstandingItem(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User,
      @Body() data: {
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
      }
    ) {
      return this.bankService.createOutstandingItem(clientEin, user, data);
    }

    @Put('outstanding-items/:itemId')
    async updateOutstandingItem(
      @Param('itemId', ParseIntPipe) itemId: number,
      @GetUser() user: User,
      @Body() data: {
        status?: 'OUTSTANDING' | 'CLEARED' | 'STALE' | 'VOIDED';
        actualClearDate?: string;
        notes?: string;
        relatedTransactionId?: string;
      }
    ) {
      return this.bankService.updateOutstandingItem(itemId, user, data);
    }

    @Put('outstanding-items/:itemId/clear')
    async markOutstandingItemAsCleared(
      @Param('itemId', ParseIntPipe) itemId: number,
      @GetUser() user: User,
      @Body() data: { transactionId?: string; clearDate?: string }
    ) {
      return this.bankService.markOutstandingItemAsCleared(itemId, user, data.transactionId, data.clearDate);
    }

    @Put('outstanding-items/:itemId/stale')
    async markOutstandingItemAsStale(
      @Param('itemId', ParseIntPipe) itemId: number,
      @GetUser() user: User,
      @Body() data: { notes?: string }
    ) {
      return this.bankService.markOutstandingItemAsStale(itemId, user, data.notes);
    }

    @Put('outstanding-items/:itemId/void')
    async voidOutstandingItem(
      @Param('itemId', ParseIntPipe) itemId: number,
      @GetUser() user: User,
      @Body() data: { notes?: string }
    ) {
      return this.bankService.voidOutstandingItem(itemId, user, data.notes);
    }

    @Put('outstanding-items/:itemId/delete')
    async deleteOutstandingItem(
      @Param('itemId', ParseIntPipe) itemId: number,
      @GetUser() user: User
    ) {
      return this.bankService.deleteOutstandingItem(itemId, user);
    }

    // ==================== MULTI-BANK ACCOUNT ENDPOINTS ====================

    @Get(':clientEin/accounts')
    async getBankAccounts(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User
    ) {
      return this.bankService.getBankAccounts(clientEin, user);
    }

    @Post(':clientEin/accounts')
    async createBankAccount(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User,
      @Body() accountData: {
        iban: string;
        accountName: string;
        bankName: string;
        currency?: string;
        accountType?: 'CURRENT' | 'SAVINGS' | 'BUSINESS' | 'CREDIT';
      }
    ) {
      return this.bankService.createBankAccount(clientEin, user, accountData);
    }

    @Put('accounts/:accountId')
    async updateBankAccount(
      @Param('accountId', ParseIntPipe) accountId: number,
      @GetUser() user: User,
      @Body() updateData: {
        accountName?: string;
        bankName?: string;
        currency?: string;
        accountType?: 'CURRENT' | 'SAVINGS' | 'BUSINESS' | 'CREDIT';
        isActive?: boolean;
      }
    ) {
      return this.bankService.updateBankAccount(accountId, user, updateData);
    }

    @Put('accounts/:accountId/deactivate')
    async deactivateBankAccount(
      @Param('accountId', ParseIntPipe) accountId: number,
      @GetUser() user: User
    ) {
      return this.bankService.deactivateBankAccount(accountId, user);
    }

    @Get(':clientEin/transactions/by-account')
    async getBankTransactionsByAccount(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User,
      @Query('accountId') accountId?: string,
      @Query('status') status?: 'all' | 'reconciled' | 'unreconciled',
      @Query('page') page?: string,
      @Query('size') size?: string
    ) {
      return this.bankService.getBankTransactionsByAccount(
        clientEin,
        user,
        accountId ? Number(accountId) : undefined,
        status || 'all',
        Number(page) || 1,
        Number(size) || 25
      );
    }

    @Get(':clientEin/accounts/consolidated-view')
    async getConsolidatedAccountView(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User
    ) {
      return this.bankService.getConsolidatedAccountView(clientEin, user);
    }

    @Post(':clientEin/accounts/associate-transactions')
    async associateTransactionsWithAccounts(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User
    ) {
      return this.bankService.associateTransactionsWithAccounts(clientEin, user);
    }

    
}

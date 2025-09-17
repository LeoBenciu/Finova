import { Controller, UseGuards, Get, Post, Put, Body, Param, Query, ParseIntPipe, Delete } from '@nestjs/common';
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
      @Query('size') size?: string,
      @Query('accountId') accountId?: string
    ) {
      return this.bankService.getReconciliationSuggestions(
        clientEin,
        user,
        Number(page) || 1,
        Number(size) || 25,
        accountId ? Number(accountId) : undefined
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
      console.log('[BANK CONTROLLER] acceptSuggestion called:', {
        suggestionId,
        userId: user.id,
        userCompanyId: user.accountingCompanyId,
        notes: data.notes
      });
      
      try {
        const result = await this.bankService.acceptSuggestion(suggestionId, user, data.notes);
        console.log('[BANK CONTROLLER] acceptSuggestion completed successfully:', {
          suggestionId,
          result: result ? 'Success' : 'No result'
        });
        return result;
      } catch (error) {
        console.error('[BANK CONTROLLER] acceptSuggestion failed:', {
          suggestionId,
          error: error.message,
          stack: error.stack
        });
        throw error;
      }
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
      const sdebug = /^(1|true|on|yes)$/i.test(process.env.SUGGESTIONS_DEBUG || '');
      if (sdebug) {
        console.log('[SuggestionsDebug][Controller] Regenerate ALL start', { clientEin, userId: user?.id });
      }
      return this.bankService.regenerateAllSuggestions(clientEin, user);
    }
    
    @Post('transaction/:transactionId/suggestions/regenerate')
    async regenerateTransactionSuggestions(
      @Param('transactionId') transactionId: string,
      @GetUser() user: User
    ) {
      const sdebug = /^(1|true|on|yes)$/i.test(process.env.SUGGESTIONS_DEBUG || '');
      if (sdebug) {
        console.log('[SuggestionsDebug][Controller] Regenerate TX start', { transactionId, userId: user?.id });
      }
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
      console.log('[BANK CONTROLLER] reconcileTransactionWithAccount called:', {
        transactionId,
        accountCode: reconciliationData.accountCode,
        notes: reconciliationData.notes,
        userId: user.id,
        userCompanyId: user.accountingCompanyId
      });
      
      try {
        const result = await this.bankService.createManualAccountReconciliation(
          transactionId,
          reconciliationData.accountCode,
          reconciliationData.notes || '',
          user
        );
        console.log('[BANK CONTROLLER] reconcileTransactionWithAccount completed successfully');
        return result;
      } catch (error) {
        console.error('[BANK CONTROLLER] reconcileTransactionWithAccount failed:', {
          transactionId,
          accountCode: reconciliationData.accountCode,
          error: error.message,
          stack: error.stack
        });
        throw error;
      }
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

    // ==================== BANK ACCOUNT ANALYTIC MAPPINGS ====================
    @Get(':clientEin/account-analytics')
    async getBankAccountAnalytics(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User
    ) {
      return this.bankService.getBankAccountAnalytics(clientEin, user);
    }

    @Post(':clientEin/account-analytics')
    async createBankAccountAnalytic(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User,
      @Body() data: {
        iban: string;
        currency: string;
        syntheticCode: string;
        analyticSuffix: string;
        bankName?: string;
        accountAlias?: string;
      }
    ) {
      return this.bankService.createBankAccountAnalytic(clientEin, user, data);
    }

    @Put('account-analytics/:id')
    async updateBankAccountAnalytic(
      @Param('id', ParseIntPipe) id: number,
      @GetUser() user: User,
      @Body() data: {
        currency?: string;
        syntheticCode?: string;
        analyticSuffix?: string;
        bankName?: string;
        accountAlias?: string;
      }
    ) {
      return this.bankService.updateBankAccountAnalytic(id, user, data);
    }

    @Delete('account-analytics/:id')
    async deleteBankAccountAnalytic(
      @Param('id', ParseIntPipe) id: number,
      @GetUser() user: User
    ) {
      return this.bankService.deleteBankAccountAnalytic(id, user);
    }

    // ==================== TRANSACTION SPLITS ====================
    @Get('transaction/:transactionId/splits')
    async getTransactionSplits(
      @Param('transactionId') transactionId: string,
      @GetUser() user: User
    ) {
      return this.bankService.getTransactionSplits(transactionId, user);
    }

    @Put('transaction/:transactionId/splits')
    async setTransactionSplits(
      @Param('transactionId') transactionId: string,
      @GetUser() user: User,
      @Body() data: { splits: { amount: number; accountCode: string; notes?: string }[] }
    ) {
      return this.bankService.setTransactionSplits(transactionId, user, data);
    }

    @Delete('split/:splitId')
    async deleteTransactionSplit(
      @Param('splitId', ParseIntPipe) splitId: number,
      @GetUser() user: User
    ) {
      return this.bankService.deleteTransactionSplit(splitId, user);
    }

    @Post('transaction/:transactionId/splits/suggest')
    async suggestTransactionSplits(
      @Param('transactionId') transactionId: string,
      @GetUser() user: User
    ) {
      return this.bankService.suggestTransactionSplits(transactionId, user);
    }

    // ==================== TRANSFER RECONCILIATION ENDPOINTS ====================
    @Post(':clientEin/transfer-reconcile')
    async createTransferReconciliation(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User,
      @Body() data: {
        sourceTransactionId: string;
        destinationTransactionId: string;
        sourceAccountCode?: string; // optional; derived from IBAN mapping if omitted
        destinationAccountCode?: string; // optional; derived from IBAN mapping if omitted
        fxRate?: number;
        notes?: string;
      }
    ) {
      return this.bankService.createTransferReconciliation(clientEin, user, data);
    }

    @Get(':clientEin/transfer-candidates')
    async getTransferReconciliationCandidates(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User,
      @Query('daysWindow') daysWindow?: string,
      @Query('maxResults') maxResults?: string,
      @Query('allowCrossCurrency') allowCrossCurrency?: string,
      @Query('fxTolerancePct') fxTolerancePct?: string
    ) {
      return this.bankService.getTransferReconciliationCandidates(clientEin, user, {
        daysWindow: daysWindow ? Number(daysWindow) : 2,
        maxResults: maxResults ? Number(maxResults) : 50,
        allowCrossCurrency: allowCrossCurrency === 'true',
        fxTolerancePct: fxTolerancePct ? Number(fxTolerancePct) : undefined,
      });
    }

    @Get(':clientEin/pending-transfers')
    async getPendingTransferReconciliations(
      @Param('clientEin') clientEin: string,
      @GetUser() user: User
    ) {
      return this.bankService.getPendingTransferReconciliations(clientEin, user);
    }

    @Get(':clientEin/transaction/:transactionId/transfer-candidates')
    async getTransferReconciliationCandidatesForTransaction(
      @Param('clientEin') clientEin: string,
      @Param('transactionId') transactionId: string,
      @GetUser() user: User,
      @Query('daysWindow') daysWindow?: string,
      @Query('maxResults') maxResults?: string,
      @Query('allowCrossCurrency') allowCrossCurrency?: string,
      @Query('fxTolerancePct') fxTolerancePct?: string
    ) {
      return this.bankService.getTransferReconciliationCandidatesForTransaction(
        clientEin,
        user,
        transactionId,
        {
          daysWindow: daysWindow ? Number(daysWindow) : 2,
          maxResults: maxResults ? Number(maxResults) : 50,
          allowCrossCurrency: allowCrossCurrency === 'true',
          fxTolerancePct: fxTolerancePct ? Number(fxTolerancePct) : undefined,
        }
      );
    }

    @Delete(':clientEin/transfer-reconcile/:id')
    async deleteTransferReconciliation(
      @Param('clientEin') clientEin: string,
      @Param('id', ParseIntPipe) id: number,
      @GetUser() user: User
    ) {
      return this.bankService.deleteTransferReconciliation(clientEin, id, user);
    }
}

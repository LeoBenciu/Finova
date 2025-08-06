import { PrismaService } from 'src/prisma/prisma.service';
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { User, ReconciliationStatus, MatchType, SuggestionStatus } from '@prisma/client';
import * as AWS from 'aws-sdk';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

@Injectable()
export class BankService {

    constructor(private readonly prisma:PrismaService){
        
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
              type: { in: ['Invoice', 'Receipt', 'Payment Order', 'Collection Order'] }
            }
          }),
          this.prisma.document.count({
            where: {
              accountingClientId: accountingClientRelation.id,
              type: { in: ['Invoice', 'Receipt', 'Payment Order', 'Collection Order'] },
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
      
        const unmatchedDocuments = await this.prisma.document.findMany({
          where: {
            accountingClientId: accountingClientRelation.id,
            type: { in: ['Invoice', 'Receipt', 'Payment Order', 'Collection Order'] },
            reconciliationStatus: ReconciliationStatus.UNRECONCILED
          },
          include: { processedData: true }
        });
      
        let unmatchedAmount = 0;
        unmatchedDocuments.forEach(doc => {
          try {
            const extractedFields = doc.processedData?.extractedFields;
            let amount = 0;
            
            if (typeof extractedFields === 'string') {
              const parsed = JSON.parse(extractedFields);
              amount = parsed.result?.total_amount || parsed.total_amount || 0;
            } else if (extractedFields && typeof extractedFields === 'object') {
              const result = (extractedFields as any).result || extractedFields;
              amount = result.total_amount || 0;
            }
            
            unmatchedAmount += Number(amount) || 0;
          } catch (e) {
          }
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
      
      async getFinancialDocuments(clientEin: string, user: User, unreconciled: boolean = false) {
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
          type: { in: ['Invoice', 'Receipt', 'Payment Order', 'Collection Order'] }
        };
      
        if (unreconciled) {
          whereCondition.reconciliationStatus = ReconciliationStatus.UNRECONCILED;
        }
      
        const documents = await this.prisma.document.findMany({
          where: whereCondition,
          include: {
            processedData: true,
            reconciliationRecords: {
              include: {
                bankTransaction: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        });
      
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
            reconciliationStatus: doc.reconciliationStatus,
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
      
        return documentsWithUrls;
      }
      
      async getBankTransactions(clientEin: string, user: User, unreconciled: boolean = false) {
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
      
        if (unreconciled) {
          whereCondition.reconciliationStatus = ReconciliationStatus.UNRECONCILED;
        }
      
        const transactions = await this.prisma.bankTransaction.findMany({
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
          orderBy: { transactionDate: 'desc' }
        });
      
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
              reconciliationStatus: transaction.reconciliationStatus,
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
      
        return transactionsWithSignedUrls;
      }

      
      async getReconciliationSuggestions(clientEin: string, user: User) {
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
      
        const suggestions = await this.prisma.reconciliationSuggestion.findMany({
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
          orderBy: { confidenceScore: 'desc' }
        });
      
        return suggestions.map(s => ({
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
              }
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
                // legacy keys expected by frontend
                code: s.chartOfAccount.accountCode,
                name: s.chartOfAccount.accountName,
                // new explicit keys
                accountCode: s.chartOfAccount.accountCode,
                accountName: s.chartOfAccount.accountName,
              } as any)
            : null,
        }));
      }

      async createManualMatch(matchData: { documentId: number; bankTransactionId: string; notes?: string }, user: User) {
        return await this.prisma.$transaction(async (prisma) => {
          const document = await prisma.document.findUnique({
            where: { id: matchData.documentId },
            include: {
              accountingClient: true
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
      
          if (!suggestion) {
            throw new NotFoundException('Suggestion not found');
          }
      
          if (suggestion.document.accountingClient.accountingCompanyId !== user.accountingCompanyId) {
            throw new UnauthorizedException('No access to this suggestion');
          }
      
          if (suggestion.status !== SuggestionStatus.PENDING) {
            throw new Error('Suggestion is no longer pending');
          }
      
          const existingMatch = await prisma.reconciliationRecord.findUnique({
            where: {
              documentId_bankTransactionId: {
                documentId: suggestion.documentId,
                bankTransactionId: suggestion.bankTransactionId
              }
            }
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
            }
          }
        });
      
        if (!suggestion) {
          throw new NotFoundException('Suggestion not found');
        }
      
        if (suggestion.document.accountingClient.accountingCompanyId !== user.accountingCompanyId) {
          throw new UnauthorizedException('No access to this suggestion');
        }
      
        if (suggestion.status !== SuggestionStatus.PENDING) {
          throw new Error('Suggestion is no longer pending');
        }
      
        const updatedSuggestion = await this.prisma.reconciliationSuggestion.update({
          where: { id: suggestionId },
          data: { 
            status: SuggestionStatus.REJECTED,
            reasons: reason ? [...(suggestion.reasons || []), `Rejected: ${reason}`] : suggestion.reasons
          }
        });
      
        return updatedSuggestion;
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
        // Documents statistics
        this.prisma.document.groupBy({
          by: ['reconciliationStatus'],
          where: {
            accountingClientId: accountingClientRelation.id,
            type: { in: ['Invoice', 'Receipt', 'Payment Order', 'Collection Order'] },
            createdAt: { gte: startDate, lte: endDate }
          },
          _count: { id: true },
          _sum: { 
            // We'll need to calculate amounts from processedData
          }
        }),
    
        // Bank transactions statistics
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
    
        // Reconciliation activity
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
    
      // Calculate document amounts
      const documentsWithAmounts = await this.prisma.document.findMany({
        where: {
          accountingClientId: accountingClientRelation.id,
          type: { in: ['Invoice', 'Receipt', 'Payment Order', 'Collection Order'] },
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
            type: { in: ['Invoice', 'Receipt', 'Payment Order', 'Collection Order'] },
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

      
}

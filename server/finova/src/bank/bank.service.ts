import { PrismaService } from 'src/prisma/prisma.service';
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { User, ReconciliationStatus, MatchType, SuggestionStatus, PaymentStatus } from '@prisma/client';
import { DataExtractionService } from 'src/data-extraction/data-extraction.service';
import * as AWS from 'aws-sdk';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

@Injectable()
export class BankService {

    constructor(
        private readonly prisma: PrismaService,
        private readonly dataExtractionService: DataExtractionService
    ){}

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
      
      async getFinancialDocuments(clientEin: string, user: User, unreconciled: boolean = false, page = 1, size = 25) {
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
      
        if (unreconciled) {
          whereCondition.reconciliationStatus = ReconciliationStatus.UNRECONCILED;
        }
      
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
      
        return { total, page, size, items: documentsWithUrls };
      }
      
      async getBankTransactions(clientEin: string, user: User, unreconciled: boolean = false, page = 1, size = 25) {
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
      
        return { total, page, size, items: transactionsWithSignedUrls };
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

            return {
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
            };
          })
        );
            
        // Check if we need to regenerate suggestions based on unreconciled transactions
        const unreconciliedTransactionCount = await this.prisma.bankTransaction.count({
          where: {
            bankStatementDocument: { accountingClientId: accountingClientRelation.id },
            reconciliationStatus: ReconciliationStatus.UNRECONCILED
          }
        });
        
        // Regenerate if we have fewer suggestions than unreconciled transactions (should be at least 1 per transaction)
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
            
            return { items: newItems, total: newTotal };
          } catch (error) {
            console.error('Failed to generate suggestions:', error);
            return { items, total };
          }
        }
        
        return { items, total };
      }

      async createManualMatch(matchData: { documentId: number; bankTransactionId: string; notes?: string }, user: User) {
        return await this.prisma.$transaction(async (prisma) => {
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
              : suggestion.bankTransaction?.bankStatementDocument.accountingClient.accountingCompanyId;
          
          console.log('🏢 AUTHORIZATION CHECK:', {
            suggestionId,
            userId: user.id,
            userCompanyId: user.accountingCompanyId,
            suggestionCompanyId,
            hasDocument: !!suggestion.document,
            hasBankTransaction: !!suggestion.bankTransaction,
            documentCompanyId: suggestion.document?.accountingClient?.accountingCompanyId,
            bankTransactionCompanyId: suggestion.bankTransaction?.bankStatementDocument?.accountingClient?.accountingCompanyId
          });
          
          if (suggestionCompanyId !== user.accountingCompanyId) {
            console.error('❌ AUTHORIZATION FAILED:', {
              reason: 'Company ID mismatch',
              userCompanyId: user.accountingCompanyId,
              suggestionCompanyId,
              suggestionId
            });
            throw new UnauthorizedException('No access to this suggestion');
          }
          
          console.log('✅ Authorization passed for suggestion', suggestionId);
      
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
      
}

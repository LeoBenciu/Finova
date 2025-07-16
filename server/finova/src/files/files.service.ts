import { Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ArticleType, User, CorrectionType, DuplicateStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DataExtractionService } from '../data-extraction/data-extraction.service';
import * as AWS from 'aws-sdk';
import * as crypto from 'crypto';

@Injectable()
export class FilesService {

    constructor(
        private prisma: PrismaService,
        private dataExtractionService: DataExtractionService
    ) {}
    
    async getFiles(ein: string, user: User) {
        try {
            const currentUser = await this.prisma.user.findUnique({
                where: { id: user.id },
                include: {
                    accountingCompany: true
                }
            });
    
            if (!currentUser) {
                throw new NotFoundException('User not found in the database!');
            }
    
            const clientCompany = await this.prisma.clientCompany.findUnique({
                where: { ein: ein }
            });
    
            if (!clientCompany) {
                throw new NotFoundException('Client Company not found in the database!');
            }
    
            const accountingClientRelation = await this.prisma.accountingClients.findFirst({
                where: {
                    accountingCompanyId: currentUser.accountingCompanyId,
                    clientCompanyId: clientCompany.id
                }
            });
    
            if (!accountingClientRelation) {
                throw new NotFoundException('No authorized relationship found between your accounting company and this client!');
            }
    
            const documents = await this.prisma.document.findMany({
                where: {
                    accountingClientId: accountingClientRelation.id 
                },
                include: {
                    accountingClient: {
                        include: {
                            accountingCompany: {
                                select: { id: true, name: true, ein: true }
                            }
                        }
                    },
                    duplicateChecks: {
                        include: {
                            originalDocument: true
                        }
                    },
                    duplicateMatches: {
                        include: {
                            duplicateDocument: true
                        }
                    },
                    complianceValidations: {
                        orderBy: {
                            createdAt: 'desc'
                        },
                        take: 1
                    }
                }
            });
    
            console.log(`[DEBUG] User ${user.id} from company ${currentUser.accountingCompanyId} accessing ${documents.length} documents for client ${ein}`);
    
            const unauthorizedDocs = documents.filter(doc => 
                doc.accountingClient.accountingCompanyId !== currentUser.accountingCompanyId
            );
    
            if (unauthorizedDocs.length > 0) {
                console.error(`[SECURITY ALERT] Found ${unauthorizedDocs.length} unauthorized documents for user ${user.id}`);
                throw new UnauthorizedException('Unauthorized access to documents detected');
            }
    
            const s3 = new AWS.S3({
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                region: process.env.AWS_REGION
            });
    
            const documentIds = documents.map(doc => doc.id);
            
            const [processedData, rpaActions] = await Promise.all([
                this.prisma.processedData.findMany({
                    where: { documentId: { in: documentIds } }
                }),
                this.prisma.rpaAction.findMany({
                    where: { documentId: { in: documentIds } }
                })
            ]);
    
            const documentsWithData = await Promise.all(
                documents.map(async (document) => {
                    const signedUrl = await s3.getSignedUrlPromise('getObject', {
                        Bucket: process.env.AWS_S3_BUCKET_NAME,
                        Key: document.s3Key,
                        Expires: 60 * 60,
                    });

                    const hasDuplicateAlert = document.duplicateChecks.some(check => check.status === 'PENDING') ||
                                           document.duplicateMatches.some(check => check.status === 'PENDING');

                    const latestCompliance = document.complianceValidations[0];
                    const hasComplianceIssues = latestCompliance && 
                        (latestCompliance.overallStatus === 'NON_COMPLIANT' || latestCompliance.overallStatus === 'WARNING');
    
                    return {
                        ...document,
                        processedData: processedData.filter(pd => pd.documentId === document.id),
                        signedUrl,
                        rpa: rpaActions.filter(rp => rp.documentId === document.id),
                        hasDuplicateAlert,
                        hasComplianceIssues,
                        complianceStatus: latestCompliance?.overallStatus || 'PENDING'
                    };
                })
            );
    
            return {
                documents: documentsWithData,
                accountingCompany: {
                    id: currentUser.accountingCompanyId,
                    name: currentUser.accountingCompany.name,
                    ein: currentUser.accountingCompany.ein
                },
                clientCompany: {
                    id: clientCompany.id,
                    name: clientCompany.name,
                    ein: clientCompany.ein
                }
            };
    
        } catch (e) {
            if (e instanceof NotFoundException || e instanceof UnauthorizedException) throw e;
            console.error('[FILES_SERVICE_ERROR]', e);
            throw new InternalServerErrorException("Failed to find documents in the database!");
        }
    }

    async verifyDocumentAccess(documentId: number, user: User): Promise<boolean> {
        const document = await this.prisma.document.findUnique({
            where: { id: documentId },
            include: {
                accountingClient: {
                    include: {
                        accountingCompany: true
                    }
                }
            }
        });
    
        if (!document) {
            throw new NotFoundException('Document not found');
        }
    
        const hasAccess = document.accountingClient.accountingCompanyId === user.accountingCompanyId;
        
        if (!hasAccess) {
            console.error(`[SECURITY] User ${user.id} attempted to access document ${documentId} belonging to company ${document.accountingClient.accountingCompanyId}`);
        }
    
        return hasAccess;
    }

    private generateDocumentHash(fileBuffer: Buffer): string {
        return crypto.createHash('md5').update(fileBuffer).digest('hex');
    }

    async postFile(clientEin: string, processedData: any, file: Express.Multer.File, user: User) {
    let uploadResult;
    let fileKey;
    
    const s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION
    });

    try {
        const currentUser = await this.prisma.user.findUnique({
            where: { id: user.id },
            include: { accountingCompany: true }
        });

        if (!currentUser) {
            throw new NotFoundException('User not found in the database');
        }

        const clientCompany = await this.prisma.clientCompany.findUnique({
            where: { ein: clientEin }
        });

        if (!clientCompany) {
            throw new NotFoundException('Client company doesn\'t exist in the database');
        }

        const accountingClientRelation = await this.prisma.accountingClients.findFirst({
            where: {
                accountingCompanyId: currentUser.accountingCompanyId,
                clientCompanyId: clientCompany.id
            }
        });

        if (!accountingClientRelation) {
            throw new UnauthorizedException('You don\'t have access to this client company');
        }

        const documentHash = this.generateDocumentHash(file.buffer);

        fileKey = `${currentUser.accountingCompanyId}/${clientCompany.id}/${Date.now()}-${file.originalname}`;

        uploadResult = await s3.upload({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: fileKey,
            Body: file.buffer,
            ContentType: file.mimetype
        }).promise();

        const result = await this.prisma.$transaction(async (prisma) => {
            const document = await prisma.document.create({
                data: {
                    name: file.originalname,
                    type: processedData.result.document_type,
                    path: uploadResult.Location,
                    s3Key: fileKey,
                    contentType: file.mimetype,
                    fileSize: file.size,
                    documentHash: documentHash,
                    accountingClientId: accountingClientRelation.id
                }
            });

            const processedDataDb = await prisma.processedData.create({
                data: {
                    documentId: document.id,
                    extractedFields: processedData
                }
            });

            if (processedData.result.duplicate_detection) {
                try {
                    const duplicateMatches = processedData.result.duplicate_detection.duplicate_matches || [];
                    for (const match of duplicateMatches) {
                        if (match.document_id && match.document_id !== document.id) {
                            await prisma.documentDuplicateCheck.create({
                                data: {
                                    originalDocumentId: document.id,
                                    duplicateDocumentId: match.document_id,
                                    similarityScore: match.similarity_score || 0.0,
                                    matchingFields: match.matching_fields || {},
                                    duplicateType: this.mapDuplicateType(match.duplicate_type),
                                    status: 'PENDING'
                                }
                            });
                        }
                    }
                } catch (duplicateError) {
                    console.warn('[DUPLICATE_DETECTION_WARNING]', duplicateError);
                }
            }

            if (processedData.result.compliance_validation) {
                try {
                    const compliance = processedData.result.compliance_validation;
                    
                    let validationRules, errors, warnings;
                    
                    if (compliance.validation_rules?.ro && compliance.validation_rules?.en) {
                        validationRules = compliance.validation_rules;
                        errors = compliance.errors;
                        warnings = compliance.warnings;
                    } else {
                        validationRules = {
                            ro: compliance.validation_rules || [],
                            en: compliance.validation_rules || []
                        };
                        errors = {
                            ro: compliance.errors || [],
                            en: compliance.errors || []
                        };
                        warnings = {
                            ro: compliance.warnings || [],
                            en: compliance.warnings || []
                        };
                    }

                    await prisma.complianceValidation.create({
                        data: {
                            documentId: document.id,
                            overallStatus: this.mapComplianceStatus(compliance.compliance_status),
                            validationRules: validationRules,
                            errors: errors,
                            warnings: warnings,
                            overallScore: compliance.overall_score || null,
                            validatedAt: new Date()
                        }
                    });
                } catch (complianceError) {
                    console.warn('[COMPLIANCE_VALIDATION_WARNING]', complianceError);
                }
            }

            if (processedData.userCorrections && processedData.userCorrections.length > 0) {
                try {
                    for (const correction of processedData.userCorrections) {
                        await prisma.userCorrection.create({
                            data: {
                                documentId: document.id,
                                userId: user.id,
                                correctionType: this.mapCorrectionType(correction.field),
                                originalValue: correction.originalValue,
                                correctedValue: correction.newValue,
                                confidence: null,
                                applied: false
                            }
                        });
                    }
                } catch (correctionError) {
                    console.warn('[USER_CORRECTION_WARNING]', correctionError);
                }
            }

            if (processedData.result.line_items && processedData.result.line_items.length > 0) {
                console.log(`[DEBUG] Creating articles from ${processedData.result.line_items.length} line items`);

                const articlePromises = processedData.result.line_items
                    .filter(item => item.isNew && item.type !== "Nedefinit")
                    .map(async (item) => {
                        const typeMapping = {
                            'Marfuri': ArticleType.MARFURI,
                            'Produse finite': ArticleType.PRODUSE_FINITE,
                            'Ambalaje': ArticleType.AMBALAJE,
                            'Semifabricate': ArticleType.SEMIFABRICATE,
                            'Discount financiar iesiri': ArticleType.DISCOUNT_FINANCIAR_IESIRI,
                            'Discount financiar intrari': ArticleType.DISCOUNT_FINANCIAR_INTRARI,
                            'Discount comercial iesiri': ArticleType.DISCOUNT_COMERCIAL_IESIRI,
                            'Discount comercial intrari': ArticleType.DISCOUNT_COMERCIAL_INTRARI,
                            'Servicii vandute': ArticleType.SERVICII_VANDUTE,
                            'Ambalaje SGR': ArticleType.AMBALAJE_SGR,
                            'Taxa verde': ArticleType.TAXA_VERDE,
                            'Produse reziduale': ArticleType.PRODUSE_REZIDUALE,
                            'Materii prime': ArticleType.MATERII_PRIME,
                            'Materiale auxiliare': ArticleType.MATERIALE_AUXILIARE,
                            'Combustibili': ArticleType.COMBUSTIBILI,
                            'Piese de schimb': ArticleType.PIESE_DE_SCHIMB,
                            'Alte mat. consumabile': ArticleType.ALTE_MATERIALE_CONSUMABILE,
                            'Obiecte de inventar': ArticleType.OBIECTE_DE_INVENTAR,
                            'Amenajarii provizorii': ArticleType.AMENAJARI_PROVIZORII,
                            'Mat. spre prelucrare': ArticleType.MATERIALE_SPRE_PRELUCRARE,
                            'Mat. in pastrare/consig': ArticleType.MATERIALE_IN_PASTRARE_SAU_CONSIGNATIE
                        };

                        console.log(`[DEBUG] Creating article: ${item.name} (code: ${item.articleCode}) for accounting relationship ${accountingClientRelation.id}`);

                        return prisma.article.create({
                            data: {
                                code: item.articleCode,
                                name: item.name,
                                vat: item.vat,
                                unitOfMeasure: item.um,
                                type: typeMapping[item.type] || ArticleType.MARFURI,
                                clientCompanyId: clientCompany.id,
                                accountingClientId: accountingClientRelation.id 
                            }
                        });
                    });

                const createdArticles = await Promise.all(articlePromises);
                console.log(`[DEBUG] Successfully created ${createdArticles.length} articles for accounting relationship ${accountingClientRelation.id}`);
            } else {
                console.log(`[DEBUG] No line items found or no new articles to create`);
            }

            console.log(`[AUDIT] Document ${document.id} created by user ${user.id} for company ${currentUser.accountingCompanyId} and client ${clientCompany.ein}`);

            return { savedDocument: document, savedProcessedData: processedDataDb };
        }, {
            timeout: 30000, // 30 second timeout
            isolationLevel: 'ReadCommitted'
        });

        return result;

    } catch (e) {
        if (uploadResult && fileKey) {
            try {
                await s3.deleteObject({
                    Bucket: process.env.AWS_S3_BUCKET_NAME,
                    Key: fileKey
                }).promise();
                console.log(`[CLEANUP] Deleted S3 file ${fileKey} after database error`);
            } catch (s3Error) {
                console.error('Failed to cleanup S3 file after database error:', s3Error);
            }
        }
        
        if (e instanceof NotFoundException || e instanceof UnauthorizedException) throw e;
        console.error('[POST_FILE_ERROR]', e);
        throw new InternalServerErrorException("Failed to save document and processed data in the database!");
    }
}

private mapDuplicateType(type: string): any {
    const mapping = {
        'exact_match': 'EXACT_MATCH',
        'content_match': 'CONTENT_MATCH', 
        'similar_content': 'SIMILAR_CONTENT'
    };
    return mapping[type?.toLowerCase()] || 'SIMILAR_CONTENT';
}

private mapComplianceStatus(status: string): any {
    const mapping = {
        'compliant': 'COMPLIANT',
        'non_compliant': 'NON_COMPLIANT',
        'warning': 'WARNING',
        'pending': 'PENDING'
    };
    return mapping[status?.toLowerCase()] || 'PENDING';
}

private mapCorrectionType(field: string): any {
    const mapping = {
        'document_type': 'DOCUMENT_TYPE',
        'direction': 'INVOICE_DIRECTION',
        'vendor_information': 'VENDOR_INFORMATION',
        'buyer_information': 'BUYER_INFORMATION',
        'amounts': 'AMOUNTS',
        'dates': 'DATES',
        'line_items': 'LINE_ITEMS'
    };
    return mapping[field] || 'OTHER';
}

    async updateFiles(processedData: any, clientCompanyEin: string, user: User, docId: number) {
        try {
            const clientCompany = await this.prisma.clientCompany.findUnique({
                where: {
                    ein: clientCompanyEin
                }
            });

            if (!clientCompany) throw new NotFoundException('Failed to find client company in the database');

            const accountingClientRelation = await this.prisma.accountingClients.findMany({
                where: {
                    accountingCompanyId: user.accountingCompanyId,
                    clientCompanyId: clientCompany.id
                }
            });
            if (accountingClientRelation.length === 0) throw new NotFoundException('You don\'t have access to this client company');

            const document = await this.prisma.document.findUnique({
                where: {
                    id: docId,
                    accountingClientId: accountingClientRelation[0].id
                },
                include: {
                    processedData: true
                }
            });

            if (!document) throw new NotFoundException('Document doesn\'t exist in the database');

            if (document.processedData) {
                await this.detectAndSaveUserCorrections(
                    document.processedData.extractedFields,
                    processedData,
                    docId,
                    user.id
                );
            }

            const updatedProcessedData = await this.prisma.processedData.update({
                where: {
                    documentId: docId
                },
                data: {
                    extractedFields: processedData
                }
            });

            return { document, updatedProcessedData }
        } catch (e) {
            if (e instanceof NotFoundException) throw e;
            throw new InternalServerErrorException("Failed to update the file's data!")
        }
    }

    private async detectAndSaveUserCorrections(originalData: any, newData: any, documentId: number, userId: number) {
        const corrections = [];

        if (originalData.result?.document_type !== newData.result?.document_type) {
            corrections.push({
                correctionType: CorrectionType.DOCUMENT_TYPE,
                originalValue: { document_type: originalData.result?.document_type },
                correctedValue: { document_type: newData.result?.document_type },
                confidence: originalData.result?.confidence || null
            });
        }

        if (originalData.result?.direction !== newData.result?.direction) {
            corrections.push({
                correctionType: CorrectionType.INVOICE_DIRECTION,
                originalValue: { direction: originalData.result?.direction },
                correctedValue: { direction: newData.result?.direction }
            });
        }

        if (originalData.result?.vendor !== newData.result?.vendor || 
            originalData.result?.vendor_ein !== newData.result?.vendor_ein) {
            corrections.push({
                correctionType: CorrectionType.VENDOR_INFORMATION,
                originalValue: { 
                    vendor: originalData.result?.vendor, 
                    vendor_ein: originalData.result?.vendor_ein 
                },
                correctedValue: { 
                    vendor: newData.result?.vendor, 
                    vendor_ein: newData.result?.vendor_ein 
                }
            });
        }

        if (originalData.result?.buyer !== newData.result?.buyer || 
            originalData.result?.buyer_ein !== newData.result?.buyer_ein) {
            corrections.push({
                correctionType: CorrectionType.BUYER_INFORMATION,
                originalValue: { 
                    buyer: originalData.result?.buyer, 
                    buyer_ein: originalData.result?.buyer_ein 
                },
                correctedValue: { 
                    buyer: newData.result?.buyer, 
                    buyer_ein: newData.result?.buyer_ein 
                }
            });
        }

        if (originalData.result?.total_amount !== newData.result?.total_amount || 
            originalData.result?.vat_amount !== newData.result?.vat_amount) {
            corrections.push({
                correctionType: CorrectionType.AMOUNTS,
                originalValue: { 
                    total_amount: originalData.result?.total_amount, 
                    vat_amount: originalData.result?.vat_amount 
                },
                correctedValue: { 
                    total_amount: newData.result?.total_amount, 
                    vat_amount: newData.result?.vat_amount 
                }
            });
        }

        if (originalData.result?.document_date !== newData.result?.document_date || 
            originalData.result?.due_date !== newData.result?.due_date) {
            corrections.push({
                correctionType: CorrectionType.DATES,
                originalValue: { 
                    document_date: originalData.result?.document_date, 
                    due_date: originalData.result?.due_date 
                },
                correctedValue: { 
                    document_date: newData.result?.document_date, 
                    due_date: newData.result?.due_date 
                }
            });
        }

        const originalLineItems = originalData.result?.line_items || [];
        const newLineItems = newData.result?.line_items || [];
        if (JSON.stringify(originalLineItems) !== JSON.stringify(newLineItems)) {
            corrections.push({
                correctionType: CorrectionType.LINE_ITEMS,
                originalValue: { line_items: originalLineItems },
                correctedValue: { line_items: newLineItems }
            });
        }

        for (const correction of corrections) {
            await this.dataExtractionService.saveUserCorrection(documentId, userId, correction);
        }

        if (corrections.length > 0) {
            console.log(`[LEARNING] Saved ${corrections.length} user corrections for document ${documentId}`);
        }
    }

    async getDuplicateAlerts(clientCompanyEin: string, user: User) {
        try {
            const clientCompany = await this.prisma.clientCompany.findUnique({
                where: { ein: clientCompanyEin }
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

            return await this.dataExtractionService.getDuplicateAlerts(accountingClientRelation.id);
        } catch (e) {
            console.error('[GET_DUPLICATE_ALERTS_ERROR]', e);
            throw new InternalServerErrorException('Failed to get duplicate alerts');
        }
    }

    async getComplianceAlerts(clientCompanyEin: string, user: User) {
        try {
            const clientCompany = await this.prisma.clientCompany.findUnique({
                where: { ein: clientCompanyEin }
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

            return await this.dataExtractionService.getComplianceAlerts(accountingClientRelation.id);
        } catch (e) {
            console.error('[GET_COMPLIANCE_ALERTS_ERROR]', e);
            throw new InternalServerErrorException('Failed to get compliance alerts');
        }
    }

    async updateDuplicateStatus(duplicateCheckId: number, status: DuplicateStatus, user: User) {
        try {
            const duplicateCheck = await this.prisma.documentDuplicateCheck.findUnique({
                where: { id: duplicateCheckId },
                include: {
                    originalDocument: {
                        include: {
                            accountingClient: true
                        }
                    }
                }
            });

            if (!duplicateCheck) {
                throw new NotFoundException('Duplicate check not found');
            }

            if (duplicateCheck.originalDocument.accountingClient.accountingCompanyId !== user.accountingCompanyId) {
                throw new UnauthorizedException('No access to this duplicate check');
            }

            return await this.dataExtractionService.updateDuplicateStatus(duplicateCheckId, status);
        } catch (e) {
            console.error('[UPDATE_DUPLICATE_STATUS_ERROR]', e);
            throw new InternalServerErrorException('Failed to update duplicate status');
        }
    }

    async deleteFiles(clientCompanyEin: string, docId: number, user: User) {
        try {
            const clientCompany = await this.prisma.clientCompany.findUnique({
                where: { ein: clientCompanyEin }
            });
            
            if (!clientCompany) throw new NotFoundException('Failed to find client company in the database');
            
            const accountingClientRelation = await this.prisma.accountingClients.findMany({
                where: {
                    accountingCompanyId: user.accountingCompanyId,
                    clientCompanyId: clientCompany.id
                }
            });
            
            if (accountingClientRelation.length === 0) throw new NotFoundException('You don\'t have access to this client company');
            
            const document = await this.prisma.document.findUnique({
                where: {
                    id: docId,
                    accountingClientId: accountingClientRelation[0].id
                }
            });
            
            if (!document) throw new NotFoundException('Document not found');

            const s3 = new AWS.S3({
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                region: process.env.AWS_REGION
            });

            await s3.deleteObject({
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Key: document.s3Key
            }).promise();

            return await this.prisma.$transaction(async (prisma) => {
                const deletedUserCorrections = await prisma.userCorrection.deleteMany({
                    where: { documentId: docId }
                });

                const deletedComplianceValidations = await prisma.complianceValidation.deleteMany({
                    where: { documentId: docId }
                });

                const deletedDuplicateChecks = await prisma.documentDuplicateCheck.deleteMany({
                    where: {
                        OR: [
                            { originalDocumentId: docId },
                            { duplicateDocumentId: docId }
                        ]
                    }
                });

                const deletedProcessedData = await prisma.processedData.deleteMany({
                    where: { documentId: docId }
                });
                
                const deletedRpaAction = await prisma.rpaAction.deleteMany({
                    where: {
                        documentId: docId,
                        accountingClientId: accountingClientRelation[0].id
                    }
                });
                
                const deletedDocument = await prisma.document.delete({
                    where: {
                        id: docId,
                        accountingClientId: accountingClientRelation[0].id
                    }
                });
                
                return {
                    deletedDocument,
                    deletedProcessedData,
                    deletedRpaAction,
                    deletedDuplicateChecks,
                    deletedComplianceValidations,
                    deletedUserCorrections,
                    s3DeleteStatus: 'Success'
                };
            });
            
        } catch (e) {
            if (e instanceof NotFoundException) throw e;
            if (e.code === 'NoSuchKey') {
                throw new InternalServerErrorException("File not found in S3 storage, but database records were deleted.");
            }
            throw new InternalServerErrorException("Failed to delete the file and its data!");
        }
    }

    async getServiceHealth() {
        try {
            return await this.dataExtractionService.getServiceHealth();
        } catch (e) {
            console.error('[GET_SERVICE_HEALTH_ERROR]', e);
            throw new InternalServerErrorException('Failed to get service health');
        }
    }
}
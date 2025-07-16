import { Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ArticleType, User, CorrectionType, DuplicateStatus, VatRate, UnitOfMeasure } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DataExtractionService } from '../data-extraction/data-extraction.service';
import * as AWS from 'aws-sdk';
import * as crypto from 'crypto';

interface ArticleSimilarity {
    code: string;
    name: string;
    vat: VatRate;
    unitOfMeasure: UnitOfMeasure;
    type: ArticleType;
    similarity: number;
}

interface SmartArticleResult {
    articleCode: string;
    name: string;
    vat: VatRate;
    unitOfMeasure: UnitOfMeasure;
    type: ArticleType;
    isNew: boolean;
    isMatched: boolean;
    originalName?: string;
}

import { Logger } from '@nestjs/common';

@Injectable()
export class FilesService {
    private readonly logger = new Logger(FilesService.name);

    constructor(
        private prisma: PrismaService,
        private dataExtractionService: DataExtractionService
    ) {}

    private async getExistingDocumentsByType(accountingClientId: number, documentType: string) {
        const documents = await this.prisma.document.findMany({
            where: {
                accountingClientId: accountingClientId,
                type: documentType 
            },
            include: {
                processedData: true
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 100 
        });

        return documents.map(doc => ({
            id: doc.id,
            name: doc.name,
            document_type: doc.type,
            documentHash: doc.documentHash,
            ...(typeof doc.processedData?.extractedFields === 'object' && doc.processedData?.extractedFields !== null
                ? doc.processedData.extractedFields
                : {})
        }));
    }

    private async getExistingDocuments(accountingClientId: number, documentType?: string) {
        const whereClause: any = {
            accountingClientId: accountingClientId
        };

        if (documentType) {
            whereClause.type = documentType;
        }

        const documents = await this.prisma.document.findMany({
            where: whereClause,
            include: {
                processedData: true
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 100
        });

        return documents.map(doc => ({
            id: doc.id,
            name: doc.name,
            documentHash: doc.documentHash,
            document_type: doc.type,
            ...(typeof doc.processedData?.extractedFields === 'object' && doc.processedData?.extractedFields !== null
                ? doc.processedData.extractedFields
                : {})
        }));
    }

    private validateDocumentRelevance(data: any, clientCompanyEin: string) {
        const documentType = data.document_type?.toLowerCase();
        const cleanClientEin = clientCompanyEin.replace(/^RO/i, '');
        
        const cleanEin = (ein: any): string => {
            if (!ein) return '';
            return ein.toString().replace(/^RO/i, '').trim();
        };

        switch (documentType) {
            case 'invoice':
            case 'receipt':
                const buyerEin = cleanEin(data.buyer_ein);
                const vendorEin = cleanEin(data.vendor_ein);

                const isBuyer = buyerEin === cleanClientEin;
                const isVendor = vendorEin === cleanClientEin;

                if (!isBuyer && !isVendor) {
                    this.logger.warn(`Document relevance warning: Neither buyer EIN (${buyerEin}) nor vendor EIN (${vendorEin}) matches client company EIN: ${cleanClientEin}`);
                    data.validation_warnings = data.validation_warnings || [];
                    data.validation_warnings.push({
                        type: 'DOCUMENT_RELEVANCE',
                        message: 'Document does not appear to belong to the selected company',
                        severity: 'HIGH',
                        details: {
                            document_buyer_ein: buyerEin,
                            document_vendor_ein: vendorEin,
                            expected_ein: cleanClientEin
                        }
                    });
                }

                if (isBuyer && isVendor) {
                    this.logger.error(`Data error: Company EIN appears as both buyer and vendor in ${documentType}`);
                    data.validation_warnings = data.validation_warnings || [];
                    data.validation_warnings.push({
                        type: 'DATA_ERROR',
                        message: 'Company EIN appears as both buyer and vendor',
                        severity: 'CRITICAL'
                    });
                }

                if (!data.direction && documentType === 'invoice') {
                    data.direction = isBuyer ? 'incoming' : (isVendor ? 'outgoing' : 'unknown');
                }
                break;

            case 'bank statement':
                const companyEin = cleanEin(data.company_ein);

                if (companyEin && companyEin !== cleanClientEin) {
                    this.logger.warn(`Document relevance warning: Bank statement company EIN (${companyEin}) does not match client company EIN: ${cleanClientEin}`);
                    data.validation_warnings = data.validation_warnings || [];
                    data.validation_warnings.push({
                        type: 'DOCUMENT_RELEVANCE',
                        message: 'Bank statement does not belong to the selected company',
                        severity: 'HIGH'
                    });
                }
                break;

            case 'contract':
                const parties = data.parties || [];
                const hasClientCompany = parties.some((party: any) => 
                    cleanEin(party.ein) === cleanClientEin
                );

                if (!hasClientCompany && parties.length > 0) {
                    this.logger.warn(`Document relevance warning: No contract party matches client company EIN: ${cleanClientEin}`);
                    data.validation_warnings = data.validation_warnings || [];
                    data.validation_warnings.push({
                        type: 'DOCUMENT_RELEVANCE',
                        message: 'Contract does not include the selected company as a party',
                        severity: 'MEDIUM'
                    });
                }
                break;

            default:
                const docEins = this.extractAllEins(data);
                const hasMatch = docEins.some(ein => cleanEin(ein) === cleanClientEin);

                if (docEins.length > 0 && !hasMatch) {
                    this.logger.warn(`Document relevance warning: No EIN in document matches client company EIN: ${cleanClientEin}`);
                    data.validation_warnings = data.validation_warnings || [];
                    data.validation_warnings.push({
                        type: 'DOCUMENT_RELEVANCE',
                        message: 'Document EINs do not match the selected company',
                        severity: 'MEDIUM'
                    });
                }
        }
    }

    private extractAllEins(data: any): string[] {
        const eins: string[] = [];
        
        const einFields = ['buyer_ein', 'vendor_ein', 'company_ein', 'payer_ein', 'payee_ein', 'ein', 'cui', 'cif'];
        
        einFields.forEach(field => {
            if (data[field]) {
                eins.push(data[field].toString());
            }
        });

        if (Array.isArray(data.parties)) {
            data.parties.forEach((party: any) => {
                if (party.ein) eins.push(party.ein.toString());
                if (party.cui) eins.push(party.cui.toString());
                if (party.cif) eins.push(party.cif.toString());
            });
        }

        return eins;
    }


    private mapVatRate(vatString: string): VatRate {
        const mapping: Record<string, VatRate> = {
            'NINETEEN': VatRate.NINETEEN,
            'NINE': VatRate.NINE,
            'FIVE': VatRate.FIVE,
            'ZERO': VatRate.ZERO
        };
        return mapping[vatString?.toUpperCase()] || VatRate.NINETEEN;
    }

    private mapUnitOfMeasure(unitString: string): UnitOfMeasure {
        const mapping: Record<string, UnitOfMeasure> = {
            'BUCATA': UnitOfMeasure.BUCATA,
            'KILOGRAM': UnitOfMeasure.KILOGRAM,
            'LITRU': UnitOfMeasure.LITRU,
            'METRU': UnitOfMeasure.METRU,
            'GRAM': UnitOfMeasure.GRAM,
            'CUTIE': UnitOfMeasure.CUTIE,
            'PACHET': UnitOfMeasure.PACHET,
            'PUNGA': UnitOfMeasure.PUNGA,
            'SET': UnitOfMeasure.SET,
            'METRU_PATRAT': UnitOfMeasure.METRU_PATRAT,
            'METRU_CUB': UnitOfMeasure.METRU_CUB,
        };
        return mapping[unitString?.toUpperCase()] || UnitOfMeasure.BUCATA;
    }

    private calculateSimilarity(text1: string, text2: string): number {
        const str1 = text1.toLowerCase().trim();
        const str2 = text2.toLowerCase().trim();
        
        if (str1 === str2) return 1.0;
        
        const maxLength = Math.max(str1.length, str2.length);
        if (maxLength === 0) return 1.0;
        
        let matches = 0;
        for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
            if (str1[i] === str2[i]) matches++;
        }
        
        let similarity = matches / maxLength;
        
        const words1 = str1.split(/\s+/);
        const words2 = str2.split(/\s+/);
        const commonWords = words1.filter(word => words2.includes(word));
        
        if (commonWords.length > 0) {
            const wordSimilarity = commonWords.length / Math.max(words1.length, words2.length);
            similarity = Math.max(similarity, wordSimilarity * 0.9);
        }
        
        return similarity;
    }

    private findSimilarArticle(newArticleName: string, existingArticles: any[], similarityThreshold: number = 0.6): ArticleSimilarity | null {
        const wordMappings: Record<string, string[]> = {
            'transport': ['shipping', 'shipment', 'delivery', 'freight', 'livrare', 'expediere'],
            'shipping': ['transport', 'shipment', 'delivery', 'freight', 'livrare'],
            'shipment': ['transport', 'shipping', 'delivery', 'freight', 'livrare'],
            'delivery': ['transport', 'shipping', 'shipment', 'freight', 'livrare'],
            'livrare': ['transport', 'shipping', 'shipment', 'delivery', 'freight'],
            'expediere': ['transport', 'shipping', 'shipment', 'delivery'],
            'service': ['servicii', 'services', 'prestari'],
            'servicii': ['service', 'services', 'prestari'],
            'services': ['service', 'servicii', 'prestari'],
            'prestari': ['service', 'servicii', 'services'],
            'product': ['produs', 'produse', 'marfa', 'marfuri'],
            'produs': ['product', 'produse', 'marfa', 'marfuri'],
            'produse': ['product', 'produs', 'marfa', 'marfuri'],
            'marfa': ['product', 'produs', 'marfuri', 'goods'],
            'marfuri': ['product', 'produs', 'marfa', 'goods'],
            'goods': ['marfa', 'marfuri', 'product', 'produs']
        };
        
        let bestMatch: ArticleSimilarity | null = null;
        let bestSimilarity = 0;
        
        const newArticleLower = newArticleName.toLowerCase();
        
        for (const article of existingArticles) {
            const articleNameLower = article.name.toLowerCase();
            
            let similarity = this.calculateSimilarity(newArticleLower, articleNameLower);
            
            for (const [word, synonyms] of Object.entries(wordMappings)) {
                if (newArticleLower.includes(word)) {
                    for (const synonym of synonyms) {
                        if (articleNameLower.includes(synonym)) {
                            similarity = Math.max(similarity, 0.8); 
                            break;
                        }
                    }
                }
            }
            
            const wordsNew = newArticleLower.split(/\s+/).filter(w => w.length > 2);
            const wordsExisting = articleNameLower.split(/\s+/).filter(w => w.length > 2);
            
            if (wordsNew.length > 0 && wordsExisting.length > 0) {
                const commonWords = wordsNew.filter(word => 
                    wordsExisting.some(existingWord => 
                        word.includes(existingWord) || existingWord.includes(word)
                    )
                );
                
                if (commonWords.length > 0) {
                    const wordSimilarity = commonWords.length / Math.max(wordsNew.length, wordsExisting.length);
                    similarity = Math.max(similarity, wordSimilarity * 0.85);
                }
            }
            
            if (similarity > bestSimilarity && similarity >= similarityThreshold) {
                bestSimilarity = similarity;
                bestMatch = {
                    code: article.code,
                    name: article.name,
                    vat: article.vat,
                    unitOfMeasure: article.unitOfMeasure,
                    type: article.type,
                    similarity: similarity
                };
            }
        }
        
        if (bestMatch) {
            console.log(`[SMART_MATCHING] Article matching: '${newArticleName}' -> '${bestMatch.name}' (similarity: ${bestSimilarity.toFixed(2)})`);
        } else {
            console.log(`[SMART_MATCHING] No similar article found for: '${newArticleName}'`);
        }
        
        return bestMatch;
    }

    private determineInvoiceDirection(extractedData: any, clientCompanyEin: string): 'incoming' | 'outgoing' | 'unknown' {
        const buyerEin = extractedData.buyer_ein?.replace(/^RO/i, '');
        const vendorEin = extractedData.vendor_ein?.replace(/^RO/i, '');
        const cleanClientEin = clientCompanyEin.replace(/^RO/i, '');

        if (buyerEin === cleanClientEin) return 'incoming';
        if (vendorEin === cleanClientEin) return 'outgoing';
        return 'unknown';
    }

    private async smartArticleProcessing(
        lineItems: any[], 
        existingArticles: any[], 
        direction: 'incoming' | 'outgoing' | 'unknown',
        accountingClientId: number
    ): Promise<SmartArticleResult[]> {
        const processedItems: SmartArticleResult[] = [];
        let nextArticleCode = Math.max(...existingArticles.map(a => parseInt(a.code.replace('ART', '')) || 0), 0) + 1;
        
        const typeMapping: Record<string, ArticleType> = {
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
            'Amenajari provizorii': ArticleType.AMENAJARI_PROVIZORII,
            'Mat. spre prelucrare': ArticleType.MATERIALE_SPRE_PRELUCRARE,
            'Mat. in pastrare/consig.': ArticleType.MATERIALE_IN_PASTRARE_SAU_CONSIGNATIE
        };
        
        for (const item of lineItems) {
            const articleName = item.name?.trim();
            if (!articleName) {
                console.warn('[SMART_MATCHING] Skipping line item with empty name');
                continue;
            }
            
            let result: SmartArticleResult;
            
            if (direction === 'outgoing') {
                const similarArticle = this.findSimilarArticle(articleName, existingArticles, 0.5);
                
                if (similarArticle) {
                    result = {
                        articleCode: similarArticle.code,
                        name: similarArticle.name, 
                        vat: this.mapVatRate(item.vat) || similarArticle.vat,
                        unitOfMeasure: this.mapUnitOfMeasure(item.um) || similarArticle.unitOfMeasure,
                        type: typeMapping[item.type] || similarArticle.type,
                        isNew: false,
                        isMatched: true,
                        originalName: articleName
                    };
                    console.log(`[SMART_MATCHING] Outgoing: Matched '${articleName}' with existing '${similarArticle.name}'`);
                } else {
                    console.warn(`[SMART_MATCHING] WARNING: Outgoing invoice contains unknown article '${articleName}' - creating new article anyway`);
                    result = {
                        articleCode: `ART${nextArticleCode.toString().padStart(3, '0')}`,
                        name: articleName,
                        vat: this.mapVatRate(item.vat) || VatRate.NINETEEN,
                        unitOfMeasure: this.mapUnitOfMeasure(item.um) || UnitOfMeasure.BUCATA,
                        type: typeMapping[item.type] || ArticleType.MARFURI,
                        isNew: true,
                        isMatched: false
                    };
                    nextArticleCode++;
                }
            } else {
                const similarArticle = this.findSimilarArticle(articleName, existingArticles, 0.7);
                
                if (similarArticle) {
                    result = {
                        articleCode: similarArticle.code,
                        name: similarArticle.name, 
                        vat: this.mapVatRate(item.vat) || similarArticle.vat,
                        unitOfMeasure: this.mapUnitOfMeasure(item.um) || similarArticle.unitOfMeasure,
                        type: typeMapping[item.type] || similarArticle.type,
                        isNew: false,
                        isMatched: true,
                        originalName: articleName
                    };
                    console.log(`[SMART_MATCHING] Incoming: Matched '${articleName}' with existing '${similarArticle.name}'`);
                } else {
                    result = {
                        articleCode: `ART${nextArticleCode.toString().padStart(3, '0')}`,
                        name: articleName,
                        vat: this.mapVatRate(item.vat) || VatRate.NINETEEN,
                        unitOfMeasure: this.mapUnitOfMeasure(item.um) || UnitOfMeasure.BUCATA,
                        type: typeMapping[item.type] || ArticleType.MARFURI,
                        isNew: true,
                        isMatched: false
                    };
                    nextArticleCode++;
                    console.log(`[SMART_MATCHING] Incoming: Creating new article '${articleName}'`);
                }
            }
            
            processedItems.push(result);
        }
        
        return processedItems;
    }
    
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
                    console.log(`[SMART_MATCHING] Processing ${processedData.result.line_items.length} line items for intelligent article matching`);

                    const existingArticles = await prisma.article.findMany({
                        where: { accountingClientId: accountingClientRelation.id }
                    });

                    const direction = this.determineInvoiceDirection(processedData.result, clientEin);
                    console.log(`[SMART_MATCHING] Invoice direction determined: ${direction}`);

                    const smartArticleResults = await this.smartArticleProcessing(
                        processedData.result.line_items,
                        existingArticles,
                        direction,
                        accountingClientRelation.id
                    );

                    const newArticlesToCreate = smartArticleResults.filter(result => result.isNew);
                    
                    if (newArticlesToCreate.length > 0) {
                        console.log(`[SMART_MATCHING] Creating ${newArticlesToCreate.length} new articles`);

                        const articlePromises = newArticlesToCreate.map(async (result) => {
                            console.log(`[SMART_MATCHING] Creating article: ${result.name} (code: ${result.articleCode})`);

                            try {
                                return await prisma.article.upsert({
                                    where: {
                                        code_accountingClientId: {
                                            code: result.articleCode,
                                            accountingClientId: accountingClientRelation.id
                                        }
                                    },
                                    update: {
                                        name: result.name,
                                        vat: result.vat,
                                        unitOfMeasure: result.unitOfMeasure,
                                        type: result.type,
                                    },
                                    create: {
                                        code: result.articleCode,
                                        name: result.name,
                                        vat: result.vat,
                                        unitOfMeasure: result.unitOfMeasure,
                                        type: result.type,
                                        clientCompanyId: clientCompany.id,
                                        accountingClientId: accountingClientRelation.id 
                                    }
                                });
                            } catch (error) {
                                console.warn(`[SMART_MATCHING] Failed to upsert article ${result.articleCode}: ${error.message}`);
                                return null;
                            }
                        });

                        const createdArticles = (await Promise.all(articlePromises)).filter(Boolean);
                        console.log(`[SMART_MATCHING] Successfully processed ${createdArticles.length} articles`);

                        processedData.result.line_items = processedData.result.line_items.map((item: any, index: number) => {
                            const smartResult = smartArticleResults[index];
                            if (smartResult) {
                                return {
                                    ...item,
                                    articleCode: smartResult.articleCode,
                                    name: smartResult.name, 
                                    vat: smartResult.vat,
                                    um: smartResult.unitOfMeasure,
                                    isNew: smartResult.isNew,
                                    isMatched: smartResult.isMatched,
                                    originalName: smartResult.originalName
                                };
                            }
                            return item;
                        });

                        await prisma.processedData.update({
                            where: { id: processedDataDb.id },
                            data: { extractedFields: processedData }
                        });
                    } else {
                        console.log(`[SMART_MATCHING] All articles were matched with existing ones - no new articles to create`);
                    }
                } else {
                    console.log(`[SMART_MATCHING] No line items found or no new articles to create`);
                }

                console.log(`[AUDIT] Document ${document.id} created by user ${user.id} for company ${currentUser.accountingCompanyId} and client ${clientCompany.ein}`);

                return { savedDocument: document, savedProcessedData: processedDataDb };
            }, {
                timeout: 30000, 
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

    async getServiceHealth(): Promise<{
        status: string;
        timestamp: string;
        [key: string]: any;
    }> {
        try {
            const healthData = await this.dataExtractionService.getServiceHealth();
            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                ...(healthData || {})
            };
        } catch (e) {
            console.error('[GET_SERVICE_HEALTH_ERROR]', e);
            return {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: 'Failed to get service health'
            };
        }
    }
}
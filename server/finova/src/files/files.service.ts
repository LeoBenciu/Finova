import { Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException, Logger } from '@nestjs/common';
import { ArticleType, User, CorrectionType, DuplicateStatus, DuplicateType, VatRate, UnitOfMeasure, Document, ComplianceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DataExtractionService } from '../data-extraction/data-extraction.service';
import * as AWS from 'aws-sdk';
import * as crypto from 'crypto';

// Extended interfaces for type safety
interface ProcessedDataResult {
    document_type?: string;
    receipt_number?: string;
    document_number?: string;
    duplicate_detection?: {
        duplicate_matches?: Array<{
            document_id: number;
            similarity_score?: number;
            matching_fields?: Record<string, unknown>;
            duplicate_type?: string;
        }>;
    };
    compliance_validation?: {
        validation_rules?: any;
        errors?: any;
        warnings?: any;
        compliance_status?: string;
        overall_score?: number;
    };
    line_items?: Array<{
        articleCode?: string;
        name?: string;
        vat?: VatRate;
        um?: UnitOfMeasure;
        isNew?: boolean;
        isMatched?: boolean;
        originalName?: string;
    }>;
    [key: string]: any;
}

interface ProcessedData {
    result?: ProcessedDataResult;
    receipt_number?: string;
    userCorrections?: Array<{
        field: string;
        originalValue: any;
        newValue: any;
    }>;
    references?: number[];
    [key: string]: any;
}

type InvoiceDirection = 'incoming' | 'outgoing' | 'unknown';

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

@Injectable()
export class FilesService {
    constructor(
        private prisma: PrismaService,
        private dataExtractionService: DataExtractionService
    ) {}

        private async syncReferences(prisma: any, cluster: number[]): Promise<void> {
            console.log(`🔁 syncReferences cluster=${JSON.stringify(cluster)}`);
            
            if (cluster.length === 0) return;
            
            // The first document in the cluster is the "source" (newly uploaded document)
            // It should reference all others, and all others should only reference it back
            const sourceDocId = cluster[0];
            const targetDocIds = cluster.slice(1);
            
            console.log(`🎆 STAR PATTERN: Source ${sourceDocId} -> Targets ${JSON.stringify(targetDocIds)}`);
            
            // Use the existing transaction context (prisma is already a transaction)
            for (const id of cluster) {
                try {
                    let refs: number[];
                    
                    if (id === sourceDocId) {
                        refs = targetDocIds;
                        console.log(`🚨 SOURCE DEBUG: Document ${id} should reference all targets: ${JSON.stringify(refs)}`);
                    } else {
                        refs = [sourceDocId];
                        console.log(`🚨 TARGET DEBUG: Document ${id} should only reference source: ${JSON.stringify(refs)}`);
                    }
                    
                    const res = await prisma.document.update({
                        where: { id },
                        data: { references: refs }
                    });
                    
                    console.log(`✅ SYNC RESULT: Document ${id} now has references: ${JSON.stringify(res.references)}`);
                    
                    if (JSON.stringify(res.references.sort()) !== JSON.stringify(refs.sort())) {
                        console.error(`🚨 SYNC ERROR: Expected ${JSON.stringify(refs.sort())} but got ${JSON.stringify(res.references.sort())}`);
                    }
                } catch (e) {
                    console.error(`❌ failed updating document ${id}:`, e);
                    throw e;
                }
            }
            
            console.log(`🔍 Final verification of cluster ${JSON.stringify(cluster)}:`);
            for (const id of cluster) {
                const doc = await prisma.document.findUnique({ where: { id } });
                const expectedRefs = cluster.filter(ref => ref !== id).sort();
                const actualRefs = (doc?.references || []).sort();
                
                if (JSON.stringify(expectedRefs) === JSON.stringify(actualRefs)) {
                    console.log(`✅ Document ${id} references are correct: ${JSON.stringify(actualRefs)}`);
                } else {
                    console.error(`❌ Document ${id} references are WRONG! Expected: ${JSON.stringify(expectedRefs)}, Got: ${JSON.stringify(actualRefs)}`);
                }
            }
        }


    async updateReferences(docId: number, references: number[], user: User) {
        const document = await this.prisma.document.findUnique({ where: { id: docId } });
        if (!document) throw new NotFoundException('Document not found');
        const accountingClient = await this.prisma.accountingClients.findUnique({ where: { id: document.accountingClientId } });
        if (!accountingClient || accountingClient.accountingCompanyId !== user.accountingCompanyId) {
            throw new UnauthorizedException('No access to this document');
        }
        const newRefs = Array.from(new Set((references || []).filter(id => typeof id === 'number' && id !== docId)));
        const oldRefs = Array.isArray(document.references) ? document.references.filter((id: any): id is number => typeof id === 'number' && id !== docId) : [];
        await this.prisma.document.update({ where: { id: docId }, data: { references: newRefs } });
        await Promise.all(newRefs.map(async refId => {
            const refDoc = await this.prisma.document.findUnique({ where: { id: refId } });
            if (refDoc) {
                const updatedRefs = refDoc.references ? Array.from(new Set([...refDoc.references, docId])) : [docId];
                await this.prisma.document.update({ where: { id: refId }, data: { references: updatedRefs } });
            }
        }));
        const removedRefs = oldRefs.filter(id => !newRefs.includes(id));
        await Promise.all(removedRefs.map(async refId => {
            const refDoc = await this.prisma.document.findUnique({ where: { id: refId } });
            if (refDoc && Array.isArray(refDoc.references)) {
                const updatedRefs = refDoc.references.filter((id: number) => id !== docId);
                await this.prisma.document.update({ where: { id: refId }, data: { references: updatedRefs } });
            }
        }));
        return { success: true };
    }

    async getSomeFiles(docIds: number[], user: User, clientEin: string) {
    
        try{const documents = await this.prisma.document.findMany({ 
            where: { id: { in: docIds } },
            include: { processedData: true }
        });
        
        if (!documents) {
            console.error(`❌ Document not found with ID: ${docIds}`);
            throw new NotFoundException('Document not found');
        }

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

        return documents;}
        catch(e){
            console.log(e);
            throw e;
        }
    }

    async getRelatedDocuments(docId: number, user: User, clientEin: string) {
        console.log(`🔍 Fetching related documents for docId: ${docId}`);
        
        const document = await this.prisma.document.findUnique({ 
            where: { id: docId },
            include: { processedData: true }
        });
        
        if (!document) {
            console.error(`❌ Document not found with ID: ${docId}`);
            throw new NotFoundException('Document not found');
        }

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

        const referenceIds: number[] = Array.isArray(document.references) 
            ? document.references.filter((id: any): id is number => typeof id === 'number' && id !== docId) 
            : [];
            
        console.log(`📄 Found ${referenceIds.length} references for document ${docId}`);

        if (referenceIds.length === 0) {
            console.log('ℹ️ No references found for document, returning empty array');
            return [];
        }

        const relatedDocs = await this.prisma.document.findMany({
            where: { 
                id: { in: referenceIds },
                accountingClientId: document.accountingClientId
            },
            include: {
                processedData: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        console.log(`✅ Found ${relatedDocs.length} related documents`);
        
        const formattedDocs = relatedDocs.map(doc => {
            let extractedData = {};
            
            if (doc.processedData?.extractedFields) {
                try {
                    const parsedFields = typeof doc.processedData.extractedFields === 'string'
                        ? JSON.parse(doc.processedData.extractedFields)
                        : doc.processedData.extractedFields;
                    
                    if (parsedFields && typeof parsedFields === 'object' && 'result' in parsedFields) {
                        extractedData = parsedFields.result || {};
                    } else if (parsedFields && typeof parsedFields === 'object') {
                        extractedData = parsedFields;
                    }
                } catch (e) {
                    console.error(`❌ Error parsing extracted fields for doc ${doc.id}:`, e);
                }
            }
            
            return {
                id: doc.id,
                name: doc.name,
                type: doc.type,
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt,
                ...extractedData,
                processedData: [{
                    extractedFields: doc.processedData?.extractedFields || {}
                }]
            };
        });

        return formattedDocs;
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

    private mapDuplicateType(type: string): DuplicateType {
        const mapping: Record<string, DuplicateType> = {
            'exact': DuplicateType.EXACT_MATCH,
            'exact_match': DuplicateType.EXACT_MATCH,
            'similar': DuplicateType.SIMILAR_CONTENT,
            'similar_content': DuplicateType.SIMILAR_CONTENT,
            'partial': DuplicateType.SIMILAR_CONTENT,
            'content_match': DuplicateType.CONTENT_MATCH
        };
        return mapping[type?.toLowerCase()] || DuplicateType.SIMILAR_CONTENT;
    }

    private mapComplianceStatus(status: string): ComplianceStatus {
        const mapping: Record<string, ComplianceStatus> = {
            'compliant': ComplianceStatus.COMPLIANT,
            'non_compliant': ComplianceStatus.NON_COMPLIANT,
            'warning': ComplianceStatus.WARNING,
            'error': ComplianceStatus.NON_COMPLIANT,
            'pending': ComplianceStatus.PENDING
        };
        return mapping[status.toLowerCase()] || ComplianceStatus.PENDING;
    }

    private mapCorrectionType(field: string): CorrectionType {
        const mapping: Record<string, CorrectionType> = {
            'amount': CorrectionType.AMOUNTS,
            'date': CorrectionType.DATES,
            'vat': CorrectionType.VENDOR_INFORMATION,
            'description': CorrectionType.LINE_ITEMS,
            'quantity': CorrectionType.LINE_ITEMS,
            'unit_price': CorrectionType.LINE_ITEMS
        };
        return mapping[field.toLowerCase()] || CorrectionType.OTHER;
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

                    const hasDuplicateAlert = document.duplicateChecks.some(check => check.status === DuplicateStatus.PENDING) ||
                                           document.duplicateMatches.some(check => check.status === DuplicateStatus.PENDING);

                    const latestCompliance = document.complianceValidations[0];
                    const hasComplianceIssues = latestCompliance && 
                        (latestCompliance.overallStatus === ComplianceStatus.NON_COMPLIANT || latestCompliance.overallStatus === ComplianceStatus.WARNING);
    
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
        let uploadResult: any;
        let fileKey: string;
        
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
                try {
                    console.log(`🚨 POSTFILE TRANSACTION START`);
                    let references: number[] = [];
                    let allDocs: any[] = [];
                    
                    console.log(`🔗 POSTFILE DEBUG:`);
                    console.log(`   - processedData type: ${typeof processedData}`);
                    console.log(`   - processedData.result type: ${typeof processedData.result}`);
                    console.log(`   - processedData.result?.references: ${JSON.stringify(processedData.result?.references)}`);
                    console.log(`   - processedData.references: ${JSON.stringify(processedData.references)}`);

                if (processedData.result?.document_type?.toLowerCase() === 'bank statement' && 
                processedData.result?.transactions && 
                Array.isArray(processedData.result.transactions)) {
                
                const aggregatedReferences: string[] = [];
                
                console.log(`🔗 BANK STATEMENT: Processing ${processedData.result.transactions.length} transactions for reference aggregation`);
                
                for (const transaction of processedData.result.transactions) {
                    if (transaction.reference_number) {
                        aggregatedReferences.push(transaction.reference_number);
                    }

                    if (Array.isArray(transaction.referenced_numbers)) {
                        aggregatedReferences.push(...transaction.referenced_numbers);
                    }
                    if (transaction.description) {
                        const patterns = [
                            /(?:factura|invoice|receipt|chitanta)\s*nr\.?\s*([A-Z0-9\-_]+)/gi,
                            /nr\.?\s*([A-Z0-9\-_]{6,})/gi,
                            /([A-Z]\d{8,})/g,
                            /([A-Z]{2,}-\d{4,}-\d+)/g,
                        ];

                        for (const pattern of patterns) {
                            const matches = transaction.description.matchAll(pattern);
                            for (const match of matches) {
                                if (match[1]) {
                                    aggregatedReferences.push(match[1]);
                                }
                            }
                        }
                    }
                }

                const uniqueReferences = [...new Set(aggregatedReferences
                    .map(ref => String(ref).trim())
                    .filter(Boolean)
                )];

                if (uniqueReferences.length > 0) {
                    processedData.result.referenced_numbers = uniqueReferences;
                    console.log(`🔗 BANK STATEMENT: Aggregated ${uniqueReferences.length} referenced numbers: ${JSON.stringify(uniqueReferences)}`);
                }
                }
                
                if (processedData.result?.referenced_numbers && Array.isArray(processedData.result.referenced_numbers)) {
                    const referencedNumbers = processedData.result.referenced_numbers
                        .map((num: any) => String(num).trim())
                        .filter((num: string) => num.length > 0);
                    
                    console.log(`🔗 Processing ${referencedNumbers.length} referenced numbers: ${JSON.stringify(referencedNumbers)}`);
                    
                    allDocs = await prisma.document.findMany({
                        where: {
                            accountingClientId: accountingClientRelation.id
                        },
                        include: {
                            processedData: true
                        }
                    });
    
                    for (const docNumber of referencedNumbers) {
                        
                        const existingDoc = allDocs.find(doc => {
                            if (!doc.processedData?.extractedFields) return false;
                            
                            try {
                                let data: any = doc.processedData.extractedFields;
                                if (typeof data === 'string') {
                                    data = JSON.parse(data);
                                }
                                
                                const result = data.result || data;
                                const documentNumber = result.document_number || 
                                                      result.invoice_number || 
                                                      result.receipt_number || 
                                                      result.contract_number ||
                                                      result.order_number ||
                                                      result.report_number;
                                
                                return documentNumber === docNumber;
                            } catch (e) {
                                return false;
                            }
                        });
                        
                        if (existingDoc) {
                            references.push(existingDoc.id);
                            console.log(`✅ Found referenced document: ${docNumber} -> ID ${existingDoc.id}`);
                        } else {
                            console.log(`⏳ Creating potential reference for: ${docNumber}`);
                        }
                    }
                }
            
                const document = await prisma.document.create({
                    data: {
                        name: file.originalname,
                        type: processedData.result?.document_type || 'Unknown',
                        path: uploadResult.Location,
                        s3Key: fileKey,
                        contentType: file.mimetype,
                        fileSize: file.size,
                        documentHash: documentHash,
                        accountingClientId: accountingClientRelation.id,
                        references: references,
                        reconciliationStatus: "UNRECONCILED"
                    }
                });
                
                if (processedData.result?.referenced_numbers && Array.isArray(processedData.result.referenced_numbers)) {
                    const referencedNumbers = processedData.result.referenced_numbers
                        .map((num: any) => String(num).trim())
                        .filter((num: string) => num.length > 0);
                    
                    for (const docNumber of referencedNumbers) {
                        const existingDoc = allDocs.find(doc => {
                            if (!doc.processedData?.extractedFields) return false;
                            
                            try {
                                let data: any = doc.processedData.extractedFields;
                                if (typeof data === 'string') {
                                    data = JSON.parse(data);
                                }
                                
                                const result = data.result || data;
                                const documentNumber = result.document_number || 
                                                      result.invoice_number || 
                                                      result.receipt_number || 
                                                      result.contract_number ||
                                                      result.order_number ||
                                                      result.report_number;
                                
                                return documentNumber === docNumber;
                            } catch (e) {
                                return false;
                            }
                        });
                        
                        if (!existingDoc) {
                            await prisma.potentialReference.create({
                                data: {
                                    sourceDocumentId: document.id,
                                    referencedDocumentNumber: docNumber,
                                    status: 'PENDING',
                                    confidence: 0.8
                                }
                            });
                            console.log(`📝 Created potential reference: ${document.id} -> "${docNumber}"`);
                        }
                    }
                }
                
                console.log(`   - Final references to save: ${JSON.stringify(references)}`);

                if (['Invoice', 'Receipt', 'Payment Order', 'Collection Order', 'Z Report'].includes(document.type)) {
                    setTimeout(async () => {
                        try {
                            await this.dataExtractionService.generateReconciliationSuggestions(accountingClientRelation.id);
                        } catch (error) {
                            console.error(`Failed to generate reconciliation suggestions:`, error);
                        }
                    }, 1500);
                }
    
                  try {
                    await this.dataExtractionService.resolvePendingReferences(document);
                  } catch (error) {
                    console.error(`Failed to resolve pending references for document ${document.id}:`, error);
                  }
            
                const docId = document.id;
            
                const filteredReferences = references.filter((id: number) => id !== docId);
            
                if (filteredReferences.length > 0) {
                    const uniqueReferences = [...new Set(filteredReferences)];
                    
                    try {
                        await prisma.document.update({
                            where: { id: docId },
                            data: { references: uniqueReferences }
                        });
                        console.log(`✅ Updated document ${docId} with references: ${uniqueReferences.join(', ')}`);
                        
                        // Create bidirectional references using syncReferences
                        const cluster = [docId, ...uniqueReferences];
                        console.log(`🔗 POSTFILE: Creating bidirectional references for cluster: ${JSON.stringify(cluster)}`);
                        await this.syncReferences(prisma, cluster);
                        
                    } catch (error) {
                        console.error('❌ Error updating document references:', error);
                    }
                }
            
                const processedDataDb = await prisma.processedData.create({
                    data: {
                        documentId: document.id,
                        extractedFields: processedData
                    }
                });
    
                if (processedData.result?.duplicate_detection) {
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
                                        status: DuplicateStatus.PENDING
                                    }
                                });
                            }
                        }
                    } catch (duplicateError) {
                        console.warn('[DUPLICATE_DETECTION_WARNING]', duplicateError);
                    }
                }
    
                if (processedData.result?.compliance_validation) {
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
    
                if (processedData.result?.line_items && processedData.result.line_items.length > 0) {
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
                    
                    if (processedData.result.line_items) {
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
                    }
    
                    if (newArticlesToCreate.length > 0) {
                        console.log(`[SMART_MATCHING] Creating ${newArticlesToCreate.length} new articles`);
                    } else {
                        console.log(`[SMART_MATCHING] All articles were matched with existing ones - no new articles to create`);
                    }
                } else {
                    console.log(`[SMART_MATCHING] No line items found or no new articles to create`);
                }
    
                console.log(`[AUDIT] Document ${document.id} created by user ${currentUser.id} for company ${currentUser.accountingCompanyId} and client ${clientCompany.ein}`);
    
                return { savedDocument: document, savedProcessedData: processedDataDb };
                } catch (transactionError) {
                    console.error(`🚨 POSTFILE TRANSACTION ERROR:`, transactionError);
                    console.error(`🚨 Error occurred during document creation for file: ${file.originalname}`);
                    throw transactionError;
                }
            }, {
                timeout: 30000
            });

            if (result.savedDocument.type === 'Bank Statement' && 
                processedData.result._shouldProcessBankTransactions && 
                processedData.result.transactions && 
                Array.isArray(processedData.result.transactions) && 
                processedData.result.transactions.length > 0) {
                
                console.log(`🏦 Processing bank statement: ${result.savedDocument.id} with ${processedData.result.transactions.length} transactions`);
                
                setTimeout(async () => {
                    try {
                        const bankTransactions = await this.dataExtractionService.extractBankTransactionsWithAccounts(
                            result.savedDocument.id, 
                            processedData.result
                        );
                        
                        console.log(`✅ Bank statement processing complete: ${bankTransactions.length} transactions created`);
                        
                    } catch (error) {
                        console.error(`❌ Bank statement processing failed:`, error);
                    }
                }, 100);
            }
    
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

    async updateFiles(processedData: any, clientCompanyEin: string, user: User, docId: number) {
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
            
            return await this.prisma.$transaction(async (prisma) => {
                const document = await prisma.document.findUnique({
                    where: { id: docId, accountingClientId: accountingClientRelation[0].id },
                    include: { processedData: true }
                });
                
                if (!document) throw new NotFoundException('Document not found');
                
                // --- Symmetrical reference update logic using helper ---
                // Prepare new references array from processed data (excluding self)
                // If the update payload omits `references`, keep the current ones to avoid accidental wipe
                const newReferencesRaw = Array.isArray(processedData.references)
                    ? processedData.references
                    : document.references ?? [];

                const newReferences: number[] = newReferencesRaw
                    .map((id: any) => Number(id))
                    .filter((id: number): id is number => !isNaN(id) && id !== docId);
                const uniqueNewReferences: number[] = [...new Set(newReferences)];

                // Build cluster (self + references) and sync
                const cluster: number[] = [...new Set([docId, ...uniqueNewReferences])];
                await this.syncReferences(prisma, cluster);
                

                // --- Continue with processedData update and user corrections ---
                if (document.processedData) {
                    await this.detectAndSaveUserCorrections(
                        document.processedData.extractedFields,
                        processedData,
                        docId,
                        user.id
                    );
                }
                
                const updatedProcessedData = await prisma.processedData.update({
                    where: { documentId: docId },
                    data: { extractedFields: processedData }
                });
                
                return { document, updatedProcessedData };
            });
        } catch (e) {
            if (e instanceof NotFoundException) throw e;
            throw new InternalServerErrorException("Failed to update the file's data!");
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
                
                const docsWithRef = await prisma.document.findMany({
                    where: {
                        references: { has: docId },
                        accountingClientId: accountingClientRelation[0].id
                    }
                });

                await Promise.all(
                    docsWithRef.map(async d => {
                        const newRefs = (d.references || []).filter(id => id !== docId);
                        await prisma.document.update({
                            where: { id: d.id },
                            data: { references: newRefs }
                        });
                    })
                );

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
            if ((e as any).code === 'NoSuchKey') {
                throw new InternalServerErrorException("File not found in S3 storage, but database records were deleted.");
            }
            throw new InternalServerErrorException("Failed to delete the file and its data!");
        }
    }


    async getInvoicePayments(invoiceId: number, user: User) {
        console.log(`🔍 Getting invoice payments for invoice ${invoiceId}`);


        
        const parseAmount = (raw: any): number => {
            if (raw === undefined || raw === null) return 0;
            if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
            
            const str = raw.toString()
                .replace(/[^0-9,.-]/g, '')      
                .replace(/\./g, '')             
                .replace(/,/g, '.');            
            const num = parseFloat(str);
            return isNaN(num) ? 0 : num;
        };
    
        const invoiceDoc = await this.prisma.document.findUnique({
            where: { id: invoiceId },
            include: { processedData: true }
        });
        
        if (!invoiceDoc) throw new NotFoundException('Invoice not found');
        
        const accountingClientRelation = await this.prisma.accountingClients.findFirst({
            where: {
                id: invoiceDoc.accountingClientId,
                accountingCompanyId: user.accountingCompanyId
            }
        });
        
        if (!accountingClientRelation) {
            throw new UnauthorizedException('No access to this invoice');
        }
    
        const extractedFields = invoiceDoc.processedData?.[0]?.extractedFields;
        let invoiceData: any = {};
        
        if (extractedFields) {
            if (typeof extractedFields === 'string') {
                try {
                    invoiceData = JSON.parse(extractedFields);
                } catch (e) {
                    console.error('Failed to parse extractedFields:', e);
                    invoiceData = {};
                }
            } else {
                invoiceData = extractedFields;
            }
        }        
        
        const relatedIds: number[] = Array.isArray(invoiceDoc.references) ? invoiceDoc.references : [];
        
        if (relatedIds.length === 0) {
            console.log(`ℹ️ Invoice ${invoiceId} has no related documents`);
            return { amountPaid: 0, payments: [] };
        }
    
        const relatedDocs = await this.prisma.document.findMany({
            where: { id: { in: relatedIds } },
            include: { processedData: true }
        });
    
        const payments: { docId: number; type: string; amount: number }[] = [];
        
        const invoiceNumber: string | undefined = invoiceData.result?.document_number || invoiceData.document_number;
        
        console.log(`🔍 Processing ${relatedDocs.length} related documents for invoice ${invoiceNumber || invoiceId}`);
    
        for (const doc of relatedDocs) {
            let docData: any = doc.processedData.extractedFields;
            console.log("DOCUMENT DATA: ",docData);
            
            let amount = 0;
            
            switch (doc.type) {
                case 'Receipt':
                    amount = parseAmount(docData.result?.total_amount || docData.total_amount);
                    break;
                    
                case 'Payment Order':
                case 'Collection Order':
                    amount = parseAmount(docData.result?.amount || docData.amount);
                    break;
                    
                case 'Bank Statement':
                    const transactions = docData.result?.transactions || docData.transactions || [];
                    if (Array.isArray(transactions)) {
                        for (const tx of transactions) {
                            const description: string = (tx.description || '').toString();
                            const matchesInvoice = invoiceNumber ? description.includes(invoiceNumber) : false;
                            
                            if (matchesInvoice) {
                                const debit = parseAmount(tx.debit_amount);
                                const credit = parseAmount(tx.credit_amount);
                                amount += credit > 0 ? credit : debit;
                            }
                        }
                    }
                    break;
                    
                default:
                    console.warn(`Unknown document type: ${doc.type}`);
                    break;
            }
            
            if (amount > 0) {
                payments.push({ docId: doc.id, type: doc.type, amount });
                console.log(`💰 Found payment: ${doc.type} #${doc.id} - ${amount} RON`);
            }
        }
    
        const amountPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        
        return { amountPaid, payments };
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
}
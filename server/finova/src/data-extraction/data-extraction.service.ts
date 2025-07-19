import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import { randomBytes } from 'crypto';
import { DuplicateType, DuplicateStatus, ComplianceStatus, CorrectionType } from '@prisma/client';

const execPromise = promisify(exec);
const writeFilePromise = promisify(fs.writeFile);
const unlinkPromise = promisify(fs.unlink);

interface ProcessedDataValidation {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

interface ProcessingPhase {
    id: number;
    name: string;
    description: string;
    requiresDocumentType: boolean;
    requiresFullExtraction: boolean;
}

class ProcessingQueue {
    private static instance: ProcessingQueue;
    private queue: Array<{ promise: Promise<any>; resolve: Function; reject: Function }> = [];
    private processing = false;
    private readonly maxConcurrent = 1;

    static getInstance(): ProcessingQueue {
        if (!ProcessingQueue.instance) {
            ProcessingQueue.instance = new ProcessingQueue();
        }
        return ProcessingQueue.instance;
    }

    async add<T>(processor: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push({ 
                promise: processor(), 
                resolve, 
                reject 
            });
            this.processNext();
        });
    }

    private async processNext() {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;
        const { promise, resolve, reject } = this.queue.shift()!;

        try {
            const result = await promise;
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.processing = false;
            setTimeout(() => {
                if (global.gc) {
                    global.gc();
                }
                this.processNext();
            }, 1000); 
        }
    }
}

@Injectable()
export class DataExtractionService {
    private readonly logger = new Logger(DataExtractionService.name);
    private pythonScriptPath: string;
    private readonly tempDir: string;
    private readonly processingQueue = ProcessingQueue.getInstance();
    private readonly maxFileSize = 10 * 1024 * 1024; 
    private readonly processingTimeout = 600000; 
    private dependenciesChecked = false;

    private readonly processingPhases: ProcessingPhase[] = [
        {
            id: 0,
            name: 'Categorization',
            description: 'Identify document types and basic information',
            requiresDocumentType: true,
            requiresFullExtraction: false
        },
        {
            id: 1,
            name: 'Incoming Invoices',
            description: 'Full processing of incoming invoices (we are buyers)',
            requiresDocumentType: true,
            requiresFullExtraction: true
        },
        {
            id: 2,
            name: 'Outgoing Invoices',
            description: 'Full processing of outgoing invoices (we are sellers)',
            requiresDocumentType: true,
            requiresFullExtraction: true
        },
        {
            id: 3,
            name: 'Other Documents',
            description: 'Process receipts, bank statements, contracts, etc.',
            requiresDocumentType: true,
            requiresFullExtraction: true
        }
    ];

    constructor(
        private readonly config: ConfigService, 
        private readonly prisma: PrismaService
    ) {
        const isProduction = process.env.NODE_ENV === 'production';
        
        if (isProduction || process.env.RENDER) {
            this.pythonScriptPath = path.join(
                process.cwd(),
                '..',
                '..',
                'agents',
                'first_crew_finova',
                'src',
                'first_crew_finova',
                'main.py'
            );
        } else {
            this.pythonScriptPath = this.config.get<string>('PYTHON_SCRIPT_PATH') || 
                path.join(process.cwd(), 'agents', 'first_crew_finova', 'src', 'first_crew_finova', 'main.py');
        }
        
        this.tempDir = path.join(os.tmpdir(), 'data-extraction');
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
        
        this.setupTempFileCleanup();
        
        this.logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        this.logger.log(`Current working directory: ${process.cwd()}`);
        this.logger.log(`Python script path: ${this.pythonScriptPath}`);
        this.logger.log(`Temp directory: ${this.tempDir}`);
        this.logger.log(`Max file size: ${this.maxFileSize / (1024 * 1024)}MB`);
        
        try {
            const scriptDir = path.dirname(this.pythonScriptPath);
            if (fs.existsSync(scriptDir)) {
                const files = fs.readdirSync(scriptDir);
                this.logger.log(`Files in script directory: ${files.join(', ')}`);
            } else {
                this.logger.warn(`Script directory does not exist: ${scriptDir}`);
                
                const cwd = process.cwd();
                this.logger.log(`Contents of ${cwd}: ${fs.readdirSync(cwd).join(', ')}`);
                
                const parent = path.join(cwd, '..');
                if (fs.existsSync(parent)) {
                    this.logger.log(`Contents of parent: ${fs.readdirSync(parent).join(', ')}`);
                }
            }
        } catch (e) {
            this.logger.error(`Error checking directories: ${e.message}`);
        }
    }

    async extractData(fileBase64: string, clientCompanyEin: string, processingPhase: number = 0) {
        return this.processingQueue.add(() => this.processDocument(fileBase64, clientCompanyEin, processingPhase));
    }

    private validateProcessedData(data: any, phase: number): ProcessedDataValidation {
        const validation: ProcessedDataValidation = {
            isValid: true,
            errors: [],
            warnings: []
        };

        if (!data || typeof data !== 'object') {
            validation.isValid = false;
            validation.errors.push('Invalid data structure received');
            return validation;
        }

        const result = data.result || data;
        const currentPhase = this.processingPhases[phase];

        if (!result.document_type) {
            validation.isValid = false;
            validation.errors.push('Missing document_type');
            return validation;
        }

        if (currentPhase?.requiresFullExtraction) {
            const docType = result.document_type.toLowerCase();

            switch (docType) {
                case 'invoice':
                    const requiredInvoiceFields = ['vendor', 'buyer', 'document_date', 'total_amount'];
                    const missingInvoiceFields = requiredInvoiceFields.filter(field => !result[field]);
                    
                    if (missingInvoiceFields.length > 0) {
                        validation.isValid = false;
                        validation.errors.push(`Missing required invoice fields: ${missingInvoiceFields.join(', ')}`);
                    }

                    if (!Array.isArray(result.line_items)) {
                        validation.warnings.push('Invoice line_items should be an array');
                    }

                    if (phase === 1 || phase === 2) {
                        if (!result.direction) {
                            validation.warnings.push('Missing invoice direction');
                        } else if (phase === 1 && result.direction !== 'incoming') {
                            validation.warnings.push('Expected incoming invoice in phase 1');
                        } else if (phase === 2 && result.direction !== 'outgoing') {
                            validation.warnings.push('Expected outgoing invoice in phase 2');
                        }
                    }
                    break;

                case 'receipt':
                    const requiredReceiptFields = ['vendor', 'total_amount', 'document_date'];
                    const missingReceiptFields = requiredReceiptFields.filter(field => !result[field]);
                    
                    if (missingReceiptFields.length > 0) {
                        validation.warnings.push(`Missing receipt fields: ${missingReceiptFields.join(', ')}`);
                    }
                    break;

                case 'bank statement':
                    const requiredBankFields = ['company_name', 'bank_name'];
                    const missingBankFields = requiredBankFields.filter(field => !result[field]);
                    
                    if (missingBankFields.length > 0) {
                        validation.warnings.push(`Missing bank statement fields: ${missingBankFields.join(', ')}`);
                    }

                    if (!Array.isArray(result.transactions)) {
                        validation.warnings.push('Bank statement transactions should be an array');
                    }
                    break;
            }
        }

        return validation;
    }

    private normalizeDocumentNumber(docNumber: any): string {
        if (!docNumber) return '';
        return String(docNumber)
            .trim()
            .toUpperCase()
            .replace(/[\s\-_]+/g, '') 
            .replace(/^0+/, '');
    }

    private normalizeAmount(amount: any): number {
        if (!amount) return 0;
        const numAmount = Number(amount);
        return isNaN(numAmount) ? 0 : Math.round(numAmount * 100) / 100;
    }

    private normalizeDate(date: any): string {
        if (!date) return '';

        const dateStr = String(date).trim();

        const ddmmyyyy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (ddmmyyyy) {
            const [, day, month, year] = ddmmyyyy;
            return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
        }

        const yyyymmdd = dateStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
        if (yyyymmdd) {
            const [, year, month, day] = yyyymmdd;
            return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
        }

        return dateStr;
    }

    private normalizeEIN(ein: any): string {
        if (!ein) return '';
        return String(ein)
            .trim()
            .toUpperCase()
            .replace(/^RO/, '') 
            .replace(/\s+/g, ''); 
    }

    private normalizeCompanyName(name: any): string {
        if (!name) return '';
        return String(name)
            .trim()
            .toUpperCase()
            .replace(/\s+/g, ' ') 
            .replace(/[SRL|SA|SRA|PFA|II|IF]\.?$/gi, '')
            .trim();
    }

    private async getExistingDocuments(accountingClientId: number) {
        console.log('🔍 getExistingDocuments called with ID:', accountingClientId);
        
        const documents = await this.prisma.document.findMany({
            where: {
                accountingClientId: accountingClientId
            },
            include: {
                processedData: true
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 200 
        });

        console.log('🔍 Raw documents found:', documents.length);

        const processedDocuments = documents.map(doc => {
            const extractedFields = doc.processedData?.extractedFields;
            let result: any = {};

            if (typeof extractedFields === 'string') {
                try {
                    const parsed = JSON.parse(extractedFields);
                    result = parsed.result || parsed || {};
                } catch (e) {
                    console.log(`🔍 Failed to parse extracted fields for doc ${doc.id}:`, e.message);
                    result = {};
                }
            } else if (extractedFields && typeof extractedFields === 'object') {
                result = (extractedFields as any).result || extractedFields || {};
            }

            const processedDoc = {
                id: doc.id,
                name: doc.name,
                documentHash: doc.documentHash,
                document_type: result.document_type?.toLowerCase(),
                document_number: this.normalizeDocumentNumber(result.document_number),
                total_amount: this.normalizeAmount(result.total_amount),
                vat_amount: this.normalizeAmount(result.vat_amount),
                document_date: this.normalizeDate(result.document_date),
                vendor_ein: this.normalizeEIN(result.vendor_ein),
                buyer_ein: this.normalizeEIN(result.buyer_ein),
                vendor: this.normalizeCompanyName(result.vendor),
                buyer: this.normalizeCompanyName(result.buyer),
                currency: result.currency || 'RON',
                created_at: doc.createdAt.toISOString()
            };

            console.log(`🔍 Processed doc ${doc.id}: type=${processedDoc.document_type}, hash=${processedDoc.documentHash}`);

            return processedDoc;
        });

        console.log('🔍 Processed documents returned:', processedDocuments.length);
        return processedDocuments;
    }

    private async getExistingArticles(accountingClientId: number) {
        const articles = await this.prisma.article.findMany({
            where: {
                accountingClientId: accountingClientId
            }
        });

        const articlesMap: Record<string, any> = {};
        articles.forEach(article => {
            articlesMap[article.code] = {
                name: article.name,
                vat: article.vat,
                unitOfMeasure: article.unitOfMeasure,
                type: article.type
            };
        });

        return articlesMap;
    }

    private async getUserCorrections(accountingClientId: number) {
        const corrections = await this.prisma.userCorrection.findMany({
            where: {
                document: {
                    accountingClientId: accountingClientId
                },
                applied: false
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 50
        });

        return corrections.map(correction => ({
            correctionType: correction.correctionType,
            originalValue: correction.originalValue,
            correctedValue: correction.correctedValue,
            confidence: correction.confidence
        }));
    }
    
    private async processDocument(fileBase64: string, clientCompanyEin: string, processingPhase: number = 0) {
    let tempBase64File: string | null = null;
    let tempExistingDocsFile: string | null = null;
    let tempUserCorrectionsFile: string | null = null;
    let tempExistingArticlesFile: string | null = null;
    const startTime = Date.now();
    const memoryBefore = process.memoryUsage();
    
    try {
        const estimatedSize = (fileBase64.length * 3) / 4; 
        if (estimatedSize > this.maxFileSize) {
            throw new Error(`File too large: ${Math.round(estimatedSize / (1024 * 1024))}MB. Maximum allowed: ${this.maxFileSize / (1024 * 1024)}MB`);
        }
    
        const currentPhase = this.processingPhases[processingPhase];
        this.logger.log(`Starting document processing in phase ${processingPhase} (${currentPhase?.name}). Estimated file size: ${Math.round(estimatedSize / 1024)}KB`);
        this.logger.debug(`Memory before processing: ${JSON.stringify(memoryBefore)}`);
    
        if (!fs.existsSync(this.pythonScriptPath)) {
            const alternativePaths = [
                path.join(process.cwd(), '../../agents/first_crew_finova/src/first_crew_finova/main.py'),
                '/opt/render/project/src/agents/first_crew_finova/src/first_crew_finova/main.py',
                path.join(process.cwd(), 'agents', 'first_crew_finova', 'src', 'first_crew_finova', 'main.py'),
                path.join(process.cwd(), 'src', 'server', 'finova', 'agents', 'first_crew_finova', 'src', 'first_crew_finova', 'main.py'),
            ];
            
            let foundPath = null;
            for (const altPath of alternativePaths) {
                this.logger.debug(`Checking alternative path: ${altPath}`);
                if (fs.existsSync(altPath)) {
                    foundPath = altPath;
                    this.logger.log(`Found Python script at alternative path: ${altPath}`);
                    break;
                }
            }
            
            if (!foundPath) {
                throw new Error(`Python script not found. Tried paths: ${this.pythonScriptPath}, ${alternativePaths.join(', ')}`);
            }
            
            this.pythonScriptPath = foundPath;
        }

        console.log('🔍 DUPLICATE DETECTION DEBUG START');
        console.log('📋 Client Company EIN:', clientCompanyEin);
        
        const clientCompany = await this.prisma.clientCompany.findUnique({
            where: { ein: clientCompanyEin },
        });
        
        console.log('🏢 Found Client Company:', clientCompany ? 'YES' : 'NO');
        if (clientCompany) {
            console.log('🏢 Client Company ID:', clientCompany.id);
            console.log('🏢 Client Company Name:', clientCompany.name);
        } else {
            throw new Error(`Failed to find client company with EIN: ${clientCompanyEin}`);
        }

        const accountingClientRelation = await this.prisma.accountingClients.findFirst({
            where: {
                clientCompanyId: clientCompany.id
            }
        });

        console.log('🔗 Found Accounting Relation:', accountingClientRelation ? 'YES' : 'NO');
        if (accountingClientRelation) {
            console.log('🔗 Accounting Client ID:', accountingClientRelation.id);
        } else {
            throw new Error(`No accounting relationship found for client company: ${clientCompanyEin}`);
        }

        const totalDocsCount = await this.prisma.document.count({
            where: {
                accountingClientId: accountingClientRelation.id
            }
        });
        console.log('📄 Total documents in database for this client:', totalDocsCount);

        const docsWithProcessedData = await this.prisma.document.count({
            where: {
                accountingClientId: accountingClientRelation.id,
                processedData: {
                    isNot: null
                }
            }
        });
        console.log('📄 Documents with processed data:', docsWithProcessedData);

        const sampleDocs = await this.prisma.document.findMany({
            where: {
                accountingClientId: accountingClientRelation.id
            },
            include: {
                processedData: true
            },
            take: 3,
            orderBy: {
                createdAt: 'desc'
            }
        });

        console.log('📄 Sample documents found:', sampleDocs.length);
        sampleDocs.forEach((doc, index) => {
            console.log(`📄 Sample Doc ${index + 1}:`);
            console.log(`   - ID: ${doc.id}`);
            console.log(`   - Name: ${doc.name}`);
            console.log(`   - Accounting Client ID: ${doc.accountingClientId}`);
            console.log(`   - Document Hash: ${doc.documentHash}`);
            console.log(`   - Has Processed Data: ${doc.processedData ? 'YES' : 'NO'}`);
            
            if (doc.processedData) {
                console.log(`   - Processed Data ID: ${doc.processedData.id}`);
                console.log(`   - Extracted Fields Type: ${typeof doc.processedData.extractedFields}`);
                
                let extractedData = null;
                if (typeof doc.processedData.extractedFields === 'string') {
                    try {
                        extractedData = JSON.parse(doc.processedData.extractedFields);
                        console.log(`   - Document Type: ${extractedData?.result?.document_type || extractedData?.document_type || 'N/A'}`);
                        console.log(`   - Document Number: ${extractedData?.result?.document_number || extractedData?.document_number || 'N/A'}`);
                    } catch (e) {
                        console.log(`   - Failed to parse extracted fields: ${e.message}`);
                    }
                } else if (doc.processedData.extractedFields && typeof doc.processedData.extractedFields === 'object') {
                    extractedData = doc.processedData.extractedFields;
                    console.log(`   - Document Type: ${(extractedData as any)?.result?.document_type || (extractedData as any)?.document_type || 'N/A'}`);
                    console.log(`   - Document Number: ${(extractedData as any)?.result?.document_number || (extractedData as any)?.document_number || 'N/A'}`);
                }
            }
            console.log('');
        });

        const existingDocuments = await this.getExistingDocuments(accountingClientRelation.id);
        console.log('📄 Existing documents returned by getExistingDocuments:', existingDocuments.length);
        
        existingDocuments.slice(0, 3).forEach((doc, index) => {
            console.log(`📄 Existing Doc ${index + 1} (processed):`);
            console.log(`   - ID: ${doc.id}`);
            console.log(`   - Name: ${doc.name}`);
            console.log(`   - Document Type: ${doc.document_type}`);
            console.log(`   - Document Number: ${doc.document_number}`);
            console.log(`   - Document Hash: ${doc.documentHash}`);
            console.log(`   - Total Amount: ${doc.total_amount}`);
            console.log(`   - Document Date: ${doc.document_date}`);
            console.log('');
        });

        console.log('🔍 DUPLICATE DETECTION DEBUG END');

        const userCorrections = await this.getUserCorrections(accountingClientRelation.id);
        const existingArticles = await this.getExistingArticles(accountingClientRelation.id);
    
        const timestamp = Date.now();
        const randomId = randomBytes(8).toString('hex');
        const tempFileName = `base64_${randomId}_${timestamp}.txt`;
        const existingDocsFileName = `existing_docs_${randomId}_${timestamp}.json`;
        const userCorrectionsFileName = `user_corrections_${randomId}_${timestamp}.json`;
        const existingArticlesFileName = `existing_articles_${randomId}_${timestamp}.json`;
        
        tempBase64File = path.join(this.tempDir, tempFileName);
        tempExistingDocsFile = path.join(this.tempDir, existingDocsFileName);
        tempUserCorrectionsFile = path.join(this.tempDir, userCorrectionsFileName);
        tempExistingArticlesFile = path.join(this.tempDir, existingArticlesFileName);
    
        await Promise.all([
            writeFilePromise(tempBase64File, fileBase64),
            writeFilePromise(tempExistingDocsFile, JSON.stringify(existingDocuments, null, 2)),
            writeFilePromise(tempUserCorrectionsFile, JSON.stringify(userCorrections, null, 2)),
            writeFilePromise(tempExistingArticlesFile, JSON.stringify(existingArticles, null, 2))
        ]);

        try {
            const existingDocsContent = fs.readFileSync(tempExistingDocsFile, 'utf8');
            const existingDocsParsed = JSON.parse(existingDocsContent);

            console.log('🔧 TEMP FILE DEBUG:');
            console.log(`   - Existing docs file size: ${existingDocsContent.length} bytes`);
            console.log(`   - Existing docs count in file: ${existingDocsParsed.length}`);

            if (existingDocsParsed.length > 0) {
                console.log(`   - First document in file:`, {
                    id: existingDocsParsed[0].id,
                    name: existingDocsParsed[0].name,
                    document_type: existingDocsParsed[0].document_type,
                    document_number: existingDocsParsed[0].document_number,
                    documentHash: existingDocsParsed[0].documentHash
                });

                const targetHash = '759707691851edb5e8b1a55475c23ef5';
                const matchingDoc = existingDocsParsed.find((doc: any) => doc.documentHash === targetHash);
                if (matchingDoc) {
                    console.log(`   - ✅ TARGET DOCUMENT FOUND IN TEMP FILE:`, {
                        id: matchingDoc.id,
                        name: matchingDoc.name,
                        document_type: matchingDoc.document_type,
                        document_number: matchingDoc.document_number,
                        documentHash: matchingDoc.documentHash,
                        total_amount: matchingDoc.total_amount
                    });
                } else {
                    console.log(`   - ❌ TARGET DOCUMENT NOT FOUND IN TEMP FILE`);
                    console.log(`   - Available hashes:`, existingDocsParsed.map((doc: any) => doc.documentHash));
                }
            }
        } catch (e) {
            console.log(`   - ❌ Failed to read temp file: ${e.message}`);
        }
        
        console.log(`🔧 Created temp files:`);
        console.log(`   - Base64 file: ${tempBase64File}`);
        console.log(`   - Existing docs file: ${tempExistingDocsFile} (${existingDocuments.length} documents)`);
        console.log(`   - User corrections file: ${tempUserCorrectionsFile} (${userCorrections.length} corrections)`);
        console.log(`   - Existing articles file: ${tempExistingArticlesFile}`);
        
        this.logger.debug(`Created temporary files for phase ${processingPhase}: ${tempBase64File}, ${tempExistingDocsFile}, ${tempUserCorrectionsFile}, ${tempExistingArticlesFile}`);
    
        if (!this.dependenciesChecked) {
            try {
                await this.installDependencies();
                this.dependenciesChecked = true;
            } catch (installError) {
                this.logger.warn('Failed to install Python dependencies, they might already be installed');
            }
        }
    
        const args = [
            clientCompanyEin,
            tempBase64File,
            tempExistingDocsFile,
            tempUserCorrectionsFile,
            tempExistingArticlesFile,
            processingPhase.toString()
        ];
        
        console.log(`🐍 Executing Python script with args:`, args);
        this.logger.debug(`Executing Python script with args: ${JSON.stringify(args)}`);
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Processing timeout')), this.processingTimeout);
        });
    
        const executionPromise = new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
            const { spawn } = require('child_process');
            
            const child = spawn('python3', [this.pythonScriptPath, ...args], {
                cwd: path.dirname(this.pythonScriptPath),
                env: {
                    ...process.env,
                    PYTHONPATH: path.dirname(this.pythonScriptPath),
                    PYTHONUNBUFFERED: '1',
                    MALLOC_ARENA_MAX: '2',
                    PROCESSING_PHASE: processingPhase.toString()
                },
                stdio: ['pipe', 'pipe', 'pipe']
            });
        
            let stdout = '';
            let stderr = '';
        
            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });
        
            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });
        
            child.on('close', (code) => {
                if (code === 0) {
                    resolve({ stdout, stderr });
                } else {
                    reject(new Error(`Python process exited with code ${code}. stderr: ${stderr}`));
                }
            });
        
            child.on('error', (error) => {
                reject(error);
            });
        });
    
        const { stdout, stderr } = await Promise.race([executionPromise, timeoutPromise]) as any;
        
        if (stderr) {
            this.logger.warn(`Python stderr output: ${stderr}`);
        }
    
        let result;
        try {
            const jsonOutput = this.extractJsonFromOutput(stdout);
            result = JSON.parse(jsonOutput);
        } catch (parseError) {
            this.logger.error(`Failed to parse Python output in phase ${processingPhase}. Raw output (first 1000 chars): ${stdout?.substring(0, 1000)}`);
            throw new Error(`Failed to parse processing results in phase ${processingPhase}: ${parseError.message}`);
        }
    
        if (result.error) {
            this.logger.error(`Python script returned error in phase ${processingPhase}: ${result.error}`);
            throw new Error(`Processing failed in phase ${processingPhase}: ${result.error}`);
        }
    
        const extractedData = result.data || result;
        
        if (extractedData.duplicate_detection) {
            console.log('🔍 PYTHON DUPLICATE DETECTION RESULTS:');
            console.log(`   - Is Duplicate: ${extractedData.duplicate_detection.is_duplicate}`);
            console.log(`   - Confidence: ${extractedData.duplicate_detection.confidence}`);
            console.log(`   - Existing Documents Count: ${extractedData.duplicate_detection.debug_info?.existing_documents_count || 0}`);
            console.log(`   - Same Type Documents Count: ${extractedData.duplicate_detection.debug_info?.same_type_documents_count || 0}`);
            console.log(`   - Matches Found: ${extractedData.duplicate_detection.duplicate_matches?.length || 0}`);
            if (extractedData.duplicate_detection.duplicate_matches?.length > 0) {
                extractedData.duplicate_detection.duplicate_matches.forEach((match: any, index: number) => {
                    console.log(`     Match ${index + 1}: Doc ID ${match.document_id}, Score: ${match.similarity_score}, Type: ${match.duplicate_type}`);
                });
            }
        }
        
        const validation = this.validateProcessedData(extractedData, processingPhase);
        
        if (!validation.isValid) {
            this.logger.error(`Data validation failed in phase ${processingPhase}: ${validation.errors.join(', ')}`);
            throw new Error(`Data validation failed in phase ${processingPhase}: ${validation.errors.join(', ')}`);
        }
        
        if (validation.warnings.length > 0) {
            this.logger.warn(`Data validation warnings in phase ${processingPhase}: ${validation.warnings.join(', ')}`);
        }
    
        if (processingPhase === 0) {
            this.logger.log(`Categorization complete: Document type = ${extractedData.document_type}`);
            if (processingPhase === 0) {
                this.logger.log(`Categorization complete: Document type = ${extractedData.document_type}`);
                
                // Special handling for receipts - resolve references even in categorization phase
                if (extractedData.document_type === 'Receipt' && 
                    Array.isArray(extractedData.referenced_numbers) && 
                    extractedData.referenced_numbers.length > 0) {
                    
                    console.log('🔗 REFERENCE RESOLUTION DEBUG (Categorization Phase):');
                    console.log(`   - Document Type: ${extractedData.document_type}`);
                    console.log(`   - Referenced numbers found: ${JSON.stringify(extractedData.referenced_numbers)}`);
                    
                    const refNumbers = [...new Set((extractedData.referenced_numbers as unknown[])
                        .map(n => String(n).trim())
                        .filter(Boolean))];
            
                    if (refNumbers.length > 0) {
                        const candidateDocs = await this.prisma.document.findMany({
                            where: {
                                accountingClientId: accountingClientRelation.id,
                                processedData: { isNot: null }
                            },
                            include: { processedData: true }
                        });
            
                        console.log(`   - Candidate documents found: ${candidateDocs.length}`);
            
                        const referenceIds: number[] = [];
                        const normalize = (val: string) => val.replace(/[^a-z0-9]/gi, '').toLowerCase();
            
                        for (const doc of candidateDocs) {
                            let fields: any = doc.processedData?.extractedFields;
                            if (!fields) {
                                console.log(`   - Doc ${doc.id} (${doc.name}): No processed fields`);
                                continue;
                            }
                            
                            if (typeof fields === 'string') {
                                try { 
                                    fields = JSON.parse(fields); 
                                } catch { 
                                    console.log(`   - Doc ${doc.id} (${doc.name}): Failed to parse fields`);
                                    continue; 
                                }
                            }
                            
                            const res = fields.result ?? fields;
                            const possibleNumbers = [
                                res.document_number,
                                res.invoice_number,
                                res.receipt_number,
                                res.contract_number,
                                res.order_number,
                                res.report_number,
                                res.statement_number
                            ]
                            .map((v: any) => (v !== undefined && v !== null ? String(v).trim() : null))
                            .filter(Boolean);
            
                            console.log(`   - Doc ${doc.id} (${doc.name}): Numbers found: ${JSON.stringify(possibleNumbers)}`);
            
                            // Check each reference against each possible number
                            for (const ref of refNumbers) {
                                for (const num of possibleNumbers) {
                                    const normalizedRef = normalize(ref);
                                    const normalizedNum = normalize(num);
                                    console.log(`     - Comparing "${ref}" (${normalizedRef}) with "${num}" (${normalizedNum}): ${normalizedRef === normalizedNum ? 'MATCH' : 'NO MATCH'}`);
                                    
                                    if (normalizedRef === normalizedNum) {
                                        if (!referenceIds.includes(doc.id)) {
                                            referenceIds.push(doc.id);
                                            console.log(`   - ✅ MATCH FOUND: Doc ${doc.id} "${num}" matches reference "${ref}"`);
                                        }
                                        break;
                                    }
                                }
                            }
                        }
            
                        if (referenceIds.length > 0) {
                            extractedData.references = referenceIds;
                            console.log(`🔗 Resolved ${referenceIds.length} explicit references: ${referenceIds}`);
                            this.logger.log(`🔗 Resolved ${referenceIds.length} explicit references during categorization.`);
                        } else {
                            console.log(`🔗 No references resolved. No matching documents found.`);
                        }
                    }
                }
                
                if (extractedData.document_type === 'Invoice') {
                    this.logger.log(`Invoice direction: ${extractedData.direction || 'unknown'}`);
                }
            }
            
            if (extractedData.document_type === 'Invoice') {
                this.logger.log(`Invoice direction: ${extractedData.direction || 'unknown'}`);
            }
        } else {
            if (extractedData.duplicate_detection) {
                this.logger.log(`Duplicate detection: ${extractedData.duplicate_detection.is_duplicate ? 'Found duplicates' : 'No duplicates found'}`);
            }
    
            if (extractedData.compliance_validation) {
                this.logger.log(`Compliance status: ${extractedData.compliance_validation.compliance_status}`);
            }
        }
    
        if (currentPhase?.requiresFullExtraction) {
            this.validateInvoiceDirection(extractedData, clientCompanyEin);
            this.validateDocumentRelevance(extractedData, clientCompanyEin);
            this.validateAndNormalizeCurrency(extractedData);
            this.validateExtractedData(extractedData, [], [], clientCompanyEin);

            // --- Resolve explicit referenced_numbers to document IDs and attach to extractedData ---
            if (Array.isArray(extractedData.referenced_numbers) && extractedData.referenced_numbers.length > 0) {
                const refNumbers = [...new Set((extractedData.referenced_numbers as unknown[])
                .map(n => String(n).trim())
                .filter(Boolean))];

                console.log('🔗 REFERENCE RESOLUTION DEBUG:');
                console.log(`   - Referenced numbers found: ${JSON.stringify(refNumbers)}`);

                if (refNumbers.length > 0) {
                    const candidateDocs = await this.prisma.document.findMany({
                        where: {
                            accountingClientId: accountingClientRelation.id,
                            processedData: { isNot: null }
                        },
                        include: { processedData: true }
                    });

                    console.log(`   - Candidate documents found: ${candidateDocs.length}`);

                    const referenceIds: number[] = [];
                    const normalize = (val: string) => val.replace(/[^a-z0-9]/gi, '').toLowerCase();

                    console.log(`   - Normalized references: ${refNumbers.map(ref => normalize(ref))}`);

                    for (const doc of candidateDocs) {
                        let fields: any = doc.processedData?.extractedFields;
                        if (!fields) continue;
                        if (typeof fields === 'string') {
                            try { fields = JSON.parse(fields); } catch { continue; }
                        }
                        const res = fields.result ?? fields;
                        const possibleNumbers = [
                            res.document_number,
                            res.invoice_number,
                            res.receipt_number,
                            res.contract_number,
                            res.order_number,
                            res.report_number,
                            res.statement_number
                        ]
                        .map((v: any) => (v !== undefined && v !== null ? String(v).trim() : null))
                        .filter(Boolean);

                        console.log(`   - Doc ${doc.id} (${doc.name}): Numbers found: ${JSON.stringify(possibleNumbers)}`);
                        console.log(`   - Doc ${doc.id} (${doc.name}): Normalized numbers: ${possibleNumbers.map(normalize)}`);

                        for (const ref of refNumbers) {
                            for (const num of possibleNumbers) {
                                const normalizedRef = normalize(ref);
                                const normalizedNum = normalize(num);
                                console.log(`     - Comparing "${ref}" (${normalizedRef}) with "${num}" (${normalizedNum}): ${normalizedRef === normalizedNum ? 'MATCH' : 'NO MATCH'}`);
                                
                                if (normalizedRef === normalizedNum) {
                                    referenceIds.push(doc.id);
                                    console.log(`   - ✅ MATCH FOUND: Doc ${doc.id} "${num}" matches reference "${ref}"`);
                                    break;
                                }
                            }
                        }
                    }

                    if (referenceIds.length > 0) {
                        extractedData.references = referenceIds;
                        console.log(`🔗 Resolved ${referenceIds.length} explicit references: ${referenceIds}`);
                        this.logger.log(`🔗 Resolved ${referenceIds.length} explicit references for current document.`);
                    } else {
                        console.log(`🔗 No references resolved. No matching documents found.`);
                    }
                }
            }
        }
    
        const processingTime = Date.now() - startTime;
        const memoryAfter = process.memoryUsage();
        const memoryDiff = {
            rss: memoryAfter.rss - memoryBefore.rss,
            heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
            external: memoryAfter.external - memoryBefore.external
        };
    
        this.logger.log(`Document processing completed in phase ${processingPhase} (${currentPhase?.name}) in ${processingTime}ms`);
        this.logger.debug(`Memory usage change: ${JSON.stringify(memoryDiff)}`);
    
        return extractedData;
        
    } catch (error) {
        const processingTime = Date.now() - startTime;
        this.logger.error(`Error extracting data for EIN ${clientCompanyEin} in phase ${processingPhase} after ${processingTime}ms: ${error.message}`, error.stack);
        
        if (error.message.includes('timeout')) {
            throw new Error(`Document processing timed out in phase ${processingPhase} after ${this.processingTimeout / 1000} seconds. Please try with a smaller file or contact support.`);
        } else if (error.message.includes('maxBuffer')) {
            throw new Error(`Document output too large in phase ${processingPhase}. Please try with a smaller or simpler document.`);
        } else if (error.message.includes('ENOENT')) {
            throw new Error('Document processing system unavailable. Please try again later.');
        } else if (error.message.includes('spawn') || error.message.includes('Python process')) {
            throw new Error(`Python processing failed in phase ${processingPhase}. Please check system configuration.`);
        } else if (error.message.includes('api key') || error.message.includes('authentication')) {
            throw new Error('API authentication failed. Please check your API configuration.');
        }
        
        throw new Error(`Failed to extract data from document in phase ${processingPhase}: ${error.message}`);
    } finally {
        const tempFiles = [tempBase64File, tempExistingDocsFile, tempUserCorrectionsFile, tempExistingArticlesFile].filter(Boolean);
        
        await Promise.all(
            tempFiles.map(async (file) => {
                if (file && fs.existsSync(file)) {
                    try {
                        await unlinkPromise(file);
                        this.logger.debug(`Cleaned up temporary file: ${file}`);
                    } catch (cleanupError) {
                        this.logger.warn(`Failed to clean up temporary file: ${cleanupError.message}`);
                    }
                }
            })
        );
    
        if (global.gc) {
            global.gc();
        }
    
        const finalMemory = process.memoryUsage();
        this.logger.debug(`Final memory state: ${JSON.stringify(finalMemory)}`);
    }
}

    async saveDuplicateDetection(documentId: number, duplicateData: any) {
        if (!duplicateData.is_duplicate || !duplicateData.duplicate_matches) {
            return;
        }

        const duplicateChecks = [];
        for (const match of duplicateData.duplicate_matches) {
            try {
                const duplicateCheck = await this.prisma.documentDuplicateCheck.create({
                    data: {
                        originalDocumentId: match.document_id,
                        duplicateDocumentId: documentId,
                        similarityScore: match.similarity_score,
                        matchingFields: match.matching_fields,
                        duplicateType: match.duplicate_type as DuplicateType,
                        status: DuplicateStatus.PENDING
                    }
                });
                duplicateChecks.push(duplicateCheck);
            } catch (error) {
                this.logger.warn(`Failed to save duplicate check: ${error.message}`);
            }
        }

        return duplicateChecks;
    } 

    async saveUserCorrection(documentId: number, userId: number, correctionData: {
        correctionType: CorrectionType;
        originalValue: any;
        correctedValue: any;
        confidence?: number;
    }) {
        try {
            const correction = await this.prisma.userCorrection.create({
                data: {
                    documentId: documentId,
                    userId: userId,
                    correctionType: correctionData.correctionType,
                    originalValue: correctionData.originalValue,
                    correctedValue: correctionData.correctedValue,
                    confidence: correctionData.confidence || null,
                    applied: false
                }
            });

            this.logger.log(`User correction saved: ${correctionData.correctionType} for document ${documentId}`);
            return correction;
        } catch (error) {
            this.logger.error(`Failed to save user correction: ${error.message}`);
            throw error;
        }
    }

    async getDuplicateAlerts(accountingClientId: number) {
        return this.prisma.documentDuplicateCheck.findMany({
            where: {
                originalDocument: {
                    accountingClientId: accountingClientId
                },
                status: DuplicateStatus.PENDING
            },
            include: {
                originalDocument: true,
                duplicateDocument: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    async getComplianceAlerts(accountingClientId: number) {
        return this.prisma.complianceValidation.findMany({
            where: {
                document: {
                    accountingClientId: accountingClientId
                },
                overallStatus: {
                    in: [ComplianceStatus.NON_COMPLIANT, ComplianceStatus.WARNING]
                }
            },
            include: {
                document: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    async updateDuplicateStatus(duplicateCheckId: number, status: DuplicateStatus) {
        return this.prisma.documentDuplicateCheck.update({
            where: { id: duplicateCheckId },
            data: { status: status }
        });
    }

    private async installDependencies() {
        const ocrDependencies = [
            'crewai', 
            'crewai-tools', 
            'pytesseract', 
            'pdf2image', 
            'pillow', 
            'opencv-python',
            'numpy'
        ];
        
        const command = `python3 -m pip install ${ocrDependencies.join(' ')} --no-cache-dir`;
        this.logger.debug('Installing Python dependencies including OCR packages...');
        
        await execPromise(command, {
            cwd: path.dirname(this.pythonScriptPath),
            timeout: 180000
        });
        
        this.logger.log('Python dependencies with OCR support installed successfully');
    }

    private setupTempFileCleanup() {
        setInterval(() => {
            this.cleanupOldTempFiles();
        }, 30 * 60 * 1000); 

        setTimeout(() => this.cleanupOldTempFiles(), 1000);
    }

    private async cleanupOldTempFiles() {
        try {
            const files = await fs.promises.readdir(this.tempDir);
            const now = Date.now();
            const oneHourAgo = now - (60 * 60 * 1000);

            for (const file of files) {
                const filePath = path.join(this.tempDir, file);
                try {
                    const stats = await fs.promises.stat(filePath);
                    if (stats.mtime.getTime() < oneHourAgo) {
                        await fs.promises.unlink(filePath);
                        this.logger.debug(`Cleaned up old temp file: ${file}`);
                    }
                } catch (error) {
                }
            }
        } catch (error) {
            this.logger.warn(`Error during temp file cleanup: ${error.message}`);
        }
    }

    private extractJsonFromOutput(output: string): string {
        if (!output) {
            throw new Error('No output received from Python script');
        }

        const lines = output.split('\n');
        
        let jsonString = '';
        let braceCount = 0;
        let inJson = false;
        
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            
            if (!inJson && line.includes('}')) {
                inJson = true;
            }
            
            if (inJson) {
                for (let j = line.length - 1; j >= 0; j--) {
                    if (line[j] === '}') braceCount++;
                    else if (line[j] === '{') braceCount--;
                    
                    if (braceCount === 0 && line[j] === '{') {
                        jsonString = line.substring(j) + '\n' + jsonString;
                        return jsonString.trim();
                    }
                }
                
                jsonString = line + '\n' + jsonString;
            }
        }
        
        const startIndex = output.lastIndexOf('{');
        if (startIndex === -1) {
            throw new Error('No JSON object found in output');
        }
        
        let openBraces = 0;
        let endIndex = -1;
        
        for (let i = startIndex; i < output.length; i++) {
            if (output[i] === '{') openBraces++;
            else if (output[i] === '}') {
                openBraces--;
                if (openBraces === 0) {
                    endIndex = i + 1;
                    break;
                }
            }
        }
        
        if (endIndex !== -1) {
            return output.substring(startIndex, endIndex);
        }
        
        throw new Error('Incomplete JSON object in output');
    }

    private validateDocumentRelevance(data: any, clientCompanyEin: string) {
        const documentType = data.document_type?.toLowerCase();
        const buyerEin = data.buyer_ein?.toString().replace(/^RO/i, '');
        const vendorEin = data.vendor_ein?.toString().replace(/^RO/i, '');
        const companyEin = data.company_ein?.toString().replace(/^RO/i, '');
        const cleanClientEin = clientCompanyEin.replace(/^RO/i, '');

        if (documentType === 'invoice' || documentType === 'receipt') {
            const isBuyer = buyerEin === cleanClientEin;
            const isVendor = vendorEin === cleanClientEin;
            
            if (!isBuyer && !isVendor) {
                this.logger.warn(`Document relevance warning: Neither buyer EIN (${buyerEin}) nor vendor EIN (${vendorEin}) matches client company EIN: ${cleanClientEin}`);
                data.validation_warnings = data.validation_warnings || [];
                data.validation_warnings.push({
                    type: 'DOCUMENT_RELEVANCE',
                    message: 'Document does not appear to belong to the selected company',
                    severity: 'HIGH'
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
        }

        else if (companyEin && companyEin !== cleanClientEin) {
            this.logger.warn(`Document relevance warning: Company EIN (${companyEin}) does not match client company EIN: ${cleanClientEin}`);
            data.validation_warnings = data.validation_warnings || [];
            data.validation_warnings.push({
                type: 'DOCUMENT_RELEVANCE',
                message: 'Document company EIN does not match selected company',
                severity: 'MEDIUM'
            });
        }
    }

    private validateAndNormalizeCurrency(data: any) {
        const supportedCurrencies = ['RON', 'EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'BGN'];
        
        if (!data.currency) {
            const documentText = JSON.stringify(data).toLowerCase();
            
            if (documentText.includes('eur') || documentText.includes('€')) {
                data.currency = 'EUR';
            } else if (documentText.includes('usd') || documentText.includes('$')) {
                data.currency = 'USD';
            } else if (documentText.includes('gbp') || documentText.includes('£')) {
                data.currency = 'GBP';
            } else if (documentText.includes('ron') || documentText.includes('lei')) {
                data.currency = 'RON';
            } else {
                data.currency = 'RON';
                this.logger.debug('No currency detected, defaulting to RON');
            }
        }

        data.currency = data.currency.toUpperCase();

        if (!supportedCurrencies.includes(data.currency)) {
            this.logger.warn(`Unsupported currency detected: ${data.currency}, defaulting to RON`);
            data.currency = 'RON';
            data.validation_warnings = data.validation_warnings || [];
            data.validation_warnings.push({
                type: 'CURRENCY_WARNING',
                message: `Unsupported currency detected, defaulted to RON`,
                severity: 'LOW'
            });
        }

        data.is_foreign_currency = data.currency !== 'RON';
        
        if (data.is_foreign_currency) {
            this.logger.log(`Document identified as foreign currency: ${data.currency}`);
        }
    }

    private validateInvoiceDirection(data: any, clientCompanyEin: string) {
        if (!data.buyer_ein || !data.vendor_ein) {
            this.logger.warn('Missing buyer_ein or vendor_ein in extracted data');
            return;
        }

        const buyerEin = data.buyer_ein.replace(/^RO/i, '');
        const vendorEin = data.vendor_ein.replace(/^RO/i, '');
        const cleanClientEin = clientCompanyEin.replace(/^RO/i, '');

        const isIncoming = buyerEin === cleanClientEin;
        const isOutgoing = vendorEin === cleanClientEin;

        if (!isIncoming && !isOutgoing) {
            this.logger.warn(`Neither buyer (${buyerEin}) nor vendor (${vendorEin}) matches client company EIN: ${cleanClientEin}`);
            return;
        }

        data.direction = isIncoming ? 'incoming' : 'outgoing';
        this.logger.log(`Invoice direction determined: ${data.direction}`);

        if (Array.isArray(data.line_items)) {
            const incomingTypes = ["Nedefinit", "Marfuri", "Materii prime", "Materiale auxiliare", "Ambalaje", "Obiecte de inventar", "Amenajari provizorii", "Mat. spre prelucrare", "Mat. in pastrare/consig.", "Discount financiar intrari", "Combustibili", "Piese de schimb", "Alte mat. consumabile", "Discount comercial intrari", "Ambalaje SGR"];
            const outgoingTypes = ["Nedefinit", "Marfuri", "Produse finite", "Ambalaje", "Produse reziduale", "Semifabricate", "Discount financiar iesiri", "Servicii vandute", "Discount comercial iesiri", "Ambalaje SGR", "Taxa verde"];

            data.line_items.forEach((item: any, index: number) => {
                if (isIncoming && !incomingTypes.includes(item.type)) {
                    this.logger.warn(`Line item ${index} has outgoing type "${item.type}" but this is an incoming invoice. Converting to "Nedefinit".`);
                    item.type = "Nedefinit";
                    item.management = null;
                }
                if (isOutgoing && !outgoingTypes.includes(item.type)) {
                    this.logger.warn(`Line item ${index} has incoming type "${item.type}" but this is an outgoing invoice. Converting to "Nedefinit".`);
                    item.type = "Nedefinit";
                    item.management = null;
                }
            });
        }
    }

    private validateExtractedData(data: any, existingArticles: any[], managementRecords: any[], clientCompanyEin: string) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid extracted data format');
        }

        const numericFields = ['total_amount', 'vat_amount'];
        numericFields.forEach(field => {
            if (data[field] !== undefined && data[field] !== null) {
                const numValue = Number(data[field]);
                if (!isNaN(numValue)) {
                    data[field] = numValue;
                }
            }
        });

        if (Array.isArray(data.line_items)) {
            data.line_items = data.line_items.map((item: any) => {
                const itemNumericFields = ['quantity', 'unit_price', 'vat_amount', 'total'];
                itemNumericFields.forEach(field => {
                    if (item[field] !== undefined && item[field] !== null) {
                        const numValue = Number(item[field]);
                        if (!isNaN(numValue)) {
                            item[field] = numValue;
                        }
                    }
                });
                
                item.isNew = item.isNew !== undefined ? item.isNew : true;
                item.management = item.management || null;
                
                return item;
            });
        } else {
            data.line_items = [];
        }

        return data;
    }

    getServiceHealth() {
        const memory = process.memoryUsage();
        return {
            memory: {
                rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
                heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
                external: `${Math.round(memory.external / 1024 / 1024)}MB`
            },
            tempDir: this.tempDir,
            pythonScriptPath: this.pythonScriptPath,
            maxFileSize: `${this.maxFileSize / 1024 / 1024}MB`,
            processingTimeout: `${this.processingTimeout / 1000}s`,
            queueLength: this.processingQueue['queue']?.length || 0,
            isProcessing: this.processingQueue['processing'] || false,
            processingPhases: this.processingPhases
        };
    }

    async saveDuplicateDetectionWithTransaction(
        prisma: any, 
        documentId: number, 
        duplicateDetection: any
    ): Promise<void> {
        try {
            if (!duplicateDetection?.duplicate_matches) return;

            for (const match of duplicateDetection.duplicate_matches) {
                if (match.document_id && match.document_id !== documentId) {
                    await prisma.documentDuplicateCheck.create({
                        data: {
                            originalDocumentId: documentId,
                            duplicateDocumentId: match.document_id,
                            similarityScore: match.similarity_score || 0.0,
                            matchingFields: match.matching_fields || {},
                            duplicateType: this.mapDuplicateType(match.duplicate_type),
                            status: DuplicateStatus.PENDING
                        }
                    });
                }
            }
        } catch (error) {
            console.error('[DUPLICATE_DETECTION_ERROR]', error);
        }
    }

    async saveComplianceValidationWithTransaction(
        prisma: any,
        documentId: number, 
        complianceValidation: any
    ): Promise<void> {
        try {
            let validationRules, errors, warnings;
            
            if (complianceValidation.validation_rules?.ro && complianceValidation.validation_rules?.en) {
                validationRules = complianceValidation.validation_rules;
                errors = complianceValidation.errors;
                warnings = complianceValidation.warnings;
            } else {
                validationRules = {
                    ro: complianceValidation.validation_rules || [],
                    en: complianceValidation.validation_rules || []
                };
                errors = {
                    ro: complianceValidation.errors || [],
                    en: complianceValidation.errors || []
                };
                warnings = {
                    ro: complianceValidation.warnings || [],
                    en: complianceValidation.warnings || []
                };
            }

            await prisma.complianceValidation.create({
                data: {
                    documentId: documentId,
                    overallStatus: this.mapComplianceStatus(complianceValidation.compliance_status),
                    validationRules: validationRules,
                    errors: errors,
                    warnings: warnings,
                    overallScore: complianceValidation.overall_score || null,
                    validatedAt: new Date()
                }
            });
        } catch (error) {
            console.error('[COMPLIANCE_VALIDATION_ERROR]', error);
        }
    }

    async saveComplianceValidation(documentId: number, complianceData: any) {
        try {
            let validationRules, errors, warnings;
            
            if (complianceData.validation_rules?.ro && complianceData.validation_rules?.en) {
                validationRules = complianceData.validation_rules;
                errors = complianceData.errors;
                warnings = complianceData.warnings;
            } else {
                validationRules = {
                    ro: complianceData.validation_rules || [],
                    en: complianceData.validation_rules || []
                };
                errors = {
                    ro: complianceData.errors || [],
                    en: complianceData.errors || []
                };
                warnings = {
                    ro: complianceData.warnings || [],
                    en: complianceData.warnings || []
                };
            }

            const compliance = await this.prisma.complianceValidation.create({
                data: {
                    documentId: documentId,
                    overallStatus: complianceData.compliance_status as ComplianceStatus,
                    validationRules: validationRules,
                    errors: errors,
                    warnings: warnings,
                    overallScore: complianceData.overall_score || null
                }
            });

            return compliance;
        } catch (error) {
            this.logger.error(`Failed to save compliance validation: ${error.message}`);
            throw error;
        }
    }

    async saveUserCorrectionWithTransaction(
        prisma: any, 
        documentId: number, 
        userId: number, 
        correction: any
    ): Promise<void> {
        try {
            await prisma.userCorrection.create({
                data: {
                    documentId: documentId,
                    userId: userId,
                    correctionType: this.mapCorrectionType(correction.correctionType || correction.field),
                    originalValue: correction.originalValue,
                    correctedValue: correction.correctedValue || correction.newValue,
                    confidence: correction.confidence || null,
                    applied: false
                }
            });
        } catch (error) {
            console.error('[USER_CORRECTION_ERROR]', error);
        }
    }

    private mapDuplicateType(type: string): DuplicateType {
        const mapping = {
            'exact_match': DuplicateType.EXACT_MATCH,
            'content_match': DuplicateType.CONTENT_MATCH,
            'similar_content': DuplicateType.SIMILAR_CONTENT
        };
        return mapping[type?.toLowerCase()] || DuplicateType.SIMILAR_CONTENT;
    }

    private mapComplianceStatus(status: string): ComplianceStatus {
        const mapping = {
            'compliant': ComplianceStatus.COMPLIANT,
            'non_compliant': ComplianceStatus.NON_COMPLIANT,
            'warning': ComplianceStatus.WARNING,
            'pending': ComplianceStatus.PENDING
        };
        return mapping[status?.toLowerCase()] || ComplianceStatus.PENDING;
    }

    private mapCorrectionType(type: string): CorrectionType {
        const mapping = {
            'document_type': CorrectionType.DOCUMENT_TYPE,
            'direction': CorrectionType.INVOICE_DIRECTION,
            'vendor_information': CorrectionType.VENDOR_INFORMATION,
            'buyer_information': CorrectionType.BUYER_INFORMATION,
            'amounts': CorrectionType.AMOUNTS,
            'dates': CorrectionType.DATES,
            'line_items': CorrectionType.LINE_ITEMS
        };
        return mapping[type] || CorrectionType.OTHER;
    }
}
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import { randomBytes } from 'crypto';
import { DuplicateType, DuplicateStatus, ComplianceStatus, CorrectionType, Document, ReconciliationStatus, SuggestionStatus } from '@prisma/client';
import { ROMANIAN_CHART_OF_ACCOUNTS } from '../utils/romanianChartOfAccounts';

const execPromise = promisify(exec);
const writeFilePromise = promisify(fs.writeFile);
const unlinkPromise = promisify(fs.unlink);

interface BankTransactionData {
    id: string;
    transactionDate: Date;
    description: string;
    amount: number;
    transactionType: 'DEBIT' | 'CREDIT';
    referenceNumber?: string;
    balanceAfter?: number;
  }

interface ProcessedDataValidation {
    isValid: boolean;
    errors: string[];
    warnings: string[];
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

    async extractData(fileBase64: string, clientCompanyEin: string, processingPhase: number, phase0Data?: any) {
            return this.processingQueue.add(() => this.processDocument(fileBase64, clientCompanyEin, processingPhase, phase0Data));
    }

    private validateProcessedData(data: any, processingPhase: number): ProcessedDataValidation {
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

        if (!result.document_type) {
            validation.isValid = false;
            validation.errors.push('Missing document_type');
            return validation;
        }

        if (processingPhase === 1) {
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


        const processedDocuments = documents.map(doc => {
            const extractedFields = doc.processedData?.extractedFields;
            let result: any = {};

            if (typeof extractedFields === 'string') {
                try {
                    const parsed = JSON.parse(extractedFields);
                    result = parsed.result || parsed || {};
                } catch (e) {
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

            return processedDoc;
        });

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

    private async processDocument(fileBase64: string, clientCompanyEin: string, processingPhase: number = 0, phase0Data?: any) {
        let tempBase64File: string | null = null;
        let tempExistingDocsFile: string | null = null;
        let tempUserCorrectionsFile: string | null = null;
        let tempExistingArticlesFile: string | null = null;
        
        try {
            const estimatedSize = (fileBase64.length * 3) / 4; 
            if (estimatedSize > this.maxFileSize) {
                throw new Error(`File too large: ${Math.round(estimatedSize / (1024 * 1024))}MB. Maximum allowed: ${this.maxFileSize / (1024 * 1024)}MB`);
            }
        
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

            const clientCompany = await this.prisma.clientCompany.findUnique({
                where: { ein: clientCompanyEin },
            });
            
            if (!clientCompany) {
                throw new Error(`Failed to find client company with EIN: ${clientCompanyEin}`);
            } 
    
            const accountingClientRelation = await this.prisma.accountingClients.findFirst({
                where: {
                    clientCompanyId: clientCompany.id
                }
            });
    
            if (!accountingClientRelation) {
                throw new Error(`No accounting relationship found for client company: ${clientCompanyEin}`);
            }
    
            const existingDocuments = await this.getExistingDocuments(accountingClientRelation.id);
    
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

            if (processingPhase === 1 && phase0Data) {
                args.push(JSON.stringify(phase0Data));
            }
            
            console.log(`🐍 Executing Python script with args:`, args);
            console.log(`🐍 Phase 0 data being passed:`, phase0Data);
            
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
                if (stderr.includes('takes from 2 to 4 positional arguments')) {
                    throw new Error(`Python script configuration error: Incorrect number of arguments passed to process_single_document`);
                }
            }
        
            let result;
            try {
                const jsonOutput = this.extractJsonFromOutput(stdout);
                console.log('🔍 Extracted JSON string (first 1000 chars):', jsonOutput.substring(0, 1000));

                result = JSON.parse(jsonOutput);

                console.log('🔍 Parsed Python result keys:', Object.keys(result));
                console.log('🔍 Result.data keys:', Object.keys(result.data || {}));
                console.log('🔍 Vendor in result.data:', result.data?.vendor);
                console.log('🔍 Receipt number in result.data:', result.data?.receipt_number);
                console.log('🔍 Total amount in result.data:', result.data?.total_amount);
            } catch (parseError) {
                this.logger.error(`Failed to parse Python output in phase ${processingPhase}. Raw output (first 1000 chars): ${stdout?.substring(0, 1000)}`);
                throw new Error(`Failed to parse processing results in phase ${processingPhase}: ${parseError.message}`);
            }
        
            if (result.error) {
                this.logger.error(`Python script returned error in phase ${processingPhase}: ${result.error}`);
                throw new Error(`Processing failed in phase ${processingPhase}: ${result.error}`);
            }
        
            const extractedData = result.data || result;

            if(processingPhase === 0)
            {
              return extractedData;
            }
            else
            {   if (processingPhase === 1) {
                    this.validateInvoiceDirection(extractedData, clientCompanyEin);
                    this.validateDocumentRelevance(extractedData, clientCompanyEin);
                    this.validateAndNormalizeCurrency(extractedData);
                    this.validateExtractedData(extractedData, [], [], clientCompanyEin);

                    if (extractedData.document_type === 'Bank Statement' && 
                      extractedData.transactions && 
                      Array.isArray(extractedData.transactions) && 
                      extractedData.transactions.length > 0) {
                      
                      this.logger.log(`🏦 Bank statement detected with ${extractedData.transactions.length} transactions`);
                      extractedData._shouldProcessBankTransactions = true;
                  }
                
                    if (Array.isArray(extractedData.referenced_numbers) && extractedData.referenced_numbers.length > 0) {
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
                        
                        
                            const referenceIds: number[] = [];
                            const normalize = (val: string) => val.replace(/[^a-z0-9]/gi, '').toLowerCase();
                        
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
                            
                                for (const ref of refNumbers) {
                                    for (const num of possibleNumbers) {
                                        const normalizedRef = normalize(ref);
                                        const normalizedNum = normalize(num);

                                        if (normalizedRef === normalizedNum) {
                                            referenceIds.push(doc.id);
                                            break;
                                        }
                                    }
                                }
                            }
                        
                            if (referenceIds.length > 0) {
                                extractedData.references = referenceIds;
                            }
                        }
                    }
                }
        
            return extractedData;
        
        }
            
        } catch (error) {
            let errorMessage = `Failed to extract data from document in phase ${processingPhase}: ${error.message}`;
            if (error.message.includes('Incorrect number of arguments')) {
                errorMessage = `Server configuration error: Python script failed due to incorrect argument count`;
            }
            throw new Error(errorMessage);
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

    async extractBankTransactions(
      bankStatementDocumentId: number, 
      extractedData: any
    ): Promise<BankTransactionData[]> {
      this.logger.log(`🔍 Starting transaction extraction for document ${bankStatementDocumentId}`);
      
      try {
        const document = await this.prisma.document.findUnique({
          where: { id: bankStatementDocumentId }
        });
        
        if (!document) {
          this.logger.error(`❌ Document ${bankStatementDocumentId} not found in database`);
          throw new Error(`Document ${bankStatementDocumentId} not found`);
        }
        
        this.logger.log(`✅ Document found: ID=${document.id}, Type=${document.type}, Name=${document.name}`);
        
        const transactions = extractedData.result?.transactions || extractedData.transactions || [];
        
        if (!Array.isArray(transactions) || transactions.length === 0) {
          this.logger.warn(`No transactions found in bank statement ${bankStatementDocumentId}`);
          return [];
        }
    
        this.logger.log(`🔍 Found ${transactions.length} transactions to process`);
    
        const deleteResult = await this.prisma.bankTransaction.deleteMany({
          where: { bankStatementDocumentId }
        });
        
        this.logger.log(`🗑️ Deleted ${deleteResult.count} existing transactions`);
    
        const bankTransactions: BankTransactionData[] = [];
    
        for (const [index, tx] of transactions.entries()) {
          try {
            const transactionId = `${bankStatementDocumentId}-${index}-${Date.now()}`;
            
            const debitAmount = this.parseAmount(tx.debit_amount);
            const creditAmount = this.parseAmount(tx.credit_amount);
            
            let amount: number;
            let transactionType: 'DEBIT' | 'CREDIT';
            
            if (creditAmount > 0) {
              amount = creditAmount;
              transactionType = 'CREDIT';
            } else if (debitAmount > 0) {
              amount = -debitAmount;
              transactionType = 'DEBIT';
            } else {
              this.logger.warn(`⚠️ Invalid transaction amounts in ${bankStatementDocumentId}, index ${index}`);
              continue;
            }
    
            const transactionDate = this.parseTransactionDate(tx.transaction_date || tx.date);
            if (!transactionDate) {
              this.logger.warn(`⚠️ Invalid transaction date in ${bankStatementDocumentId}, index ${index}`);
              continue;
            }
    
            const bankTransactionData = {
              id: transactionId,
              transactionDate,
              description: tx.description || '',
              amount,
              transactionType,
              referenceNumber: tx.reference_number || tx.reference || null,
              balanceAfter: this.parseAmount(tx.balance_after_transaction) || null
            };
    
            this.logger.log(`🔍 Creating transaction ${index}: ${tx.description} (${amount} ${transactionType})`);
    
            const createdTransaction = await this.prisma.bankTransaction.create({
              data: {
                ...bankTransactionData,
                bankStatementDocumentId,
                reconciliationStatus: 'UNRECONCILED',
                isStandalone: false
              }
            });
    
            bankTransactions.push(bankTransactionData);
            this.logger.log(`✅ Successfully created transaction ${index}: ${createdTransaction.id}`);
            
          } catch (error) {
            this.logger.error(`❌ Error creating transaction ${index}:`, {
              error: error.message,
              transactionData: tx,
              documentId: bankStatementDocumentId
            });
            
            continue;
          }
        }
    
        this.logger.log(`✅ Successfully extracted ${bankTransactions.length}/${transactions.length} transactions`);
        return bankTransactions;
    
      } catch (error) {
        this.logger.error(`❌ Failed to extract bank transactions for document ${bankStatementDocumentId}:`, error);
        throw new Error(`Bank transaction extraction failed: ${error.message}`);
      }
    }

    async processDocumentWithTransactions(documentData: any, extractedData: any) {
      return await this.prisma.$transaction(async (prisma) => {
        const document = await prisma.document.create({
          data: documentData
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const transactions = await this.extractBankTransactions(document.id, extractedData);
        
        return { document, transactions };
      });
    }
      
    private parseTransactionDate(dateStr: string): Date | null {
      if (!dateStr) return null;
      
      try {
          if (dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) {
              const [day, month, year] = dateStr.split('-');
              return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          }
          
          if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
              const [day, month, year] = dateStr.split('/');
              return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          }
          
          if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
              return new Date(dateStr);
          }
          
          const parsed = new Date(dateStr);
          return isNaN(parsed.getTime()) ? null : parsed;
      } catch (error) {
          this.logger.warn(`Failed to parse date: ${dateStr}`, error);
          return null;
      }
  }
      
      private parseAmount(amount: any): number {
        if (!amount || amount === null || amount === undefined) return 0;
        
        if (typeof amount === 'number') return amount;
        
        const cleanAmount = amount.toString()
          .replace(/[^\d,.-]/g, '')
          .replace(/\./g, '')
          .replace(',', '.');
          
        const parsed = parseFloat(cleanAmount);
        return isNaN(parsed) ? 0 : parsed;
      }

      async resolvePendingReferences(document: Document): Promise<void> {
        try {
          const documentNumber = this.extractDocumentNumber(document);
          if (!documentNumber) {
            this.logger.debug(`No document number found for document ${document.id}`);
            return;
          }
      
          this.logger.log(`Resolving pending references for document number: ${documentNumber}`);
      
          const pendingRefs = await this.prisma.potentialReference.findMany({
            where: { 
              referencedDocumentNumber: documentNumber,
              status: 'PENDING'
            },
            include: {
              sourceDocument: true
            }
          });
      
          if (pendingRefs.length === 0) {
            this.logger.debug(`No pending references found for ${documentNumber}`);
            return;
          }
      
          this.logger.log(`Found ${pendingRefs.length} pending references to resolve`);
      
          for (const pendingRef of pendingRefs) {
            try {
              await this.prisma.potentialReference.update({
                where: { id: pendingRef.id },
                data: {
                  targetDocumentId: document.id,
                  status: 'RESOLVED',
                  resolvedAt: new Date(),
                  confidence: 1.0
                }
              });
      
              this.logger.warn(`🔗 CALLING createBidirectionalReference(${pendingRef.sourceDocumentId}, ${document.id})`);
              this.logger.warn(`🔗 MEANING: ${pendingRef.sourceDocument.name}(${pendingRef.sourceDocumentId}) <-> ${document.name}(${document.id})`);
              
              await this.createBidirectionalReference(pendingRef.sourceDocumentId, document.id);
      
              this.logger.log(`Resolved reference: ${pendingRef.sourceDocument.name} -> ${document.name}`);
      
            } catch (error) {
              this.logger.error(`Failed to resolve reference ${pendingRef.id}:`, error);
              continue;
            }
          }
      
        } catch (error) {
          this.logger.error(`Error resolving pending references:`, error);
        }
      }
      
      private extractDocumentNumber(document: Document & { processedData?: { extractedFields: any } | null }): string | null {
        try {
          if (!document.processedData?.extractedFields) return null;
          
          const extractedFields = typeof document.processedData.extractedFields === 'string' 
            ? JSON.parse(document.processedData.extractedFields)
            : document.processedData.extractedFields;
      
          const result = extractedFields.result || extractedFields;
          
          return result.document_number || 
                 result.invoice_number || 
                 result.receipt_number || 
                 result.contract_number ||
                 result.order_number ||
                 result.report_number ||
                 null;
        } catch (error) {
          this.logger.error(`Error extracting document number:`, error);
          return null;
        }
      }
      
      private async createBidirectionalReference(sourceDocId: number, targetDocId: number): Promise<void> {
        try {
          // Validate parameters
          if (!sourceDocId || !targetDocId || sourceDocId === targetDocId) {
            this.logger.error(`🔗 Invalid parameters: sourceDocId=${sourceDocId}, targetDocId=${targetDocId}`);
            return;
          }
          
          this.logger.warn(`🔗 BIDIRECTIONAL REF: Creating ${sourceDocId} <-> ${targetDocId}`);
          
          // Use a transaction to ensure atomicity and prevent race conditions
          await this.prisma.$transaction(async (tx) => {
            const [sourceDoc, targetDoc] = await Promise.all([
              tx.document.findUnique({ where: { id: sourceDocId } }),
              tx.document.findUnique({ where: { id: targetDocId } })
            ]);

            if (!sourceDoc || !targetDoc) {
              this.logger.error(`🔗 Missing documents - source: ${!!sourceDoc}, target: ${!!targetDoc}`);
              return;
            }
            
            this.logger.warn(`🔗 BEFORE - Source ${sourceDocId} (${sourceDoc.name}): ${JSON.stringify(sourceDoc.references)}`);
            this.logger.warn(`🔗 BEFORE - Target ${targetDocId} (${targetDoc.name}): ${JSON.stringify(targetDoc.references)}`);
            
            // Update source document to reference target
            const sourceRefs = Array.isArray(sourceDoc.references) ? [...sourceDoc.references] : [];
            this.logger.warn(`🔗 Source ${sourceDocId} (${sourceDoc.name}) current refs: ${JSON.stringify(sourceRefs)}`);
            
            if (!sourceRefs.includes(targetDocId)) {
              sourceRefs.push(targetDocId);
              this.logger.warn(`🔗 Adding ${targetDocId} to source ${sourceDocId} refs: ${JSON.stringify(sourceRefs)}`);
              
              await tx.document.update({
                where: { id: sourceDocId },
                data: { references: sourceRefs }
              });
              this.logger.warn(`🔗 UPDATED Source ${sourceDocId} (${sourceDoc.name}) references: ${JSON.stringify(sourceRefs)}`);
            } else {
              this.logger.warn(`🔗 Source ${sourceDocId} already references ${targetDocId}`);
            }
        
            // Only add reverse reference when neither document is a bank statement
            if (sourceDoc.type !== 'BANK_STATEMENT' && targetDoc.type !== 'BANK_STATEMENT') {
              const targetRefs = Array.isArray(targetDoc.references) ? [...targetDoc.references] : [];
              this.logger.warn(`🔗 Target ${targetDocId} (${targetDoc.name}) current refs: ${JSON.stringify(targetRefs)}`);
              
              if (!targetRefs.includes(sourceDocId)) {
                // CRITICAL DEBUG: Log exactly what we're about to do
                this.logger.error(`🚨 CRITICAL: About to add sourceDocId=${sourceDocId} to targetDocId=${targetDocId}`);
                this.logger.error(`🚨 CRITICAL: Target document name: ${targetDoc.name}`);
                this.logger.error(`🚨 CRITICAL: Source document name: ${sourceDoc.name}`);
                this.logger.error(`🚨 CRITICAL: Expected result: ${targetDoc.name} should reference ${sourceDoc.name}`);
                
                targetRefs.push(sourceDocId);
                this.logger.warn(`🔗 Adding ${sourceDocId} to target ${targetDocId} refs: ${JSON.stringify(targetRefs)}`);
                
                await tx.document.update({
                  where: { id: targetDocId },
                  data: { references: targetRefs }
                });
                this.logger.warn(`🔗 UPDATED Target ${targetDocId} (${targetDoc.name}) references: ${JSON.stringify(targetRefs)}`);
                
                // CRITICAL DEBUG: Verify what was actually saved
                const verifyDoc = await tx.document.findUnique({ where: { id: targetDocId } });
                this.logger.error(`🚨 VERIFICATION: ${targetDoc.name} now has references: ${JSON.stringify(verifyDoc?.references)}`);
              } else {
                this.logger.warn(`🔗 Target ${targetDocId} already references ${sourceDocId}`);
              }
            } else {
              this.logger.warn(`🔗 Skipping reverse reference - one document is a bank statement`);
            }
          });
      
          // Log final state after transaction
          const [finalSourceDoc, finalTargetDoc] = await Promise.all([
            this.prisma.document.findUnique({ where: { id: sourceDocId } }),
            this.prisma.document.findUnique({ where: { id: targetDocId } })
          ]);
          
          this.logger.warn(`🔗 FINAL - Source ${sourceDocId} (${finalSourceDoc?.name}): ${JSON.stringify(finalSourceDoc?.references)}`);
          this.logger.warn(`🔗 FINAL - Target ${targetDocId} (${finalTargetDoc?.name}): ${JSON.stringify(finalTargetDoc?.references)}`);

        } catch (error) {
          this.logger.error(`Error creating bidirectional reference:`, error);
        }
      }

      async suggestAccountForTransactionWithAgent(
        transaction: {
          description: string;
          amount: number;
          transactionType: 'DEBIT' | 'CREDIT';
          referenceNumber?: string;
          transactionDate?: string;
        },
        accountingClientId: number
      ): Promise<{ accountCode: string; accountName: string; confidence: number }[]> {
        try { // Fixed: was "try:" should be "try {"
          const accountingRelation = await this.prisma.accountingClients.findUnique({
            where: { id: accountingClientId },
            include: { clientCompany: true }
          });
    
          if (!accountingRelation) {
            throw new Error('Accounting client relation not found');
          }
    
          const accountCorrections = await this.prisma.userCorrection.findMany({
            where: {
              document: { accountingClientId: accountingClientId },
              correctionType: 'OTHER',
              applied: false
            },
            orderBy: { createdAt: 'desc' },
            take: 10
          });
    
          const learningContext = accountCorrections.map(correction => ({
            originalSuggestion: correction.originalValue,
            correctAccount: correction.correctedValue,
            confidence: correction.confidence
          }));
    
          const transactionData = {
            description: transaction.description,
            amount: transaction.amount,
            transactionType: transaction.transactionType,
            referenceNumber: transaction.referenceNumber || '',
            transactionDate: transaction.transactionDate || new Date().toISOString(),
            clientCompanyEin: accountingRelation.clientCompany.ein,
            chartOfAccounts: ROMANIAN_CHART_OF_ACCOUNTS,
            learningContext: learningContext,
            processingHints: this.generateProcessingHints(transaction)
          };
    
          const timestamp = Date.now();
          const randomId = randomBytes(8).toString('hex');
          const transactionFilePath = path.join(this.tempDir, `transaction_${randomId}_${timestamp}.json`);
    
          await writeFilePromise(transactionFilePath, JSON.stringify(transactionData, null, 2));
          const result = await this.callAccountAttributionScript(transactionFilePath); 
    
          if (fs.existsSync(transactionFilePath)) {
            await unlinkPromise(transactionFilePath);
          }
    
          return result.map(suggestion => ({
            ...suggestion,
            confidence: this.enhanceConfidenceScore(suggestion.confidence, transaction, suggestion.accountCode)
          }));
    
        } catch (error) {
          this.logger.error(`Account attribution agent failed: ${error.message}`);
          return this.suggestAccountForTransactionFallback(transaction); 
        }
      }    
      

      async suggestAccountForTransaction(
        transaction: {
            description: string;
            amount: number;
            transactionType: 'DEBIT' | 'CREDIT';
            referenceNumber?: string;
            transactionDate?: string;
        },
        accountingClientId: number
    ): Promise<{ accountCode: string; accountName: string; confidence: number }[]> {
        
        this.logger.log(`🤖 STARTING AI ACCOUNT ATTRIBUTION`);
        this.logger.log(`🤖 Transaction: "${transaction.description}" | ${transaction.amount} | ${transaction.transactionType}`);
        
        try {
            const accountingRelation = await this.prisma.accountingClients.findUnique({
                where: { id: accountingClientId },
                include: { clientCompany: true }
            });
    
            if (!accountingRelation) {
                this.logger.error(`❌ No accounting relation found for ID: ${accountingClientId}`);
                throw new Error('Accounting client relation not found');
            }
    
            const timestamp = Date.now();
            const randomId = require('crypto').randomBytes(8).toString('hex');
            const transactionFileName = `transaction_${randomId}_${timestamp}.json`;
            const transactionFilePath = path.join(this.tempDir, transactionFileName);
    
            const transactionData = {
                description: transaction.description,
                amount: transaction.amount,
                transactionType: transaction.transactionType,
                referenceNumber: transaction.referenceNumber || '',
                transactionDate: transaction.transactionDate || new Date().toISOString(),
                clientCompanyEin: accountingRelation.clientCompany.ein,
                chartOfAccounts: ROMANIAN_CHART_OF_ACCOUNTS
            };
    
            this.logger.log(`🤖 WRITING TRANSACTION DATA TO: ${transactionFilePath}`);
            this.logger.log(`🤖 TRANSACTION DATA: ${JSON.stringify(transactionData, null, 2)}`);
    
            await writeFilePromise(transactionFilePath, JSON.stringify(transactionData, null, 2));
    
            this.logger.log(`🤖 CALLING AI PYTHON SCRIPT...`);
            const result = await this.callAccountAttributionScript(transactionFilePath);
    
            if (fs.existsSync(transactionFilePath)) {
                await unlinkPromise(transactionFilePath);
            }
    
            this.logger.log(`🤖 AI RESULT: ${JSON.stringify(result)}`);
            
            if (!result || result.length === 0 || result[0].accountCode === '628') {
                this.logger.warn(`⚠️ AI returned default/empty result, this suggests AI failure`);
                this.logger.log(`🔄 FALLING BACK TO RULE-BASED CATEGORIZATION`);
                return this.suggestAccountForTransactionFallback(transaction);
            }
            
            this.logger.log(`✅ AI SUCCESS: Using AI suggestion ${result[0].accountCode} - ${result[0].accountName}`);
            return result;
    
        } catch (error) {
            this.logger.error(`❌ AI ACCOUNT ATTRIBUTION FAILED: ${error.message}`);
            this.logger.log(`🔄 FALLING BACK TO RULE-BASED CATEGORIZATION`);
            
            return this.suggestAccountForTransactionFallback(transaction);
        }
    }
    
      
    private async callAccountAttributionScript(transactionFilePath: string): Promise<{ accountCode: string; accountName: string; confidence: number }[]> {
      return new Promise((resolve, reject) => {
          const { spawn } = require('child_process');
          
          this.logger.log(`🐍 PYTHON DEBUG: Calling account attribution script`);
          this.logger.log(`🐍 Script path: ${this.pythonScriptPath}`);
          this.logger.log(`🐍 Transaction file: ${transactionFilePath}`);
          
          const child = spawn('python3', [
              this.pythonScriptPath, 
              'account_attribution', 
              transactionFilePath
          ], {
              cwd: path.dirname(this.pythonScriptPath),
              env: {
                  ...process.env,
                  PYTHONPATH: path.dirname(this.pythonScriptPath),
                  PYTHONUNBUFFERED: '1',
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
              this.logger.log(`🐍 PYTHON EXIT CODE: ${code}`);
              this.logger.log(`🐍 PYTHON STDOUT (first 1000 chars): ${stdout.substring(0, 1000)}`);
              if (stderr) this.logger.log(`🐍 PYTHON STDERR: ${stderr.substring(0, 500)}`);
              
              if (code === 0) {
                  try {
                      const jsonOutput = this.extractJsonFromOutput(stdout);
                      const result = JSON.parse(jsonOutput);
                      
                      this.logger.log(`🐍 PARSED PYTHON RESULT: ${JSON.stringify(result)}`);
                      
                      if (result.error) {
                          this.logger.error(`🐍 Python returned error: ${result.error}`);
                          resolve(this.getDefaultFallbackSuggestion());
                          return;
                      }
  
                      let suggestions: { accountCode: string; accountName: string; confidence: number }[] = [];
                      
                      if (result.account_code || result.recommended_account) {
                          suggestions.push({
                              accountCode: result.account_code || result.recommended_account || '628',
                              accountName: result.account_name || result.account_description || 'Alte cheltuieli cu serviciile executate de terți',
                              confidence: result.confidence || result.confidence_score || 0.5
                          });
                      }
                      
                      else if (result.data && (result.data.account_code || result.data.recommended_account)) {
                          suggestions.push({
                              accountCode: result.data.account_code || result.data.recommended_account || '628',
                              accountName: result.data.account_name || result.data.account_description || 'Alte cheltuieli cu serviciile executate de terți',
                              confidence: result.data.confidence || result.data.confidence_score || 0.5
                          });
                      }
                      
                      else if (Array.isArray(result.suggestions)) {
                          suggestions = result.suggestions.map((s: any) => ({
                              accountCode: s.account_code || s.code || '628',
                              accountName: s.account_name || s.name || 'Alte cheltuieli cu serviciile executate de terți',
                              confidence: s.confidence || 0.5
                          }));
                      }
                      
                      if (suggestions.length === 0) {
                          this.logger.warn(`🐍 No valid suggestions in Python result, using fallback`);
                          resolve(this.getDefaultFallbackSuggestion());
                          return;
                      }
  
                      if (result.alternative_accounts && Array.isArray(result.alternative_accounts)) {
                          result.alternative_accounts.forEach((alt: any) => {
                              suggestions.push({
                                  accountCode: alt.code || alt.account_code || '628',
                                  accountName: alt.name || alt.account_name || 'Alternative account',
                                  confidence: alt.confidence || 0.3
                              });
                          });
                      }
  
                      this.logger.log(`🐍 FINAL SUGGESTIONS: ${JSON.stringify(suggestions)}`);
                      resolve(suggestions.sort((a, b) => b.confidence - a.confidence));
                      
                  } catch (parseError) {
                      this.logger.error(`🐍 Failed to parse Python result: ${parseError.message}`);
                      this.logger.error(`🐍 Raw output that failed to parse: ${stdout.substring(0, 1000)}`);
                      resolve(this.getDefaultFallbackSuggestion());
                  }
              } else {
                  this.logger.error(`🐍 Python failed with code ${code}: ${stderr}`);
                  resolve(this.getDefaultFallbackSuggestion());
              }
          });
  
          child.on('error', (error) => {
              this.logger.error(`🐍 Failed to start Python process: ${error.message}`);
              resolve(this.getDefaultFallbackSuggestion());
          });
      });
  }
      
      private getDefaultFallbackSuggestion(): { accountCode: string; accountName: string; confidence: number }[] {
        return [{
          accountCode: '628',
          accountName: 'Alte cheltuieli cu serviciile executate de terți',
          confidence: 0.3
        }];
      }
      
      private async suggestAccountForTransactionFallback(
        transaction: {
            description: string;
            amount: number;
            transactionType: 'DEBIT' | 'CREDIT';
            referenceNumber?: string;
        }
    ): Promise<{ accountCode: string; accountName: string; confidence: number }[]> {
        
        this.logger.warn(`⚠️ USING FALLBACK RULES - AI FAILED!`);
        this.logger.log(`🔧 FALLBACK: Processing "${transaction.description}"`);
        
        const suggestions: { accountCode: string; accountName: string; confidence: number }[] = [];
        const description = transaction.description.toLowerCase();
    
        if (this.matchesPattern(description, ['comision', 'taxa', 'fee', 'charge', 'cost', 'bancar'])) {
            suggestions.push({ accountCode: '627', accountName: 'Servicii bancare', confidence: 0.9 });
            this.logger.log(`🔧 FALLBACK MATCH: Bank fees → 627`);
        }
    
        if (this.matchesPattern(description, ['salariu', 'salary', 'angajat', 'payroll'])) {
            suggestions.push({ accountCode: '421', accountName: 'Personal - salarii datorate', confidence: 0.9 });
            this.logger.log(`🔧 FALLBACK MATCH: Salary → 421`);
        }
    
        if (this.matchesPattern(description, ['servicii it', 'it services', 'software'])) {
            if (transaction.transactionType === 'CREDIT') {
                suggestions.push({ accountCode: '704', accountName: 'Venituri din prestări servicii', confidence: 0.9 });
                this.logger.log(`🔧 FALLBACK MATCH: IT Services Income → 704`);
            } else {
                suggestions.push({ accountCode: '628', accountName: 'Alte cheltuieli cu serviciile executate de terți', confidence: 0.8 });
                this.logger.log(`🔧 FALLBACK MATCH: IT Services Expense → 628`);
            }
        }
    
        if (this.matchesPattern(description, ['utilitati', 'utilities'])) {
            suggestions.push({ accountCode: '626', accountName: 'Cheltuieli poștale și taxe de telecomunicații', confidence: 0.8 });
            this.logger.log(`🔧 FALLBACK MATCH: Utilities → 626`);
        }
    
        if (this.matchesPattern(description, ['consultanta', 'consulting'])) {
            if (transaction.transactionType === 'CREDIT') {
                suggestions.push({ accountCode: '704', accountName: 'Venituri din prestări servicii', confidence: 0.85 });
                this.logger.log(`🔧 FALLBACK MATCH: Consulting Income → 704`);
            } else {
                suggestions.push({ accountCode: '628', accountName: 'Alte cheltuieli cu serviciile executate de terți', confidence: 0.7 });
                this.logger.log(`🔧 FALLBACK MATCH: Consulting Expense → 628`);
            }
        }
    
        if (suggestions.length === 0) {
            if (transaction.transactionType === 'DEBIT') {
                suggestions.push({ accountCode: '628', accountName: 'Alte cheltuieli cu serviciile executate de terți', confidence: 0.3 });
                this.logger.log(`🔧 FALLBACK DEFAULT: Expense → 628`);
            } else {
                suggestions.push({ accountCode: '758', accountName: 'Alte venituri din exploatare', confidence: 0.3 });
                this.logger.log(`🔧 FALLBACK DEFAULT: Income → 758`);
            }
        }
    
        this.logger.log(`🔧 FALLBACK RESULT: ${JSON.stringify(suggestions[0])}`);
        return suggestions.sort((a, b) => b.confidence - a.confidence);
    }

      async handleRoundingDifferences(
        expectedAmount: number, 
        actualAmount: number,
        currency: string = 'RON'
      ): Promise<{ accountCode: string; accountName: string; roundingAmount: number } | null> {
        const difference = Math.abs(expectedAmount - actualAmount);

        const maxRounding = currency === 'RON' ? 1.0 : 0.05; 

        if (difference > maxRounding) {
          return null; 
        }
    
        if (difference < 0.01) {
          return null; 
        }
    
        const isGain = actualAmount > expectedAmount;

        if (isGain) {
          return {
            accountCode: '754',
            accountName: 'Câștiguri din rotunjirea sumelor',
            roundingAmount: difference
          };
        } else {
          return {
            accountCode: '654',
            accountName: 'Pierderi din rotunjirea sumelor',
            roundingAmount: -difference
          };
        }
      }

      async categorizeStandaloneTransactionWithAgent(
        bankTransactionId: string,
        accountingClientId: number
      ): Promise<void> {
        try {
            const transaction = await this.prisma.bankTransaction.findUnique({
                where: { id: bankTransactionId }
            });
    
            if (!transaction || transaction.chartOfAccountId) {
                return;
            }

            // Check if there are already document-based suggestions for this transaction
            const existingDocumentSuggestions = await this.prisma.reconciliationSuggestion.findMany({
                where: {
                    bankTransactionId,
                    documentId: { not: null },
                    status: SuggestionStatus.PENDING
                }
            });

            if (existingDocumentSuggestions.length > 0) {
                this.logger.log(`🤖 SKIPPING AI attribution for ${bankTransactionId} - document suggestions already exist`);
                return;
            }
    
            this.logger.log(`🤖 AI ATTRIBUTION DEBUG: Processing transaction ${bankTransactionId}`);
            this.logger.log(`🤖 Description: "${transaction.description}"`);
            this.logger.log(`🤖 Amount: ${transaction.amount}, Type: ${transaction.transactionType}`);
    
            const suggestions = await this.suggestAccountForTransaction({
                description: transaction.description,
                amount: Number(transaction.amount),
                transactionType: transaction.transactionType,
                referenceNumber: transaction.referenceNumber || undefined,
                transactionDate: transaction.transactionDate.toISOString()
            }, accountingClientId);
    
            this.logger.log(`🤖 AI SUGGESTIONS: ${JSON.stringify(suggestions)}`);
    
            if (suggestions.length > 0) {
                const bestSuggestion = suggestions[0];
                
                this.logger.log(`🤖 BEST SUGGESTION: ${bestSuggestion.accountCode} - ${bestSuggestion.accountName} (${bestSuggestion.confidence})`);
                
                const chartOfAccount = await this.getOrCreateChartOfAccount(
                    bestSuggestion.accountCode,
                    bestSuggestion.accountName
                );
    
                const notes = bestSuggestion.confidence > 0.7 
                    ? `AI-categorized: ${bestSuggestion.accountName} (${Math.round(bestSuggestion.confidence * 100)}%)`
                    : `AI-suggested: ${bestSuggestion.accountName} (${Math.round(bestSuggestion.confidence * 100)}%) - review needed`;
    
                // Instead of permanently writing the account on the transaction, create a reconciliation suggestion
                await this.prisma.reconciliationSuggestion.create({
                  data: {
                    bankTransactionId: bankTransactionId,
                    chartOfAccountId: chartOfAccount.id,
                    documentId: null,
                    confidenceScore: bestSuggestion.confidence.toFixed(3) as unknown as any,
                    matchingCriteria: {},
                    reasons: [notes],
                  },
                });
    
                this.logger.log(`🤖 Created standalone suggestion for transaction ${bankTransactionId}: ${bestSuggestion.accountCode} - ${bestSuggestion.accountName}`);
            }
    
        } catch (error) {
            this.logger.error(`❌ AI categorization failed for ${bankTransactionId}:`, error);
            this.logger.log(`🔄 Falling back to rule-based categorization`);
            await this.categorizeStandaloneTransaction(bankTransactionId, false);
        }
    }
    

      async categorizeStandaloneTransaction(
        bankTransactionId: string,
        force: boolean = false
      ): Promise<void> {
        try {
          const transaction = await this.prisma.bankTransaction.findUnique({
            where: { id: bankTransactionId },
            include: {
              bankStatementDocument: {
                include: {
                  accountingClient: true
                }
              }
            }
          });
      
          if (!transaction) {
            throw new Error(`Transaction ${bankTransactionId} not found`);
          }
      
          if (transaction.chartOfAccountId && !force) {
            this.logger.debug(`Transaction ${bankTransactionId} already has account assigned`);
            return;
          }
      
          const suggestions = await this.suggestAccountForTransaction({
            description: transaction.description,
            amount: Number(transaction.amount),
            transactionType: transaction.transactionType,
            referenceNumber: transaction.referenceNumber || undefined,
            transactionDate: transaction.transactionDate.toISOString()
          }, transaction.bankStatementDocument.accountingClientId);
      
          if (suggestions.length === 0) {
            this.logger.warn(`No account suggestions found for transaction ${bankTransactionId}`);
            return;
          }
      
          const bestSuggestion = suggestions[0];
      
          const chartOfAccount = await this.getOrCreateChartOfAccount(
            bestSuggestion.accountCode,
            bestSuggestion.accountName
          );
      
          if (bestSuggestion.confidence > 0.7) {
            await this.prisma.bankTransaction.update({
              where: { id: bankTransactionId },
              data: {
                chartOfAccountId: chartOfAccount.id,
                isStandalone: true,
                accountingNotes: `AI-categorized: ${bestSuggestion.accountName} (confidence: ${Math.round(bestSuggestion.confidence * 100)}%)`
              }
            });
        
            this.logger.log(`Transaction ${bankTransactionId} AI-categorized as ${bestSuggestion.accountCode} - ${bestSuggestion.accountName}`);
          } else {
            await this.prisma.bankTransaction.update({
              where: { id: bankTransactionId },
              data: {
                isStandalone: true,
                accountingNotes: `Requires manual categorization - AI suggested: ${bestSuggestion.accountName} (low confidence: ${Math.round(bestSuggestion.confidence * 100)}%)`
              }
            });
        
            this.logger.log(`Transaction ${bankTransactionId} marked for manual categorization (low AI confidence)`);
          }
      
        } catch (error) {
          this.logger.error(`Error categorizing standalone transaction ${bankTransactionId}:`, error);
          throw error;
        }
      }

      private generateProcessingHints(transaction: any): string[] {
        const hints: string[] = [];
        const desc = transaction.description.toLowerCase();
      
        if (transaction.amount > 10000) {
          hints.push('Large amount - consider special classification');
        }
      
        if (desc.includes('salary') || desc.includes('salariu')) {
          hints.push('Personnel expense');
        }
      
        if (desc.includes('rent') || desc.includes('chirie')) {
          hints.push('Rent/lease expense');
        }
      
        return hints;
      }

      private enhanceConfidenceScore(baseConfidence: number, transaction: any, accountCode: string): number {
        let adjusted = baseConfidence;
        const desc = transaction.description.toLowerCase();
      
        const patterns = {
          '627': ['comision', 'taxa bancara', 'fee'],
          '666': ['dobanda', 'interest'],
          '613': ['asigurare', 'insurance'],
          '5311': ['cash', 'numerar', 'atm']
        };
      
        if (patterns[accountCode]?.some(pattern => desc.includes(pattern))) {
          adjusted = Math.min(adjusted + 0.2, 1.0);
        }
      
        if (transaction.description.split(' ').length > 10) {
          adjusted = Math.max(adjusted - 0.1, 0.1);
        }
      
        return Math.round(adjusted * 100) / 100;
      }

      private async getOrCreateChartOfAccount(accountCode: string, accountName: string): Promise<{ id: number }> {
        let chartOfAccount = await this.prisma.chartOfAccounts.findUnique({
          where: { accountCode }
        });
    
        if (!chartOfAccount) {
          const accountType = this.determineAccountType(accountCode);
        
          chartOfAccount = await this.prisma.chartOfAccounts.create({
            data: {
              accountCode,
              accountName,
              accountType,
              isActive: true
            }
          });
      
          this.logger.log(`Created new chart of accounts entry: ${accountCode} - ${accountName}`);
        }
    
        return chartOfAccount;
      }

      private determineAccountType(accountCode: string): 'ASSETS' | 'LIABILITIES' | 'INCOME' | 'EXPENSE' | 'EQUITY' {
        const firstDigit = accountCode.charAt(0);

        switch (firstDigit) {
          case '1':
          case '2':
          case '3':
          case '5':
            return 'ASSETS';
          case '4':
            return 'LIABILITIES';
          case '6':
            return 'EXPENSE';
          case '7':
            return 'INCOME';
          case '8':
          case '9':
            return 'EQUITY';
          default:
            return 'EXPENSE';
        }
      }

      private matchesPattern(description: string, keywords: string[]): boolean {
        return keywords.some(keyword => description.includes(keyword));
      }

      async extractBankTransactionsWithAccounts(
        bankStatementDocumentId: number, 
        extractedData: any
    ): Promise<BankTransactionData[]> {
        
        this.logger.log(`🔍 Starting extractBankTransactionsWithAccounts for document ${bankStatementDocumentId}`);
        
        try {
            const document = await this.prisma.document.findUnique({
                where: { id: bankStatementDocumentId },
                include: { accountingClient: true }
            });
            
            if (!document) {
                throw new Error(`Document ${bankStatementDocumentId} not found`);
            }
            
            this.logger.log(`✅ Document verified: ID=${document.id}, Type=${document.type}`);
            
            const transactions = extractedData.result?.transactions || extractedData.transactions || [];
            
            if (!Array.isArray(transactions) || transactions.length === 0) {
                this.logger.warn(`No transactions found in bank statement ${bankStatementDocumentId}`);
                return [];
            }
    
            this.logger.log(`🔍 Found ${transactions.length} transactions to process`);
    
            await this.prisma.bankTransaction.deleteMany({
                where: { bankStatementDocumentId }
            });
    
            const bankTransactions: BankTransactionData[] = [];
    
            for (const [index, tx] of transactions.entries()) {
                try {
                    const transactionId = `${bankStatementDocumentId}-${index}-${Date.now()}`;
                    
                    const debitAmount = this.parseAmount(tx.debit_amount);
                    const creditAmount = this.parseAmount(tx.credit_amount);
                    
                    let amount: number;
                    let transactionType: 'DEBIT' | 'CREDIT';
                    
                    if (creditAmount > 0) {
                        amount = creditAmount;
                        transactionType = 'CREDIT';
                    } else if (debitAmount > 0) {
                        amount = debitAmount;
                        transactionType = 'DEBIT';
                    } else {
                        this.logger.warn(`⚠️ Invalid transaction amounts in ${bankStatementDocumentId}, index ${index}`);
                        continue;
                    }
    
                    const transactionDate = this.parseTransactionDate(tx.transaction_date || tx.date);
                    if (!transactionDate) {
                        this.logger.warn(`⚠️ Invalid transaction date in ${bankStatementDocumentId}, index ${index}`);
                        continue;
                    }
    
                    const bankTransactionData = {
                        id: transactionId,
                        transactionDate,
                        description: tx.description || '',
                        amount,
                        transactionType,
                        referenceNumber: tx.reference_number || tx.reference || null,
                        balanceAfter: this.parseAmount(tx.balance_after_transaction) || null
                    };
    
                    this.logger.log(`🔍 Creating transaction ${index}: ${tx.description} (${amount} ${transactionType})`);
    
                    await this.prisma.bankTransaction.create({
                        data: {
                            ...bankTransactionData,
                            bankStatementDocumentId,
                            reconciliationStatus: 'UNRECONCILED',
                            isStandalone: false
                        }
                    });
    
                    bankTransactions.push(bankTransactionData);
                    this.logger.log(`✅ Created transaction ${index} successfully`);
                    
                } catch (error) {
                    this.logger.error(`❌ Error creating transaction ${index}:`, error);
                    continue; 
                }
            }
    
            this.logger.log(`✅ Successfully created ${bankTransactions.length}/${transactions.length} transactions`);
            
            // Generate document-based reconciliation suggestions first
            try {
                await this.generateReconciliationSuggestions(document.accountingClientId);
                this.logger.log(`✅ Generated reconciliation suggestions for client ${document.accountingClientId}`);
            } catch (error) {
                this.logger.error(`❌ Failed to generate reconciliation suggestions:`, error);
            }
            
            setTimeout(async () => {
                for (const transaction of bankTransactions) {
                    try {
                        await this.categorizeStandaloneTransactionWithAgent(
                            transaction.id, 
                            document.accountingClientId
                        );
                    } catch (error) {
                        this.logger.error(`Failed to categorize transaction ${transaction.id}:`, error);
                    }
                }
            }, 1000);
            
            return bankTransactions;
            
        } catch (error) {
            this.logger.error(`❌ Failed to extract bank transactions for document ${bankStatementDocumentId}:`, error);
            throw error;
        }
        
    }

    private extractJsonFromOutput(output: string): string {
        console.log('🔍 RAW Python output (first 2000 chars):', output.substring(0, 2000));
        
        if (!output) {
            throw new Error('No output received from Python script');
        }
    
        const lines = output.split('\n');
        const jsonCandidates: { line: string, data: any, size: number }[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('{')) {
                try {
                    const parsed = JSON.parse(line);
                    const dataSize = JSON.stringify(parsed).length;
                    jsonCandidates.push({ line, data: parsed, size: dataSize });
                    console.log(`🔍 Found JSON at line ${i}, size: ${dataSize}, has vendor: ${!!parsed.data?.vendor}`);
                } catch (e) {
                }
            }
        }
        
        if (jsonCandidates.length === 0) {
            throw new Error('No valid JSON found in output');
        }
        
        jsonCandidates.sort((a, b) => b.size - a.size);
        
        const chosenJson = jsonCandidates[0];
        console.log(`🔍 Chose largest JSON (size: ${chosenJson.size})`);
        
        return chosenJson.line;
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

    async generateReconciliationSuggestions(accountingClientId: number): Promise<void> {
        try {
          const unreconciled = await this.prisma.document.findMany({
            where: {
              accountingClientId,
              reconciliationStatus: ReconciliationStatus.UNRECONCILED,
              type: { in: ['Invoice', 'Receipt', 'Payment Order', 'Collection Order', 'Z Report'] }
            },
            include: { processedData: true }
          });
          
          this.logger.warn(`📊 RECONCILIATION DEBUG: Found ${unreconciled.length} unreconciled documents`);
          const docsByType = unreconciled.reduce((acc, doc) => {
            acc[doc.type] = (acc[doc.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          this.logger.warn(`📊 Document breakdown: ${JSON.stringify(docsByType)}`);
          
          // Log Payment Orders and Z Reports specifically
          const paymentOrders = unreconciled.filter(d => d.type === 'Payment Order');
          const zReports = unreconciled.filter(d => d.type === 'Z Report');
          
          if (paymentOrders.length > 0) {
            this.logger.warn(`💰 Payment Orders found: ${paymentOrders.map(p => `${p.id}(${p.name})`).join(', ')}`);
          }
          
          if (zReports.length > 0) {
            this.logger.warn(`🏦 Z Reports found: ${zReports.map(z => `${z.id}(${z.name})`).join(', ')}`);
          }
      
          const unreconciliedTransactions = await this.prisma.bankTransaction.findMany({
            where: {
              bankStatementDocument: { accountingClientId },
              reconciliationStatus: ReconciliationStatus.UNRECONCILED
            }
          });
      
          if (unreconciliedTransactions.length === 0) {
            return;
          }
      
          await this.prisma.reconciliationSuggestion.deleteMany({
            where: {
              status: SuggestionStatus.PENDING,
              OR: [
                {
                  document: { accountingClientId },
                },
                {
                  documentId: null,
                  bankTransaction: {
                    bankStatementDocument: { accountingClientId },
                  },
                },
              ],
            }
          });
      
          const suggestions = [];
      
          for (const document of unreconciled) {
            let documentData: any = {};
            
            if (document.processedData?.extractedFields) {
              try {
                const parsedFields = typeof document.processedData.extractedFields === 'string'
                  ? JSON.parse(document.processedData.extractedFields)
                  : document.processedData.extractedFields;
                
                documentData = parsedFields.result || parsedFields || {};
              } catch (e) {
                continue; 
              }
            }
      
            const documentAmount = this.parseAmountForReconciliation(
              documentData.total_amount,
              documentData,
              document.type
            );
            const documentNumber = documentData.document_number || documentData.receipt_number;
            const documentDate = this.parseDate(documentData.document_date);
            
            // Enhanced debug logging for Payment/Collection Orders and Z Reports
            if (document.type === 'Payment Order' || document.type === 'Collection Order' || document.type === 'Z Report') {
              try {
                const dateStr = documentDate ? documentDate.toISOString().split('T')[0] : 'null';
                const keysStr = documentData && typeof documentData === 'object' ? Object.keys(documentData).join(', ') : 'none';
                this.logger.warn(
                  `🔍 ${document.type.toUpperCase()} DEBUG: Document ${document.id} (${document.name}) ` +
                  `Type: ${document.type}, Amount: ${documentAmount}, Number: ${documentNumber || 'null'}, ` +
                  `Date: ${dateStr}, Direction: ${documentData?.direction || 'null'}, ` +
                  `Raw data keys: ${keysStr}`
                );
              } catch (debugError) {
                this.logger.error(`Debug logging error for document ${document.id}:`, debugError);
              }
            }
  
            if (documentAmount === 0) {
              if (document.type === 'Payment Order' || document.type === 'Collection Order' || document.type === 'Z Report') {
                this.logger.error(`❌ ${document.type.toUpperCase()} ${document.id} (${document.name}) has ZERO amount - skipping!`);
                try {
                  this.logger.error(`❌ Raw data for ${document.name}: ${JSON.stringify(documentData, null, 2)}`);
                } catch (jsonError) {
                  this.logger.error(`❌ Raw data logging failed for ${document.name}:`, jsonError);
                }
              }
              continue;
            }
      
            let bestMatchForDocument = { score: 0, transaction: null, suggestion: null };
            
            for (const transaction of unreconciliedTransactions) {
              const suggestion = this.calculateMatchSuggestion(
                document,
                transaction,
                documentData,
                documentAmount,
                documentNumber,
                documentDate
              );
              
              // Track the best match for this document for debugging
              if (suggestion.confidenceScore > bestMatchForDocument.score) {
                bestMatchForDocument = { score: suggestion.confidenceScore, transaction, suggestion };
              }
      
              if (suggestion.confidenceScore >= 0.25) { 
                suggestions.push({
                  documentId: document.id,
                  bankTransactionId: transaction.id,
                  confidenceScore: suggestion.confidenceScore,
                  matchingCriteria: suggestion.matchingCriteria,
                  reasons: suggestion.reasons
                });
              }
            }
            
            // Debug: Log documents that don't have any matches above threshold
            if (bestMatchForDocument.score < 0.25) {
              this.logger.warn(
                `📄 Document ${document.id} (${document.name}) has no matches above 0.25 threshold. ` +
                `Best match: ${bestMatchForDocument.score.toFixed(3)} with transaction ${bestMatchForDocument.transaction?.id} ` +
                `(Amount: ${documentAmount} vs ${bestMatchForDocument.transaction?.amount}, ` +
                `Date: ${documentDate?.toISOString().split('T')[0]} vs ${bestMatchForDocument.transaction?.transactionDate.toISOString().split('T')[0]})`
              );
              
              // Fallback: If we have a very close amount match (within 10 RON or 10%), create a low-confidence suggestion
              if (bestMatchForDocument.transaction) {
                const amountDiff = Math.abs(documentAmount - Math.abs(Number(bestMatchForDocument.transaction.amount)));
                const amountThreshold = Math.max(documentAmount * 0.1, 10); // 10% or 10 RON tolerance
                
                if (amountDiff <= amountThreshold) {
                  this.logger.log(
                    `💡 Creating fallback suggestion for document ${document.id} with close amount match (diff: ${amountDiff.toFixed(2)} RON)`
                  );
                  
                  suggestions.push({
                    documentId: document.id,
                    bankTransactionId: bestMatchForDocument.transaction.id,
                    confidenceScore: Math.max(bestMatchForDocument.score, 0.2), // Ensure minimum confidence
                    matchingCriteria: { ...bestMatchForDocument.suggestion.matchingCriteria, fallback_match: true },
                    reasons: [...bestMatchForDocument.suggestion.reasons, 'Fallback match based on amount proximity']
                  });
                }
              }
            }
          }
      
          // Debug: Log raw suggestions before filtering
          this.logger.log(
            `🔍 RAW SUGGESTIONS (${suggestions.length}): ` +
            suggestions
              .map(s => `${s.bankTransactionId}→${s.documentId || 'account'} ${(s.confidenceScore * 100).toFixed(0)}%`)
              .join(' | ')
          );
          
          const filteredSuggestions = this.filterBestSuggestions(suggestions);
      
          // Process standalone transactions (those that don't match any documents)
          const matchedTransactionIds = new Set(filteredSuggestions.map(s => s.bankTransactionId));
          const standaloneTransactions = unreconciliedTransactions.filter(t => !matchedTransactionIds.has(t.id));
          
          this.logger.log(`Processing ${standaloneTransactions.length} standalone transactions for account categorization`);
          
          for (const transaction of standaloneTransactions) {
            try {
              const suggestions = await this.suggestAccountForTransaction({
                description: transaction.description,
                amount: Number(transaction.amount),
                transactionType: transaction.transactionType,
                referenceNumber: transaction.referenceNumber || undefined,
                transactionDate: transaction.transactionDate.toISOString()
              }, accountingClientId);
              
              if (suggestions.length > 0) {
                const bestSuggestion = suggestions[0];
                const chartOfAccount = await this.getOrCreateChartOfAccount(
                  bestSuggestion.accountCode,
                  bestSuggestion.accountName
                );
                
                const notes = bestSuggestion.confidence > 0.7 
                  ? `AI-categorized: ${bestSuggestion.accountName} (${Math.round(bestSuggestion.confidence * 100)}%)`
                  : `AI-suggested: ${bestSuggestion.accountName} (${Math.round(bestSuggestion.confidence * 100)}%) - review needed`;
                
                // Create suggestion for standalone transaction
                await this.prisma.reconciliationSuggestion.create({
                  data: {
                    bankTransactionId: transaction.id,
                    chartOfAccountId: chartOfAccount.id,
                    documentId: null,
                    confidenceScore: bestSuggestion.confidence.toFixed(3) as unknown as any,
                    matchingCriteria: {},
                    reasons: [notes],
                  },
                });
                
                this.logger.log(`🤖 Created standalone suggestion for transaction ${transaction.id}: ${bestSuggestion.accountCode} - ${bestSuggestion.accountName}`);
              }
            } catch (error) {
              this.logger.error(`Failed to categorize standalone transaction ${transaction.id}:`, error);
            }
          }
      
          if (filteredSuggestions.length > 0) {
            await this.prisma.reconciliationSuggestion.createMany({
              data: filteredSuggestions,
              skipDuplicates: true
            });
      
            this.logger.log(`Generated ${filteredSuggestions.length} document-transaction match suggestions for client ${accountingClientId}`);
          }
          
          const totalSuggestions = filteredSuggestions.length + standaloneTransactions.length;
          this.logger.log(`Generated total of ${totalSuggestions} suggestions (${filteredSuggestions.length} matches + ${standaloneTransactions.length} standalone) for client ${accountingClientId}`);
      
        } catch (error) {
          this.logger.error(`Failed to generate reconciliation suggestions: ${error.message}`);
        }
      }
      
      private calculateMatchSuggestion(
        document: any,
        transaction: any,
        documentData: any,
        documentAmount: number,
        documentNumber: string,
        documentDate: Date | null
      ): { confidenceScore: number; matchingCriteria: any; reasons: string[] } {
        let score = 0;
        const criteria: any = {};
        const reasons: string[] = [];
      
        const transactionAmount = Math.abs(Number(transaction.amount));
        const transactionDate = new Date(transaction.transactionDate);
      
        const amountDiff = Math.abs(documentAmount - transactionAmount);
        const amountThreshold = Math.max(documentAmount * 0.05, 2); // Increased from 2% to 5% and min from 1 to 2 RON 
      
        if (amountDiff === 0) {
          score += 0.6;
          criteria.exact_amount_match = true;
          reasons.push('Exact amount match');
        } else if (amountDiff <= amountThreshold) {
          score += 0.3;
          criteria.close_amount_match = true;
          reasons.push(`Close amount match (diff: ${amountDiff.toFixed(2)} RON)`);
        }
      
        if (documentNumber && transaction.referenceNumber) {
          const docNumNormalized = this.normalizeReference(documentNumber);
          const txnRefNormalized = this.normalizeReference(transaction.referenceNumber);
          
          if (docNumNormalized === txnRefNormalized) {
            score += 0.3;
            criteria.reference_match = true;
            reasons.push('Reference number match');
          } else if (docNumNormalized.includes(txnRefNormalized) || txnRefNormalized.includes(docNumNormalized)) {
            score += 0.2;
            criteria.partial_reference_match = true;
            reasons.push('Partial reference match');
          }
        }
      
        if (documentNumber && transaction.description) {
          const description = transaction.description.toLowerCase();
          const docNum = documentNumber.toLowerCase();
          
          if (description.includes(docNum)) {
            score += 0.2;
            criteria.description_match = true;
            reasons.push('Document number found in description');
          }
        }
      
        if (documentDate) {
          const daysDiff = Math.abs((documentDate.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff === 0) {
            score += 0.2;
            criteria.same_date = true;
            reasons.push('Same date');
          } else if (daysDiff <= 3) {
            score += 0.07;
            criteria.close_date = true;
            reasons.push(`Close dates (${Math.round(daysDiff)} days apart)`);
          } else if (daysDiff <= 7) {
            score += 0.05;
            criteria.week_proximity = true;
            reasons.push(`Within a week (${Math.round(daysDiff)} days apart)`);
          }
        }
      
        const isIncoming = documentData.direction === 'incoming' || document.type === 'Receipt' || document.type === 'Z Report';
        const isOutgoing = documentData.direction === 'outgoing' || document.type === 'Payment Order' || document.type === 'Collection Order';
        const isCredit = transaction.transactionType === 'CREDIT';
        const isDebit = transaction.transactionType === 'DEBIT';
      
        if ((isIncoming && isCredit) || (isOutgoing && isDebit)) {
          score += 0.05;
          criteria.logical_transaction_type = true;
          reasons.push('Transaction type matches document direction');
        }
        
        // Bonus for Payment Orders matching debit transactions (they should be prioritized)
        if (document.type === 'Payment Order' && isDebit) {
          score += 0.1;
          criteria.payment_order_priority = true;
          reasons.push('Payment Order matches debit transaction');
        }
      
        // Debug logging for Payment/Collection Orders
        if (document.type === 'Payment Order' || document.type === 'Collection Order') {
          this.logger.warn(
            `🎯 MATCH DEBUG: ${document.type} ${document.id} vs Transaction ${transaction.id} ` +
            `Score: ${Math.min(score, 1.0).toFixed(3)} | Amount: ${documentAmount} vs ${transactionAmount} (diff: ${amountDiff.toFixed(2)}) ` +
            `| Date: ${documentDate?.toISOString().split('T')[0]} vs ${transactionDate.toISOString().split('T')[0]} ` +
            `| DocNum: "${documentNumber}" vs TxnRef: "${transaction.referenceNumber}" ` +
            `| Direction: ${documentData.direction} vs ${transaction.transactionType} ` +
            `| Reasons: [${reasons.join(', ')}]`
          );
        }
      
        return {
          confidenceScore: Math.min(score, 1.0), 
          matchingCriteria: criteria,
          reasons
        };
      }
      
      private filterBestSuggestions(suggestions: any[]): any[] {
        suggestions.sort((a, b) => {
          const aHasDoc = a.documentId !== null && a.documentId !== undefined;
          const bHasDoc = b.documentId !== null && b.documentId !== undefined;

          if (aHasDoc !== bHasDoc) {
            return aHasDoc ? -1 : 1;
          }
          
          // If confidence scores are very close (within 0.05), prioritize by document type
          const scoreDiff = b.confidenceScore - a.confidenceScore;
          if (Math.abs(scoreDiff) <= 0.05) {
            // Get document types for comparison
            const aHasPaymentOrder = a.matchingCriteria?.payment_order_priority;
            const bHasPaymentOrder = b.matchingCriteria?.payment_order_priority;
            
            if (aHasPaymentOrder && !bHasPaymentOrder) return -1;
            if (!aHasPaymentOrder && bHasPaymentOrder) return 1;
          }

          return scoreDiff;
        });
      
        const filteredSuggestions: any[] = [];
        const usedDocuments = new Set<number>();
        const seenTx = new Set<string>();
        
        for (const suggestion of suggestions) {
          if (suggestion.confidenceScore >= 0.25 && !seenTx.has(suggestion.bankTransactionId)) {
            // If this is a document suggestion, check if document is already used
            if (suggestion.documentId && usedDocuments.has(suggestion.documentId)) {
              continue; // Skip this suggestion, document already matched
            }
            
            filteredSuggestions.push(suggestion);
            seenTx.add(suggestion.bankTransactionId);
            
            // Mark document as used if this is a document suggestion
            if (suggestion.documentId) {
              usedDocuments.add(suggestion.documentId);
            }
          }
        }
      
        return filteredSuggestions;
      }
      
      private normalizeReference(ref: string): string {
        return ref.replace(/[^a-z0-9]/gi, '').toLowerCase();
      }
      
      private parseAmountForReconciliation(amount: any, docData?: any, docType?: string): number {
        // 1. Try the primary amount field first
        let parsed = Math.abs(this.parseAmount(amount));
        if (parsed !== 0) return parsed;

        // 2. Fallback for Payment/Collection Orders & Z-Reports when total_amount is missing/zero
        if (docData) {
          const candidateKeys = [
            'amount', 'value', 'payment_amount', 'transaction_amount',
            'grand_total', 'total_z', 'sum', 'net_amount', 'final_amount'
          ];
          
          for (const key of candidateKeys) {
            if (docData[key]) {
              parsed = Math.abs(this.parseAmount(docData[key]));
              if (parsed !== 0) {
                this.logger.debug(`📊 Found amount ${parsed} in field '${key}' for ${docType} document`);
                return parsed;
              }
            }
          }
        }
        
        return 0; // Keep existing behavior if we still can't find a valid amount
      }
      
      private parseDate(dateStr: any): Date | null {
        if (!dateStr) return null;
        
        try {
          if (typeof dateStr === 'string' && dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) {
            const [day, month, year] = dateStr.split('-');
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          }
          
          return new Date(dateStr);
        } catch {
          return null;
        }
      }
}
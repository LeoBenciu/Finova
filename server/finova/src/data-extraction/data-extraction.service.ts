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

          const notes = bestSuggestion.confidence > 0.7 
          ? `AI-categorized: ${bestSuggestion.accountName} (${Math.round(bestSuggestion.confidence * 100)}%)`
          : `AI-suggested: ${bestSuggestion.accountName} (${Math.round(bestSuggestion.confidence * 100)}%) - review needed`;
        // Create reconciliation suggestion instead of directly updating the transaction
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

    private generationInProgress = new Set<number>();

    async generateReconciliationSuggestions(accountingClientId: number): Promise<void> {
      // Prevent multiple simultaneous generations for the same client
      if (this.generationInProgress.has(accountingClientId)) {
          this.logger.log(`⏳ Generation already in progress for client ${accountingClientId}, skipping`);
          return;
      }
      
      this.generationInProgress.add(accountingClientId);
      this.logger.log(`🚀 STARTING generateReconciliationSuggestions for client ${accountingClientId}`);
      
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
          },
          include: {
            bankStatementDocument: true,
            bankAccount: true
          }
        });
    
        this.logger.log(`💳 Found ${unreconciliedTransactions.length} unreconciled transactions`);
        if (unreconciliedTransactions.length === 0) {
          this.logger.log(`❌ No unreconciled transactions found, exiting`);
          return;
        }
        
        // Log transaction breakdown
        const txByType = unreconciliedTransactions.reduce((acc, tx) => {
          acc[tx.transactionType] = (acc[tx.transactionType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        this.logger.log(`💳 Transaction breakdown: ${JSON.stringify(txByType)}`);
        
        // Log specific transactions we're tracking
        const targetTxs = unreconciliedTransactions.filter(tx => 
          tx.id === '110-0-1756203049797' || tx.id === '111-0-1756209938791'
        );
        if (targetTxs.length > 0) {
          this.logger.log(`🎯 TARGET TRANSACTIONS FOUND: ${targetTxs.map(tx => `${tx.id}(${tx.description})`).join(', ')}`);
        } else {
          this.logger.warn(`❌ TARGET TRANSACTIONS NOT FOUND in unreconciled transactions!`);
        }
        
        const bankStatementReferencedDocs = new Set<number>();
        for (const transaction of unreconciliedTransactions) {
          if (transaction.bankStatementDocument?.references) {
            transaction.bankStatementDocument.references.forEach((refId: number) => {
              bankStatementReferencedDocs.add(refId);
            });
          }
        }
        
        this.logger.warn(`🏦 MANDATORY RULE: Bank statements reference ${bankStatementReferencedDocs.size} documents: [${Array.from(bankStatementReferencedDocs).join(', ')}]`);
        
        const mandatoryDocs = await this.prisma.document.findMany({
          where: {
            id: { in: Array.from(bankStatementReferencedDocs) },
            reconciliationStatus: ReconciliationStatus.UNRECONCILED
          },
          include: { processedData: true }
        });
        
        this.logger.warn(`🎯 MANDATORY DOCS: Found ${mandatoryDocs.length} mandatory documents to suggest`);
        
        const existingDocIds = new Set(unreconciled.map(d => d.id));
        for (const mandatoryDoc of mandatoryDocs) {
          if (!existingDocIds.has(mandatoryDoc.id)) {
            unreconciled.push(mandatoryDoc);
            this.logger.warn(`➕ Added mandatory doc: ${mandatoryDoc.name} (${mandatoryDoc.id})`);
          }
        }
    
        // Get previously rejected suggestions to avoid regenerating them
        const rejectedSuggestions = await this.prisma.reconciliationSuggestion.findMany({
          where: {
            status: SuggestionStatus.REJECTED,
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
          },
          select: {
            documentId: true,
            bankTransactionId: true,
            chartOfAccountId: true
          }
        });
        
        this.logger.warn(`🚫 Found ${rejectedSuggestions.length} previously rejected suggestions to avoid regenerating`);
        
        // Create sets of rejected combinations to avoid regenerating
        const rejectedDocTransactionPairs = new Set<string>();
        const rejectedTransactionAccountPairs = new Set<string>();
        
        rejectedSuggestions.forEach(rejected => {
          if (rejected.documentId && rejected.bankTransactionId) {
            rejectedDocTransactionPairs.add(`${rejected.documentId}-${rejected.bankTransactionId}`);
          } else if (rejected.bankTransactionId && rejected.chartOfAccountId) {
            rejectedTransactionAccountPairs.add(`${rejected.bankTransactionId}-${rejected.chartOfAccountId}`);
          }
        });
        
        this.logger.warn(`🚫 Avoiding ${rejectedDocTransactionPairs.size} doc-transaction pairs and ${rejectedTransactionAccountPairs.size} transaction-account pairs`);

        // Check for existing transfer suggestions to avoid duplicates
        const existingTransferSuggestions = await this.prisma.reconciliationSuggestion.findMany({
          where: {
            status: { not: SuggestionStatus.REJECTED },
            bankTransaction: {
              bankStatementDocument: { accountingClientId }
            },
            matchingCriteria: {
              path: ['type'],
              equals: 'TRANSFER'
            }
          },
          select: {
            bankTransactionId: true,
            matchingCriteria: true
          }
        });
        
        const existingTransferPairs = new Set<string>();
        for (const existing of existingTransferSuggestions) {
          const criteria = existing.matchingCriteria as any;
          if (criteria?.transfer?.destinationTransactionId) {
            // Create bidirectional keys to prevent duplicates in either direction
            const key1 = `${existing.bankTransactionId}-${criteria.transfer.destinationTransactionId}`;
            const key2 = `${criteria.transfer.destinationTransactionId}-${existing.bankTransactionId}`;
            existingTransferPairs.add(key1);
            existingTransferPairs.add(key2);
          }
        }
        
        this.logger.log(`🔍 Found ${existingTransferSuggestions.length} existing transfer suggestions, created ${existingTransferPairs.size} bidirectional pair keys`);

        // Only delete pending suggestions (keep rejected ones for reference)
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

        // AGGRESSIVE CLEANUP: Delete ALL existing transfer suggestions for this client to start fresh
        const deletedTransfers = await this.prisma.reconciliationSuggestion.deleteMany({
          where: {
            status: { not: SuggestionStatus.REJECTED },
            documentId: null,
            chartOfAccountId: null,
            bankTransaction: {
              bankStatementDocument: { accountingClientId }
            }
          }
        });
        
        this.logger.warn(`🧹 CLEANUP: Deleted ${deletedTransfers.count} existing transfer suggestions to start fresh`);
    
        const suggestions = [];

        // ------------------------------------------------------------------
        // Transfer suggestions: propose internal transfers between accounts
        // ------------------------------------------------------------------
        this.logger.log(`🔁 STARTING TRANSFER SUGGESTION GENERATION`);
        try {
          const dbg = true;
          const daysWindow = 5; // +/- days to consider as close dates
          const amountTolerancePct = 0.01; // 1%
          const minAmountTolerance = 1; // RON minimum tolerance

          const credits = unreconciliedTransactions.filter(t => t.transactionType === 'CREDIT');
          const debits = unreconciliedTransactions.filter(t => t.transactionType === 'DEBIT');
          
          this.logger.log(`🔁 Transfer candidates: ${credits.length} credits, ${debits.length} debits`);
          
          // Check if our target transactions are in the right categories
          const targetCredits = credits.filter(t => t.id === '110-0-1756203049797');
          const targetDebits = debits.filter(t => t.id === '111-0-1756209938791');
          this.logger.log(`🎯 Target transactions in categories: credits=${targetCredits.length}, debits=${targetDebits.length}`);

          // Keep track of already paired destination credits to avoid duplicate suggestions
          const usedDestinationIds = new Set<string>();
          const createdTransferKeys = new Set<string>();

          const transferSuggestions: Array<{
            documentId: number | null;
            bankTransactionId: string;
            chartOfAccountId: number | null;
            confidenceScore: number;
            matchingCriteria: any;
            reasons: string[];
          }> = [];

          // Precompute keyword presence for descriptions
          const hasTransferKeyword = (desc?: string) => {
            if (!desc) return false;
            const d = desc.toLowerCase();
            return (
              d.includes('transfer') || d.includes('intrabank') || d.includes('interbank') ||
              d.includes('interne') || d.includes('transfer intern') || d.includes('transf')
            );
          };

          // Helpers for currency detection
          const inferCurrency = (desc?: string) => {
            if (!desc) return undefined as string | undefined;
            const d = desc.toUpperCase();
            if (d.includes(' EUR')) return 'EUR';
            if (d.includes(' RON')) return 'RON';
            if (d.includes('USD') || d.includes(' USD')) return 'USD';
            if (d.includes('LEI')) return 'RON';
            return undefined;
          };
          const getTxnCurrency = (t: any): string | undefined => {
            // Prefer bankAccount.currency if present
            const accCur = t?.bankAccount?.currency as string | undefined;
            if (accCur) return accCur.toUpperCase();
            // Try statement document name
            const stmtName = t?.bankStatementDocument?.name as string | undefined;
            const byName = stmtName ? inferCurrency(stmtName.replace(/[_.-]/g, ' ')) : undefined;
            if (byName) return byName;
            // Try description text
            const byDesc = inferCurrency(t?.description);
            return byDesc;
          };

          this.logger.log(`🔁 Starting transfer matching loop for ${debits.length} debits`);
          for (const src of debits) {
            const srcAmt = Math.abs(Number(src.amount));
            const srcDate = new Date(src.transactionDate);
            let bestCandidate: any = null;
            let bestScore = 0;
            const dbgSrc = dbg && src.id === '111-0-1756209938791';
            if (dbgSrc) {
              this.logger.warn(`🔍 TRANSFER DEBUG src=${src.id} amt=${srcAmt} date=${srcDate.toISOString().split('T')[0]} acct=${src.bankAccount?.id || 'null'}`);
            }
            
            // Log every debit being processed
            this.logger.log(`🔁 Processing debit ${src.id}: "${src.description}" (${srcAmt})`);

            console.log('🔍 Transfer detection - evaluating transactions:', {
              sourceId: src.id,
              sourceAmount: srcAmt,
              sourceType: src.transactionType,
              sourceDate: srcDate,
              sourceAccount: src.bankAccount?.id,
              destinationCandidates: credits.length
            });

            for (const dst of credits) {
              if (usedDestinationIds.has(dst.id)) {
                if (dbgSrc) this.logger.warn(`  [X] dst=${dst.id} skipped: already used`);
                continue;
              }
              if (src.bankAccount?.id && dst.bankAccount?.id && src.bankAccount.id === dst.bankAccount.id) {
                if (dbgSrc) this.logger.warn(`  [X] dst=${dst.id} skipped: same account ${src.bankAccount.id}`);
                // Skip moves within the same account
                continue;
              }

              // Check if this transfer pair already exists
              const transferKey1 = `${src.id}-${dst.id}`;
              const transferKey2 = `${dst.id}-${src.id}`;
              if (existingTransferPairs.has(transferKey1) || existingTransferPairs.has(transferKey2)) {
                if (dbgSrc) this.logger.warn(`  [X] dst=${dst.id} skipped: transfer pair already exists`);
                continue;
              }

              const dstAmt = Math.abs(Number(dst.amount));
              const amountDiff = Math.abs(srcAmt - dstAmt);
              const amountTolerance = Math.max(srcAmt * amountTolerancePct, minAmountTolerance);
              
              // Cross-currency handling: allow plausible FX rate differences (e.g., RON↔EUR around 4–6)
              const srcCur = getTxnCurrency(src);
              const dstCur = getTxnCurrency(dst);
              let crossCurrencyOk = false;
              let impliedRate: number | undefined;
              if (srcCur && dstCur && srcCur !== dstCur) {
                const bigger = Math.max(srcAmt, dstAmt);
                const smaller = Math.max(1e-6, Math.min(srcAmt, dstAmt));
                impliedRate = Number((bigger / smaller).toFixed(3));
                // Heuristic bands
                if ((srcCur === 'RON' && dstCur === 'EUR') || (srcCur === 'EUR' && dstCur === 'RON')) {
                  // Typical RON/EUR range; broaden slightly to avoid false negatives
                  crossCurrencyOk = impliedRate >= 4.0 && impliedRate <= 6.0;
                } else if ((srcCur === 'RON' && dstCur === 'USD') || (srcCur === 'USD' && dstCur === 'RON')) {
                  crossCurrencyOk = impliedRate >= 3.0 && impliedRate <= 6.0;
                } else {
                  // Generic band for other pairs
                  crossCurrencyOk = impliedRate >= 0.1 && impliedRate <= 20.0;
                }
                if (dbgSrc) this.logger.warn(`  [~] cross-currency ${srcCur}->${dstCur} impliedRate=${impliedRate} ok=${crossCurrencyOk}`);
              }
              if (amountDiff > amountTolerance) {
                if (!crossCurrencyOk) {
                  if (dbgSrc) this.logger.warn(`  [X] dst=${dst.id} skipped: amountDiff=${amountDiff.toFixed(2)} > tol=${amountTolerance.toFixed(2)} (src=${srcAmt}, dst=${dstAmt})`);
                  continue;
                }
              }

              const dstDate = new Date(dst.transactionDate);
              const daysApart = Math.abs((+srcDate - +dstDate) / (1000 * 60 * 60 * 24));
              if (daysApart > daysWindow) {
                if (dbgSrc) this.logger.warn(`  [X] dst=${dst.id} skipped: daysApart=${Math.round(daysApart)} > ${daysWindow}`);
                continue;
              }

              // Scoring
              let score = 0.7; // base for amount+date proximity
              const reasons: string[] = [];
              const criteria: any = { transfer: {} };

              if (amountDiff === 0 || crossCurrencyOk) {
                score += 0.1;
                if (crossCurrencyOk) {
                  reasons.push(`Cross-currency transfer (${srcCur || '?'}/${dstCur || '?'}, implied rate ${impliedRate})`);
                } else {
                  reasons.push('Exact amount match');
                }
              } else {
                reasons.push(`Close amount match (diff: ${amountDiff.toFixed(2)})`);
              }

              if (daysApart === 0) {
                score += 0.08;
                reasons.push('Same date');
              } else if (daysApart <= 2) {
                score += 0.05;
                reasons.push(`Close dates (${Math.round(daysApart)} days apart)`);
              }

              const kwSrc = hasTransferKeyword(src.description);
              const kwDst = hasTransferKeyword(dst.description);
              if (kwSrc || kwDst) {
                score += 0.05;
                reasons.push('Transfer keyword detected in description');
              }

              if (src.bankAccount?.bankName && dst.bankAccount?.bankName) {
                if (src.bankAccount.bankName === dst.bankAccount.bankName) {
                  score += 0.02;
                  reasons.push('Same bank');
                }
              }

              // Keep best candidate per source
              if (score > bestScore) {
                bestScore = score;
                bestCandidate = { dst, score, amountDiff, daysApart, reasons };
                if (dbgSrc) this.logger.warn(`  [✓] candidate dst=${dst.id} score=${score.toFixed(3)} amountDiff=${amountDiff.toFixed(2)} daysApart=${Math.round(daysApart)}`);
              }
            }

            if (bestCandidate && bestScore >= 0.5) {
              const { dst, score, amountDiff, daysApart, reasons } = bestCandidate;
              
              // Check if we already created this exact transfer suggestion in this batch
              const transferKey = `${src.id}-${dst.id}`;
              const reverseTransferKey = `${dst.id}-${src.id}`;
              if (createdTransferKeys.has(transferKey) || createdTransferKeys.has(reverseTransferKey)) {
                this.logger.log(`🔍 SKIPPING DUPLICATE TRANSFER IN BATCH: ${src.id} -> ${dst.id}`);
                continue;
              }
              
              usedDestinationIds.add(dst.id);
              createdTransferKeys.add(transferKey);
              existingTransferPairs.add(transferKey);
              existingTransferPairs.add(reverseTransferKey);

              this.logger.log(`✅ CREATING TRANSFER SUGGESTION: ${src.id} -> ${dst.id} (score: ${score.toFixed(3)})`);

              // Calculate impliedRate for cross-currency transfers
              const srcAmt = Math.abs(Number(src.amount));
              const dstAmt = Math.abs(Number(dst.amount));
              const srcCur = getTxnCurrency(src);
              const dstCur = getTxnCurrency(dst);
              let impliedRate: number | undefined;
              if (srcCur && dstCur && srcCur !== dstCur) {
                const bigger = Math.max(srcAmt, dstAmt);
                const smaller = Math.max(1e-6, Math.min(srcAmt, dstAmt));
                impliedRate = Number((bigger / smaller).toFixed(3));
              }

              const mc = {
                type: 'TRANSFER',
                transfer: {
                  destinationTransactionId: dst.id,
                  amountDiff: Number(amountDiff.toFixed(2)),
                  daysApart: Math.round(daysApart),
                  sourceTransaction: {
                    id: src.id,
                    description: src.description,
                    amount: src.amount,
                    transactionDate: src.transactionDate,
                    transactionType: src.transactionType,
                    bankAccountId: src.bankAccount?.id,
                    currency: getTxnCurrency(src),
                  },
                  destinationTransaction: {
                    id: dst.id,
                    description: dst.description,
                    amount: dst.amount,
                    transactionDate: dst.transactionDate,
                    transactionType: dst.transactionType,
                    bankAccountId: dst.bankAccount?.id,
                    currency: getTxnCurrency(dst),
                  },
                  impliedExchangeRate: impliedRate,
                },
              } as any;

              const transferSuggestion = {
                documentId: null,
                bankTransactionId: src.id, // source (outflow)
                chartOfAccountId: null,
                confidenceScore: Number(score.toFixed(3)) as unknown as any,
                matchingCriteria: mc,
                reasons,
              };
              
              transferSuggestions.push(transferSuggestion);
              this.logger.log(`✅ Added transfer suggestion to array: source=${src.id}, dest=${dst.id}`);

              if (dbg) {
                this.logger.log(
                  `🔁 Transfer candidate: ${src.id} -> ${dst.id} score=${score.toFixed(3)} amountDiff=${amountDiff.toFixed(2)} daysApart=${Math.round(daysApart)}`
                );
              }
            }
          }

          if (transferSuggestions.length > 0) {
            // Remove duplicates within the same batch (extra safety)
            const uniqueTransferSuggestions = [];
            const seen = new Set();
            let duplicatesSkipped = 0;
            
            for (const ts of transferSuggestions) {
              const key = `${ts.bankTransactionId}-${(ts.matchingCriteria as any)?.transfer?.destinationTransactionId}`;
              const reverseKey = `${(ts.matchingCriteria as any)?.transfer?.destinationTransactionId}-${ts.bankTransactionId}`;
              if (!seen.has(key) && !seen.has(reverseKey)) {
                seen.add(key);
                seen.add(reverseKey);
                uniqueTransferSuggestions.push(ts);
              } else {
                duplicatesSkipped++;
              }
            }
            
            this.logger.log(`🔁 Filtered ${transferSuggestions.length} transfer suggestions to ${uniqueTransferSuggestions.length} unique (${duplicatesSkipped} duplicates skipped)`);
            
            if (uniqueTransferSuggestions.length > 0) {
              const insertResult = await this.prisma.reconciliationSuggestion.createMany({
                data: uniqueTransferSuggestions,
                skipDuplicates: true,
              });
              this.logger.log(`💾 Database insert result: ${insertResult.count} suggestions inserted`);
            }
            this.logger.log(`🔁 Generated ${uniqueTransferSuggestions.length} internal transfer suggestions for client ${accountingClientId}`);
            
            // Add transfer suggestions to the main suggestions array for filtering
            suggestions.push(...uniqueTransferSuggestions);
          } else {
            this.logger.warn(`❌ NO TRANSFER SUGGESTIONS CREATED!`);
          }
        } catch (e) {
          this.logger.error(`Transfer suggestion generation failed: ${e.message}`);
        }
    
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
            // Check if this document is mandatory (referenced by the bank statement for this transaction)
            const isMandatory = bankStatementReferencedDocs.has(document.id) && 
                                transaction.bankStatementDocument?.references?.includes(document.id);
            
            const suggestion = this.calculateMatchSuggestion(
              document,
              transaction,
              documentData,
              documentAmount,
              documentNumber,
              documentDate,
              isMandatory
            );
            
            // Targeted per-pair debug logging
            try {
              if (this.shouldLogSuggestion(document.id as unknown as number, transaction.id as unknown as string)) {
                const txAmount = Math.abs(Number(transaction.amount));
                const txDate = new Date(transaction.transactionDate).toISOString().split('T')[0];
                const docDateStr = documentDate ? documentDate.toISOString().split('T')[0] : 'null';
                const prefix = this.suggestionLogPrefix(document.id as unknown as number, transaction.id as unknown as string);
                this.logger.warn(
                  `${prefix} Pair score ${suggestion.confidenceScore.toFixed(3)} | ` +
                  `doc(${document.id}:${document.name}) ${document.type} amt=${documentAmount} date=${docDateStr} num=${documentNumber || 'null'} | ` +
                  `tx(${transaction.id}) amt=${txAmount} type=${transaction.transactionType} date=${txDate} ref=${transaction.referenceNumber || 'null'} | ` +
                  `mandatory=${isMandatory} | criteria=${JSON.stringify(suggestion.matchingCriteria)} | reasons=${JSON.stringify(suggestion.reasons)}`
                );
              }
            } catch (e) {
              this.logger.error('Suggestion debug logging error:', e);
            }
            
            // Track the best match for this document for debugging
            if (suggestion.confidenceScore > bestMatchForDocument.score) {
              bestMatchForDocument = { score: suggestion.confidenceScore, transaction, suggestion };
            }
    
            if (suggestion.confidenceScore >= 0.25) {
              // Check if this document-transaction pair was previously rejected
              const pairKey = `${document.id}-${transaction.id}`;
              if (rejectedDocTransactionPairs.has(pairKey)) {
                this.logger.warn(`🚫 SKIPPING previously rejected suggestion: Document ${document.id} + Transaction ${transaction.id}`);
                continue;
              }
              
              const suggestionData = {
                documentId: document.id,
                bankTransactionId: transaction.id,
                confidenceScore: suggestion.confidenceScore,
                matchingCriteria: suggestion.matchingCriteria,
                reasons: suggestion.reasons
              };
              
              if (suggestion.matchingCriteria.component_match) {
                suggestionData.matchingCriteria.component_type = suggestion.matchingCriteria.component_type;
                suggestionData.matchingCriteria.is_partial_match = true;
                
                this.logger.warn(
                  `🧩 COMPONENT SUGGESTION: Document ${document.id} (${document.name}) ` +
                  `${suggestion.matchingCriteria.component_type} component matches Transaction ${transaction.id} ` +
                  `(Score: ${suggestion.confidenceScore.toFixed(3)})`
                );
              }
              
              suggestions.push(suggestionData);
            }
          }
          
          if (bestMatchForDocument.score < 0.25) {
            const bmTx = bestMatchForDocument.transaction;
            const bmTxDate = bmTx ? new Date(bmTx.transactionDate).toISOString().split('T')[0] : 'null';
            const docDateStr = documentDate ? documentDate.toISOString().split('T')[0] : 'null';
            const prefix = this.suggestionLogPrefix(document.id as unknown as number, bmTx?.id as unknown as string);
            if (this.shouldLogSuggestion(document.id as unknown as number, bmTx?.id as unknown as string)) {
              this.logger.warn(
                `${prefix} 📄 No matches >= 0.25. Best=${bestMatchForDocument.score.toFixed(3)} ` +
                `(doc ${document.id}:${document.name} amt=${documentAmount} date=${docDateStr} vs tx ${bmTx?.id} amt=${bmTx?.amount} date=${bmTxDate})`
              );
            } else {
              this.logger.warn(
                `📄 Document ${document.id} (${document.name}) has no matches above 0.25 threshold. ` +
                `Best match: ${bestMatchForDocument.score.toFixed(3)} with transaction ${bmTx?.id} ` +
                `(Amount: ${documentAmount} vs ${bmTx?.amount}, Date: ${docDateStr} vs ${bmTxDate})`
              );
            }
            
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
        this.logger.log(`🔍 RAW SUGGESTIONS BEFORE FILTERING: ${suggestions.length} total`);
        this.logger.log(
          `🔍 RAW SUGGESTIONS (${suggestions.length}): ` +
          suggestions
            .map(s => `${s.bankTransactionId}→${s.documentId || 'account'} ${(s.confidenceScore * 100).toFixed(0)}%`)
            .join(' | ')
        );
        
        // Count transfer suggestions in raw array
        const rawTransferSuggestions = suggestions.filter(s => (s.matchingCriteria as any)?.type === 'TRANSFER');
        this.logger.log(`🔍 RAW TRANSFER SUGGESTIONS: ${rawTransferSuggestions.length}`);
        for (const ts of rawTransferSuggestions) {
          this.logger.log(`🔍 Raw transfer: ${ts.bankTransactionId} -> ${(ts.matchingCriteria as any)?.transfer?.destinationTransactionId}`);
        }
        
        this.logger.log(`🔥 ABOUT TO CALL filterBestSuggestions - VERSION 2.0`);
        this.logger.log(`🔥 INPUT TO filterBestSuggestions: ${suggestions.length} suggestions`);
        for (const s of suggestions) {
          const isTransfer = (s.matchingCriteria as any)?.type === 'TRANSFER';
          this.logger.log(`🔥 Suggestion: ${s.bankTransactionId} - isTransfer: ${isTransfer} - confidence: ${s.confidenceScore}`);
        }
        const filteredSuggestions = this.filterBestSuggestions(suggestions);
        this.logger.log(`🔥 OUTPUT FROM filterBestSuggestions: ${filteredSuggestions.length} suggestions - VERSION 2.0`);
    
        // Process standalone transactions (those that don't match any documents AND are not part of transfer pairs)
        const matchedTransactionIds = new Set(filteredSuggestions.map(s => s.bankTransactionId));
        
        // Get ALL transfer suggestions from database (not just from filteredSuggestions)
        const allTransferSuggestions = await this.prisma.reconciliationSuggestion.findMany({
          where: {
            status: { not: SuggestionStatus.REJECTED },
            bankTransaction: {
              bankStatementDocument: { accountingClientId }
            },
            documentId: null,
            chartOfAccountId: null,
          },
          select: {
            bankTransactionId: true,
            matchingCriteria: true
          }
        });
        
        // Extract all transaction IDs that are part of transfer pairs from database
        const transferTransactionIds = new Set<string>();
        this.logger.log(`🔍 Checking ${allTransferSuggestions.length} database transfer suggestions for exclusion...`);
        
        for (const suggestion of allTransferSuggestions) {
          try {
            const matchingCriteria = suggestion.matchingCriteria as any;
            this.logger.log(`🔍 DB Transfer suggestion: bankTransactionId=${suggestion.bankTransactionId}, type=${matchingCriteria?.type}, hasTransfer=${!!matchingCriteria?.transfer}`);
            if (matchingCriteria?.type === 'TRANSFER' && matchingCriteria?.transfer?.destinationTransactionId) {
              transferTransactionIds.add(suggestion.bankTransactionId);
              transferTransactionIds.add(matchingCriteria.transfer.destinationTransactionId);
              this.logger.log(`🔁 Found transfer pair in DB: ${suggestion.bankTransactionId} -> ${matchingCriteria.transfer.destinationTransactionId}`);
            }
          } catch (e) {
            this.logger.error(`Error processing transfer suggestion ${suggestion.bankTransactionId}:`, e);
          }
        }
        
        const standaloneTransactions = unreconciliedTransactions.filter(t => 
          !matchedTransactionIds.has(t.id) && !transferTransactionIds.has(t.id)
        );
        
        this.logger.log(`🔁 Transfer pairs detected: ${transferTransactionIds.size} transactions excluded from standalone processing`);
        this.logger.log(`🔁 Excluded transfer transaction IDs: [${Array.from(transferTransactionIds).join(', ')}]`);
        this.logger.log(`📊 Transaction filtering: ${unreconciliedTransactions.length} total → ${matchedTransactionIds.size} matched to documents → ${transferTransactionIds.size} part of transfers → ${standaloneTransactions.length} standalone`);
        
        // Check if our target transactions are in the standalone list
        const targetStandalone = standaloneTransactions.filter(t => 
          t.id === '110-0-1756203049797' || t.id === '111-0-1756209938791'
        );
        if (targetStandalone.length > 0) {
          this.logger.warn(`❌ TARGET TRANSACTIONS STILL IN STANDALONE: ${targetStandalone.map(t => t.id).join(', ')}`);
        } else {
          this.logger.log(`✅ TARGET TRANSACTIONS PROPERLY EXCLUDED FROM STANDALONE`);
        }
        
        this.logger.log(`Processing ${standaloneTransactions.length} standalone transactions for account categorization`);
        
        for (const transaction of standaloneTransactions) {
          this.logger.log(`🤖 Processing standalone transaction ${transaction.id}: "${transaction.description}" (${transaction.amount} ${transaction.transactionType})`);
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
              
              // Check if this transaction-account pair was previously rejected
              const pairKey = `${transaction.id}-${chartOfAccount.id}`;
              if (rejectedTransactionAccountPairs.has(pairKey)) {
                this.logger.warn(`🚫 SKIPPING previously rejected standalone suggestion: Transaction ${transaction.id} + Account ${chartOfAccount.id}`);
                continue;
              }
              
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
        this.logger.log(`🏁 FINAL RESULTS: Generated total of ${totalSuggestions} suggestions (${filteredSuggestions.length} matches + ${standaloneTransactions.length} standalone) for client ${accountingClientId}`);
        
        // Final summary
        this.logger.log(`🏁 SUMMARY:`);
        this.logger.log(`🏁 - Unreconciled documents: ${unreconciled.length}`);
        this.logger.log(`🏁 - Unreconciled transactions: ${unreconciliedTransactions.length}`);
        this.logger.log(`🏁 - Transfer suggestions created: ${rawTransferSuggestions.length}`);
        this.logger.log(`🏁 - Filtered suggestions: ${filteredSuggestions.length}`);
        this.logger.log(`🏁 - Standalone transactions processed: ${standaloneTransactions.length}`);
        this.logger.log(`🏁 - Total final suggestions: ${totalSuggestions}`);
    
      } catch (error) {
        this.logger.error(`Failed to generate reconciliation suggestions: ${error.message}`);
      } finally {
        this.generationInProgress.delete(accountingClientId);
      }
    }
      
      private tryComponentMatching(
  document: any,
  documentData: any,
  transactionAmount: number
): { found: boolean; score: number; componentType: string; reason: string } {
  const tolerance = Math.max(transactionAmount * 0.05, 2); 
  
  if (document.type === 'Z Report') {
    console.log(`📊 Z REPORT COMPONENT ANALYSIS for ${document.name}:`, {
      transactionAmount,
      tolerance,
      availableFields: Object.keys(documentData || {})
    });
    
    const components = [
      { key: 'pos_amount', name: 'POS', score: 0.6 },
      { key: 'card_amount', name: 'Card', score: 0.6 },
      { key: 'cash_amount', name: 'Cash', score: 0.6 },
      { key: 'total_pos', name: 'Total POS', score: 0.6 },
      { key: 'card_total', name: 'Card Total', score: 0.6 }
    ];
    
    for (const component of components) {
      const componentAmount = parseFloat(documentData[component.key]) || 0;
      const amountDiff = Math.abs(componentAmount - transactionAmount);
      
      console.log(`🔍 Z REPORT COMPONENT CHECK: ${component.name} (${component.key})`, {
        componentAmount,
        transactionAmount,
        amountDiff,
        tolerance,
        withinTolerance: amountDiff <= tolerance,
        hasValue: componentAmount > 0
      });
      
      if (componentAmount > 0 && Math.abs(componentAmount - transactionAmount) <= tolerance) {
        console.log(`🎯 Z REPORT COMPONENT MATCH: ${document.name} ${component.name} ${componentAmount} matches transaction ${transactionAmount}`);
        return {
          found: true,
          score: component.score,
          componentType: component.name,
          reason: `${component.name} component matches transaction amount`
        };
      }
    }
    
    console.log(`❌ Z REPORT NO COMPONENT MATCH for ${document.name}`);
  }
  
  if (document.type === 'Invoice') {
    const netAmount = parseFloat(documentData.net_amount) || parseFloat(documentData.subtotal) || 0;
    const vatAmount = parseFloat(documentData.vat_amount) || 0;
    
    if (netAmount > 0 && Math.abs(netAmount - transactionAmount) <= tolerance) {
      return {
        found: true,
        score: 0.5,
        componentType: 'Net Amount',
        reason: 'Net amount (excluding VAT) matches transaction'
      };
    }
    
    if (vatAmount > 0 && Math.abs(vatAmount - transactionAmount) <= tolerance) {
      return {
        found: true,
        score: 0.4,
        componentType: 'VAT Amount',
        reason: 'VAT amount matches transaction'
      };
    }
  }
  
  if (document.type === 'Payment Order' || document.type === 'Collection Order') {
    const netAmount = parseFloat(documentData.net_amount) || 0;
    const feeAmount = parseFloat(documentData.fee_amount) || parseFloat(documentData.commission) || 0;
    
    if (netAmount > 0 && Math.abs(netAmount - transactionAmount) <= tolerance) {
      return {
        found: true,
        score: 0.5,
        componentType: 'Net Amount',
        reason: 'Net amount (after fees) matches transaction'
      };
    }
    
    const totalAmount = parseFloat(documentData.total_amount) || 0;
    if (totalAmount > 0 && feeAmount > 0) {
      const expectedNet = totalAmount - feeAmount;
      if (Math.abs(expectedNet - transactionAmount) <= tolerance) {
        return {
          found: true,
          score: 0.5,
          componentType: 'Amount minus fees',
          reason: `Document amount minus fees (${feeAmount}) matches transaction`
        };
      }
    }
  }
  
  return { found: false, score: 0, componentType: '', reason: '' };
}

private calculateMatchSuggestion(
        document: any,
        transaction: any,
        documentData: any,
        documentAmount: number,
        documentNumber: string,
        documentDate: Date | null,
        isMandatory: boolean = false
      ): { confidenceScore: number; matchingCriteria: any; reasons: string[] } {
        let score = 0;
        const criteria: any = {};
        const reasons: string[] = [];
      
        const transactionAmount = Math.abs(Number(transaction.amount));
        const transactionDate = new Date(transaction.transactionDate);
      
        const amountDiff = Math.abs(documentAmount - transactionAmount);
        const amountThreshold = Math.max(documentAmount * 0.05, 2); 
        let amountMatchFound = false;

        if (amountDiff === 0) {
          score += 0.6;
          criteria.exact_amount_match = true;
          reasons.push('Exact amount match');
          amountMatchFound = true;
        } else if (amountDiff <= amountThreshold) {
          score += 0.3;
          criteria.close_amount_match = true;
          reasons.push(`Close amount match (diff: ${amountDiff.toFixed(2)} RON)`);
          amountMatchFound = true;
        }
        
        if (!amountMatchFound && documentData) {
          console.log(`🔍 COMPONENT MATCHING DEBUG for ${document.name}:`, {
            documentType: document.type,
            documentAmount,
            transactionAmount,
            documentData: JSON.stringify(documentData, null, 2)
          });
          
          const componentMatch = this.tryComponentMatching(document, documentData, transactionAmount);
          console.log(`🎯 COMPONENT MATCH RESULT for ${document.name}:`, componentMatch);
          
          if (componentMatch.found) {
            score += componentMatch.score;
            criteria.component_match = true;
            criteria.component_type = componentMatch.componentType;
            reasons.push(componentMatch.reason);
            amountMatchFound = true;
            console.log(`✅ COMPONENT MATCH SUCCESS: ${document.name} matched via ${componentMatch.componentType}`);
          }
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
        
        // LEVEL 3: ENHANCED PAYMENT ORDER PRIORITIZATION
        // Check transaction description for payment order indicators
        const description = transaction.description?.toLowerCase() || '';
        const paymentOrderIndicators = [
          'ordin de plata', 'ordinul de plata', 'ordin plata',
          'payment order', 'transfer', 'virament'
        ];
        const hasPaymentOrderDescription = paymentOrderIndicators.some(indicator => 
          description.includes(indicator)
        );
        
        // Strong bonus for Payment Orders when description indicates payment order
        if (document.type === 'Payment Order' && hasPaymentOrderDescription) {
          score += 0.3; // Large boost for description match
          criteria.payment_order_description_match = true;
          reasons.push('Payment Order matches transaction description ("Ordin de plata")');
        }
        
        // Regular bonus for Payment Orders matching debit transactions
        if (document.type === 'Payment Order' && isDebit) {
          score += 0.1;
          criteria.payment_order_priority = true;
          reasons.push('Payment Order matches debit transaction');
        }
        
        // Similarly for Collection Orders
        const collectionOrderIndicators = [
          'ordin de incasare', 'incasare', 'collection order', 'direct debit'
        ];
        const hasCollectionOrderDescription = collectionOrderIndicators.some(indicator => 
          description.includes(indicator)
        );
        
        if (document.type === 'Collection Order' && hasCollectionOrderDescription) {
          score += 0.3;
          criteria.collection_order_description_match = true;
          reasons.push('Collection Order matches transaction description');
        }
        
        // MANDATORY DOCUMENT PRIORITY: If this document is referenced by the bank statement, give it a significant boost
        if (isMandatory) {
          score += 0.4; // Large boost to ensure mandatory docs are prioritized
          criteria.mandatory_document = true;
          reasons.push('Document referenced by bank statement (mandatory)');
          
          this.logger.warn(`🎯 MANDATORY BOOST: Document ${document.id} (${document.name}) gets +0.4 priority boost`);
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
  this.logger.log(`🔍 FILTERING INPUT: ${suggestions.length} total suggestions`);
  this.logger.log(`🔥 INSIDE filterBestSuggestions - VERSION 2.0`);
  const transferSuggestionsInput = suggestions.filter(s => (s.matchingCriteria as any)?.type === 'TRANSFER');
  this.logger.log(`🔥 Transfer suggestions in input: ${transferSuggestionsInput.length}`);
  if (transferSuggestionsInput.length > 0) {
    this.logger.log(`🔁 Transfer suggestions in input: ${transferSuggestionsInput.length}`);
    for (const ts of transferSuggestionsInput) {
      this.logger.log(`🔁 Input Transfer: ${ts.bankTransactionId} -> ${(ts.matchingCriteria as any)?.transfer?.destinationTransactionId}`);
    }
  }
  
  suggestions.sort((a, b) => {
    const aHasDoc = a.documentId !== null && a.documentId !== undefined;
    const bHasDoc = b.documentId !== null && b.documentId !== undefined;
    const aIsTransfer = (a.matchingCriteria as any)?.type === 'TRANSFER';
    const bIsTransfer = (b.matchingCriteria as any)?.type === 'TRANSFER';

    // Priority order: Document suggestions > Transfer suggestions > Other suggestions
    if (aHasDoc && !bHasDoc && !bIsTransfer) return -1;
    if (!aHasDoc && !aIsTransfer && bHasDoc) return 1;
    if (aIsTransfer && !bHasDoc && !bIsTransfer) return -1;
    if (!aHasDoc && !aIsTransfer && bIsTransfer) return 1;
    
    // If confidence scores are very close (within 0.05), prioritize by document type
    const scoreDiff = b.confidenceScore - a.confidenceScore;
    if (Math.abs(scoreDiff) <= 0.05) {
      // Get document types for comparison
      const aHasPaymentOrder = a.matchingCriteria?.payment_order_priority;
      const bHasPaymentOrder = b.matchingCriteria?.payment_order_priority;
      
      if (aHasPaymentOrder !== bHasPaymentOrder) {
        return aHasPaymentOrder ? -1 : 1;
      }
    }
    
    return scoreDiff;
  });

  const filteredSuggestions = [];
  const seenTx = new Set();
  const usedDocuments = new Set();
  const componentMatches = new Map(); // Track component matches per document
  
  for (const suggestion of suggestions) {
    // For component matches, allow multiple transactions per document
    const isComponentMatch = suggestion.matchingCriteria?.component_match;
    const componentType = suggestion.matchingCriteria?.component_type;
    
    if (seenTx.has(suggestion.bankTransactionId)) {
      continue; // Skip, transaction already has a suggestion
    }
    
    // Enhanced logic for component-based reconciliation
    if (suggestion.documentId) {
      if (isComponentMatch) {
        // For component matches, track which components are used
        const docKey = `${suggestion.documentId}`;
        const componentKey = `${suggestion.documentId}-${componentType}`;
        
        if (!componentMatches.has(docKey)) {
          componentMatches.set(docKey, new Set());
        }
        
        const usedComponents = componentMatches.get(docKey);
        if (usedComponents.has(componentType)) {
          continue; // This component already matched
        }
        
        // Mark this component as used
        usedComponents.add(componentType);
        
        this.logger.warn(
          `✅ COMPONENT MATCH ALLOWED: Document ${suggestion.documentId} ` +
          `component '${componentType}' → Transaction ${suggestion.bankTransactionId}`
        );
      } else {
        // For non-component matches, use traditional logic
        if (usedDocuments.has(suggestion.documentId)) {
          continue; // Skip this suggestion, document already matched
        }
        usedDocuments.add(suggestion.documentId);
      }
    }
    
    filteredSuggestions.push(suggestion);
    seenTx.add(suggestion.bankTransactionId);
  }

  this.logger.warn(
    `🔍 FILTERING RESULT: ${suggestions.length} → ${filteredSuggestions.length} suggestions ` +
    `(${Array.from(componentMatches.entries()).map(([doc, comps]) => `Doc${doc}:${Array.from(comps).join(',')}`).join(' | ')})`
  );

  // Log transfer suggestions specifically
  const transferSuggestions = filteredSuggestions.filter(s => (s.matchingCriteria as any)?.type === 'TRANSFER');
  if (transferSuggestions.length > 0) {
    this.logger.log(`🔁 Transfer suggestions in filtered results: ${transferSuggestions.length}`);
    for (const ts of transferSuggestions) {
      this.logger.log(`🔁 Transfer: ${ts.bankTransactionId} -> ${(ts.matchingCriteria as any)?.transfer?.destinationTransactionId}`);
    }
  } else {
    this.logger.warn(`❌ NO TRANSFER SUGGESTIONS in filtered results!`);
  }

  this.logger.log(`🔥 RETURNING FROM filterBestSuggestions: ${filteredSuggestions.length} suggestions - VERSION 2.0`);
  const transferSuggestionsOutput = filteredSuggestions.filter(s => (s.matchingCriteria as any)?.type === 'TRANSFER');
  this.logger.log(`🔥 Transfer suggestions in output: ${transferSuggestionsOutput.length}`);
  for (const ts of transferSuggestionsOutput) {
    this.logger.log(`🔥 Output Transfer: ${ts.bankTransactionId} -> ${(ts.matchingCriteria as any)?.transfer?.destinationTransactionId}`);
  }
  return filteredSuggestions;
}

private normalizeReference(ref: string): string {
  return ref.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

private parseAmountForReconciliation(amount: any, docData?: any, docType?: string): number {
        let parsed = Math.abs(this.parseAmount(amount));
        if (parsed !== 0) return parsed;

        if (docData) {
          const candidateKeys = [
            'amount', 'value', 'payment_amount', 'transaction_amount',
            'grand_total', 'total_z', 'sum', 'net_amount', 'final_amount',
            'total_sales' 
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
        
        return 0; 
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

      // =====================
      // Targeted suggestion debug helpers
      // =====================
      private shouldLogSuggestion(docId?: number | null, txId?: string | null): boolean {
        try {
          const env = (name: string) => (process.env[name] || '').toString();
          const on = (v: string) => ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
          const globalEnabled = on(env('SUGGESTIONS_DEBUG'));
          const docFilter = env('SUGGESTIONS_DEBUG_DOC_ID');
          const txFilter = env('SUGGESTIONS_DEBUG_TX_ID');
          const pairFilter = env('SUGGESTIONS_DEBUG_PAIR'); // format: <docId>:<txId>
          if (globalEnabled) return true;
          if (docFilter && docId != null && docFilter === String(docId)) return true;
          if (txFilter && txId && txFilter === String(txId)) return true;
          if (pairFilter && docId != null && txId && pairFilter === `${docId}:${txId}`) return true;
        } catch {}
        return false;
      }

      private suggestionLogPrefix(docId?: number | null, txId?: string | null): string {
        try {
          const session = (process.env.SUGGESTIONS_DEBUG_SESSION || '').toString();
          const parts: string[] = ['SUGDBG'];
          if (session) parts.push(`session=${session}`);
          if (docId != null) parts.push(`doc=${docId}`);
          if (txId) parts.push(`tx=${txId}`);
          return `[${parts.join(' ')}]`;
        } catch {
          return '[SUGDBG]';
        }
      }
    }
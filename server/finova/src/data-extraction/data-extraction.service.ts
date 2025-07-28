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
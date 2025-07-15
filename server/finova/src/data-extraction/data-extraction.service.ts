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

    async extractData(fileBase64: string, clientCompanyEin: string) {
        return this.processingQueue.add(() => this.processDocument(fileBase64, clientCompanyEin));
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
            take: 100 
        });

        return documents.map(doc => ({
            id: doc.id,
            name: doc.name,
            documentHash: doc.documentHash,
            ...(typeof doc.processedData?.extractedFields === 'object' && doc.processedData?.extractedFields !== null
                ? doc.processedData.extractedFields
                : {})
        }));
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

    private async processDocument(fileBase64: string, clientCompanyEin: string) {
        let tempBase64File: string | null = null;
        const startTime = Date.now();
        const memoryBefore = process.memoryUsage();
        
        try {
            const estimatedSize = (fileBase64.length * 3) / 4; 
            if (estimatedSize > this.maxFileSize) {
                throw new Error(`File too large: ${Math.round(estimatedSize / (1024 * 1024))}MB. Maximum allowed: ${this.maxFileSize / (1024 * 1024)}MB`);
            }

            this.logger.log(`Starting document processing. Estimated file size: ${Math.round(estimatedSize / 1024)}KB`);
            this.logger.debug(`Memory before processing: ${JSON.stringify(memoryBefore)}`);

            if (!fs.existsSync(this.pythonScriptPath)) {
                const alternativePaths = [
                    path.join(process.cwd(), '../../agents/first_crew_finova/src/first_crew_finova/main.py'),
                    '/opt/render/project/src/agents/first_crew_finova/src/first_crew_finova/main.py',
                    path.join(process.cwd(), 'agents', 'first_crew_finova', 'src', 'first_crew_finova', 'main.py'),
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

            const tempFileName = `base64_${randomBytes(8).toString('hex')}_${Date.now()}.txt`;
            tempBase64File = path.join(this.tempDir, tempFileName);
            await writeFilePromise(tempBase64File, fileBase64);
            
            this.logger.debug(`Created temporary base64 file: ${tempBase64File}`);

            if (!this.dependenciesChecked) {
                try {
                    await this.installDependencies();
                    this.dependenciesChecked = true;
                } catch (installError) {
                    this.logger.warn('Failed to install Python dependencies, they might already be installed');
                }
            }

            const existingDocsJson = JSON.stringify(existingDocuments);
            const userCorrectionsJson = JSON.stringify(userCorrections);
            
            const command = `python3 "${this.pythonScriptPath}" "${clientCompanyEin}" "${tempBase64File}" '${existingDocsJson}' '${userCorrectionsJson}'`;
            
            this.logger.debug(`Executing command: ${command.substring(0, 100)}...`);
            
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Processing timeout')), this.processingTimeout);
            });

            const executionPromise = execPromise(command, {
                maxBuffer: 1024 * 1024 * 10,
                cwd: path.dirname(this.pythonScriptPath), 
                env: {
                    ...process.env,
                    PYTHONPATH: path.dirname(this.pythonScriptPath),
                    PYTHONUNBUFFERED: '1',
                    MALLOC_ARENA_MAX: '2',
                }
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
                this.logger.error(`Failed to parse Python output. Raw output (first 1000 chars): ${stdout?.substring(0, 1000)}`);
                throw new Error(`Invalid JSON output from Python script: ${parseError.message}`);
            }

            if (result.error) {
                throw new Error(result.error);
            }

            const extractedData = result.data || result;

            if (extractedData.duplicate_detection) {
                this.logger.log(`Duplicate detection: ${extractedData.duplicate_detection.is_duplicate ? 'Found duplicates' : 'No duplicates found'}`);
            }

            if (extractedData.compliance_validation) {
                this.logger.log(`Compliance status: ${extractedData.compliance_validation.compliance_status}`);
            }

            this.validateInvoiceDirection(extractedData, clientCompanyEin);
            this.validateDocumentRelevance(extractedData, clientCompanyEin);
            this.validateAndNormalizeCurrency(extractedData);
            this.validateExtractedData(extractedData, [], [], clientCompanyEin);

            const processingTime = Date.now() - startTime;
            const memoryAfter = process.memoryUsage();
            const memoryDiff = {
                rss: memoryAfter.rss - memoryBefore.rss,
                heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
                external: memoryAfter.external - memoryBefore.external
            };

            this.logger.log(`Document processing completed in ${processingTime}ms`);
            this.logger.debug(`Memory usage change: ${JSON.stringify(memoryDiff)}`);

            return extractedData;
            
        } catch (error) {
            const processingTime = Date.now() - startTime;
            this.logger.error(`Error extracting data for EIN ${clientCompanyEin} after ${processingTime}ms: ${error.message}`, error.stack);
            
            if (error.message.includes('timeout')) {
                throw new Error(`Document processing timed out after ${this.processingTimeout / 1000} seconds. Please try with a smaller file or contact support.`);
            } else if (error.message.includes('maxBuffer')) {
                throw new Error('Document output too large. Please try with a smaller or simpler document.');
            } else if (error.message.includes('ENOENT')) {
                throw new Error('Document processing system unavailable. Please try again later.');
            }
            
            throw new Error(`Failed to extract data from document: ${error.message}`);
        } finally {
            if (tempBase64File && fs.existsSync(tempBase64File)) {
                try {
                    await unlinkPromise(tempBase64File);
                    this.logger.debug(`Cleaned up temporary file: ${tempBase64File}`);
                } catch (cleanupError) {
                    this.logger.warn(`Failed to clean up temporary file: ${cleanupError.message}`);
                }
            }

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

    async saveComplianceValidation(documentId: number, complianceData: any) {
        try {
            const compliance = await this.prisma.complianceValidation.create({
                data: {
                    documentId: documentId,
                    overallStatus: complianceData.compliance_status as ComplianceStatus,
                    validationRules: complianceData.validation_rules || [],
                    errors: complianceData.errors || [],
                    warnings: complianceData.warnings || []
                }
            });

            return compliance;
        } catch (error) {
            this.logger.error(`Failed to save compliance validation: ${error.message}`);
            throw error;
        }
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
            isProcessing: this.processingQueue['processing'] || false
        };
    }

    async saveDuplicateDetectionWithTransaction(
    prisma: any, // PrismaTransaction type
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
        // Don't throw - let the transaction continue
    }
}

async saveComplianceValidationWithTransaction(
    prisma: any, // PrismaTransaction type
    documentId: number, 
    complianceValidation: any
): Promise<void> {
    try {
        await prisma.complianceValidation.create({
            data: {
                documentId: documentId,
                overallStatus: this.mapComplianceStatus(complianceValidation.compliance_status),
                validationRules: complianceValidation.validation_rules || [],
                errors: complianceValidation.errors || null,
                warnings: complianceValidation.warnings || null,
                validatedAt: new Date()
            }
        });
    } catch (error) {
        console.error('[COMPLIANCE_VALIDATION_ERROR]', error);
        // Don't throw - let the transaction continue
    }
}

async saveUserCorrectionWithTransaction(
    prisma: any, // PrismaTransaction type
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
        // Don't throw - let the transaction continue
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
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import { randomBytes } from 'crypto';

const execPromise = promisify(exec);
const writeFilePromise = promisify(fs.writeFile);
const unlinkPromise = promisify(fs.unlink);

@Injectable()
export class DataExtractionService {
    private readonly logger = new Logger(DataExtractionService.name);
    private pythonScriptPath: string;
    private readonly tempDir: string;

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
        
        this.logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        this.logger.log(`Current working directory: ${process.cwd()}`);
        this.logger.log(`Python script path: ${this.pythonScriptPath}`);
        this.logger.log(`Temp directory: ${this.tempDir}`);
        
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
        let tempBase64File: string | null = null;
        
        try {
            if (!fs.existsSync(this.pythonScriptPath)) {
                const alternativePaths = [
                    path.join(process.cwd(), '../../agents/first_crew_finova/src/first_crew_finova/main.py'),
                    '/opt/render/project/src/agents/first_crew_finova/src/first_crew_finova/main.py',
                    path.join(process.cwd(), 'agents/first_crew_finova/src/first_crew_finova/main.py'),
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

            const tempFileName = `base64_${randomBytes(8).toString('hex')}.txt`;
            tempBase64File = path.join(this.tempDir, tempFileName);
            await writeFilePromise(tempBase64File, fileBase64);
            
            this.logger.debug(`Created temporary base64 file: ${tempBase64File}`);

            try {
                await execPromise('python3 -m pip install crewai crewai-tools pytesseract pdf2image pillow', {
                    cwd: path.dirname(this.pythonScriptPath)
                });
            } catch (installError) {
                this.logger.warn('Failed to install Python dependencies, they might already be installed');
            }

            const command = `python3 "${this.pythonScriptPath}" "${clientCompanyEin}" "${tempBase64File}"`;
            
            this.logger.debug(`Executing command: ${command.substring(0, 100)}...`);
            
            const { stdout, stderr } = await execPromise(command, {
                maxBuffer: 1024 * 1024 * 10, 
                cwd: path.dirname(this.pythonScriptPath), 
                env: {
                    ...process.env,
                    PYTHONPATH: path.dirname(this.pythonScriptPath) 
                }
            });
            
            if (stderr) {
                this.logger.warn(`Python stderr output: ${stderr}`);
            }

            let result;
            try {
                const jsonOutput = this.extractJsonFromOutput(stdout);
                result = JSON.parse(jsonOutput);
            } catch (parseError) {
                this.logger.error(`Failed to parse Python output. Raw output: ${stdout}`);
                throw new Error(`Invalid JSON output from Python script: ${parseError.message}`);
            }

            if (result.error) {
                throw new Error(result.error);
            }

            const extractedData = result.data || result;

            this.validateInvoiceDirection(extractedData, clientCompanyEin);
            this.validateExtractedData(extractedData, [], [], clientCompanyEin);

            return extractedData;
            
        } catch (error) {
            this.logger.error(`Error extracting data for EIN ${clientCompanyEin}: ${error.message}`, error.stack);
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
        }
    }

    private extractJsonFromOutput(output: string): string {
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
                data[field] = Number(data[field]);
            }
        });

        if (Array.isArray(data.line_items)) {
            data.line_items = data.line_items.map((item: any) => {
                const itemNumericFields = ['quantity', 'unit_price', 'vat_amount', 'total'];
                itemNumericFields.forEach(field => {
                    if (item[field] !== undefined && item[field] !== null) {
                        item[field] = Number(item[field]);
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
}
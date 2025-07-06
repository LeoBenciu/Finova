import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
const execPromise = promisify(exec);

@Injectable()
export class DataExtractionService {
    private readonly logger = new Logger(DataExtractionService.name);
    private readonly pythonScriptPath = path.join(__dirname, '../../first_crew_finova/src/first_crew_finova/main.py');

    constructor(config: ConfigService, private readonly prisma: PrismaService) {}

    async extractData(fileBase64:string, clientCompanyEin: string) {
        try {
            const clientCompany = await this.prisma.clientCompany.findUnique({
                where: { ein: clientCompanyEin },
            });
            if (!clientCompany) {
                throw new Error(`Failed to find client company with EIN:${clientCompanyEin} in the database!`);
            }

            const { stdout, stderr } = await execPromise(`python ${this.pythonScriptPath} ${clientCompanyEin} ${fileBase64}`);
            if (stderr) {
                this.logger.error(`Python error: ${stderr}`);
                throw new Error(`Failed to process document: ${stderr}`);
            }

            const result = JSON.parse(stdout);
            if (result.error) {
                throw new Error(result.error);
            }

            const extractedJsonData = result.data;

            this.validateInvoiceDirection(extractedJsonData, clientCompanyEin);
            this.validateExtractedData(extractedJsonData, [], [], clientCompanyEin);

            return extractedJsonData;
        } catch (e) {
            this.logger.error(`Error extracting data for EIN ${clientCompanyEin}: ${e.message}`, e.stack);
            throw new Error(`Failed to extract data from document: ${e.message}`);
        }
    }

    private validateInvoiceDirection(data: any, clientCompanyEin: string) {
        if (!data.buyer_ein || !data.vendor_ein) {
            this.logger.warn('Missing buyer_ein or vendor_ein in extracted data');
            return;
        }

        const isIncoming = data.buyer_ein === clientCompanyEin;
        const isOutgoing = data.vendor_ein === clientCompanyEin;

        if (!isIncoming && !isOutgoing) {
            this.logger.warn(`Neither buyer nor vendor matches client company EIN: ${clientCompanyEin}`);
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

    private extractJsonString(input: string): string {
        try {
            const startIndex = input.indexOf('{');
            if (startIndex === -1) return input;
            
            let openBraces = 0;
            let endIndex = -1;
            
            for (let i = startIndex; i < input.length; i++) {
                if (input[i] === '{') openBraces++;
                else if (input[i] === '}') {
                    openBraces--;
                    if (openBraces === 0) {
                        endIndex = i + 1;
                        break;
                    }
                }
            }
            
            if (endIndex !== -1) {
                return input.substring(startIndex, endIndex);
            }
            
            return input;
        } catch (error) {
            this.logger.warn("Error extracting JSON string", error);
            return input;
        }
    }

    private validateExtractedData(data: any, existingArticles: any[], managementRecords: any[], clientCompanyEin: string) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid extracted data format');
        }

        if (Array.isArray(data.line_items)) {
            data.line_items = data.line_items.map((item: any) => {
                if (item.quantity !== undefined) item.quantity = Number(item.quantity);
                if (item.unit_price !== undefined) item.unit_price = Number(item.unit_price);
                if (item.vat_amount !== undefined) item.vat_amount = Number(item.vat_amount);
                if (item.total !== undefined) item.total = Number(item.total);
                return item;
            });
        } else {
            data.line_items = [];
        }

        return data;
    }
}
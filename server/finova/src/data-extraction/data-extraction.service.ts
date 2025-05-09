import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerativeModel, GoogleGenerativeAI, ChatSession } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';

const GEMINI_MODEL = "gemini-2.0-flash";

@Injectable()
export class DataExtractionService {
    private readonly googleAi:GoogleGenerativeAI;
    private readonly model: GenerativeModel;
    private readonly prompt:string;
    private readonly logger = new Logger(DataExtractionService.name);

    constructor(config: ConfigService, private readonly prisma: PrismaService){
            const geminiApiKey = config.get('GOOGLE_GEMINI_API_KEY');
            this.googleAi = new GoogleGenerativeAI(geminiApiKey);
            this.model = this.googleAi.getGenerativeModel({ model: GEMINI_MODEL });
            this.prompt = `You are a bookkeeping data extraction assistant for Romanian accounting companies. When you receive text from a scanned document (e.g., invoice, receipt), your task is to extract the relevant bookkeeping details and output them as a JSON object. You will also compare extracted articles with a provided list of existing articles from the database and select a management record from a provided list for the same company.

            **Instructions**:

            1. **Determine Invoice Direction**:
               - First, identify if this is an incoming invoice (from supplier) or outgoing invoice (to customer) by comparing the buyer_ein with the CURRENT_COMPANY_EIN ({{CURRENT_COMPANY_EIN}}).
               - If buyer_ein matches CURRENT_COMPANY_EIN, this is an incoming invoice (from supplier).
               - If vendor_ein matches CURRENT_COMPANY_EIN, this is an outgoing invoice (to customer).

            2. **Extract Document Details**:
               - Extract the following fields when available:
                 - document_type: "Invoice" or "Receipt" (set to null if neither).
                 - invoice_type: Incoming or Outgoing.
                 - reason_invoice: The reason why the invoice is Incoming or Outgoing.
                 - vendor: Name of the vendor or service provider.
                 - vendor_ein: Vendor's unique identifier (number only, remove "RO" prefix).
                 - buyer: Name of the buyer.
                 - buyer_ein: Buyer's unique identifier (number only, remove "RO" prefix).
                 - document_number: Unique identifier for the document (e.g., invoice/receipt number).
                 - document_date: Date issued (format: DD-MM-YYYY).
                 - due_date: Payment due date (format: DD-MM-YYYY, null if not applicable).
                 - total_amount: Total amount charged or paid in RON (numeric).
                 - vat_amount: Total VAT (sum of vat_amount from all line items, numeric).
                 - receipt_of: Invoice number for which the receipt was made (null if not applicable).

            3. **Extract Line Items**:
               - Extract an array of line items (if present). For each item:
                 - quantity: Number of units (numeric).
                 - unit_price: Price per unit (numeric).
                 - vat_amount: VAT per unit (numeric, e.g., 19% VAT for one unit).
                 - total: Total amount for the line item (quantity * unit_price + VAT, numeric).
                 - type: Article type (choose based on invoice direction):
                   - FOR INCOMING INVOICES (from suppliers): ["Nedefinit", "Marfuri", "Materii prime", "Materiale auxiliare", "Ambalaje", "Obiecte de inventar", "Amenajari provizorii", "Mat. spre prelucrare", "Mat. in pastrare/consig.", "Discount financiar intrari", "Combustibili", "Piese de schimb", "Alte mat. consumabile", "Discount comercial intrari", "Ambalaje SGR"]
                   - FOR OUTGOING INVOICES (to customers): ["Nedefinit", "Marfuri", "Produse finite", "Ambalaje", "Produse reziduale", "Semifabricate", "Discount financiar iesiri", "Servicii vandute", "Discount comercial iesiri", "Ambalaje SGR", "Taxa verde"]
                 - articleCode: Numeric code for the article. If the article exists in the provided EXISTING_ARTICLES, use its articleCode. If the article is new (isNew: true), assign the next available numeric value as follows:
                   - If EXISTING_ARTICLES is empty, start with articleCode: 1 for the first new article, incrementing by 1 for each subsequent new article (e.g., 1, 2, 3, ...).
                   - If EXISTING_ARTICLES is not empty, use the highest existing articleCode + 1 for the first new article, incrementing by 1 for each subsequent new article.
                 - name: Name of the article that this item matches (e.g., "Widget-A").
                 - vat: VAT rate (choose from: "NINETEEN", "NINE", "FIVE", "ZERO"). If you can't find a VAT amount in the document for each line item, that means the VAT rate should be "ZERO".
                 - um: Unit of measure (choose from: "BUCATA", "KILOGRAM", "LITRU", "METRU", "GRAM", "CUTIE", "PACHET", "PUNGA", "SET", "METRU_PATRAT", "METRU_CUB", "MILIMETRU", "CENTIMETRU", "TONA", "PERECHE", "SAC", "MILILITRU", "KILOWATT_ORA", "MINUT", "ORA", "ZI_DE_LUCRU", "LUNI_DE_LUCRU", "DOZA", "UNITATE_DE_SERVICE", "O_MIE_DE_BUCATI", "TRIMESTRU", "PROCENT", "KILOMETRU", "LADA", "DRY_TONE", "CENTIMETRU_PATRAT", "MEGAWATI_ORA", "ROLA", "TAMBUR", "SAC_PLASTIC", "PALET_LEMN", "UNITATE", "TONA_NETA", "HECTOMETRU_PATRAT", "FOAIE").
                 - account_code: For "Nedefinit" type or when applicable, suggest an appropriate accounting code (e.g., "624" for transport services).
                 - management: Name of the management as string from the provided management list (select the most relevant). If type is "Nedefinit", this field should be null.
                 - isNew: Boolean (true if the article is new, false if it matches an existing article).

            4. **Special Handling for "Nedefinit" Type**:
               - When type is "Nedefinit":
                 - Set management to null
                 - Suggest an appropriate account_code based on the item description (e.g., transportation services → "624")

            5. **Article Comparison**:
               - Compare each extracted article (based on description or articleCode) with the provided list of existing articles.
               - If a match is found (by name or articleCode, case-insensitive), set isNew: false and use the existing article's details (type, articleCode, name, vat, um).
               - If no match is found, set isNew: true and infer type, articleCode, name, vat, um from the document or context (use reasonable defaults if missing).

            6. **Management Selection**:
               - For each line item (except those with type "Nedefinit"), select a management record from the provided management list that is most relevant (e.g., based on name or type).

            7. **Provided Data**:
               - Current Company EIN: {{CURRENT_COMPANY_EIN}}
               - Existing Articles: {{EXISTING_ARTICLES}}
               - Management Records: {{MANAGEMENT_RECORDS}}

            8. **Output**:
               - Return only a valid JSON object with the specified fields.
               - Set missing or inapplicable fields to null.
               - Do not include commentary or extra text.

            **Example Output**:
            {
              "document_type": "Invoice",
              "invoice_type": "Incoming",
              "reason_invoice": "Because I compared the buyer_ein(87654321) with the CURRENT_COMPANY_EIN (23423423) and they were not equal",
              "vendor": "Vendor SRL",
              "vendor_ein": "12345678",
              "buyer": "Buyer SRL",
              "buyer_ein": "87654321",
              "document_number": "INV001",
              "document_date": "01-01-2025",
              "due_date": "15-01-2025",
              "total_amount": 1190,
              "vat_amount": 190,
              "receipt_of": null,
              "line_items": [
                {
                  "quantity": 10,
                  "unit_price": 100,
                  "vat_amount": 19,
                  "total": 1190,
                  "type": "Marfuri",
                  "articleCode": 1001,
                  "name": "Widget-A",
                  "vat": "NINETEEN",
                  "um": "BUCATA",
                  "account_code": null,
                  "management": "Depozit Central",
                  "isNew": false
                },
                {
                  "quantity": 1,
                  "unit_price": 50,
                  "vat_amount": 9.5,
                  "total": 59.5,
                  "type": "Nedefinit",
                  "articleCode": 1002,
                  "name": "Transport marfa",
                  "vat": "NINETEEN",
                  "um": "SERVICIU",
                  "account_code": "624",
                  "management": null,
                  "isNew": true
                }
              ]
            }
            `};

    async extractData(fileBase64: string, clientCompanyEin: string){
        try
        {
            const clientCompany = await this.prisma.clientCompany.findUnique({
                where:{
                    ein: clientCompanyEin
                }
            });
            if(!clientCompany){
                throw new Error(`Failed to find client company with EIN:${clientCompany} in the database!`);
            };

            const articles = await this.prisma.article.findMany({
                where:{clientCompanyId: clientCompany.id},
                select:{
                    code: true,
                    name: true,
                    vat: true,
                    unitOfMeasure: true,
                    type: true,
                }
            });

            const management = await this.prisma.management.findMany({
                where:{
                    clientCompanyId: clientCompany.id
                },
                select:{
                    code: true,
                    name: true,
                    vatRate: true,
                    type: true
                }
            });

            const promptWithData = this.prompt
            .replace('{{EXISTING_ARTICLES}}', JSON.stringify(articles))
            .replace('{{MANAGEMENT_RECORDS}}', JSON.stringify(management))
            .replace('{{CURRENT_COMPANY_EIN}}', JSON.stringify(clientCompanyEin));


            const result = await this.model.generateContent([
                { text: promptWithData },
                {
                    inlineData: {
                        mimeType: "application/pdf",
                        data: fileBase64,
                    },
                },
            ]);

            const rawResponse = result.response.text();

            let jsonStr = rawResponse;
            if(jsonStr.startsWith('```json'))
            {
                jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
            }
            else if(jsonStr.startsWith('```'))
            {
                jsonStr = jsonStr.substring(3, jsonStr.length - 3).trim();
            }
            const extractedJsonData = JSON.parse(jsonStr);

            this.validateExtractedData(extractedJsonData, articles, management);
            
            return extractedJsonData;
        }
        catch(e)
        {
            this.logger.error(`Error extracting data for EIN ${clientCompanyEin}: ${e.message}`, e.stack);
            throw new Error(`Failed to extract data from document: ${e.message}`);
        }
    }

    private validateExtractedData(data:any, existingArticles: any[], managementRecords: any[]){
        if(!data || typeof data !== 'object'){
            throw new Error('Invalid extracted data format')
        }

        if(data.line_items && Array.isArray(data.line_items)){
            data.line_items.forEach((item: any, index: number)=>{
                if(!item.isNew){
                    const matchedArticle = existingArticles.find(
                        (a) => a.code === item.articleCode || a.name.toLowerCase() === item.name?.toLowerCase(),
                    );
                    if(!matchedArticle){
                        this.logger.warn(`No matching article found for line item ${index}, marking as new`);
                        item.isNew = true;
                        item.type = item.type || 'MARFURI';
                        item.vat = item.vat || 'NINETEEN';
                        item.um = item.um || 'BUCATA';
                    }else{
                        item.type = matchedArticle.type;
                        item.articleCode = matchedArticle.code;
                        item.name = matchedArticle.name;
                        item.vat = matchedArticle.vat;
                        item.um = matchedArticle.unitOfMeasure;
                    }
                }
            });

            data.vat_amount = data.line_items.reduce((sum: number, item: any)=>{
                return sum + (item.vat_amount * item.quantity || 0);
            },0);
        }
    }
}

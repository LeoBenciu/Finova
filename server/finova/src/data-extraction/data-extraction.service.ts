import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerativeModel, GoogleGenerativeAI, ChatSession } from '@google/generative-ai';

const GEMINI_MODEL = "gemini-2.0-flash";

@Injectable()
export class DataExtractionService {
    private readonly googleAi:GoogleGenerativeAI;
    private readonly model: GenerativeModel;
    private readonly prompt:string;
    private readonly logger = new Logger(DataExtractionService.name);

    constructor(config: ConfigService){
            const geminiApiKey = config.get('GOOGLE_GEMINI_API_KEY');
            this.googleAi = new GoogleGenerativeAI(geminiApiKey);
            this.model = this.googleAi.getGenerativeModel({ model: GEMINI_MODEL });
            this.prompt = `You are a bookkeeping data extraction assistant. When you receive text from a scanned document, your task is to extract the relevant bookkeeping details and output them as a JSON object. The scanned document may be an invoice, receipt, or another type of bookkeeping document. Please extract the following fields when available:
            document_type: Choose between Invoice/Receipt if something else set to null.
            vendor: The name of the vendor or service provider.
            vendor_ein: The Unique identifier of the vendor company(Just the number without any RO in front of it).
            buyer: The name of the buyer.
            buyer_ein: The Unique identifier of the buyer company(Just the number without any RO in front of it).
            document_number: The unique identifier for the document (this could be an invoice number, receipt number, etc.).
            document_date: The date the document was issued (format: DD-MM-YYYY).
            due_date: The payment due date (if applicable, format: DD-MM-YYYY).
            total_amount: The total amount charged or paid.
            vat_amount: Calculate the total VAT by summing the VAT from each line item.
            receipt_of: The invoice for which the receipt was made.
            line_items: An array of items, if applicable. Each item should include:
                -description: A short description of the item or service.
                -quantity: The number of units.
                -unit_price: The price per unit.
                -vat_amount: The vat(TVA) per unit.
                -total: The total amount for that line item.
            If any field is not present or not applicable, set its value to null.
            Return only a valid JSON object containing these keys with no additional commentary or text.
            `;

        }

    async extractData(fileBase64: string){
        try
        {
            const chat = this.model.startChat();
            const result = await chat.sendMessage([
                { text: this.prompt },
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

            
            return extractedJsonData;
        }
        catch(e)
        {
            this.logger.error("Error sending request to Gemini API:", e);
            throw new Error("Failed to extract data from document.");
        }
    }

}

import sys
import warnings
import base64
import os
import json
import csv
import logging
from crew import FirstCrewFinova
from typing import Dict, Any
import tempfile
from io import StringIO
from contextlib import redirect_stdout, redirect_stderr

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")

def extract_json_from_text(text: str) -> dict:
    """Extract JSON from text that might contain other content."""
    if not text:
        return {}
    
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    import re
    
    def find_json_objects(text):
        results = []
        brace_count = 0
        start_idx = -1
        
        for i, char in enumerate(text):
            if char == '{':
                if brace_count == 0:
                    start_idx = i
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0 and start_idx != -1:
                    try:
                        json_str = text[start_idx:i+1]
                        json_obj = json.loads(json_str)
                        results.append(json_obj)
                    except json.JSONDecodeError:
                        pass
                    start_idx = -1
        
        return results
    
    json_objects = find_json_objects(text)
    
    if json_objects:
        json_objects.sort(key=lambda x: len(str(x)), reverse=True)
        return json_objects[0]
    
    if "document_type" in text.lower() or "vendor" in text.lower():
        result = {}
        patterns = [
            (r'"document_type"\s*:\s*"([^"]+)"', 'document_type'),
            (r'"direction"\s*:\s*"([^"]+)"', 'direction'),
            (r'"vendor"\s*:\s*"([^"]+)"', 'vendor'),
            (r'"vendor_ein"\s*:\s*"([^"]+)"', 'vendor_ein'),
            (r'"buyer"\s*:\s*"([^"]+)"', 'buyer'),
            (r'"buyer_ein"\s*:\s*"([^"]+)"', 'buyer_ein'),
        ]
        
        for pattern, key in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                result[key] = match.group(1)
        
        if result:
            logging.info(f"Extracted structured data using patterns: {result}")
            return result
    
    return {}


def get_existing_articles() -> Dict:
    articles = {}
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        articles_path = os.path.join(script_dir, "articles.csv")
        
        if not os.path.exists(articles_path):
            articles_path = "articles.csv"
        
        with open(articles_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                articles[row["code"]] = {
                    "name": row["name"],
                    "vat": row["vat"],
                    "unitOfMeasure": row["unitOfMeasure"],
                    "type": row["type"]
                }
    except FileNotFoundError:
        logging.warning("articles.csv not found, using empty articles")
        return {}
    except Exception as e:
        logging.error(f"Error reading articles.csv: {str(e)}")
        return {}
    return articles

def save_temp_file(base64_data: str) -> str:
    """Save base64 data to a temporary file and return the path."""
    try:
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.pdf', delete=False) as temp_file:
            temp_file.write(base64.b64decode(base64_data))
            return temp_file.name
    except Exception as e:
        logging.error(f"Error saving temporary file: {str(e)}")
        raise

def process_single_document(doc_path: str, client_company_ein: str) -> Dict[str, Any]:
    """Process a single document and return extraction results."""
    
    existing_articles = get_existing_articles()
    management_records = {"Depozit Central": {}, "Servicii": {}}
    
    try:
        crew = FirstCrewFinova(client_company_ein, existing_articles, management_records).crew()
        
        logging.info(f"Processing document: {doc_path}")
        
        inputs = {
            "document_path": doc_path,
            "client_company_ein": client_company_ein,
            "vendor_labels": ["Furnizor", "Vânzător", "Emitent", "Societate emitentă", "Prestator", "Societate"],
            "buyer_labels": ["Cumpărător", "Client", "Beneficiar", "Achizitor", "Societate client"],
            "incoming_types": ["Nedefinit", "Marfuri", "Materii prime", "Materiale auxiliare", "Ambalaje", "Obiecte de inventar", "Amenajari provizorii", "Mat. spre prelucrare", "Mat. in pastrare/consig.", "Discount financiar intrari", "Combustibili", "Piese de schimb", "Alte mat. consumabile", "Discount comercial intrari", "Ambalaje SGR"],
            "outgoing_types": ["Nedefinit", "Marfuri", "Produse finite", "Ambalaje", "Produse reziduale", "Semifabricate", "Discount financiar iesiri", "Servicii vandute", "Discount comercial iesiri", "Ambalaje SGR", "Taxa verde"],
            "vat_rates": ["NINETEEN", "NINE", "FIVE", "ZERO"],
            "units_of_measure": ["BUCATA", "KILOGRAM", "LITRU", "METRU", "GRAM", "CUTIE", "PACHET", "PUNGA", "SET", "METRU_PATRAT", "METRU_CUB", "MILIMETRU", "CENTIMETRU", "TONA", "PERECHE", "SAC", "MILILITRU", "KILOWATT_ORA", "MINUT", "ORA", "ZI_DE_LUCRU", "LUNI_DE_LUCRU", "DOZA", "UNITATE_DE_SERVICE", "O_MIE_DE_BUCATI", "TRIMESTRU", "PROCENT", "KILOMETRU", "LADA", "DRY_TONE", "CENTIMETRU_PATRAT", "MEGAWATI_ORA", "ROLA", "TAMBUR", "SAC_PLASTIC", "PALET_LEMN", "UNITATE", "TONA_NETA", "HECTOMETRU_PATRAT", "FOAIE"],
            "existing_articles": existing_articles,
            "management_records": management_records,
            "doc_type": "Unknown" 
        }
        
        captured_output = StringIO()
        
        with redirect_stdout(captured_output), redirect_stderr(captured_output):
            result = crew.kickoff(inputs=inputs)
        
        combined_data = {
            "document_type": "Unknown",
            "direction": None,
            "line_items": []
        }
        
        if hasattr(result, 'tasks_output') and result.tasks_output and len(result.tasks_output) > 0:
            logging.info(f"Number of tasks completed: {len(result.tasks_output)}")
            
            if result.tasks_output[0] and hasattr(result.tasks_output[0], 'raw') and result.tasks_output[0].raw:
                logging.info(f"Task 0 raw output: {result.tasks_output[0].raw[:500]}...")  # Log first 500 chars
                categorization_data = extract_json_from_text(result.tasks_output[0].raw)
                if categorization_data:
                    combined_data.update(categorization_data)
                    logging.info(f"Document categorized as: {categorization_data.get('document_type', 'Unknown')}")
            
            if combined_data.get('document_type', '').lower() == 'invoice':
                if len(result.tasks_output) > 1:
                    if result.tasks_output[1] and hasattr(result.tasks_output[1], 'raw') and result.tasks_output[1].raw:
                        logging.info(f"Task 1 raw output length: {len(result.tasks_output[1].raw)}")
                        logging.info(f"Task 1 raw output: {result.tasks_output[1].raw[:1000]}...")  # Log first 1000 chars
                        extraction_data = extract_json_from_text(result.tasks_output[1].raw)
                        if extraction_data:
                            combined_data.update(extraction_data)
                            logging.info(f"Invoice data extracted successfully: {list(extraction_data.keys())}")
                        else:
                            logging.error(f"Failed to extract invoice data from: {result.tasks_output[1].raw[:500]}...")
                    else:
                        logging.error("Task 1 has no raw output")
                else:
                    logging.error("No second task output for invoice extraction")
            
            elif combined_data.get('document_type', '').lower() in ['receipt', 'chitanță']:
                if len(result.tasks_output) > 2 and result.tasks_output[2] and hasattr(result.tasks_output[2], 'raw') and result.tasks_output[2].raw:
                    receipt_data = extract_json_from_text(result.tasks_output[2].raw)
                    if receipt_data:
                        combined_data.update(receipt_data)
                        logging.info("Receipt data extracted successfully")
                    else:
                        logging.info("Receipt identified but minimal data extracted")
        
        if combined_data.get('document_type', '').lower() != 'invoice':
            invoice_fields = ['vendor_ein', 'buyer_ein', 'direction', 'line_items', 'vat_amount']
            for field in invoice_fields:
                if field in combined_data and not combined_data.get(field):
                    combined_data.pop(field, None)
        
        return {
            "data": combined_data
        }
    except Exception as e:
        logging.error(f"Failed to process {doc_path}: {str(e)}", exc_info=True)
        
        error_message = str(e)
        if "LLM" in error_message or "OpenAI" in error_message or "API" in error_message:
            return {"error": "LLM configuration error. Please check OpenAI API key or set TEST_MODE=true.", "details": error_message}
        
        return {"error": f"Failed to process: {str(e)}"}
    finally:
        if os.path.exists(doc_path):
            try:
                os.remove(doc_path)
            except Exception as e:
                logging.warning(f"Failed to remove temporary file: {str(e)}")

def read_base64_from_file(file_path: str) -> str:
    """Read base64 data from a file."""
    try:
        with open(file_path, 'r') as f:
            return f.read().strip()
    except Exception as e:
        logging.error(f"Error reading base64 file: {str(e)}")
        raise

if __name__ == "__main__":
    try:
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Usage: python main.py <client_company_ein> <base64_file_data_or_file_path>"}))
            sys.exit(1)
        
        client_company_ein = sys.argv[1]
        base64_input = sys.argv[2]
        
        if os.path.exists(base64_input) and os.path.isfile(base64_input):
            base64_data = read_base64_from_file(base64_input)
        else:
            base64_data = base64_input
        
        temp_file_path = save_temp_file(base64_data)
        
        result = process_single_document(temp_file_path, client_company_ein)
        
        print(json.dumps(result))
        
    except Exception as e:
        logging.error(f"Unhandled error: {str(e)}", exc_info=True)
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
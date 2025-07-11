import sys
import warnings
import base64
import os
import json
import csv
import logging
from typing import Dict, Any
import tempfile
from io import StringIO
from contextlib import redirect_stdout, redirect_stderr
from crew import FirstCrewFinova

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")

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

def extract_json_from_text(text: str) -> dict:
    """Extract JSON from text that might contain other content."""
    if not text:
        return {}
    
    import re
    text = re.sub(r'\x1b\[[0-9;]*m', '', text)
    text = text.strip()
    
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
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
        json_objects.sort(key=lambda x: len(x.keys()), reverse=True)
        return json_objects[0]
    
    json_in_code = re.search(r'```(?:json)?\s*(\{[^`]+\})\s*```', text, re.DOTALL)
    if json_in_code:
        try:
            return json.loads(json_in_code.group(1))
        except json.JSONDecodeError:
            pass
    
    if "document_type" in text.lower() or "vendor" in text.lower():
        result = {}
        patterns = [
            (r'"document_type"\s*:\s*"([^"]+)"', 'document_type'),
            (r'"direction"\s*:\s*"([^"]+)"', 'direction'),
            (r'"vendor"\s*:\s*"([^"]+)"', 'vendor'),
            (r'"vendor_ein"\s*:\s*"([^"]+)"', 'vendor_ein'),
            (r'"buyer"\s*:\s*"([^"]+)"', 'buyer'),
            (r'"buyer_ein"\s*:\s*"([^"]+)"', 'buyer_ein'),
            (r'"company_name"\s*:\s*"([^"]+)"', 'company_name'),
            (r'"company_ein"\s*:\s*"([^"]+)"', 'company_ein'),
        ]
        
        for pattern, key in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                result[key] = match.group(1)
        
        if result:
            logging.info(f"Extracted structured data using patterns: {result}")
            return result
    
    logging.warning(f"Could not extract JSON from text: {text[:200]}...")
    return {}

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
            "line_items": []
        }
        
        if hasattr(result, 'tasks_output') and result.tasks_output:
            logging.info(f"Number of tasks completed: {len(result.tasks_output)}")
            
            for i, task_output in enumerate(result.tasks_output):
                if task_output and hasattr(task_output, 'raw') and task_output.raw:
                    logging.info(f"Task {i} has output of length: {len(task_output.raw)}")
                    
                    if i == 0:
                        logging.info(f"Task 0 (categorization) raw output: {task_output.raw[:500]}...")
                        categorization_data = extract_json_from_text(task_output.raw)
                        if categorization_data:
                            combined_data.update(categorization_data)
                            doc_type = categorization_data.get('document_type', 'Unknown')
                            logging.info(f"Document categorized as: {doc_type}")
                            inputs['doc_type'] = doc_type
                    
                    elif i == 1 and combined_data.get('document_type', '').lower() == 'invoice':
                        logging.info(f"Task 1 (invoice extraction) raw output: {task_output.raw[:1000]}...")
                        extraction_data = extract_json_from_text(task_output.raw)
                        if extraction_data:
                            combined_data.update(extraction_data)
                            logging.info(f"Invoice data extracted. Keys: {list(extraction_data.keys())}")
                        else:
                            logging.error("Failed to extract invoice data")
                    
                    elif i == 2:
                        doc_type = combined_data.get('document_type') or ''
                        if doc_type.lower() != 'invoice' and doc_type.lower() != '':
                            logging.info(f"Task 2 (other doc extraction) raw output: {task_output.raw[:1000]}...")
                            other_data = extract_json_from_text(task_output.raw)
                            if other_data:
                                combined_data.update(other_data)
                                logging.info(f"Other document data extracted. Keys: {list(other_data.keys())}")
                            else:
                                logging.error(f"Failed to extract data for {combined_data.get('document_type')} document")
                else:
                    logging.warning(f"Task {i} has no output")
        else:
            logging.error("No tasks output found in result")
        
        doc_type = (combined_data.get('document_type') or '').lower()
        
        if doc_type != 'invoice':
            invoice_only_fields = ['vendor_ein', 'buyer_ein', 'direction', 'vat_amount']
            for field in invoice_only_fields:
                if field in combined_data and not combined_data.get(field):
                    combined_data.pop(field, None)
        
        if doc_type == 'invoice' and 'line_items' not in combined_data:
            combined_data['line_items'] = []
            logging.warning("No line_items found for invoice, setting empty array")
        
        if doc_type == 'bank statement' and 'transactions' not in combined_data:
            combined_data['transactions'] = []
            logging.warning("No transactions found for bank statement, setting empty array")
        
        return {
            "data": combined_data
        }
    except Exception as e:
        logging.error(f"Failed to process {doc_path}: {str(e)}", exc_info=True)
        
        error_message = str(e)
        if "LLM" in error_message or "OpenAI" in error_message or "API" in error_message:
            return {"error": "LLM configuration error. Please check OpenAI API key.", "details": error_message}
        
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
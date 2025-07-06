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
        
        categorization = {}
        extracted_data = {}
        
        if hasattr(result, 'tasks_output') and result.tasks_output and len(result.tasks_output) > 0:
            if result.tasks_output[0].raw:
                try:
                    categorization = json.loads(result.tasks_output[0].raw)
                except json.JSONDecodeError:
                    raw_output = result.tasks_output[0].raw
                    if isinstance(raw_output, str):
                        import re
                        json_match = re.search(r'\{[^}]+\}', raw_output)
                        if json_match:
                            try:
                                categorization = json.loads(json_match.group())
                            except:
                                categorization = {"document_type": "Unknown", "error": "Failed to parse output"}
                    else:
                        categorization = {"document_type": "Unknown", "error": "Invalid output format"}
            
            if len(result.tasks_output) > 1 and result.tasks_output[1].raw:
                try:
                    extracted_data = json.loads(result.tasks_output[1].raw)
                except json.JSONDecodeError:
                    extracted_data = {"error": "Failed to parse extraction data"}
        
        combined_data = {**categorization, **extracted_data} if categorization or extracted_data else {"error": "No data extracted", "crew_failed": True}
        
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
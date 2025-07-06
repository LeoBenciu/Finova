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
        
        result = crew.kickoff(inputs={"document_path": doc_path})
        
        categorization = {}
        extracted_data = {}
        
        if result.tasks_output and len(result.tasks_output) > 0:
            if result.tasks_output[0].raw:
                try:
                    categorization = json.loads(result.tasks_output[0].raw)
                except json.JSONDecodeError:
                    logging.error(f"Failed to parse categorization: {result.tasks_output[0].raw}")
            
            if len(result.tasks_output) > 1 and result.tasks_output[1].raw:
                try:
                    extracted_data = json.loads(result.tasks_output[1].raw)
                except json.JSONDecodeError:
                    logging.error(f"Failed to parse extracted data: {result.tasks_output[1].raw}")
        
        combined_data = {**categorization, **extracted_data} if categorization or extracted_data else {"error": "No data extracted"}
        
        return {
            "data": combined_data
        }
    except Exception as e:
        logging.error(f"Failed to process {doc_path}: {str(e)}", exc_info=True)
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
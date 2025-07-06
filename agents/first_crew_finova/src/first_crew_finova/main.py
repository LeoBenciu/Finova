import sys
import warnings
import base64
import os
import json
import csv
import logging
from crew import FirstCrewFinova
from typing import Dict, Any

logging.basicConfig(filename='processing.log', level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")

def get_existing_articles() -> Dict:
    articles = {}
    try:
        with open("articles.csv", "r", encoding="utf-8") as f:
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
    return articles

def save_temp_file(base64_data: str) -> str:
    temp_dir = "temp"
    os.makedirs(temp_dir, exist_ok=True)
    temp_file_path = os.path.join(temp_dir, f"temp_{os.urandom(8).hex()}.pdf")
    with open(temp_file_path, "wb") as f:
        f.write(base64.b64decode(base64_data))
    return temp_file_path

def process_single_document(doc_path: str, client_company_ein: str) -> Dict[str, Any]:
    existing_articles = get_existing_articles()
    management_records = {"Depozit Central": {}, "Servicii": {}}
    crew = FirstCrewFinova(client_company_ein, existing_articles, management_records).crew()
    try:
        logging.info(f"Processing document: {doc_path}")
        result = crew.kickoff(inputs={"document_path": doc_path})
        categorization = json.loads(result.tasks_output[0].raw) if result.tasks_output and result.tasks_output[0].raw else {}
        extracted_data = json.loads(result.tasks_output[1].raw) if result.tasks_output and len(result.tasks_output) > 1 and result.tasks_output[1].raw else {}
        return {
            "document": doc_path,
            "data": {**categorization, **extracted_data} if categorization or extracted_data else {"error": "No data extracted"}
        }
    except Exception as e:
        logging.error(f"Failed to process {doc_path}: {str(e)}")
        return {"document": doc_path, "error": f"Failed to process: {str(e)}"}
    finally:
        if os.path.exists(doc_path):
            os.remove(doc_path)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python main.py <client_company_ein> <base64_file_data>"}))
        sys.exit(1)
    
    client_company_ein = sys.argv[1]
    base64_data = sys.argv[2]
    
    temp_file_path = save_temp_file(base64_data)
    result = process_single_document(temp_file_path, client_company_ein)
    print(json.dumps(result))
import sys
import warnings
import base64
import os
import json
import csv
import logging
import gc
import tempfile
import tracemalloc
import traceback
from typing import Dict, Any, Optional
from io import StringIO
from contextlib import redirect_stdout, redirect_stderr
from crew import FirstCrewFinova

logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

def test_openai_connection():
    """Test direct OpenAI connection to verify API key."""
    try:
        import openai
        api_key = os.getenv('OPENAI_API_KEY')
        
        if not api_key:
            logging.error("No OpenAI API key found")
            return False
            
        logging.info(f"Testing OpenAI API key (length: {len(api_key)}, prefix: {api_key[:10]}...)")
        
        client = openai.OpenAI(api_key=api_key)
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Say 'API key works'"}],
            max_tokens=10
        )
        
        logging.info(f"OpenAI API test successful: {response.choices[0].message.content}")
        return True
    except Exception as e:
        logging.error(f"OpenAI API test failed: {str(e)}")
        logging.error(f"Error type: {type(e).__name__}")
        return False

def check_llm_configuration():
    """Check if LLM is properly configured"""
    openai_api_key = os.getenv('OPENAI_API_KEY')
    anthropic_api_key = os.getenv('ANTHROPIC_API_KEY')
    
    if not openai_api_key and not anthropic_api_key:
        logging.error("No LLM API key found. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.")
        return False
    
    if openai_api_key:
        logging.info("OpenAI API key found - using OpenAI models")
        # Test the API key
        if test_openai_connection():
            logging.info("OpenAI API key verified and working")
            return True
        else:
            logging.error("OpenAI API key validation failed")
            return False
    elif anthropic_api_key:
        logging.info("Anthropic API key found - using Claude models")
        return True
    
    return False

def setup_memory_monitoring():
    """Setup memory monitoring if available."""
    try:
        tracemalloc.start()
        return True
    except Exception:
        return False

def log_memory_usage(label: str):
    """Log current memory usage."""
    try:
        import psutil
        process = psutil.Process(os.getpid())
        memory_info = process.memory_info()
        logging.info(f"{label} - Memory: RSS={memory_info.rss // 1024 // 1024}MB, VMS={memory_info.vms // 1024 // 1024}MB")
        
        if tracemalloc.is_tracing():
            current, peak = tracemalloc.get_traced_memory()
            logging.info(f"{label} - Traced: Current={current // 1024 // 1024}MB, Peak={peak // 1024 // 1024}MB")
    except ImportError:
        pass
    except Exception as e:
        logging.debug(f"Memory logging failed: {e}")

def cleanup_memory():
    """Force garbage collection and cleanup."""
    try:
        collected = gc.collect()
        logging.debug(f"Garbage collected {collected} objects")
        
        if tracemalloc.is_tracing():
            tracemalloc.clear_traces()
            
    except Exception as e:
        logging.debug(f"Memory cleanup failed: {e}")

def get_existing_articles() -> Dict:
    """Load existing articles with error handling and memory optimization."""
    articles = {}
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        articles_path = os.path.join(script_dir, "articles.csv")
        
        if not os.path.exists(articles_path):
            articles_path = "articles.csv"
        
        if not os.path.exists(articles_path):
            logging.warning("articles.csv not found, using empty articles")
            return {}
            
        with open(articles_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                articles[row["code"]] = {
                    "name": row["name"],
                    "vat": row["vat"],
                    "unitOfMeasure": row["unitOfMeasure"],
                    "type": row["type"]
                }
                
        logging.info(f"Loaded {len(articles)} articles")
        
    except Exception as e:
        logging.error(f"Error reading articles.csv: {str(e)}")
        return {}
    
    return articles

def save_temp_file(base64_data: str) -> str:
    """Save base64 data to a temporary file with error handling."""
    try:
        if not base64_data:
            raise ValueError("Empty base64 data")
            
        estimated_size = len(base64_data) * 3 // 4
        max_size = 50 * 1024 * 1024
        
        if estimated_size > max_size:
            raise ValueError(f"File too large: {estimated_size // 1024 // 1024}MB > {max_size // 1024 // 1024}MB")
        
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.pdf', delete=False) as temp_file:
            chunk_size = 1024 * 1024 
            for i in range(0, len(base64_data), chunk_size):
                chunk = base64_data[i:i + chunk_size]
                decoded_chunk = base64.b64decode(chunk)
                temp_file.write(decoded_chunk)
                
            temp_path = temp_file.name
            
        logging.info(f"Saved temporary file: {temp_path} ({estimated_size // 1024}KB)")
        return temp_path
        
    except Exception as e:
        logging.error(f"Error saving temporary file: {str(e)}")
        raise

def extract_json_from_text(text: str) -> dict:
    """Extract JSON from text with optimized parsing."""
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
                        if len(results) >= 5:
                            break
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
    
    if any(keyword in text.lower() for keyword in ["document_type", "vendor", "buyer", "company"]):
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
            logging.info(f"Extracted structured data using patterns: {list(result.keys())}")
            return result
    
    logging.warning(f"Could not extract JSON from text (length: {len(text)})")
    return {}

def process_single_document(doc_path: str, client_company_ein: str) -> Dict[str, Any]:
    """Process a single document with memory optimization."""
    log_memory_usage("Before processing")
    
    try:
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            return {
                "error": "OPENAI_API_KEY environment variable not found",
                "details": "Please set the OPENAI_API_KEY environment variable"
            }
        
        logging.info(f"API Key info - Length: {len(api_key)}, Starts with 'sk-': {api_key.startswith('sk-')}")
        
        try:
            import openai
            client = openai.OpenAI(api_key=api_key)
            test_response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": "test"}],
                max_tokens=5
            )
            logging.info("Direct OpenAI API test passed")
        except Exception as e:
            logging.error(f"Direct OpenAI API test failed: {str(e)}")
            error_msg = str(e).lower()
            if "authentication" in error_msg or "api key" in error_msg or "unauthorized" in error_msg:
                return {
                    "error": "OpenAI API key is invalid or expired. Please check your API key.",
                    "details": str(e)
                }
            elif "rate limit" in error_msg:
                return {
                    "error": "OpenAI API rate limit exceeded. Please try again later.",
                    "details": str(e)
                }
            else:
                return {
                    "error": f"OpenAI API error: {str(e)}",
                    "details": str(e)
                }
        
        if not check_llm_configuration():
            return {
                "error": "LLM service not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.",
                "details": "No valid LLM API key found in environment variables"
            }
        
        existing_articles = get_existing_articles()
        management_records = {"Depozit Central": {}, "Servicii": {}}
        
        log_memory_usage("After loading config")
        
        try:
            logging.info("Creating FirstCrewFinova instance...")
            crew_instance = FirstCrewFinova(client_company_ein, existing_articles, management_records)
            logging.info("FirstCrewFinova instance created successfully")
            
            if not hasattr(crew_instance, 'llm'):
                logging.error("crew_instance doesn't have 'llm' attribute")
                return {
                    "error": "CrewAI initialization error: missing llm attribute",
                    "details": "The crew instance was created but LLM is not properly configured"
                }
            
            if crew_instance.llm is None:
                logging.error("crew_instance.llm is None")
                
                try:
                    from crewai import LLM
                    crew_instance.llm = LLM(
                        model="gpt-4o-mini",
                        temperature=0.3,
                        max_tokens=4000,
                        api_key=api_key
                    )
                    logging.info("Manually initialized LLM for crew_instance")
                except Exception as llm_e:
                    logging.error(f"Failed to manually initialize LLM: {str(llm_e)}")
                    return {
                        "error": "Failed to configure LLM for CrewAI agents",
                        "details": str(llm_e)
                    }
            
        except Exception as e:
            logging.error(f"Failed to create CrewAI instance: {str(e)}")
            logging.error(f"Exception type: {type(e).__name__}")
            logging.error(f"Traceback: {traceback.format_exc()}")
            
            if isinstance(e, ImportError):
                return {
                    "error": "CrewAI import error. Please ensure all dependencies are installed.",
                    "details": str(e)
                }
            
            return {
                "error": "Failed to initialize CrewAI. Check logs for details.",
                "details": str(e)
            }
        
        try:
            crew = crew_instance.crew()
            logging.info("Crew created successfully")
        except Exception as e:
            logging.error(f"Failed to create crew: {str(e)}")
            return {
                "error": "Failed to create CrewAI crew",
                "details": str(e)
            }
        
        log_memory_usage("After crew creation")
        
        logging.info(f"Processing document: {os.path.basename(doc_path)}")
        
        inputs = {
            "document_path": doc_path,
            "client_company_ein": client_company_ein,
            "vendor_labels": ["Furnizor", "Vânzător", "Emitent", "Societate emitentă", "Prestator", "Societate"],
            "buyer_labels": ["Cumpărător", "Client", "Beneficiar", "Achizitor", "Societate client", "Destinatar"],
            "incoming_types": ["Nedefinit", "Marfuri", "Materii prime", "Materiale auxiliare", "Ambalaje", "Obiecte de inventar", "Amenajari provizorii", "Mat. spre prelucrare", "Mat. in pastrare/consig.", "Discount financiar intrari", "Combustibili", "Piese de schimb", "Alte mat. consumabile", "Discount comercial intrari", "Ambalaje SGR"],
            "outgoing_types": ["Nedefinit", "Marfuri", "Produse finite", "Ambalaje", "Produse reziduale", "Semifabricate", "Discount financiar iesiri", "Servicii vandute", "Discount comercial iesiri", "Ambalaje SGR", "Taxa verde"],
            "vat_rates": ["NINETEEN", "NINE", "FIVE", "ZERO"],
            "units_of_measure": ["BUCATA", "KILOGRAM", "LITRU", "METRU", "GRAM", "CUTIE", "PACHET", "PUNGA", "SET", "METRU_PATRAT", "METRU_CUB", "MILIMETRU", "CENTIMETRU", "TONA", "PERECHE", "SAC", "MILILITRU", "KILOWATT_ORA", "MINUT", "ORA", "ZI_DE_LUCRU", "LUNI_DE_LUCRU", "DOZA", "UNITATE_DE_SERVICE", "O_MIE_DE_BUCATI", "TRIMESTRU", "PROCENT", "KILOMETRU", "LADA", "DRY_TONE", "CENTIMETRU_PATRAT", "MEGAWATI_ORA", "ROLA", "TAMBUR", "SAC_PLASTIC", "PALET_LEMN", "UNITATE", "TONA_NETA", "HECTOMETRU_PATRAT", "FOAIE"],
            "existing_articles": existing_articles,
            "management_records": management_records,
            "doc_type": "Unknown"  
        }
        
        log_memory_usage("Before crew kickoff")
        
        captured_output = StringIO()
        
        try:
            with redirect_stdout(captured_output), redirect_stderr(captured_output):
                result = crew.kickoff(inputs=inputs)
        except Exception as e:
            logging.error(f"Crew kickoff failed: {str(e)}")
            logging.error(f"Captured output: {captured_output.getvalue()}")
            return {
                "error": "Document processing failed during crew execution",
                "details": str(e)
            }
        
        log_memory_usage("After crew kickoff")
        
        combined_data = {
            "document_type": "Unknown",
            "line_items": []
        }
        
        if hasattr(result, 'tasks_output') and result.tasks_output:
            logging.info(f"Processing {len(result.tasks_output)} task outputs")
            
            for i, task_output in enumerate(result.tasks_output):
                try:
                    if task_output and hasattr(task_output, 'raw') and task_output.raw:
                        output_length = len(task_output.raw)
                        logging.info(f"Task {i} output length: {output_length}")
                        
                        if i == 0:
                            categorization_data = extract_json_from_text(task_output.raw)
                            if categorization_data:
                                combined_data.update(categorization_data)
                                doc_type = categorization_data.get('document_type', 'Unknown')
                                logging.info(f"Document categorized as: {doc_type}")
                                inputs['doc_type'] = doc_type
                        
                        elif i == 1 and combined_data.get('document_type', '').lower() == 'invoice':
                            extraction_data = extract_json_from_text(task_output.raw)
                            if extraction_data:
                                combined_data.update(extraction_data)
                                logging.info(f"Invoice data extracted with keys: {list(extraction_data.keys())}")
                        
                        elif i == 2: 
                            doc_type = combined_data.get('document_type', '').lower()
                            if doc_type != 'invoice' and doc_type:
                                other_data = extract_json_from_text(task_output.raw)
                                if other_data:
                                    combined_data.update(other_data)
                                    logging.info(f"Other document data extracted with keys: {list(other_data.keys())}")
                        
                        del task_output.raw
                        
                    else:
                        logging.warning(f"Task {i} has no output")
                        
                except Exception as e:
                    logging.error(f"Error processing task {i}: {str(e)}")
                    continue
        else:
            logging.error("No tasks output found in result")
        
        del crew
        del crew_instance
        del existing_articles
        del management_records
        
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
        
        log_memory_usage("After processing")
        
        return {
            "data": combined_data
        }
        
    except Exception as e:
        logging.error(f"Failed to process {doc_path}: {str(e)}", exc_info=True)
        
        error_message = str(e)
        if any(keyword in error_message.lower() for keyword in ["api", "key", "authentication", "unauthorized", "forbidden"]):
            return {"error": "LLM API authentication failed. Please check your API key.", "details": error_message}
        elif any(keyword in error_message for keyword in ["LLM", "OpenAI", "rate limit", "quota"]):
            return {"error": "LLM service error. Please check API configuration or try again later.", "details": error_message}
        elif "memory" in error_message.lower() or "killed" in error_message.lower():
            return {"error": "Memory limit exceeded. Please try with a smaller document.", "details": error_message}
        elif "timeout" in error_message.lower():
            return {"error": "Processing timeout. Please try with a simpler document.", "details": error_message}
        
        return {"error": f"Processing failed: {str(e)}"}
    
    finally:
        cleanup_memory()
        log_memory_usage("After cleanup")

def read_base64_from_file(file_path: str) -> str:
    """Read base64 data from file with error handling."""
    try:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Base64 file not found: {file_path}")
            
        file_size = os.path.getsize(file_path)
        max_size = 100 * 1024 * 1024 
        
        if file_size > max_size:
            raise ValueError(f"Base64 file too large: {file_size // 1024 // 1024}MB")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read().strip()
            
        if not content:
            raise ValueError("Empty base64 file")
            
        logging.info(f"Read base64 file: {file_path} ({file_size // 1024}KB)")
        return content
        
    except Exception as e:
        logging.error(f"Error reading base64 file: {str(e)}")
        raise

def main():
    """Main function with comprehensive error handling and memory management."""

    print(f"Python script started", file=sys.stderr)
    print(f"OPENAI_API_KEY exists: {bool(os.getenv('OPENAI_API_KEY'))}", file=sys.stderr)
    print(f"MODEL env var: {os.getenv('MODEL', 'NOT SET')}", file=sys.stderr)
    print(f"Current working directory: {os.getcwd()}", file=sys.stderr)

    memory_monitoring = setup_memory_monitoring()
    
    try:
        if len(sys.argv) < 3:
            result = {"error": "Usage: python main.py <client_company_ein> <base64_file_data_or_file_path>"}
            print(json.dumps(result, ensure_ascii=False))
            sys.exit(1)
        
        client_company_ein = sys.argv[1].strip()
        base64_input = sys.argv[2].strip()
        
        if not client_company_ein:
            result = {"error": "Client company EIN is required"}
            print(json.dumps(result, ensure_ascii=False))
            sys.exit(1)
        
        log_memory_usage("Startup")
        
        if os.path.exists(base64_input) and os.path.isfile(base64_input):
            base64_data = read_base64_from_file(base64_input)
        else:
            base64_data = base64_input
            
        if not base64_data:
            result = {"error": "No base64 data provided"}
            print(json.dumps(result, ensure_ascii=False))
            sys.exit(1)
        
        temp_file_path = save_temp_file(base64_data)
        
        try:
            result = process_single_document(temp_file_path, client_company_ein)
            
            print(json.dumps(result, ensure_ascii=False))
            
        finally:
            if os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                    logging.info(f"Cleaned up temporary file: {temp_file_path}")
                except Exception as e:
                    logging.warning(f"Failed to remove temporary file: {str(e)}")
        
    except KeyboardInterrupt:
        logging.info("Processing interrupted by user")
        print(json.dumps({"error": "Processing interrupted"}))
        sys.exit(1)
        
    except Exception as e:
        logging.error(f"Unhandled error: {str(e)}", exc_info=True)
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)
        
    finally:
        cleanup_memory()
        
        if memory_monitoring and tracemalloc.is_tracing():
            tracemalloc.stop()
        
        log_memory_usage("Exit")

if __name__ == "__main__":
    main()
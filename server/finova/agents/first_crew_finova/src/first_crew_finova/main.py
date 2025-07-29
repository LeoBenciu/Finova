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
import hashlib
import time
from typing import Dict, Any, Optional, List
from io import StringIO
from contextlib import redirect_stdout, redirect_stderr
from datetime import datetime

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stderr)]
)

warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

try:
    from crew import FirstCrewFinova
    print("Successfully imported FirstCrewFinova", file=sys.stderr)
except Exception as e:
    print(f"ERROR: Failed to import FirstCrewFinova: {str(e)}", file=sys.stderr)
    print(f"Traceback: {traceback.format_exc()}", file=sys.stderr)
    sys.exit(1)

def validate_processed_data(data: dict, expected_doc_type: str = None) -> tuple[bool, list[str]]:
    """Validate that processed data contains minimum required fields."""
    errors = []
    
    if not data or not isinstance(data, dict):
        errors.append("Invalid data structure")
        return False, errors
    
    if not data.get('document_type'):
        errors.append("Missing document_type")
        return False, errors
    
    return True, errors

def create_fallback_response(doc_type: str = "Unknown") -> dict:
    """Create a minimal fallback response when processing fails."""
    return {
        "document_type": doc_type,
        "document_date": "",
        "line_items": [] if doc_type.lower() == 'invoice' else None,
        "transactions": [] if doc_type.lower() == 'bank statement' else None,
        "duplicate_detection": {
            "is_duplicate": False,
            "duplicate_matches": [],
            "document_hash": "",
            "confidence": 0.0
        },
        "compliance_validation": {
            "compliance_status": "PENDING",
            "overall_score": 0.0,
            "validation_rules": {"ro": [], "en": []},
            "errors": {"ro": ["Procesare incompletă - verificați manual"], "en": ["Incomplete processing - please verify manually"]},
            "warnings": {"ro": [], "en": []}
        },
        "confidence": 0.1,
        "processing_status": "FALLBACK"
    }

def test_openai_connection():
    """Test direct OpenAI connection to verify API key."""
    try:
        import openai
        api_key = os.getenv('OPENAI_API_KEY')
        
        if not api_key:
            print("ERROR: No OpenAI API key found in test_openai_connection", file=sys.stderr)
            return False
            
        print(f"Testing OpenAI API key (length: {len(api_key)}, prefix: {api_key[:10]}...)", file=sys.stderr)
        
        client = openai.OpenAI(api_key=api_key)
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Say 'API key works'"}],
            max_tokens=10,
            timeout=30
        )
        
        print(f"OpenAI API test successful: {response.choices[0].message.content}", file=sys.stderr)
        return True
    except Exception as e:
        print(f"ERROR: OpenAI API test failed: {str(e)}", file=sys.stderr)
        print(f"Error type: {type(e).__name__}", file=sys.stderr)
        return False

def check_llm_configuration():
    """Check if LLM is properly configured"""
    openai_api_key = os.getenv('OPENAI_API_KEY')
    anthropic_api_key = os.getenv('ANTHROPIC_API_KEY')
    
    if not openai_api_key and not anthropic_api_key:
        print("ERROR: No LLM API key found. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.", file=sys.stderr)
        return False
    
    if openai_api_key:
        print("OpenAI API key found - using OpenAI models", file=sys.stderr)
        if test_openai_connection():
            print("OpenAI API key verified and working", file=sys.stderr)
            return True
        else:
            print("ERROR: OpenAI API key validation failed", file=sys.stderr)
            return False
    elif anthropic_api_key:
        print("Anthropic API key found - using Claude models", file=sys.stderr)
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
        print(f"{label} - Memory: RSS={memory_info.rss // 1024 // 1024}MB, VMS={memory_info.vms // 1024 // 1024}MB", file=sys.stderr)
        
        if tracemalloc.is_tracing():
            current, peak = tracemalloc.get_traced_memory()
            print(f"{label} - Traced: Current={current // 1024 // 1024}MB, Peak={peak // 1024 // 1024}MB", file=sys.stderr)
    except ImportError:
        pass
    except Exception as e:
        print(f"Memory logging failed: {e}", file=sys.stderr)

def cleanup_memory():
    """Force garbage collection and cleanup."""
    try:
        collected = gc.collect()
        print(f"Garbage collected {collected} objects", file=sys.stderr)
        
        if tracemalloc.is_tracing():
            tracemalloc.clear_traces()
            
    except Exception as e:
        print(f"Memory cleanup failed: {e}", file=sys.stderr)

def get_existing_articles() -> Dict:
    """Load existing articles with error handling and memory optimization."""
    articles = {}
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        articles_path = os.path.join(script_dir, "articles.csv")
        
        if not os.path.exists(articles_path):
            articles_path = "articles.csv"
        
        if not os.path.exists(articles_path):
            print("WARNING: articles.csv not found, using empty articles", file=sys.stderr)
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
                
        print(f"Loaded {len(articles)} articles", file=sys.stderr)
        
    except Exception as e:
        print(f"ERROR: Error reading articles.csv: {str(e)}", file=sys.stderr)
        return {}
    
    return articles

def generate_document_hash(file_path: str) -> str:
    """Generate MD5 hash of document content."""
    try:
        with open(file_path, 'rb') as f:
            content = f.read()
            return hashlib.md5(content).hexdigest()
    except Exception as e:
        print(f"Failed to generate document hash: {str(e)}", file=sys.stderr)
        return ""

def load_user_corrections(client_company_ein: str) -> List[Dict]:
    """Load user corrections for learning (mock implementation - replace with actual DB call)."""
    return []

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
            
        print(f"Saved temporary file: {temp_path} ({estimated_size // 1024}KB)", file=sys.stderr)
        return temp_path
        
    except Exception as e:
        print(f"ERROR: Error saving temporary file: {str(e)}", file=sys.stderr)
        raise

def validate_compliance_output(result):
    """Validate and fix compliance data to ensure bilingual structure"""
    if not result or not isinstance(result, dict):
        return False
    
    compliance_data = result.get('compliance_validation')
    if not compliance_data:
        return True 
    
    if not isinstance(compliance_data, dict):
        return False
    
    if 'compliance_status' not in compliance_data:
        return False
    
    bilingual_fields = ['validation_rules', 'errors', 'warnings']
    
    for field in bilingual_fields:
        field_data = compliance_data.get(field)
        
        if field_data is None:
            compliance_data[field] = {'ro': [], 'en': []}
        elif isinstance(field_data, list):
            compliance_data[field] = {'ro': field_data, 'en': field_data}
            print(f"Converted legacy {field} format to bilingual", file=sys.stderr)
        elif isinstance(field_data, dict):
            if 'ro' not in field_data or 'en' not in field_data:
                ro_data = field_data.get('ro', [])
                en_data = field_data.get('en', [])
                compliance_data[field] = {
                    'ro': ro_data if isinstance(ro_data, list) else [],
                    'en': en_data if isinstance(en_data, list) else []
                }
                print(f"Fixed incomplete bilingual structure for {field}", file=sys.stderr)
        else:
            compliance_data[field] = {'ro': [], 'en': []}
            print(f"Reset invalid {field} format to empty bilingual structure", file=sys.stderr)
    
    if 'overall_score' in compliance_data:
        try:
            compliance_data['overall_score'] = float(compliance_data['overall_score'])
        except (ValueError, TypeError):
            print("Fixed invalid overall_score format", file=sys.stderr)
            compliance_data['overall_score'] = 0.0
    
    return True

def extract_json_from_text(text: str) -> dict:
    """Extract JSON from text with optimized parsing and compliance validation."""
    if not text:
        print("WARNING: extract_json_from_text received empty text", file=sys.stderr)
        return {}
    
    import re
    
    print(f"extract_json_from_text input (first 500 chars): {text[:500]}", file=sys.stderr)
    
    text = re.sub(r'\x1b\[[0-9;]*m', '', text) 
    text = text.strip()
    
    try:
        result = json.loads(text)
        print(f"Successfully parsed JSON directly. Keys: {list(result.keys())}", file=sys.stderr)
        if 'compliance_validation' in result:
            if not validate_compliance_output(result):
                print("WARNING: Invalid compliance validation format, attempting to fix...", file=sys.stderr)
                validate_compliance_output(result)
        return result
    except json.JSONDecodeError as e:
        print(f"Direct JSON parsing failed: {e}", file=sys.stderr)
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
                        print(f"Found JSON object with keys: {list(json_obj.keys())}", file=sys.stderr)
                        if len(results) >= 5:
                            break
                    except json.JSONDecodeError:
                        pass
                    start_idx = -1
        
        return results
    
    json_objects = find_json_objects(text)
    
    if json_objects:
        json_objects.sort(key=lambda x: len(x.keys()), reverse=True)
        result = json_objects[0]
        print(f"Using largest JSON object found. Keys: {list(result.keys())}", file=sys.stderr)
        if 'compliance_validation' in result:
            if not validate_compliance_output(result):
                print("WARNING: Invalid compliance validation format, attempting to fix...", file=sys.stderr)
                validate_compliance_output(result)
        return result
    
    json_in_code = re.search(r'```(?:json)?\s*(\{[^`]+\})\s*```', text, re.DOTALL)
    if json_in_code:
        try:
            result = json.loads(json_in_code.group(1))
            print(f"Extracted JSON from code block. Keys: {list(result.keys())}", file=sys.stderr)
            if 'compliance_validation' in result:
                if not validate_compliance_output(result):
                    print("WARNING: Invalid compliance validation format, attempting to fix...", file=sys.stderr)
                    validate_compliance_output(result)
            return result
        except json.JSONDecodeError:
            pass
    
    if any(keyword in text.lower() for keyword in ["document_type", "vendor", "buyer", "company", "compliance_validation", "document_number", "document_date", "total_amount"]):
        result = {}
        patterns = [
            (r'"document_type"\s*:\s*"([^"]+)"', 'document_type'),
            (r'"direction"\s*:\s*"([^"]+)"', 'direction'),
            (r'"document_number"\s*:\s*"([^"]+)"', 'document_number'),
            (r'"document_date"\s*:\s*"([^"]+)"', 'document_date'),
            (r'"vendor"\s*:\s*"([^"]+)"', 'vendor'),
            (r'"vendor_ein"\s*:\s*"([^"]+)"', 'vendor_ein'),
            (r'"buyer"\s*:\s*"([^"]+)"', 'buyer'),
            (r'"buyer_ein"\s*:\s*"([^"]+)"', 'buyer_ein'),
            (r'"total_amount"\s*:\s*([\d.]+)', 'total_amount'),
            (r'"vat_amount"\s*:\s*([\d.]+)', 'vat_amount'),
            (r'"currency"\s*:\s*"([^"]+)"', 'currency'),
            (r'"company_name"\s*:\s*"([^"]+)"', 'company_name'),
            (r'"company_ein"\s*:\s*"([^"]+)"', 'company_ein'),
        ]
        
        for pattern, key in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                value = match.group(1)
                if key in ['total_amount', 'vat_amount']:
                    try:
                        result[key] = float(value)
                    except ValueError:
                        result[key] = value
                else:
                    result[key] = value
        
        line_items_match = re.search(r'"line_items"\s*:\s*\[(.*?)\]', text, re.DOTALL | re.IGNORECASE)
        if line_items_match:
            try:
                line_items_str = '[' + line_items_match.group(1) + ']'
                result['line_items'] = json.loads(line_items_str)
                print(f"Extracted {len(result['line_items'])} line items", file=sys.stderr)
            except:
                result['line_items'] = []
        
        if 'compliance_validation' in text.lower():
            status_match = re.search(r'"compliance_status"\s*:\s*"([^"]+)"', text, re.IGNORECASE)
            if status_match:
                result['compliance_validation'] = {
                    'compliance_status': status_match.group(1),
                    'overall_score': 0.0,
                    'validation_rules': {'ro': [], 'en': []},
                    'errors': {'ro': [], 'en': []},
                    'warnings': {'ro': [], 'en': []}
                }
                print("Extracted basic compliance validation structure from patterns", file=sys.stderr)
        
        if result:
            print(f"Extracted structured data using patterns: {list(result.keys())}", file=sys.stderr)
            if 'compliance_validation' in result:
                if not validate_compliance_output(result):
                    print("WARNING: Invalid compliance validation format, attempting to fix...", file=sys.stderr)
                    validate_compliance_output(result)
            return result
    
    print(f"WARNING: Could not extract JSON from text (length: {len(text)})", file=sys.stderr)
    print(f"Text contains 'document_number': {'document_number' in text}", file=sys.stderr)
    print(f"Text contains 'document_date': {'document_date' in text}", file=sys.stderr)
    print(f"Text contains 'vendor': {'vendor' in text}", file=sys.stderr)
    print(f"Last 500 chars of text: {text[-500:]}", file=sys.stderr)
    
    return {}

def process_with_retry(crew_instance, inputs: dict, max_retries: int = 2) -> tuple[dict, bool]:
    """Process document with retry logic and validation."""
    for attempt in range(max_retries + 1):
        try:
            print(f"Processing attempt {attempt + 1}/{max_retries + 1}", file=sys.stderr)
            
            captured_output = StringIO()
            
            with redirect_stdout(captured_output), redirect_stderr(captured_output):
                if current_phase == 1:
                    doc_type = phase0_data.get('document_type', '').lower() if phase0_data else 'unknown'
                    crew_obj = crew_instance.crew()
                    
                    if doc_type == 'invoice':
                        crew_obj.tasks[0] = crew_instance.extract_invoice_data_task()
                        print(f"Using invoice extraction task for {doc_type}", file=sys.stderr)
                    else:
                        crew_obj.tasks[0] = crew_instance.extract_other_document_data_task()
                        print(f"Using other document extraction task for {doc_type}", file=sys.stderr)
                    
                    result = crew_obj.kickoff(inputs=inputs)
                else:
                    result = crew_instance.crew().kickoff(inputs=inputs)
            
            combined_data = {
                "document_type": "Unknown",
                "line_items": [],
                "document_hash": inputs.get("document_hash", ""),
                "duplicate_detection": {"is_duplicate": False, "duplicate_matches": []},
                "compliance_validation": {"compliance_status": "PENDING", "validation_rules": {"ro": [], "en": []}, "errors": {"ro": [], "en": []}, "warnings": {"ro": [], "en": []}}
            }
            
            if hasattr(result, 'tasks_output') and result.tasks_output:
                print(f"Processing {len(result.tasks_output)} task outputs", file=sys.stderr)

                current_phase = inputs.get('processing_phase', crew_instance.processing_phase)
                print(f"Current processing phase: {current_phase}", file=sys.stderr)

                for i, task_output in enumerate(result.tasks_output):
                    try:
                        if task_output and hasattr(task_output, 'raw') and task_output.raw:
                            output_length = len(task_output.raw)
                            print(f"Task {i} output length: {output_length}", file=sys.stderr)
                            print(f"🐍 DEBUG Task {i} first 200 chars: {task_output.raw[:200]}", file=sys.stderr)

                            if current_phase == 0:

                                if i == 0: 
                                    categorization_data = extract_json_from_text(task_output.raw)
                                    if categorization_data and isinstance(categorization_data, dict):
                                        combined_data.update(categorization_data)
                                        doc_type = categorization_data.get('document_type', 'Unknown')
                                        print(f"Document categorized as: {doc_type}", file=sys.stderr)
                                        inputs['doc_type'] = doc_type
                                    else:
                                        print(f"🐍 DEBUG: Task 0 extraction failed or empty", file=sys.stderr)

                            elif current_phase == 1:
                                if i == 0:
                                    doc_type = combined_data.get('document_type', inputs.get('doc_type', '')).lower()
                                    print(f"🐍 DEBUG: Processing Task {i} (Data extraction for {doc_type})", file=sys.stderr)
                                    print(f"🐍 DEBUG: Task {i} raw output: {task_output.raw}", file=sys.stderr)

                                    extraction_data = extract_json_from_text(task_output.raw)
                                    print(f"🐍 DEBUG: Task {i} extracted data: {extraction_data}", file=sys.stderr)

                                    if extraction_data and isinstance(extraction_data, dict):
                                        print(f"🐍 DEBUG: Task {i} extracted keys: {list(extraction_data.keys())}", file=sys.stderr)
                                        combined_data.update(extraction_data)
                                        print(f"Data extracted for {doc_type} with keys: {list(extraction_data.keys())}", file=sys.stderr)
                                    else:
                                        print(f"🐍 DEBUG: Task {i} extraction FAILED - no valid data returned", file=sys.stderr)

                                elif i == 1:
                                    print(f"🐍 DEBUG: Processing Task {i} (Duplicate detection)", file=sys.stderr)
                                    try:
                                        duplicate_data = extract_json_from_text(task_output.raw)
                                        if duplicate_data and isinstance(duplicate_data, dict):
                                            combined_data['duplicate_detection'] = duplicate_data
                                            print(f"Duplicate detection completed: {duplicate_data.get('is_duplicate', False)}", file=sys.stderr)
                                    except Exception as dup_error:
                                        print(f"ERROR: Duplicate detection processing failed: {str(dup_error)}", file=sys.stderr)

                                elif i == 2:
                                    print(f"🐍 DEBUG: Processing Task {i} (Compliance validation)", file=sys.stderr)
                                    try:
                                        compliance_data = extract_json_from_text(task_output.raw)
                                        if compliance_data and isinstance(compliance_data, dict):
                                            combined_data['compliance_validation'] = compliance_data
                                            print(f"Compliance validation completed: {compliance_data.get('compliance_status', 'PENDING')}", file=sys.stderr)
                                    except Exception as comp_error:
                                        print(f"ERROR: Compliance validation processing failed: {str(comp_error)}", file=sys.stderr)
                            else:
                                print(f"🐍 DEBUG: Task {i} has no output or empty raw data", file=sys.stderr)

                    except Exception as e:
                        print(f"ERROR: Error processing task {i}: {str(e)}", file=sys.stderr)
                        continue

            if current_phase == 1 and inputs.get('doc_type', '').lower() == 'invoice':
                combined_data['document_type'] = inputs.get('doc_type', '').lower()
                if inputs.get('direction'):
                    combined_data['direction'] = inputs.get('direction')
                
            is_valid, validation_errors = validate_processed_data(combined_data)
            
            if is_valid:
                print(f"Processing successful on attempt {attempt + 1}", file=sys.stderr)
                return combined_data, True
            else:
                print(f"Validation failed on attempt {attempt + 1}: {validation_errors}", file=sys.stderr)
                if attempt < max_retries:
                    print(f"Retrying processing (attempt {attempt + 2})", file=sys.stderr)
                    time.sleep(2)  
                    continue
                else:
                    print("Max retries reached, returning fallback response", file=sys.stderr)
                    fallback = create_fallback_response(combined_data.get('document_type', 'Unknown'))
                    if combined_data.get('document_type'):
                        fallback['document_type'] = combined_data['document_type']
                    if combined_data.get('duplicate_detection'):
                        fallback['duplicate_detection'] = combined_data['duplicate_detection']
                    return fallback, False
                    
        except Exception as e:
            print(f"Processing attempt {attempt + 1} failed with error: {str(e)}", file=sys.stderr)
            if attempt < max_retries:
                print(f"Retrying after error (attempt {attempt + 2})", file=sys.stderr)
                time.sleep(3)  
                continue
            else:
                print("Max retries reached after errors, returning fallback response", file=sys.stderr)
                return create_fallback_response(), False
    
    return create_fallback_response(), False

def process_single_document(doc_path: str, client_company_ein: str, existing_documents: List[Dict] = None, processing_phase: int = 0, phase0_data: Dict[str, Any] = None) -> Dict[str, Any]:
    """Process a single document with memory optimization and improved error handling."""
    print(f"Starting process_single_document for EIN: {client_company_ein}", file=sys.stderr)
    log_memory_usage("Before processing")
    
    try:
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            error_msg = "OPENAI_API_KEY environment variable not found"
            print(f"ERROR: {error_msg}", file=sys.stderr)
            return {
                "error": error_msg,
                "details": "Please set the OPENAI_API_KEY environment variable"
            }
        
        print(f"API Key info - Length: {len(api_key)}, Starts with 'sk-': {api_key.startswith('sk-')}", file=sys.stderr)
        
        try:
            import openai
            print("Testing direct OpenAI connection...", file=sys.stderr)
            client = openai.OpenAI(api_key=api_key)
            test_response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": "test"}],
                max_tokens=5,
                timeout=30
            )
            print("Direct OpenAI API test PASSED", file=sys.stderr)
        except Exception as e:
            print(f"ERROR: Direct OpenAI API test FAILED: {str(e)}", file=sys.stderr)
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
        
        print("Loading existing articles...", file=sys.stderr)
        existing_articles = get_existing_articles()
        management_records = {"Depozit Central": {}, "Servicii": {}}
        
        user_corrections = load_user_corrections(client_company_ein)
        
        document_hash = generate_document_hash(doc_path)
        
        log_memory_usage("After loading config")
        
        try:
            print("Creating FirstCrewFinova instance...", file=sys.stderr)
            crew_instance = FirstCrewFinova(
                client_company_ein, 
                existing_articles, 
                management_records, 
                user_corrections,
                processing_phase
            )
            print("FirstCrewFinova instance created successfully", file=sys.stderr)
            
        except Exception as e:
            print(f"ERROR: Failed to create CrewAI instance: {str(e)}", file=sys.stderr)
            return {
                "error": "Failed to initialize CrewAI. Check logs for details.",
                "details": str(e)
            }
        
        log_memory_usage("After crew creation")
        
        print(f"Processing document: {os.path.basename(doc_path)}", file=sys.stderr)

        current_date = datetime.now().strftime("%d/%m/%Y")
        print(f"Current date for validation: {current_date}", file=sys.stderr)
        
        inputs = {
            "document_path": doc_path,
            "client_company_ein": client_company_ein,
            "current_date": current_date,
            "processing_phase": processing_phase,
            "vendor_labels": ["Furnizor", "Vânzător", "Emitent", "Societate emitentă", "Prestator", "Societate"],
            "buyer_labels": ["Cumpărător", "Client", "Beneficiar", "Achizitor", "Societate client", "Destinatar"],
            "incoming_types": ["Nedefinit", "Marfuri", "Materii prime", "Materiale auxiliare", "Ambalaje", "Obiecte de inventar", "Amenajari provizorii", "Mat. spre prelucrare", "Mat. in pastrare/consig.", "Discount financiar intrari", "Combustibili", "Piese de schimb", "Alte mat. consumabile", "Discount comercial intrari", "Ambalaje SGR"],
            "outgoing_types": ["Nedefinit", "Marfuri", "Produse finite", "Ambalaje", "Produse reziduale", "Semifabricate", "Discount financiar iesiri", "Servicii vandute", "Discount comercial iesiri", "Ambalaje SGR", "Taxa verde"],
            "vat_rates": ["NINETEEN", "NINE", "FIVE", "ZERO"],
            "units_of_measure": ["BUCATA", "KILOGRAM", "LITRU", "METRU", "GRAM", "CUTIE", "PACHET", "PUNGA", "SET", "METRU_PATRAT", "METRU_CUB", "MILIMETRU", "CENTIMETRU", "TONA", "PERECHE", "SAC", "MILILITRU", "KILOWATT_ORA", "MINUT", "ORA", "ZI_DE_LUCRU", "LUNI_DE_LUCRU", "DOZA", "UNITATE_DE_SERVICE", "O_MIE_DE_BUCATI", "TRIMESTRU", "PROCENT", "KILOMETRU", "LADA", "DRY_TONE", "CENTIMETRU_PATRAT", "MEGAWATI_ORA", "ROLA", "TAMBUR", "SAC_PLASTIC", "PALET_LEMN", "UNITATE", "TONA_NETA", "HECTOMETRU_PATRAT", "FOAIE"],
            "existing_articles": existing_articles,
            "management_records": management_records,
            "existing_documents": existing_documents or [],
            "document_hash": document_hash,
            "doc_type": phase0_data.get("document_type", "Unknown") if phase0_data else "Unknown",
            "direction": phase0_data.get("direction", "") if phase0_data else "",
            "referenced_numbers": phase0_data.get("referenced_numbers", []) if phase0_data else [],
        }
        
        if processing_phase == 1 and phase0_data:
            inputs["doc_type"] = phase0_data.get("document_type", "Unknown")
            inputs["direction"] = phase0_data.get("direction", "")
            inputs["referenced_numbers"] = phase0_data.get("referenced_numbers", [])
            print(f"Phase 1 inputs: doc_type={inputs['doc_type']}, direction={inputs['direction']}", file=sys.stderr)
        
        log_memory_usage("Before crew kickoff")
        
        combined_data, success = process_with_retry(crew_instance, inputs)
        
        if not success:
            print("Processing completed with fallback response", file=sys.stderr)
        
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
            print("WARNING: No line_items found for invoice, setting empty array", file=sys.stderr)
        
        if doc_type == 'bank statement' and 'transactions' not in combined_data:
            combined_data['transactions'] = []
            print("WARNING: No transactions found for bank statement, setting empty array", file=sys.stderr)
        
        if 'duplicate_detection' not in combined_data:
            combined_data['duplicate_detection'] = {
                "is_duplicate": False,
                "duplicate_matches": [],
                "document_hash": document_hash,
                "confidence": 0.0
            }
        
        if 'compliance_validation' not in combined_data:
            combined_data['compliance_validation'] = {
                "compliance_status": "PENDING",
                "overall_score": 0.0,
                "validation_rules": {"ro": [], "en": []},
                "errors": {"ro": [], "en": []},
                "warnings": {"ro": [], "en": []}
            }
        
        log_memory_usage("After processing")
        
        return {
            "data": combined_data
        }
        
    except Exception as e:
        print(f"ERROR: Unhandled exception in process_single_document: {str(e)}", file=sys.stderr)
        print(f"Traceback:\n{traceback.format_exc()}", file=sys.stderr)
        
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
            
        print(f"Read base64 file: {file_path} ({file_size // 1024}KB)", file=sys.stderr)
        return content
        
    except Exception as e:
        print(f"ERROR: Error reading base64 file: {str(e)}", file=sys.stderr)
        raise

def main():
    """Main function with comprehensive error handling and memory management."""

    print(f"Python script started", file=sys.stderr)
    print(f"Python version: {sys.version}", file=sys.stderr)
    print(f"OPENAI_API_KEY exists: {bool(os.getenv('OPENAI_API_KEY'))}", file=sys.stderr)
    print(f"MODEL env var: {os.getenv('MODEL', 'NOT SET')}", file=sys.stderr)
    print(f"Current working directory: {os.getcwd()}", file=sys.stderr)
    
    try:
        import crewai
        print(f"CrewAI version: {crewai.__version__ if hasattr(crewai, '__version__') else 'unknown'}", file=sys.stderr)
    except ImportError as e:
        print(f"ERROR: Cannot import crewai: {e}", file=sys.stderr)
    
    try:
        import openai
        print(f"OpenAI version: {openai.__version__ if hasattr(openai, '__version__') else 'unknown'}", file=sys.stderr)
    except ImportError as e:
        print(f"ERROR: Cannot import openai: {e}", file=sys.stderr)

    memory_monitoring = setup_memory_monitoring()
    
    try:
        if len(sys.argv) < 7:
            result = {"error": "Usage: python main.py <client_company_ein> <base64_file_data_or_file_path> [existing_documents_json]"}
            print(json.dumps(result, ensure_ascii=False))
            sys.exit(1)
        
        client_company_ein = sys.argv[1].strip()
        base64_input = sys.argv[2].strip()
        existing_documents_file = sys.argv[3].strip()
        user_corrections_file = sys.argv[4].strip()
        existing_articles_file = sys.argv[5].strip()
        processing_phase = int(sys.argv[6].strip())
        phase0_data = json.loads(sys.argv[7].strip()) if len(sys.argv) > 7 else None

        existing_documents = []
        if os.path.exists(existing_documents_file):
            with open(existing_documents_file, 'r') as f:
                existing_documents = json.load(f)

        base64_data = read_base64_from_file(base64_input)
        temp_file_path = save_temp_file(base64_data)

        try:
            result = process_single_document(temp_file_path, client_company_ein, existing_documents, processing_phase, phase0_data)
            print(json.dumps(result, ensure_ascii=False))
        finally:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
        
        existing_documents = []
        if len(sys.argv) > 3:
            existing_documents_file = sys.argv[3].strip()

            print(f"🐍 PYTHON DEBUG: existing_documents_file path: {existing_documents_file}", file=sys.stderr)
            print(f"🐍 PYTHON DEBUG: File exists: {os.path.exists(existing_documents_file)}", file=sys.stderr)

            if os.path.exists(existing_documents_file):
                try:
                    with open(existing_documents_file, 'r') as f:
                        file_content = f.read()
                        print(f"🐍 PYTHON DEBUG: File size: {len(file_content)} bytes", file=sys.stderr)
                        print(f"🐍 PYTHON DEBUG: First 500 chars: {file_content[:500]}", file=sys.stderr)

                        existing_docs = json.loads(file_content)
                        existing_documents = existing_docs
                        print(f"🐍 PYTHON DEBUG: Parsed JSON, found {len(existing_documents)} documents", file=sys.stderr)
                        if len(existing_documents) > 0:
                            print(f"🐍 PYTHON DEBUG: First doc: {existing_documents[0]}", file=sys.stderr)
                except Exception as e:
                    print(f"🐍 PYTHON DEBUG: Error reading existing documents file: {e}", file=sys.stderr)
            else:
                print("🐍 PYTHON DEBUG: Existing documents file does not exist", file=sys.stderr)

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
            result = process_single_document(temp_file_path, client_company_ein, existing_documents)
            
            print(json.dumps(result, ensure_ascii=False))
            
        finally:
            if os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                    print(f"Cleaned up temporary file: {temp_file_path}", file=sys.stderr)
                except Exception as e:
                    print(f"WARNING: Failed to remove temporary file: {str(e)}", file=sys.stderr)
        
    except KeyboardInterrupt:
        print("Processing interrupted by user", file=sys.stderr)
        print(json.dumps({"error": "Processing interrupted"}))
        sys.exit(1)
        
    except Exception as e:
        print(f"ERROR: Unhandled error in main: {str(e)}", file=sys.stderr)
        print(f"Traceback:\n{traceback.format_exc()}", file=sys.stderr)
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)
        
    finally:
        cleanup_memory()
        
        if memory_monitoring and tracemalloc.is_tracing():
            tracemalloc.stop()
        
        log_memory_usage("Exit")

if __name__ == "__main__":
    main()
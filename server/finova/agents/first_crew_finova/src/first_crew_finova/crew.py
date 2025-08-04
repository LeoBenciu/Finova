from crewai import Agent, Crew, Task, LLM
from crewai.project import CrewBase, agent, crew, task
from crewai.tools import BaseTool
from typing import List, Dict, Type
import os
import json
import traceback
import sys
from pydantic import BaseModel, Field
import logging
import hashlib
import re
from .tools.serper_tool import get_serper_tool

try:
    from crewai import Process
except ImportError:
    from crewai.process import Process

try:
    import PyPDF2
    PYPDF2_AVAILABLE = True
except ImportError:
    PYPDF2_AVAILABLE = False

try:
    from llm_vision_ocr_tool import LLMVisionTextExtractorTool
    LLM_VISION_AVAILABLE = True
except ImportError:
    LLM_VISION_AVAILABLE = False
    try:
        OCR_TOOL_AVAILABLE = True
    except ImportError:
        OCR_TOOL_AVAILABLE = False

class FileReadInput(BaseModel):
    """Input schema for FileReadTool."""
    file_path: str = Field(..., description="Path to the file to read")

class DuplicateCheckInput(BaseModel):
    """Input schema for duplicate checking."""
    document_data: dict = Field(..., description="Current document data for comparison")
    existing_documents: List[dict] = Field(..., description="List of existing documents to compare against")

class SimpleTextExtractorTool(BaseTool):
    name: str = "simple_text_extractor"
    description: str = "Text extraction with PyPDF2 & OpenAI Vision fallback"
    args_schema: Type[BaseModel] = FileReadInput

    def _run(self, file_path: str) -> str:
        """Extract text from files. Uses PyPDF2 for text PDFs, falls back to OpenAI Vision for image-based PDFs."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        def _extract_with_vision(path: str) -> str:
            """Extract text using OpenAI's Vision API."""
            try:
                import base64
                from openai import OpenAI
                
                with open(path, "rb") as f:
                    file_content = f.read()
                base64_encoded = base64.b64encode(file_content).decode('utf-8')
                
                client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
                response = client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": "Extract all text from this document. Preserve formatting, tables, and structure. Include all numbers, dates, and codes."},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:application/pdf;base64,{base64_encoded}",
                                        "detail": "high"
                                    },
                                },
                            ],
                        }
                    ],
                    max_tokens=4000,
                )
                return response.choices[0].message.content
            except Exception as e:
                print(f"OpenAI Vision extraction failed: {e}", file=sys.stderr)
                return ""

        if file_path.lower().endswith(".pdf"):
            if PYPDF2_AVAILABLE:
                try:
                    with open(file_path, "rb") as f:
                        reader = PyPDF2.PdfReader(f)
                        extracted = "\n".join(page.extract_text() or "" for page in reader.pages)
                        if len(extracted.strip()) > 100:
                            return extracted
                except Exception as e:
                    print(f"PyPDF2 extraction failed, will try Vision API: {e}", file=sys.stderr)

            vision_result = _extract_with_vision(file_path)
            if vision_result and len(vision_result.strip()) > 50:
                return vision_result
            return "Could not extract text from PDF (PyPDF2 and Vision API both failed)."

        for enc in ("utf-8", "latin-1", "windows-1250"):
            try:
                with open(file_path, "r", encoding=enc) as f:
                    return f.read()
            except UnicodeDecodeError:
                continue
        return ""

class DocumentHashTool(BaseTool):
    name: str = "document_hash_generator"
    description: str = "Generate hash for document content to detect exact duplicates"
    args_schema: Type[BaseModel] = FileReadInput
    
    def _run(self, file_path: str) -> str:
        """Generate MD5 hash of document content."""
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
                return hashlib.md5(content).hexdigest()
        except Exception as e:
            print(f"Failed to generate hash: {str(e)}")
            return ""
        
class ComplianceMessageTranslator:
    """Helper class for generating bilingual compliance messages"""
    
    @staticmethod
    def get_bilingual_message(key, **kwargs):
        """Get bilingual message for a specific validation rule/error/warning"""
        messages = {
            'invalid_vat': {
                'ro': f"Numărul de TVA invalid: {kwargs.get('vat', 'N/A')}",
                'en': f"Invalid VAT number: {kwargs.get('vat', 'N/A')}"
            },
            'future_date': {
                'ro': f"Dată în viitor detectată: {kwargs.get('date', 'N/A')}",
                'en': f"Future date detected: {kwargs.get('date', 'N/A')}"
            },
            'invalid_iban': {
                'ro': "Format IBAN invalid (trebuie RO + 22 cifre)",
                'en': "Invalid IBAN format (must be RO + 22 digits)"
            },
            'missing_field': {
                'ro': f"Câmp obligatoriu lipsă: {kwargs.get('field', 'N/A')}",
                'en': f"Missing required field: {kwargs.get('field', 'N/A')}"
            },
            'vat_calculation_error': {
                'ro': "Eroare în calculul TVA",
                'en': "VAT calculation error"
            },
            'foreign_currency': {
                'ro': f"Document în valută străină ({kwargs.get('currency', 'N/A')}) - verificați declararea",
                'en': f"Foreign currency document ({kwargs.get('currency', 'N/A')}) - verify declaration"
            },
            'vat_format_rule': {
                'ro': "Numărul de TVA trebuie să aibă format valid (RO + 2-10 cifre)",
                'en': "VAT number must have valid format (RO + 2-10 digits)"
            },
            'date_validation_rule': {
                'ro': "Data facturii nu poate fi în viitor",
                'en': "Invoice date cannot be in the future"
            },
            'iban_format_rule': {
                'ro': "IBAN-ul trebuie să aibă formatul RO + 22 cifre",
                'en': "IBAN must have format RO + 22 digits"
            }
        }
        return messages.get(key, {'ro': 'Mesaj necunoscut', 'en': 'Unknown message'})

class EnhancedDuplicateDetectionTool(BaseTool):
    name: str = "enhanced_duplicate_detector"
    description: str = "Advanced duplicate document detection with improved accuracy and document type filtering"
    args_schema: Type[BaseModel] = DuplicateCheckInput
    
    def _run(self, document_data: dict, existing_documents: List[dict]) -> str:
        """Enhanced duplicate detection with better accuracy."""
        current_doc = document_data
        duplicates = []
        
        current_normalized = self._normalize_document(current_doc)
        
        print(f"[DUPLICATE_DETECTION] Checking document type: {current_normalized.get('document_type')}")
        print(f"[DUPLICATE_DETECTION] Against {len(existing_documents)} existing documents")
        
        same_type_docs = []
        for existing_doc in existing_documents:
            existing_normalized = self._normalize_document(existing_doc)
            
            if (current_normalized.get('document_type') and existing_normalized.get('document_type') and
                current_normalized['document_type'] == existing_normalized['document_type']):
                same_type_docs.append((existing_doc, existing_normalized))
        
        print(f"[DUPLICATE_DETECTION] Found {len(same_type_docs)} documents of same type to compare")
        
        for existing_doc, existing_normalized in same_type_docs:
            if (current_doc.get('document_hash') and existing_doc.get('document_hash') and
                current_doc['document_hash'] == existing_doc['document_hash']):
                duplicates.append({
                    "document_id": existing_doc.get('id'),
                    "similarity_score": 1.0,
                    "matching_fields": ['document_hash'],
                    "duplicate_type": "EXACT_MATCH",
                    "reason": "Identical file content (hash match)"
                })
                continue
            
            similarity_result = self._calculate_similarity(current_normalized, existing_normalized)
            
            if similarity_result['score'] >= 0.85: 
                duplicate_type = "EXACT_MATCH"
            elif similarity_result['score'] >= 0.70:  
                duplicate_type = "CONTENT_MATCH"
            elif similarity_result['score'] >= 0.60:  
                duplicate_type = "SIMILAR_CONTENT"
            else:
                continue 
            
            duplicates.append({
                "document_id": existing_doc.get('id'),
                "similarity_score": similarity_result['score'],
                "matching_fields": similarity_result['fields'],
                "duplicate_type": duplicate_type,
                "reason": similarity_result['reason']
            })
        
        is_duplicate = len(duplicates) > 0
        
        print(f"[DUPLICATE_DETECTION] Result: {len(duplicates)} potential duplicates found")
        if duplicates:
            for dup in duplicates:
                print(f"  - {dup['duplicate_type']}: {dup['reason']} (score: {dup['similarity_score']:.2f})")
        
        return json.dumps({
            "is_duplicate": is_duplicate,
            "duplicate_matches": duplicates,
            "document_hash": current_doc.get('document_hash', ''),
            "confidence": max([d['similarity_score'] for d in duplicates]) if duplicates else 0.0
        })
    
    def _normalize_document(self, doc: dict) -> dict:
        """Normalize document fields for consistent comparison."""
        normalized = {}
        
        normalized['document_type'] = doc.get('document_type', '').lower().strip()
        
        doc_num = doc.get('document_number', '')
        if doc_num:
            normalized['document_number'] = str(doc_num).strip().upper().replace(' ', '').replace('-', '').lstrip('0')
        else:
            normalized['document_number'] = ''
        
        for field in ['total_amount', 'vat_amount']:
            amount = doc.get(field)
            if amount is not None:
                try:
                    normalized[field] = round(float(amount), 2)
                except (ValueError, TypeError):
                    normalized[field] = 0.0
            else:
                normalized[field] = 0.0
        
        date_str = doc.get('document_date', '')
        normalized['document_date'] = self._normalize_date(date_str)
        
        for field in ['vendor_ein', 'buyer_ein']:
            ein = doc.get(field, '')
            if ein:
                normalized[field] = str(ein).strip().upper().replace('RO', '').replace(' ', '')
            else:
                normalized[field] = ''
        
        for field in ['vendor', 'buyer']:
            name = doc.get(field, '')
            if name:
                normalized[field] = self._normalize_company_name(str(name))
            else:
                normalized[field] = ''
        
        normalized['currency'] = doc.get('currency', 'RON').upper()
        
        return normalized
    
    def _normalize_date(self, date_str: str) -> str:
        """Normalize date to DD-MM-YYYY format."""
        if not date_str:
            return ''
        
        date_str = str(date_str).strip()
        
        if re.match(r'^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$', date_str):
            parts = re.split(r'[\/\-]', date_str)
            return f"{parts[0].zfill(2)}-{parts[1].zfill(2)}-{parts[2]}"
        
        if re.match(r'^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$', date_str):
            parts = re.split(r'[\/\-]', date_str)
            return f"{parts[2].zfill(2)}-{parts[1].zfill(2)}-{parts[0]}"
        
        return date_str
    
    def _normalize_company_name(self, name: str) -> str:
        """Normalize company name for comparison."""
        name = name.upper().strip()
        suffixes = ['SRL', 'SA', 'SRA', 'PFA', 'II', 'IF', 'LLC', 'LTD', 'INC']
        for suffix in suffixes:
            name = re.sub(rf'\b{suffix}\.?\b$', '', name).strip()
        name = re.sub(r'\s+', ' ', name)
        return name
    
    def _calculate_similarity(self, current: dict, existing: dict) -> dict:
        """Calculate detailed similarity between documents with document-type specific logic."""
        score = 0.0
        matching_fields = []
        reasons = []
        
        doc_type = current.get('document_type', '')
        
        doc_num_weight = 0.5 if doc_type == 'invoice' else 0.4  # Higher weight for invoices
        if (current.get('document_number') and existing.get('document_number') and
            current['document_number'] == existing['document_number']):
            score += doc_num_weight
            matching_fields.append('document_number')
            reasons.append(f"Same document number: {current['document_number']}")
        
        if (current.get('total_amount') and existing.get('total_amount')):
            amount_diff = abs(current['total_amount'] - existing['total_amount'])
            if amount_diff < 0.01:  # Exact match
                score += 0.3
                matching_fields.append('total_amount')
                reasons.append(f"Exact amount match: {current['total_amount']}")
            elif amount_diff < 1.0:  # Very close amounts
                score += 0.15
                matching_fields.append('total_amount_close')
                reasons.append(f"Similar amounts: {current['total_amount']} vs {existing['total_amount']}")
        
        if (current.get('document_date') and existing.get('document_date')):
            if current['document_date'] == existing['document_date']:
                score += 0.15
                matching_fields.append('document_date')
                reasons.append(f"Same date: {current['document_date']}")
            else:
                if doc_type != 'invoice':
                    date_diff = self._calculate_date_difference(current['document_date'], existing['document_date'])
                    if date_diff <= 7:  # Within a week
                        score += 0.05
                        matching_fields.append('document_date_close')
                        reasons.append(f"Close dates: {current['document_date']} vs {existing['document_date']}")
        
        if doc_type in ['invoice', 'receipt']:
            vendor_weight = 0.15
            if (current.get('vendor_ein') and existing.get('vendor_ein') and
                current['vendor_ein'] == existing['vendor_ein']):
                score += vendor_weight
                matching_fields.append('vendor_ein')
                reasons.append(f"Same vendor EIN: {current['vendor_ein']}")
            elif (current.get('vendor') and existing.get('vendor') and
                  self._company_names_similar(current['vendor'], existing['vendor'])):
                score += vendor_weight * 0.7  # Partial match for name similarity
                matching_fields.append('vendor_name')
                reasons.append(f"Similar vendor names: {current['vendor']} vs {existing['vendor']}")
        
        if current.get('currency') == existing.get('currency'):
            score += 0.05
            matching_fields.append('currency')
        
        if doc_type == 'invoice' and len([f for f in matching_fields if not f.endswith('_close')]) >= 3:
            score += 0.1
            reasons.append("Multiple exact field matches bonus")
        
        return {
            'score': min(score, 1.0),  # Cap at 1.0
            'fields': matching_fields,
            'reason': '; '.join(reasons) if reasons else 'Field similarities detected'
        }
    
    def _company_names_similar(self, name1: str, name2: str) -> bool:
        """Check if company names are similar enough."""
        if not name1 or not name2:
            return False
        
        if name1 == name2:
            return True
        
        if len(name1) > 5 and len(name2) > 5:
            shorter = name1 if len(name1) < len(name2) else name2
            longer = name2 if len(name1) < len(name2) else name1
            if shorter in longer:
                return True
        
        words1 = set(name1.split())
        words2 = set(name2.split())
        common_words = words1.intersection(words2)
        
        if len(common_words) >= 2 and len(common_words) >= min(len(words1), len(words2)) * 0.6:
            return True
        
        return False
    
    def _calculate_date_difference(self, date1: str, date2: str) -> int:
        """Calculate difference in days between two dates."""
        try:
            from datetime import datetime
            
            d1 = datetime.strptime(date1, '%d-%m-%Y')
            d2 = datetime.strptime(date2, '%d-%m-%Y')
            
            return abs((d1 - d2).days)
        except:
            return 999  
        
def get_text_extractor_tool():
    if LLM_VISION_AVAILABLE:
        print("Using LLM Vision Text Extractor")
        return LLMVisionTextExtractorTool()
    else:
        print("Using Simple Text Extractor (fallback)")
        return SimpleTextExtractorTool()

def get_configured_llm():
    """Get properly configured LLM for CrewAI agents"""
    
    openai_api_key = os.getenv('OPENAI_API_KEY')
    model_name = os.getenv('MODEL', 'gpt-4o-mini')
    
    if not openai_api_key:
        print("ERROR: OPENAI_API_KEY environment variable not found", file=sys.stderr)
        return None
    
    try:
        from crewai import LLM
        print("Importing LLM from crewai...", file=sys.stderr)
        
        llm = LLM(
            model=model_name,
            temperature=0.3,
            max_tokens=4000
        )
        
        print("LLM configuration successful", file=sys.stderr)
        return llm
        
    except Exception as e:
        print(f"ERROR: Failed to configure LLM: {str(e)}", file=sys.stderr)
        print(f"Traceback:\n{traceback.format_exc()}", file=sys.stderr)
        return None

@CrewBase
class FirstCrewFinova:
    """FirstCrewFinova crew for document categorization and data extraction"""
    
    agents_config = 'config/agents.yaml'
    tasks_config = 'config/tasks.yaml'

    def __init__(self, client_company_ein: str, existing_articles: Dict, management_records: Dict, user_corrections: List[Dict] = None, processing_phase: int = 0):
        self.client_company_ein = client_company_ein
        self.existing_articles = existing_articles
        self.management_records = management_records
        self.user_corrections = user_corrections or []
        self.processing_phase = processing_phase
        self.llm = get_configured_llm()
        
        import os
        print(f"Current working directory: {os.getcwd()}", file=sys.stderr)
        print(f"Looking for agents config at: {self.agents_config}", file=sys.stderr)
        print(f"Agents config file exists: {os.path.exists(self.agents_config)}", file=sys.stderr)
        
        config_dir = os.path.dirname(self.agents_config) if self.agents_config else 'config'
        print(f"Config directory '{config_dir}' exists: {os.path.exists(config_dir)}", file=sys.stderr)
        
        if os.path.exists(config_dir):
            files_in_config = os.listdir(config_dir)
            print(f"Files in config directory: {files_in_config}", file=sys.stderr)
    
    def attribute_account_for_transaction(self, transaction_data: dict, romanian_chart_of_accounts: str) -> dict:
        """Use the account attribution agent to categorize a bank transaction."""
        try:
            attribution_crew = Crew(
                agents=[self.account_attribution_agent()],
                tasks=[self.attribute_bank_transaction_account_task()],
                verbose=True
            )

            inputs = {
                'transaction_description': transaction_data.get('description', ''),
                'transaction_amount': transaction_data.get('amount', 0),
                'transaction_type': transaction_data.get('transactionType', ''),
                'reference_number': transaction_data.get('referenceNumber', ''),
                'transaction_date': transaction_data.get('transactionDate', ''),
                'romanian_chart_of_accounts': romanian_chart_of_accounts
            }

            result = attribution_crew.kickoff(inputs=inputs)

            if hasattr(result, 'tasks_output') and result.tasks_output:
                task_output = result.tasks_output[0]
                if hasattr(task_output, 'raw'):
                    return self._parse_account_attribution_result(task_output.raw)

            return {
                'account_code': '628',
                'account_name': 'Alte cheltuieli cu serviciile executate de terți',
                'confidence': 0.3,
                'reasoning': 'Could not determine specific account, using general expense account',
                'requires_manual_review': True
            }

        except Exception as e:
            print(f"Account attribution failed: {str(e)}", file=sys.stderr)
            return {
                'account_code': '628',
                'account_name': 'Alte cheltuieli cu serviciile executate de terți',
                'confidence': 0.1,
                'reasoning': f'Attribution failed due to error: {str(e)}',
                'requires_manual_review': True
            }

    def _parse_account_attribution_result(self, raw_output: str) -> dict:
        """Parse the agent's JSON output."""
        try:
            import re
            json_match = re.search(r'\{[^{}]*\}', raw_output)
            if json_match:
                result_json = json.loads(json_match.group())
                return result_json
            else:
                return {
                    'account_code': '628',
                    'account_name': 'Alte cheltuieli cu serviciile executate de terți',
                    'confidence': 0.2,
                    'reasoning': 'Could not parse agent response',
                    'requires_manual_review': True
                }
        except Exception as e:
            print(f"Failed to parse attribution result: {str(e)}", file=sys.stderr)
            return {
                'account_code': '628',
                'account_name': 'Alte cheltuieli cu serviciile executate de terți',
                'confidence': 0.1,
                'reasoning': 'Parsing error',
                'requires_manual_review': True
            }

    @agent
    def document_categorizer(self) -> Agent:
        learning_context = ""
        if self.user_corrections:
            categorization_corrections = [c for c in self.user_corrections if c.get('correctionType') == 'DOCUMENT_TYPE']
            if categorization_corrections:
                learning_context = f"\n\nLearning from previous corrections:\n"
                for correction in categorization_corrections[-5:]:  # Use last 5 corrections
                    learning_context += f"- Original prediction: {correction.get('originalValue')}, Correct answer: {correction.get('correctedValue')}\n"
        
        print(f"Trying to access document_categorizer config...", file=sys.stderr)
        
        enhanced_goal = self.agents_config['document_categorizer']['goal'] + f" Learn from user corrections to improve accuracy.{learning_context}"
        enhanced_backstory = self.agents_config['document_categorizer']['backstory'] + " You learn from user feedback to continuously improve your classifications."
        
        agent_config = {
            'role': self.agents_config['document_categorizer']['role'],
            'goal': enhanced_goal,
            'backstory': enhanced_backstory,
            'verbose': True,
            'tools': [get_text_extractor_tool()],
        }
        
        if self.llm:
            agent_config['llm'] = self.llm
            
        print(f"Document categorizer config created successfully", file=sys.stderr)
        return Agent(**agent_config)

    @agent
    def invoice_data_extractor(self) -> Agent:
        agent_config = {
            'role': self.agents_config['invoice_data_extractor']['role'],
            'goal': self.agents_config['invoice_data_extractor']['goal'],
            'backstory': self.agents_config['invoice_data_extractor']['backstory'],
            'verbose': True,
            'tools': [get_text_extractor_tool()],
        }
        
        if self.llm:
            agent_config['llm'] = self.llm
            
        return Agent(**agent_config)

    @agent
    def other_document_data_extractor(self) -> Agent:
        agent_config = {
            'role': self.agents_config['other_document_data_extractor']['role'],
            'goal': self.agents_config['other_document_data_extractor']['goal'],
            'backstory': self.agents_config['other_document_data_extractor']['backstory'],
            'verbose': True,
            'tools': [get_text_extractor_tool()],
        }
        
        if self.llm:
            agent_config['llm'] = self.llm
            
        return Agent(**agent_config)

    @agent
    def duplicate_detector_agent(self) -> Agent:
        agent_config = {
            'role': self.agents_config['duplicate_detector_agent']['role'],
            'goal': self.agents_config['duplicate_detector_agent']['goal'],
            'backstory': self.agents_config['duplicate_detector_agent']['backstory'],
            'verbose': True,
            'tools': [get_text_extractor_tool(), EnhancedDuplicateDetectionTool(), DocumentHashTool()],
        }
        
        if self.llm:
            agent_config['llm'] = self.llm
            
        return Agent(**agent_config)

    @agent
    def compliance_validator_agent(self) -> Agent:
        agent_config = {
            'role': self.agents_config['compliance_validator_agent']['role'],
            'goal': self.agents_config['compliance_validator_agent']['goal'] + 
                    " Always output validation results in BOTH Romanian and English using the specified JSON format.",
            'backstory': self.agents_config['compliance_validator_agent']['backstory'] + 
                        " You are fluent in both Romanian and English and always provide bilingual compliance reports.",
            'verbose': True,
            'tools': [get_text_extractor_tool()],
        }
        
        if self.llm:
            agent_config['llm'] = self.llm
            
        return Agent(**agent_config)

    @agent
    def account_attribution_agent(self) -> Agent:

        tools = [get_text_extractor_tool()]
    
        serper_tool = get_serper_tool()
        if serper_tool:
            tools.append(serper_tool)
            print("Account attribution agent: Serper research enabled", file=sys.stderr)
        else:
            print("Account attribution agent: Using local knowledge only", file=sys.stderr)
    

        agent_config = {
            'role': self.agents_config['account_attribution_agent']['role'],
            'goal': self.agents_config['account_attribution_agent']['goal'],
            'backstory': self.agents_config['account_attribution_agent']['backstory'],
            'verbose': True,
            'tools': tools,
        }
        
        if self.llm:
            agent_config['llm'] = self.llm
            
        return Agent(**agent_config)

    @task
    def categorize_document_task(self) -> Task:
        return Task(
            config=self.tasks_config['categorize_document_task'],
        )

    @task
    def extract_invoice_data_task(self) -> Task:
        return Task(
            config=self.tasks_config['extract_invoice_data_task'],
            output_file='invoice_data.json'
        )

    @task
    def extract_other_document_data_task(self) -> Task:
        return Task(
            config=self.tasks_config['extract_other_document_data_task'],
            output_file='other_document_data.json'
        )

    @task
    def detect_duplicates_task(self) -> Task:
        return Task(
            config=self.tasks_config['detect_duplicates_task'],
            output_file='duplicate_detection.json'
        )

    @task
    def validate_compliance_task(self) -> Task:
        return Task(
            config=self.tasks_config['validate_compliance_task'],
            output_file='compliance_validation.json'
        )

    @task
    def attribute_bank_transaction_account_task(self) -> Task:
        return Task(
            config=self.tasks_config['attribute_bank_transaction_account_task'],
            output_file='account_attribution.json'
        )
        
    @crew
    def crew(self) -> Crew:
        if self.processing_phase == 0:
            tasks = [self.categorize_document_task()]
            print("Phase 0: Only running categorization task", file=sys.stderr)
        else:
            tasks = [
                self.detect_duplicates_task(),
                self.validate_compliance_task()
            ]
            print("Phase 1: Running full processing pipeline", file=sys.stderr)

        crew_config = {
            'agents': self.agents,
            'tasks': tasks,
            'verbose': True,
        }
        if self.llm:
            crew_config['manager_llm'] = self.llm

        return Crew(**crew_config)
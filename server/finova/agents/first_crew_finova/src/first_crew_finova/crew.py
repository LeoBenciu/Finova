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
    description: str = "Simple text extraction for text-based files"
    args_schema: Type[BaseModel] = FileReadInput
    
    def _run(self, file_path: str) -> str:
        """Extract text from simple text files."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        if file_path.endswith(".pdf"):
            if PYPDF2_AVAILABLE:
                try:
                    with open(file_path, 'rb') as file:
                        pdf_reader = PyPDF2.PdfReader(file)
                        text = ""
                        for page_num, page in enumerate(pdf_reader.pages):
                            page_text = page.extract_text()
                            if page_text:
                                text += page_text + "\n"
                        
                        if len(text.strip()) > 100:
                            return text
                except Exception as e:
                    print(f"PyPDF2 extraction failed: {str(e)}")
            
            return "Could not extract text from PDF. This appears to be an image-based PDF."
        else:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    return f.read()
            except UnicodeDecodeError:
                with open(file_path, "r", encoding="latin-1") as f:
                    return f.read()

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



class DuplicateDetectionTool(BaseTool):
    name: str = "duplicate_detector"
    description: str = "Compare current document with existing documents to detect duplicates"
    args_schema: Type[BaseModel] = DuplicateCheckInput
    
    def _run(self, document_data: dict, existing_documents: List[dict]) -> str:
        """Check for duplicates based on key fields with document-type specific logic."""
        current_doc = document_data
        current_type = current_doc.get('document_type', '').lower()
        duplicates = []
        
        same_type_docs = [doc for doc in existing_documents if doc.get('document_type', '').lower() == current_type]
        
        print(f"Checking for duplicates among {len(same_type_docs)} {current_type} documents", file=sys.stderr)
        
        for existing_doc in same_type_docs:
            similarity_score = 0.0
            matching_fields = []
            duplicate_type = None
            
            if current_type == 'invoice':
                if (current_doc.get('document_number') and existing_doc.get('document_number') and
                    current_doc['document_number'] == existing_doc['document_number'] and
                    current_doc.get('vendor_ein') == existing_doc.get('vendor_ein')):
                    similarity_score = 1.0
                    matching_fields = ['document_number', 'vendor_ein']
                    duplicate_type = "EXACT_MATCH"
                elif (current_doc.get('vendor_ein') == existing_doc.get('vendor_ein') and
                      current_doc.get('total_amount') and existing_doc.get('total_amount') and
                      abs(float(current_doc['total_amount']) - float(existing_doc['total_amount'])) < 0.01 and
                      current_doc.get('document_date') == existing_doc.get('document_date')):
                    similarity_score = 0.9
                    matching_fields = ['vendor_ein', 'total_amount', 'document_date']
                    duplicate_type = "CONTENT_MATCH"
                elif (current_doc.get('vendor_ein') == existing_doc.get('vendor_ein') and
                      current_doc.get('total_amount') and existing_doc.get('total_amount')):
                    amount_diff = abs(float(current_doc['total_amount']) - float(existing_doc['total_amount']))
                    amount_avg = (float(current_doc['total_amount']) + float(existing_doc['total_amount'])) / 2
                    if amount_diff / amount_avg < 0.05:  # Within 5%
                        similarity_score = 0.6
                        matching_fields = ['vendor_ein', 'total_amount_similar']
                        duplicate_type = "SIMILAR_CONTENT"
                        
            elif current_type == 'receipt':
                if (current_doc.get('receipt_number') and existing_doc.get('receipt_number') and
                    current_doc['receipt_number'] == existing_doc['receipt_number'] and
                    current_doc.get('vendor_ein') == existing_doc.get('vendor_ein') and
                    current_doc.get('document_date') == existing_doc.get('document_date')):
                    similarity_score = 1.0
                    matching_fields = ['receipt_number', 'vendor_ein', 'document_date']
                    duplicate_type = "EXACT_MATCH"
                elif (current_doc.get('vendor_ein') == existing_doc.get('vendor_ein') and
                      current_doc.get('total_amount') == existing_doc.get('total_amount') and
                      current_doc.get('document_date') == existing_doc.get('document_date')):
                    similarity_score = 0.8
                    matching_fields = ['vendor_ein', 'total_amount', 'document_date']
                    duplicate_type = "CONTENT_MATCH"
                    
            elif current_type == 'bank statement':
                if (current_doc.get('statement_number') and existing_doc.get('statement_number') and
                    current_doc['statement_number'] == existing_doc['statement_number'] and
                    current_doc.get('account_number') == existing_doc.get('account_number')):
                    similarity_score = 1.0
                    matching_fields = ['statement_number', 'account_number']
                    duplicate_type = "EXACT_MATCH"
                elif (current_doc.get('account_number') == existing_doc.get('account_number') and
                      current_doc.get('statement_period_start') and existing_doc.get('statement_period_start')):
                    if (current_doc.get('statement_period_start') == existing_doc.get('statement_period_start') or
                        current_doc.get('statement_period_end') == existing_doc.get('statement_period_end')):
                        similarity_score = 0.9
                        matching_fields = ['account_number', 'overlapping_period']
                        duplicate_type = "CONTENT_MATCH"
                        
            elif current_type == 'contract':
                if (current_doc.get('contract_number') and existing_doc.get('contract_number') and
                    current_doc['contract_number'] == existing_doc['contract_number']):
                    similarity_score = 1.0
                    matching_fields = ['contract_number']
                    duplicate_type = "EXACT_MATCH"
                    
            else:
                if (current_doc.get('document_number') and existing_doc.get('document_number') and
                    current_doc['document_number'] == existing_doc['document_number']):
                    similarity_score = 0.9
                    matching_fields = ['document_number']
                    duplicate_type = "CONTENT_MATCH"
            
            if duplicate_type and similarity_score >= 0.6:
                duplicates.append({
                    "document_id": existing_doc.get('id'),
                    "document_name": existing_doc.get('name', 'Unknown'),
                    "similarity_score": similarity_score,
                    "matching_fields": matching_fields,
                    "duplicate_type": duplicate_type,
                    "reason": f"Matched on: {', '.join(matching_fields)}"
                })
        
        duplicates.sort(key=lambda x: x['similarity_score'], reverse=True)
        
        return json.dumps({
            "duplicates": duplicates[:5],  
            "total_checked": len(same_type_docs),
            "document_type": current_type
        })
    

class ArticleMatchingInput(BaseModel):
    """Input schema for article matching."""
    article_name: str = Field(..., description="Name of the article to match")
    existing_articles: List[dict] = Field(..., description="List of existing articles to match against")
    similarity_threshold: float = Field(0.7, description="Minimum similarity score for matching")

class ArticleMatchingTool(BaseTool):
    name: str = "article_matcher"
    description: str = "Match article names with existing articles using fuzzy matching"
    args_schema: Type[BaseModel] = ArticleMatchingInput
    
    def _run(self, article_name: str, existing_articles: List[dict], similarity_threshold: float = 0.7) -> str:
        """Find similar articles using fuzzy matching with business logic."""
        
        word_mappings = {
            'transport': ['shipping', 'shipment', 'delivery', 'freight', 'livrare', 'expediere', 'transportare'],
            'shipping': ['transport', 'shipment', 'delivery', 'freight', 'livrare', 'transportare'],
            'livrare': ['transport', 'shipping', 'shipment', 'delivery', 'freight', 'expediere'],
            'expediere': ['transport', 'shipping', 'shipment', 'delivery', 'livrare'],
            'service': ['servicii', 'services', 'prestari', 'serviciu'],
            'servicii': ['service', 'services', 'prestari', 'serviciu'],
            'services': ['service', 'servicii', 'prestari'],
            'prestari': ['service', 'servicii', 'services'],
            'product': ['produs', 'produse', 'marfa', 'marfuri', 'articol'],
            'produs': ['product', 'produse', 'marfa', 'marfuri', 'articol'],
            'produse': ['product', 'produs', 'marfa', 'marfuri'],
            'marfa': ['product', 'produs', 'marfuri', 'goods', 'merchandise'],
            'marfuri': ['product', 'produs', 'marfa', 'goods', 'merchandise'],
            'goods': ['marfa', 'marfuri', 'product', 'produs', 'merchandise']
        }
        
        def calculate_similarity(str1: str, str2: str) -> float:
            """Calculate similarity between two strings."""
            s1 = str1.lower().strip()
            s2 = str2.lower().strip()
            
            if s1 == s2:
                return 1.0
            
            if s1 in s2 or s2 in s1:
                return 0.9
            
            max_len = max(len(s1), len(s2))
            if max_len == 0:
                return 1.0
            
            matches = 0
            for i in range(min(len(s1), len(s2))):
                if s1[i] == s2[i]:
                    matches += 1
            
            char_similarity = matches / max_len
            
            words1 = set(s1.split())
            words2 = set(s2.split())
            
            if words1 and words2:
                common_words = words1.intersection(words2)
                word_similarity = len(common_words) / max(len(words1), len(words2))
                
                synonym_matches = 0
                for w1 in words1:
                    if w1 in word_mappings:
                        for synonym in word_mappings[w1]:
                            if synonym in words2:
                                synonym_matches += 1
                                break
                
                if synonym_matches > 0:
                    word_similarity = max(word_similarity, 0.8)
                
                return max(char_similarity * 0.4 + word_similarity * 0.6, char_similarity)
            
            return char_similarity

        best_match = None
        best_score = 0
        
        article_lower = article_name.lower()
        
        for existing in existing_articles:
            if not existing.get('name'):
                continue
                
            score = calculate_similarity(article_name, existing['name'])
            
            for word, synonyms in word_mappings.items():
                if word in article_lower:
                    for synonym in synonyms:
                        if synonym in existing['name'].lower():
                            score = max(score, 0.8)
                            break
            
            if score > best_score and score >= similarity_threshold:
                best_score = score
                best_match = existing
        
        result = {
            "found_match": best_match is not None,
            "similarity_score": best_score,
            "matched_article": best_match if best_match else None,
            "original_name": article_name
        }
        
        return json.dumps(result)


@agent
def invoice_data_extractor(self) -> Agent:
    agent_config = {
        'role': self.agents_config['invoice_data_extractor']['role'],
        'goal': self.agents_config['invoice_data_extractor']['goal'],
        'backstory': self.agents_config['invoice_data_extractor']['backstory'],
        'verbose': True,
        'tools': [get_text_extractor_tool(), ArticleMatchingTool()], 
    }
    
    if self.llm:
        agent_config['llm'] = self.llm
        
    return Agent(**agent_config)

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
    
    print(f"get_configured_llm: API key exists: {bool(openai_api_key)}", file=sys.stderr)
    print(f"get_configured_llm: Model name: {model_name}", file=sys.stderr)
    
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

    def __init__(self, client_company_ein: str, existing_articles: Dict, management_records: Dict, user_corrections: List[Dict] = None):
        self.client_company_ein = client_company_ein
        self.existing_articles = existing_articles
        self.management_records = management_records
        self.user_corrections = user_corrections or []
        
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

    @agent
    def document_categorizer(self) -> Agent:
        learning_context = ""
        if self.user_corrections:
            categorization_corrections = [c for c in self.user_corrections if c.get('correctionType') == 'DOCUMENT_TYPE']
            if categorization_corrections:
                learning_context = f"\n\nLearning from previous corrections:\n"
                for correction in categorization_corrections[-5:]: 
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
            'tools': [get_text_extractor_tool(), DuplicateDetectionTool(), DocumentHashTool()],
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

    @crew
    def crew(self) -> Crew:
        """Creates the FirstCrewFinova crew"""
        crew_config = {
            'agents': self.agents,
            'tasks': self.tasks,
            'verbose': True,
        }
        
        if self.llm:
            crew_config['manager_llm'] = self.llm
            
        return Crew(**crew_config)
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

class DuplicateDetectionTool(BaseTool):
    name: str = "duplicate_detector"
    description: str = "Compare current document with existing documents to detect duplicates"
    args_schema: Type[BaseModel] = DuplicateCheckInput
    
    def _run(self, document_data: dict, existing_documents: List[dict]) -> str:
        """Check for duplicates based on key fields."""
        current_doc = document_data
        duplicates = []
        
        for existing_doc in existing_documents:
            similarity_score = 0.0
            matching_fields = []
            
            if current_doc.get('document_number') and existing_doc.get('document_number'):
                if current_doc['document_number'] == existing_doc['document_number']:
                    similarity_score += 0.4
                    matching_fields.append('document_number')
            
            if current_doc.get('total_amount') and existing_doc.get('total_amount'):
                if abs(float(current_doc['total_amount']) - float(existing_doc['total_amount'])) < 0.01:
                    similarity_score += 0.3
                    matching_fields.append('total_amount')
            
            if current_doc.get('document_date') and existing_doc.get('document_date'):
                if current_doc['document_date'] == existing_doc['document_date']:
                    similarity_score += 0.2
                    matching_fields.append('document_date')
            
            if current_doc.get('vendor_ein') and existing_doc.get('vendor_ein'):
                if current_doc['vendor_ein'] == existing_doc['vendor_ein']:
                    similarity_score += 0.1
                    matching_fields.append('vendor_ein')
            
            if similarity_score >= 0.9:
                duplicate_type = "EXACT_MATCH"
            elif similarity_score >= 0.7:
                duplicate_type = "CONTENT_MATCH"
            elif similarity_score >= 0.5:
                duplicate_type = "SIMILAR_CONTENT"
            else:
                continue
            
            duplicates.append({
                "document_id": existing_doc.get('id'),
                "similarity_score": similarity_score,
                "matching_fields": matching_fields,
                "duplicate_type": duplicate_type
            })
        
        return json.dumps({"duplicates": duplicates})

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
            'tools': [get_text_extractor_tool(), DuplicateDetectionTool(), DocumentHashTool()],
        }
        
        if self.llm:
            agent_config['llm'] = self.llm
            
        return Agent(**agent_config)

    @agent
    def compliance_validator_agent(self) -> Agent:
        agent_config = {
            'role': self.agents_config['compliance_validator_agent']['role'],
            'goal': self.agents_config['compliance_validator_agent']['goal'],
            'backstory': self.agents_config['compliance_validator_agent']['backstory'],
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
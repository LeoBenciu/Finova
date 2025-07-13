from crewai import Agent, Crew, Task, LLM
from crewai.project import CrewBase, agent, crew, task
from crewai.tools import BaseTool
from typing import List, Dict, Type
import os
import json
from pydantic import BaseModel, Field

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
    
    if openai_api_key:
        return LLM(
            model="gpt-4o-mini",
            temperature=0.3,
            max_tokens=4000
        )
    
    print("Warning: No LLM configuration found. Please set OPENAI_API_KEY or another supported LLM provider.")
    return None

@CrewBase
class FirstCrewFinova:
    """FirstCrewFinova crew for document categorization and data extraction"""

    def __init__(self, client_company_ein: str, existing_articles: Dict, management_records: Dict):
        self.client_company_ein = client_company_ein
        self.existing_articles = existing_articles
        self.management_records = management_records
        
        self.llm = get_configured_llm()

    @agent
    def document_categorizer(self) -> Agent:
        agent_config = {
            'role': 'Document Categorizer',
            'goal': 'Classify Romanian documents as factură (incoming or outgoing) based on CUI, chitanță, extras de cont, contract, raport, or unknown.',
            'backstory': 'You are an expert in analyzing Romanian financial documents, skilled at identifying document types and determining invoice direction based on CUI and company information.',
            'verbose': True,
            'tools': [get_text_extractor_tool()],
        }
        
        if self.llm:
            agent_config['llm'] = self.llm
            
        return Agent(**agent_config)

    @agent
    def invoice_data_extractor(self) -> Agent:
        agent_config = {
            'role': 'Invoice Data Extractor',
            'goal': 'Extract structured bookkeeping data from Romanian invoices, including line items, and validate articles and management records.',
            'backstory': 'You specialize in parsing Romanian invoices compliant with ANAF standards, comparing articles with a database, and selecting management records.',
            'verbose': True,
            'tools': [get_text_extractor_tool()],
        }
        
        if self.llm:
            agent_config['llm'] = self.llm
            
        return Agent(**agent_config)

    @agent
    def other_document_data_extractor(self) -> Agent:
        agent_config = {
            'role': 'Other Document Data Extractor',
            'goal': 'Extract relevant data from Romanian non-invoice documents such as chitanță, extras de cont, contracte, rapoarte, etc.',
            'backstory': 'You are adept at extracting structured information from Romanian financial and legal documents to support downstream processes.',
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
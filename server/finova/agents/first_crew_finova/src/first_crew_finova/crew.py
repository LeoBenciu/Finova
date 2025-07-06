from crewai import Agent, Crew, Task
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
    import pytesseract
    from pdf2image import convert_from_path
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    
try:
    import PyPDF2
    PYPDF2_AVAILABLE = True
except ImportError:
    PYPDF2_AVAILABLE = False

class FileReadInput(BaseModel):
    """Input schema for FileReadTool."""
    file_path: str = Field(..., description="Path to the file to read")

class RomanianTextExtractorTool(BaseTool):
    name: str = "romanian_text_extractor"
    description: str = "Extracts text from files, with OCR support for Romanian PDFs"
    args_schema: Type[BaseModel] = FileReadInput
    
    def _run(self, file_path: str) -> str:
        """Extract text from the given file."""
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
            
            if OCR_AVAILABLE:
                try:
                    images = convert_from_path(file_path)
                    text = ""
                    for i, image in enumerate(images):
                        page_text = pytesseract.image_to_string(image, lang="ron")
                        text += f"Page {i + 1}:\n{page_text}\n\n"
                    return text
                except Exception as e:
                    print(f"OCR failed: {str(e)}")
            
            return "Could not extract text from PDF. Please ensure the PDF contains text or install OCR dependencies."
        else:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    return f.read()
            except UnicodeDecodeError:
                with open(file_path, "r", encoding="latin-1") as f:
                    return f.read()

@CrewBase
class FirstCrewFinova:
    """FirstCrewFinova crew for document categorization and data extraction"""

    def __init__(self, client_company_ein: str, existing_articles: Dict, management_records: Dict):
        self.client_company_ein = client_company_ein
        self.existing_articles = existing_articles
        self.management_records = management_records

    @agent
    def document_categorizer(self) -> Agent:
        return Agent(
            config=self.agents_config['document_categorizer'],
            verbose=True,
            tools=[RomanianTextExtractorTool()],
            config_dic={
                "client_company_ein": self.client_company_ein,
                "vendor_labels": ["Furnizor", "Vânzător", "Emitent", "Societate emitentă", "Prestator", "Societate"],
                "buyer_labels": ["Cumpărător", "Client", "Beneficiar", "Achizitor", "Societate client"]
            }
        )

    @agent
    def invoice_data_extractor(self) -> Agent:
        return Agent(
            config=self.agents_config['invoice_data_extractor'],
            verbose=True,
            tools=[RomanianTextExtractorTool()],
            config_dic={
                "client_company_ein": self.client_company_ein,
                "existing_articles": self.existing_articles,
                "management_records": self.management_records,
                "incoming_types": ["Nedefinit", "Marfuri", "Materii prime", "Materiale auxiliare", "Ambalaje", "Obiecte de inventar", "Amenajari provizorii", "Mat. spre prelucrare", "Mat. in pastrare/consig.", "Discount financiar intrari", "Combustibili", "Piese de schimb", "Alte mat. consumabile", "Discount comercial intrari", "Ambalaje SGR"],
                "outgoing_types": ["Nedefinit", "Marfuri", "Produse finite", "Ambalaje", "Produse reziduale", "Semifabricate", "Discount financiar iesiri", "Servicii vandute", "Discount comercial iesiri", "Ambalaje SGR", "Taxa verde"],
                "vat_rates": ["NINETEEN", "NINE", "FIVE", "ZERO"],
                "units_of_measure": ["BUCATA", "KILOGRAM", "LITRU", "METRU", "GRAM", "CUTIE", "PACHET", "PUNGA", "SET", "METRU_PATRAT", "METRU_CUB", "MILIMETRU", "CENTIMETRU", "TONA", "PERECHE", "SAC", "MILILITRU", "KILOWATT_ORA", "MINUT", "ORA", "ZI_DE_LUCRU", "LUNI_DE_LUCRU", "DOZA", "UNITATE_DE_SERVICE", "O_MIE_DE_BUCATI", "TRIMESTRU", "PROCENT", "KILOMETRU", "LADA", "DRY_TONE", "CENTIMETRU_PATRAT", "MEGAWATI_ORA", "ROLA", "TAMBUR", "SAC_PLASTIC", "PALET_LEMN", "UNITATE", "TONA_NETA", "HECTOMETRU_PATRAT", "FOAIE"]
            }
        )

    @agent
    def other_document_data_extractor(self) -> Agent:
        return Agent(
            config=self.agents_config['other_document_data_extractor'],
            verbose=True,
            tools=[RomanianTextExtractorTool()]
        )

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
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            verbose=True
        )
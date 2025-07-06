from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai_tools import FileReadTool
from typing import List, Dict
import os
import pytesseract
from pdf2image import convert_from_path
import json

# Custom tool to handle text extraction with OCR for Romanian
class RomanianTextExtractorTool(FileReadTool):
    def _run(self, file_path: str) -> str:
        if file_path.endswith(".pdf"):
            try:
                images = convert_from_path(file_path)
                text = "".join(pytesseract.image_to_string(image, lang="ron") for image in images)
            except Exception as e:
                raise Exception(f"OCR failed for {file_path}: {str(e)}")
        else:
            with open(file_path, "r", encoding="utf-8") as f:
                text = f.read()
        return text

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
            })

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
        """Creates the FirstCrewFinova crew with parallel processing"""
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.parallel,
            verbose=True
        )
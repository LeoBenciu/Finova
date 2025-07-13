import os
import tempfile
import logging
import base64
from typing import Type, Optional
from pydantic import BaseModel, Field
from crewai.tools import BaseTool
import openai

try:
    import PyPDF2
    PYPDF2_AVAILABLE = True
except ImportError:
    PYPDF2_AVAILABLE = False

try:
    from pdf2image import convert_from_path
    from PIL import Image
    import io
    PDF_TO_IMAGE_AVAILABLE = True
except ImportError:
    PDF_TO_IMAGE_AVAILABLE = False

class FileReadInput(BaseModel):
    file_path: str = Field(..., description="Path to the file to read")

class LLMVisionTextExtractorTool(BaseTool):
    name: str = "llm_vision_text_extractor"
    description: str = "Advanced text extraction using LLM vision capabilities for Romanian documents"
    args_schema: Type[BaseModel] = FileReadInput
    
    def __init__(self):
        super().__init__()
        self.client = openai.OpenAI(
            api_key=os.getenv('OPENAI_API_KEY')
        )
    
    def _run(self, file_path: str) -> str:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
            
        if file_path.endswith(".pdf"):
            return self._extract_from_pdf(file_path)
        elif file_path.lower().endswith(('.png', '.jpg', '.jpeg', '.tiff', '.bmp')):
            return self._extract_from_image(file_path)
        else:
            return self._extract_from_text_file(file_path)
    
    def _extract_from_pdf(self, file_path: str) -> str:
        logging.info(f"Starting PDF text extraction for: {file_path}")
        
        if PYPDF2_AVAILABLE:
            try:
                direct_text = self._extract_direct_text(file_path)
                if len(direct_text.strip()) > 100:
                    logging.info("Direct text extraction successful")
                    return direct_text
            except Exception as e:
                logging.info(f"Direct text extraction failed: {str(e)}")
        
        if PDF_TO_IMAGE_AVAILABLE:
            try:
                return self._extract_with_llm_vision(file_path)
            except Exception as e:
                logging.error(f"LLM Vision OCR failed: {str(e)}")
                raise
        else:
            raise Exception("PDF to image conversion not available")
    
    def _extract_direct_text(self, file_path: str) -> str:
        """Extract text directly from PDF if it contains selectable text"""
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text = ""
            for page_num, page in enumerate(pdf_reader.pages):
                page_text = page.extract_text()
                if page_text:
                    text += f"Page {page_num + 1}:\n{page_text}\n\n"
            return text
    
    def _extract_with_llm_vision(self, file_path: str) -> str:
        """Extract text using LLM vision capabilities"""
        logging.info("Starting LLM Vision OCR extraction")
        
        images = convert_from_path(file_path, dpi=200, fmt='PNG')
        logging.info(f"Converted PDF to {len(images)} images")
        
        all_text = ""
        for i, image in enumerate(images):
            logging.info(f"Processing page {i + 1}/{len(images)} with LLM Vision")
            page_text = self._extract_text_from_image_with_llm(image, i + 1)
            if page_text.strip():
                all_text += f"=== PAGE {i + 1} ===\n{page_text}\n\n"
        
        if not all_text.strip():
            return "No text could be extracted from this document."
        
        return all_text
    
    def _extract_from_image(self, file_path: str) -> str:
        """Extract text from image file using LLM vision"""
        with Image.open(file_path) as image:
            return self._extract_text_from_image_with_llm(image, 1)
    
    def _extract_text_from_image_with_llm(self, image: Image.Image, page_num: int) -> str:
        """Use LLM vision to extract text from image"""
        try:
            buffer = io.BytesIO()
            if image.mode in ('RGBA', 'LA', 'P'):
                image = image.convert('RGB')
            image.save(buffer, format='JPEG', quality=95)
            base64_image = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            prompt = """You are an expert OCR system specialized in Romanian financial documents. 
            Please extract ALL text from this image with high accuracy. Pay special attention to:
            
            - Romanian diacritics (ă, â, î, ș, ț)
            - Numbers, dates, and currency amounts
            - Company names and CUI/EIN numbers
            - Table structures and line items
            - Preserve the original formatting and layout as much as possible
            
            Return ONLY the extracted text, maintaining the document structure.
            If you cannot read certain parts clearly, indicate with [UNCLEAR] but try your best to extract everything visible."""
            
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}",
                                    "detail": "high"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=4000,
                temperature=0.1
            )
            
            extracted_text = response.choices[0].message.content
            logging.info(f"Successfully extracted text from page {page_num} using LLM Vision")
            return extracted_text
            
        except Exception as e:
            logging.error(f"LLM Vision OCR failed for page {page_num}: {str(e)}")
            return f"[OCR_ERROR: Failed to extract text from page {page_num}]"
    
    def _extract_from_text_file(self, file_path: str) -> str:
        """Extract text from plain text files"""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        except UnicodeDecodeError:
            with open(file_path, "r", encoding="latin-1") as f:
                return f.read()

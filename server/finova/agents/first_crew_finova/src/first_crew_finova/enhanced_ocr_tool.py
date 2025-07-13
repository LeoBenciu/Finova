import os
import tempfile
import logging
from typing import Type
from pydantic import BaseModel, Field
from crewai.tools import BaseTool

try:
    import pytesseract
    from pdf2image import convert_from_path
    from PIL import Image, ImageEnhance, ImageFilter
    import cv2
    import numpy as np
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    
try:
    import PyPDF2
    PYPDF2_AVAILABLE = True
except ImportError:
    PYPDF2_AVAILABLE = False

class FileReadInput(BaseModel):
    file_path: str = Field(..., description="Path to the file to read")

class EnhancedRomanianTextExtractorTool(BaseTool):
    name: str = "enhanced_romanian_text_extractor"
    description: str = "Enhanced text extraction from files with advanced OCR for Romanian documents"
    args_schema: Type[BaseModel] = FileReadInput
    
    def _run(self, file_path: str) -> str:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
            
        if file_path.endswith(".pdf"):
            return self._extract_from_pdf(file_path)
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
        
        if OCR_AVAILABLE:
            try:
                return self._extract_with_enhanced_ocr(file_path)
            except Exception as e:
                logging.error(f"Enhanced OCR failed: {str(e)}")
                raise
        else:
            raise Exception("OCR dependencies not available")
    
    def _extract_direct_text(self, file_path: str) -> str:
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text = ""
            for page_num, page in enumerate(pdf_reader.pages):
                page_text = page.extract_text()
                if page_text:
                    text += f"Page {page_num + 1}:\n{page_text}\n\n"
            return text
    
    def _extract_with_enhanced_ocr(self, file_path: str) -> str:
        logging.info("Starting enhanced OCR extraction")
        
        images = convert_from_path(file_path, dpi=300, fmt='PNG')
        logging.info(f"Converted PDF to {len(images)} images")
        
        all_text = ""
        for i, image in enumerate(images):
            logging.info(f"Processing page {i + 1}/{len(images)}")
            page_text = self._extract_text_from_image(image, i + 1)
            if page_text.strip():
                all_text += f"=== PAGE {i + 1} ===\n{page_text}\n\n"
        
        if not all_text.strip():
            return "No text could be extracted from this document."
        
        return all_text
    
    def _extract_text_from_image(self, image: Image.Image, page_num: int) -> str:
        custom_config = r'--oem 3 --psm 6'
        
        try:
            text = pytesseract.image_to_string(image, lang='ron+eng', config=custom_config)
            if len(text.strip()) > 20:
                return text
        except:
            pass
        
        try:
            text = pytesseract.image_to_string(image, lang='eng', config=custom_config)
            return text
        except Exception as e:
            logging.error(f"OCR failed for page {page_num}: {str(e)}")
            return ""
    
    def _extract_from_text_file(self, file_path: str) -> str:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        except UnicodeDecodeError:
            with open(file_path, "r", encoding="latin-1") as f:
                return f.read()
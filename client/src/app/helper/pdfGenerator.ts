import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generatePDF = async (elementId: string, filename: string) => {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with id ${elementId} not found`);
    }

    const canvas = await html2canvas(element, {
      allowTaint: true,
      useCORS: true,
      logging: false,
      height: element.scrollHeight,
      width: element.scrollWidth
    });

    const imgData = canvas.toDataURL('image/png');
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    const marginX = 10;
    const marginY = 10;
    const availableWidth = pdfWidth - (marginX * 2);
    const availableHeight = pdfHeight - (marginY * 2);
    
    const ratio = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);
    const scaledWidth = imgWidth * ratio;
    const scaledHeight = imgHeight * ratio;
    
    const x = (pdfWidth - scaledWidth) / 2;
    const y = marginY;
    
    if (scaledHeight <= availableHeight) {
      pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight);
    } else {
      const pageHeight = availableHeight;
      let remainingHeight = scaledHeight;
      let sourceY = 0;
      
      while (remainingHeight > 0) {
        const heightToUse = Math.min(pageHeight, remainingHeight);
        
        const cropCanvas = document.createElement('canvas');
        const cropCtx = cropCanvas.getContext('2d');
        
        if (cropCtx) {
          const sourceHeight = (heightToUse / ratio);
          cropCanvas.width = imgWidth;
          cropCanvas.height = sourceHeight;
          
          cropCtx.drawImage(
            canvas, 
            0, sourceY / ratio, imgWidth, sourceHeight,
            0, 0, imgWidth, sourceHeight
          );
          
          const cropImgData = cropCanvas.toDataURL('image/png');
          pdf.addImage(cropImgData, 'PNG', x, y, scaledWidth, heightToUse);
        }
        
        remainingHeight -= heightToUse;
        sourceY += heightToUse;
        
        if (remainingHeight > 0) {
          pdf.addPage();
        }
      }
    }
    
    pdf.save(filename);
    
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error('Failed to generate PDF');
  }
};
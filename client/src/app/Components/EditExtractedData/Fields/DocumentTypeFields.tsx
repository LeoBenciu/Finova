import React from 'react';
import InvoiceFields from './InvoiceFields';
import ReceiptFields from './ReceiptFields';
import BankStatementFields from './BankStatementFields';
import ContractFields from './ContractFields';
import ZReportFields from './ZReportFields';
import PaymentOrderFields from './PaymentOrderFields';
import DefaultFields from './DefaultFields';

interface DocumentTypeFieldsProps {
  editFile: any;
  setEditFile: (value: any) => void;
}

const DocumentTypeFields: React.FC<DocumentTypeFieldsProps> = ({ editFile, setEditFile }) => {
  const documentType = editFile?.result?.document_type?.toLowerCase() || '';

  switch (documentType) {
    case 'invoice':
    case 'factura':
      return <InvoiceFields editFile={editFile} setEditFile={setEditFile} />;
    
    case 'receipt':
    case 'chitanta':
    case 'chitanță':
      return <ReceiptFields editFile={editFile} setEditFile={setEditFile} />;
    
    case 'bank statement':
    case 'extras de cont':
      return <BankStatementFields editFile={editFile} setEditFile={setEditFile} />;
    
    case 'contract':
    case 'contracte':
      return <ContractFields editFile={editFile} setEditFile={setEditFile} />;
    
    case 'z report':
    case 'raport z':
      return <ZReportFields editFile={editFile} setEditFile={setEditFile} />;
    
    case 'payment order':
    case 'collection order':
    case 'ordin de plata':
    case 'ordin de incasare':
      return <PaymentOrderFields editFile={editFile} setEditFile={setEditFile} />;
    
    default:
      return <DefaultFields editFile={editFile} setEditFile={setEditFile} />;
  }
};

export default DocumentTypeFields;
import React from 'react';
import EditableField from '../EditableField';
import { useSelector } from 'react-redux';

interface InvoiceFieldsProps {
  editFile: any;
  setEditFile: (value: any) => void;
}

const InvoiceFields: React.FC<InvoiceFieldsProps> = ({ editFile, setEditFile }) => {
  const language = useSelector((state: { user: { language: string } }) => state.user.language);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <EditableField
        label={language === 'ro' ? 'Numarul documentului' : 'Document number'}
        fieldName="document_number"
        editFile={editFile}
        setEditFile={setEditFile}
      />

      <EditableField
        label={language === 'ro' ? 'Data' : 'Date'}
        fieldName="document_date"
        editFile={editFile}
        setEditFile={setEditFile}
      />

      <EditableField
        label={language === 'ro' ? 'Data scadentei' : 'Due date'}
        fieldName="due_date"
        editFile={editFile}
        setEditFile={setEditFile}
      />

      <EditableField
        label={language === 'ro' ? 'Cumparator' : 'Buyer'}
        fieldName="buyer"
        editFile={editFile}
        setEditFile={setEditFile}
      />

      <EditableField
        label={language === 'ro' ? 'CUI Cumparator' : 'Buyer EIN'}
        fieldName="buyer_ein"
        editFile={editFile}
        setEditFile={setEditFile}
      />

      <EditableField
        label={language === 'ro' ? 'Vanzator' : 'Vendor'}
        fieldName="vendor"
        editFile={editFile}
        setEditFile={setEditFile}
      />

      <EditableField
        label={language === 'ro' ? 'CUI Vanzator' : 'Vendor EIN'}
        fieldName="vendor_ein"
        editFile={editFile}
        setEditFile={setEditFile}
      />

      <EditableField
        label={language === 'ro' ? 'Suma totala' : 'Total amount'}
        fieldName="total_amount"
        editFile={editFile}
        setEditFile={setEditFile}
      />

      <EditableField
        label={language === 'ro' ? 'Total TVA' : 'Vat amount'}
        fieldName="vat_amount"
        editFile={editFile}
        setEditFile={setEditFile}
      />

      <EditableField
        label={language === 'ro' ? 'Directie' : 'Direction'}
        fieldName="direction"
        editFile={editFile}
        setEditFile={setEditFile}
      />
    </div>
  );
};

export default InvoiceFields;
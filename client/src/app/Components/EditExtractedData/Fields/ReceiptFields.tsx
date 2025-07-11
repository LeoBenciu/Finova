import React from 'react';
import EditableField from '../EditableField';
import { useSelector } from 'react-redux';

interface ReceiptFieldsProps {
  editFile: any;
  setEditFile: (value: any) => void;
}

const ReceiptFields: React.FC<ReceiptFieldsProps> = ({ editFile, setEditFile }) => {
  const language = useSelector((state: { user: { language: string } }) => state.user.language);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {editFile?.result.receipt_of && (
        <div className="lg:col-span-2">
          <EditableField
            label={language === 'ro' ? "Chitanta pentru factura nr." : "Receipt for Invoice No."}
            fieldName="receipt_of"
            editFile={editFile}
            setEditFile={setEditFile}
          />
        </div>
      )}

      <EditableField
        label={language === 'ro' ? 'Numarul chitantei' : 'Receipt number'}
        fieldName="receipt_number"
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
        label={language === 'ro' ? 'Suma totala' : 'Total amount'}
        fieldName="total_amount"
        editFile={editFile}
        setEditFile={setEditFile}
      />

      <EditableField
        label={language === 'ro' ? 'Referinta factura' : 'Invoice reference'}
        fieldName="invoice_reference"
        editFile={editFile}
        setEditFile={setEditFile}
      />

      <EditableField
        label={language === 'ro' ? 'Metoda de plata' : 'Payment method'}
        fieldName="payment_method"
        editFile={editFile}
        setEditFile={setEditFile}
      />
    </div>
  );
};

export default ReceiptFields;
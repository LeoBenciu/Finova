import React from 'react';
import EditableField from '../EditableField';
import { useSelector } from 'react-redux';

interface PaymentOrderFieldsProps {
  editFile: any;
  setEditFile: (value: any) => void;
}

const PaymentOrderFields: React.FC<PaymentOrderFieldsProps> = ({ editFile, setEditFile }) => {
  const language = useSelector((state: { user: { language: string } }) => state.user.language);

  return (
    <div className="space-y-6">
      {/* Basic Payment Order Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EditableField
          label={language === 'ro' ? 'Numarul ordinului' : 'Order number'}
          fieldName="order_number"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Tipul ordinului' : 'Order type'}
          fieldName="order_type"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Platitor' : 'Payer'}
          fieldName="payer"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'CUI Platitor' : 'Payer EIN'}
          fieldName="payer_ein"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Beneficiar' : 'Payee'}
          fieldName="payee"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'CUI Beneficiar' : 'Payee EIN'}
          fieldName="payee_ein"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Suma' : 'Amount'}
          fieldName="amount"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Moneda' : 'Currency'}
          fieldName="currency"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Data ordinului' : 'Order date'}
          fieldName="order_date"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Data executiei' : 'Execution date'}
          fieldName="execution_date"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Referinta factura' : 'Reference invoice'}
          fieldName="reference_invoice"
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

      {/* Bank Details Section */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-[var(--text1)] mb-4">
          {language === 'ro' ? 'Detalii bancare' : 'Bank details'}
        </h3>
        
        <div className="bg-[var(--background)] border border-[var(--text4)] rounded-2xl p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EditableField
              label={language === 'ro' ? 'Numarul contului' : 'Account number'}
              fieldName="bank_details.account_number"
              editFile={editFile}
              setEditFile={(newEditFile) => {
                setEditFile({
                  ...editFile,
                  result: {
                    ...editFile?.result,
                    bank_details: {
                      ...editFile?.result?.bank_details,
                      account_number: newEditFile.result['bank_details.account_number']
                    }
                  }
                });
              }}
            />

            <EditableField
              label={language === 'ro' ? 'Numele bancii' : 'Bank name'}
              fieldName="bank_details.bank_name"
              editFile={editFile}
              setEditFile={(newEditFile) => {
                setEditFile({
                  ...editFile,
                  result: {
                    ...editFile?.result,
                    bank_details: {
                      ...editFile?.result?.bank_details,
                      bank_name: newEditFile.result['bank_details.bank_name']
                    }
                  }
                });
              }}
            />

            <EditableField
              label={language === 'ro' ? 'Cod SWIFT' : 'SWIFT code'}
              fieldName="bank_details.swift_code"
              editFile={editFile}
              setEditFile={(newEditFile) => {
                setEditFile({
                  ...editFile,
                  result: {
                    ...editFile?.result,
                    bank_details: {
                      ...editFile?.result?.bank_details,
                      swift_code: newEditFile.result['bank_details.swift_code']
                    }
                  }
                });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentOrderFields;
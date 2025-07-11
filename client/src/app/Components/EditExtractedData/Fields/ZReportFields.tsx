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
    <div className="space-y-6">
      {/* Basic Z Report Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EditableField
          label={language === 'ro' ? 'Numărul raportului' : 'Report number'}
          fieldName="report_number"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'ID casă de marcat' : 'Register ID'}
          fieldName="register_id"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Data afacerii' : 'Business date'}
          fieldName="business_date"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Ora deschiderii' : 'Opening time'}
          fieldName="opening_time"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Ora închiderii' : 'Closing time'}
          fieldName="closing_time"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Total vânzări' : 'Total sales'}
          fieldName="total_sales"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Total tranzacții' : 'Total transactions'}
          fieldName="total_transactions"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Tranzacții anulate' : 'Cancelled transactions'}
          fieldName="cancelled_transactions"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Suma rambursări' : 'Refunds amount'}
          fieldName="refunds_amount"
          editFile={editFile}
          setEditFile={setEditFile}
        />
      </div>

      {/* VAT Breakdown Section */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-[var(--text1)] mb-4">
          {language === 'ro' ? 'Detalii TVA' : 'VAT Breakdown'}
        </h3>
        
        <div className="bg-[var(--background)] border border-[var(--text4)] rounded-2xl p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EditableField
              label={language === 'ro' ? 'Rata TVA' : 'VAT rate'}
              fieldName="vat_breakdown.vat_rate"
              editFile={editFile}
              setEditFile={(newEditFile) => {
                setEditFile({
                  ...editFile,
                  result: {
                    ...editFile?.result,
                    vat_breakdown: {
                      ...editFile?.result?.vat_breakdown,
                      vat_rate: newEditFile.result['vat_breakdown.vat_rate']
                    }
                  }
                });
              }}
            />

            <EditableField
              label={language === 'ro' ? 'Suma netă' : 'Net amount'}
              fieldName="vat_breakdown.net_amount"
              editFile={editFile}
              setEditFile={(newEditFile) => {
                setEditFile({
                  ...editFile,
                  result: {
                    ...editFile?.result,
                    vat_breakdown: {
                      ...editFile?.result?.vat_breakdown,
                      net_amount: newEditFile.result['vat_breakdown.net_amount']
                    }
                  }
                });
              }}
            />

            <EditableField
              label={language === 'ro' ? 'Suma TVA' : 'VAT amount'}
              fieldName="vat_breakdown.vat_amount"
              editFile={editFile}
              setEditFile={(newEditFile) => {
                setEditFile({
                  ...editFile,
                  result: {
                    ...editFile?.result,
                    vat_breakdown: {
                      ...editFile?.result?.vat_breakdown,
                      vat_amount: newEditFile.result['vat_breakdown.vat_amount']
                    }
                  }
                });
              }}
            />

            <EditableField
              label={language === 'ro' ? 'Suma totală' : 'Total amount'}
              fieldName="vat_breakdown.total_amount"
              editFile={editFile}
              setEditFile={(newEditFile) => {
                setEditFile({
                  ...editFile,
                  result: {
                    ...editFile?.result,
                    vat_breakdown: {
                      ...editFile?.result?.vat_breakdown,
                      total_amount: newEditFile.result['vat_breakdown.total_amount']
                    }
                  }
                });
              }}
            />
          </div>
        </div>
      </div>

      {/* Payment Methods Section */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-[var(--text1)] mb-4">
          {language === 'ro' ? 'Metode de plată' : 'Payment Methods'}
        </h3>
        
        <div className="bg-[var(--background)] border border-[var(--text4)] rounded-2xl p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EditableField
              label={language === 'ro' ? 'Metodă' : 'Method'}
              fieldName="payment_methods.method"
              editFile={editFile}
              setEditFile={(newEditFile) => {
                setEditFile({
                  ...editFile,
                  result: {
                    ...editFile?.result,
                    payment_methods: {
                      ...editFile?.result?.payment_methods,
                      method: newEditFile.result['payment_methods.method']
                    }
                  }
                });
              }}
            />

            <EditableField
              label={language === 'ro' ? 'Suma' : 'Amount'}
              fieldName="payment_methods.amount"
              editFile={editFile}
              setEditFile={(newEditFile) => {
                setEditFile({
                  ...editFile,
                  result: {
                    ...editFile?.result,
                    payment_methods: {
                      ...editFile?.result?.payment_methods,
                      amount: newEditFile.result['payment_methods.amount']
                    }
                  }
                });
              }}
            />

            <EditableField
              label={language === 'ro' ? 'Număr tranzacții' : 'Transaction count'}
              fieldName="payment_methods.transaction_count"
              editFile={editFile}
              setEditFile={(newEditFile) => {
                setEditFile({
                  ...editFile,
                  result: {
                    ...editFile?.result,
                    payment_methods: {
                      ...editFile?.result?.payment_methods,
                      transaction_count: newEditFile.result['payment_methods.transaction_count']
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

export default InvoiceFields;
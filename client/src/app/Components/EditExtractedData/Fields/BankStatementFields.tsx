import React from 'react';
import EditableField from '../EditableField';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';

interface BankStatementFieldsProps {
  editFile: any;
  setEditFile: (value: any) => void;
}

interface Transaction {
  transaction_date: string;
  description: string;
  reference_number: string;
  debit_amount: number | null;
  credit_amount: number | null;
  balance_after_transaction: number;
  transaction_type: string;
}

const BankStatementFields: React.FC<BankStatementFieldsProps> = ({ editFile, setEditFile }) => {
  const language = useSelector((state: { user: { language: string } }) => state.user.language);
  const [showTransactions, setShowTransactions] = React.useState(false);

  const handleAddTransaction = () => {
    const newTransaction: Transaction = {
      transaction_date: '',
      description: '',
      reference_number: '',
      debit_amount: null,
      credit_amount: null,
      balance_after_transaction: 0,
      transaction_type: 'transfer'
    };

    setEditFile({
      ...editFile,
      result: {
        ...editFile?.result,
        transactions: [...(editFile?.result.transactions || []), newTransaction]
      }
    });
  };

  const handleDeleteTransaction = (index: number) => {
    const updatedTransactions = editFile?.result.transactions.filter((_: any, i: number) => i !== index);
    setEditFile({
      ...editFile,
      result: {
        ...editFile?.result,
        transactions: updatedTransactions
      }
    });
  };

  const updateTransaction = (index: number, field: string, value: any) => {
    const updatedTransactions = [...editFile?.result.transactions];
    updatedTransactions[index] = {
      ...updatedTransactions[index],
      [field]: value
    };
    setEditFile({
      ...editFile,
      result: {
        ...editFile?.result,
        transactions: updatedTransactions
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EditableField
          label={language === 'ro' ? 'Numele companiei' : 'Company name'}
          fieldName="company_name"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'CUI Companie' : 'Company EIN'}
          fieldName="company_ein"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Numele bancii' : 'Bank name'}
          fieldName="bank_name"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Numarul contului' : 'Account number'}
          fieldName="account_number"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Numarul extrasului' : 'Statement number'}
          fieldName="statement_number"
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
          label={language === 'ro' ? 'Data inceput perioada' : 'Statement period start'}
          fieldName="statement_period_start"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Data sfarsit perioada' : 'Statement period end'}
          fieldName="statement_period_end"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Sold initial' : 'Opening balance'}
          fieldName="opening_balance"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Sold final' : 'Closing balance'}
          fieldName="closing_balance"
          editFile={editFile}
          setEditFile={setEditFile}
        />
      </div>

      {/* Transactions Section */}
      <div className="mt-8">
        <button
          className="bg-[var(--primary)] text-white rounded-2xl flex items-center gap-3 px-6 py-3 
          hover:bg-[var(--primary)]/80 transition-all duration-200 font-medium shadow-sm w-full justify-between"
          onClick={() => setShowTransactions(!showTransactions)}
        >
          <span className="flex items-center gap-2">
            {language === 'ro' ? 'Tranzactii' : 'Transactions'}
            <span className="bg-white/20 text-xs px-2 py-1 rounded-full">
              {editFile?.result.transactions?.length || 0}
            </span>
          </span>
          <ChevronDown
            size={18}
            className={`transition-transform duration-200 ${showTransactions ? 'rotate-180' : ''}`}
          />
        </button>

        <AnimatePresence>
          {showTransactions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4 space-y-4"
            >
              <button
                onClick={handleAddTransaction}
                className="bg-[var(--primary)]/10 hover:bg-[var(--primary)] 
                hover:text-white text-[var(--primary)] px-4 py-2.5 rounded-2xl
                flex items-center gap-2 transition-all duration-200 font-medium"
              >
                <Plus size={18} />
                {language === 'ro' ? 'Adauga tranzactie' : 'Add transaction'}
              </button>

              {editFile?.result.transactions?.map((transaction: Transaction, index: number) => (
                <div
                  key={index}
                  className="bg-[var(--foreground)] border border-[var(--text4)] rounded-2xl p-4 space-y-4"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold text-[var(--text1)]">
                      {language === 'ro' ? `Tranzactie ${index + 1}` : `Transaction ${index + 1}`}
                    </h4>
                    <button
                      onClick={() => handleDeleteTransaction(index)}
                      className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-[var(--text2)] mb-1 block">
                        {language === 'ro' ? 'Data tranzactiei' : 'Transaction date'}
                      </label>
                      <input
                        type="text"
                        value={transaction.transaction_date || ''}
                        onChange={(e) => updateTransaction(index, 'transaction_date', e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--text4)] 
                        rounded-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-[var(--text2)] mb-1 block">
                        {language === 'ro' ? 'Tip tranzactie' : 'Transaction type'}
                      </label>
                      <select
                        value={transaction.transaction_type || 'transfer'}
                        onChange={(e) => updateTransaction(index, 'transaction_type', e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--text4)] 
                        rounded-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
                      >
                        <option value="transfer">Transfer</option>
                        <option value="payment">{language === 'ro' ? 'Plata' : 'Payment'}</option>
                        <option value="deposit">{language === 'ro' ? 'Depunere' : 'Deposit'}</option>
                        <option value="withdrawal">{language === 'ro' ? 'Retragere' : 'Withdrawal'}</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-sm text-[var(--text2)] mb-1 block">
                        {language === 'ro' ? 'Descriere' : 'Description'}
                      </label>
                      <input
                        type="text"
                        value={transaction.description || ''}
                        onChange={(e) => updateTransaction(index, 'description', e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--text4)] 
                        rounded-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-[var(--text2)] mb-1 block">
                        {language === 'ro' ? 'Numar referinta' : 'Reference number'}
                      </label>
                      <input
                        type="text"
                        value={transaction.reference_number || ''}
                        onChange={(e) => updateTransaction(index, 'reference_number', e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--text4)] 
                        rounded-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-[var(--text2)] mb-1 block">
                        {language === 'ro' ? 'Suma debit' : 'Debit amount'}
                      </label>
                      <input
                        type="number"
                        value={transaction.debit_amount || ''}
                        onChange={(e) => updateTransaction(index, 'debit_amount', e.target.value ? parseFloat(e.target.value) : null)}
                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--text4)] 
                        rounded-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-[var(--text2)] mb-1 block">
                        {language === 'ro' ? 'Suma credit' : 'Credit amount'}
                      </label>
                      <input
                        type="number"
                        value={transaction.credit_amount || ''}
                        onChange={(e) => updateTransaction(index, 'credit_amount', e.target.value ? parseFloat(e.target.value) : null)}
                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--text4)] 
                        rounded-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-[var(--text2)] mb-1 block">
                        {language === 'ro' ? 'Sold dupa tranzactie' : 'Balance after transaction'}
                      </label>
                      <input
                        type="number"
                        value={transaction.balance_after_transaction || ''}
                        onChange={(e) => updateTransaction(index, 'balance_after_transaction', e.target.value ? parseFloat(e.target.value) : 0)}
                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--text4)] 
                        rounded-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default BankStatementFields;
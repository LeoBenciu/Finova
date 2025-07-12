import React from 'react';
import EditableField from '../EditableField';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

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
  isExpanded?: boolean;
  isNew?: boolean;
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

  const truncateText = (text: string, maxLength: number = 40) => {
    if (!text) return '-';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
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
          hover:bg-[var(--primary)]/80 transition-all duration-200 font-medium w-full justify-between"
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
                  className="bg-[var(--foreground)] rounded-2xl border border-[var(--text4)] shadow-sm overflow-hidden"
                >
                  {/* Collapsible Header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-[var(--background)]/50 transition-colors duration-200"
                    onClick={() => {
                      const updatedTransactions = [...editFile?.result.transactions];
                      updatedTransactions[index] = {
                        ...updatedTransactions[index],
                        isExpanded: !transaction.isExpanded
                      };
                      setEditFile({
                        ...editFile,
                        result: {
                          ...editFile?.result,
                          transactions: updatedTransactions
                        }
                      });
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex items-center gap-2">
                          {transaction.isExpanded ? (
                            <ChevronUp size={20} className="text-[var(--text2)]" />
                          ) : (
                            <ChevronDown size={20} className="text-[var(--text2)]" />
                          )}
                          {transaction.isNew && (
                            <span className="bg-[var(--primary)] text-white text-xs px-2 py-1 rounded-full font-medium">
                              {language === 'ro' ? 'Nou' : 'New'}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[var(--text1)] font-medium truncate">
                            {truncateText(
                              transaction.description || (language === 'ro' ? 'Fără descriere' : 'No description'),
                              50
                            )}
                          </p>
                          <div className="flex items-center gap-4 mt-1 text-sm text-[var(--text2)]">
                            <span>{language === 'ro' ? 'Data:' : 'Date:'} {transaction.transaction_date || '-'}</span>
                            <span>
                              {language === 'ro' ? 'Debit:' : 'Debit:'} {transaction.debit_amount || 0}
                            </span>
                            <span>
                              {language === 'ro' ? 'Credit:' : 'Credit:'} {transaction.credit_amount || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTransaction(index);
                        }}
                        className="p-2 text-red-500 bg-red-50 hover:bg-red-500 hover:text-white rounded-xl transition-all duration-200 ml-2"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {transaction.isExpanded && (
                    <div className="border-t border-[var(--text4)] bg-[var(--background)]/30">
                      <div className="p-6">
                        {/* Description Field - Full Width */}
                        <div className="mb-6">
                          <label className="block text-sm font-semibold text-[var(--text1)] mb-2">
                            {language === 'ro' ? 'Descriere' : 'Description'}
                          </label>
                          <input
                            type="text"
                            value={transaction.description || ''}
                            onChange={(e) => updateTransaction(index, 'description', e.target.value)}
                            className="w-full h-12 rounded-xl px-4 bg-[var(--foreground)] border border-[var(--text4)] 
                            focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent 
                            text-[var(--text1)] transition-all duration-200"
                            placeholder={language === 'ro' ? 'Introdu descrierea...' : 'Enter description...'}
                          />
                        </div>

                        {/* First Row of Connected Fields */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-0 mb-4">
                          <div className="relative">
                            <label className="block text-xs font-medium text-[var(--text2)] mb-1 px-3">
                              {language === 'ro' ? 'Data tranzactiei' : 'Transaction date'}
                            </label>
                            <input
                              type="text"
                              value={transaction.transaction_date || ''}
                              onChange={(e) => updateTransaction(index, 'transaction_date', e.target.value)}
                              className="w-full h-11 px-3 bg-[var(--foreground)] border border-r-0 border-[var(--text4)] 
                              focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent focus:z-10 relative 
                              text-[var(--text1)] text-sm rounded-l-xl"
                              placeholder={language === 'ro' ? 'Data...' : 'Date...'}
                            />
                          </div>
                          <div className="relative">
                            <label className="block text-xs font-medium text-[var(--text2)] mb-1 px-3">
                              {language === 'ro' ? 'Numar referinta' : 'Reference number'}
                            </label>
                            <input
                              type="text"
                              value={transaction.reference_number || ''}
                              onChange={(e) => updateTransaction(index, 'reference_number', e.target.value)}
                              className="w-full h-11 px-3 bg-[var(--foreground)] border border-[var(--text4)] 
                              focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent focus:z-10 relative 
                              text-[var(--text1)] text-sm rounded-r-xl md:rounded-none"
                              placeholder={language === 'ro' ? 'Referinta...' : 'Reference...'}
                            />
                          </div>
                          <div className="relative hidden md:block">
                            <label className="block text-xs font-medium text-[var(--text2)] mb-1 px-3">
                              {language === 'ro' ? 'Tip tranzactie' : 'Transaction type'}
                            </label>
                            <select
                              value={transaction.transaction_type || 'transfer'}
                              onChange={(e) => updateTransaction(index, 'transaction_type', e.target.value)}
                              className="w-full h-11 px-3 bg-[var(--foreground)] border border-[var(--text4)] 
                              focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent focus:z-10 relative 
                              text-[var(--text1)] text-sm rounded-r-xl"
                            >
                              <option value="transfer">Transfer</option>
                              <option value="payment">{language === 'ro' ? 'Plata' : 'Payment'}</option>
                              <option value="deposit">{language === 'ro' ? 'Depunere' : 'Deposit'}</option>
                              <option value="withdrawal">{language === 'ro' ? 'Retragere' : 'Withdrawal'}</option>
                            </select>
                          </div>
                        </div>

                        {/* Second Row of Connected Fields */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-0 mb-4">
                          <div className="relative">
                            <label className="block text-xs font-medium text-[var(--text2)] mb-1 px-3">
                              {language === 'ro' ? 'Suma debit' : 'Debit amount'}
                            </label>
                            <input
                              type="number"
                              value={transaction.debit_amount || ''}
                              onChange={(e) =>
                                updateTransaction(index, 'debit_amount', e.target.value ? parseFloat(e.target.value) : null)
                              }
                              className="w-full h-11 px-3 bg-[var(--foreground)] border border-r-0 border-[var(--text4)] 
                              focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent focus:z-10 relative 
                              text-[var(--text1)] text-sm rounded-l-xl"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="relative">
                            <label className="block text-xs font-medium text-[var(--text2)] mb-1 px-3">
                              {language === 'ro' ? 'Suma credit' : 'Credit amount'}
                            </label>
                            <input
                              type="number"
                              value={transaction.credit_amount || ''}
                              onChange={(e) =>
                                updateTransaction(index, 'credit_amount', e.target.value ? parseFloat(e.target.value) : null)
                              }
                              className="w-full h-11 px-3 bg-[var(--foreground)] border border-[var(--text4)] 
                              focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent focus:z-10 relative 
                              text-[var(--text1)] text-sm rounded-r-xl md:rounded-none"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="relative">
                            <label className="block text-xs font-medium text-[var(--text2)] mb-1 px-3">
                              {language === 'ro' ? 'Sold dupa tranzactie' : 'Balance after transaction'}
                            </label>
                            <input
                              type="number"
                              value={transaction.balance_after_transaction || ''}
                              onChange={(e) =>
                                updateTransaction(index, 'balance_after_transaction', e.target.value ? parseFloat(e.target.value) : 0)
                              }
                              className="w-full h-11 px-3 bg-[var(--foreground)] border border-[var(--text4)] 
                              focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent focus:z-10 relative 
                              text-[var(--text1)] text-sm rounded-r-xl"
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        {/* Transaction Type for Mobile */}
                        <div className="mt-4 md:hidden">
                          <label className="block text-xs font-medium text-[var(--text2)] mb-1">
                            {language === 'ro' ? 'Tip tranzactie' : 'Transaction type'}
                          </label>
                          <select
                            value={transaction.transaction_type || 'transfer'}
                            onChange={(e) => updateTransaction(index, 'transaction_type', e.target.value)}
                            className="w-full h-11 px-3 bg-[var(--foreground)] border border-[var(--text4)] 
                            focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent 
                            text-[var(--text1)] text-sm rounded-xl"
                          >
                            <option value="transfer">Transfer</option>
                            <option value="payment">{language === 'ro' ? 'Plata' : 'Payment'}</option>
                            <option value="deposit">{language === 'ro' ? 'Depunere' : 'Deposit'}</option>
                            <option value="withdrawal">{language === 'ro' ? 'Retragere' : 'Withdrawal'}</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
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
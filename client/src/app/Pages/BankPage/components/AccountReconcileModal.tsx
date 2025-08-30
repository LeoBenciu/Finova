import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Target, CreditCard } from 'lucide-react';

interface AccountReconcileModalProps {
  open: boolean;
  language: 'ro' | 'en' | string;
  selectedTransaction: {
    id: string;
    description: string;
    amount: number;
    transactionDate: string;
    transactionType: 'debit' | 'credit';
  } | null;
  isLoading: boolean;
  onCancel: () => void;
  onSelect: (accountCode: { code: string; name?: string }) => void;
  // utils
  formatDate: (d: any) => string;
  formatCurrency: (n: any) => string;
  // embedded selector component
  AccountCodeSelector: React.ComponentType<{
    onSelect: (accountCode: { code: string; name?: string }) => void;
    onCancel: () => void;
    isLoading: boolean;
    language: any;
  }>;
}

const AccountReconcileModal: React.FC<AccountReconcileModalProps> = ({
  open,
  language,
  selectedTransaction,
  isLoading,
  onCancel,
  onSelect,
  formatDate,
  formatCurrency,
  AccountCodeSelector,
}) => {
  return (
    <AnimatePresence>
      {open && selectedTransaction && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-[var(--foreground)] rounded-2xl border border-[var(--text4)] shadow-2xl max-w-2xl w-full p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-[var(--primary)]/10 rounded-xl flex items-center justify-center">
                <Target size={24} className="text-[var(--primary)]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[var(--text1)]">
                  {language === 'ro' ? 'Reconciliază cu Cont Contabil' : 'Reconcile with Account Code'}
                </h3>
                <p className="text-[var(--text2)]">
                  {language === 'ro' ? 'Selectează contul contabil pentru această tranzacție' : 'Select the chart of account for this transaction'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-[var(--background)] rounded-xl border border-[var(--text4)] mb-6">
              <h4 className="font-semibold text-[var(--text1)] mb-3 flex items-center gap-2">
                <CreditCard size={18} />
                {language === 'ro' ? 'Detalii Tranzacție' : 'Transaction Details'}
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text3)]">{language === 'ro' ? 'Descriere:' : 'Description:'}</span>
                  <span className="text-[var(--text1)] truncate ml-2">{selectedTransaction.description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text3)]">{language === 'ro' ? 'Sumă:' : 'Amount:'}</span>
                  <span className={`font-semibold ${selectedTransaction.transactionType === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {selectedTransaction.transactionType === 'credit' ? '+' : ''}
                    {formatCurrency(selectedTransaction.amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text3)]">{language === 'ro' ? 'Data:' : 'Date:'}</span>
                  <span className="text-[var(--text1)]">{formatDate(selectedTransaction.transactionDate)}</span>
                </div>
              </div>
            </div>

            <AccountCodeSelector
              onSelect={onSelect}
              onCancel={onCancel}
              isLoading={isLoading}
              language={language}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AccountReconcileModal;

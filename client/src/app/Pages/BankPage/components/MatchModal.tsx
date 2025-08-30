import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, FileText, CreditCard, AlertTriangle, Loader2 } from 'lucide-react';

interface MatchModalProps {
  open: boolean;
  language: 'ro' | 'en' | string;
  matchingPair: {
    document: any;
    transaction: any;
  } | null;
  onCancel: () => void;
  onConfirm: () => void;
  isCreating?: boolean;
  // utils
  formatDate: (d: any) => string;
  formatCurrency: (n: any) => string;
  getDocumentDate: (doc: any) => Date | string | undefined;
  getDocumentAmount: (doc: any) => number;
}

const MatchModal: React.FC<MatchModalProps> = ({
  open,
  language,
  matchingPair,
  onCancel,
  onConfirm,
  isCreating,
  formatDate,
  formatCurrency,
  getDocumentDate,
  getDocumentAmount,
}) => {
  return (
    <AnimatePresence>
      {open && matchingPair && (
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
                <Link size={24} className="text-[var(--primary)]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[var(--text1)]">
                  {language === 'ro' ? 'Confirmă Reconcilierea' : 'Confirm Reconciliation'}
                </h3>
                <p className="text-[var(--text2)]">
                  {language === 'ro' ? 'Verifică detaliile înainte de a confirma' : 'Review details before confirming'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-[var(--background)] rounded-xl border border-[var(--text4)]">
                <h4 className="font-semibold text-[var(--text1)] mb-3 flex items-center gap-2">
                  <FileText size={18} />
                  Document
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--text3)]">Număr:</span>
                    <span className="text-[var(--text1)]">{matchingPair.document.document_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text3)]">Furnizor:</span>
                    <span className="text-[var(--text1)]">{matchingPair.document.vendor}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text3)]">Sumă:</span>
                    <span className="text-[var(--primary)] font-semibold">
                      {formatCurrency(getDocumentAmount(matchingPair.document))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text3)]">Data:</span>
                    <span className="text-[var(--text1)]">{formatDate(getDocumentDate(matchingPair.document) as any)}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[var(--background)] rounded-xl border border-[var(--text4)]">
                <h4 className="font-semibold text-[var(--text1)] mb-3 flex items-center gap-2">
                  <CreditCard size={18} />
                  Tranzacție
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--text3)]">Descriere:</span>
                    <span className="text-[var(--text1)] truncate ml-2">{matchingPair.transaction.description}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text3)]">Referință:</span>
                    <span className="text-[var(--text1)]">{matchingPair.transaction.referenceNumber || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text3)]">Sumă:</span>
                    <span className={`font-semibold ${matchingPair.transaction.transactionType === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {matchingPair.transaction.transactionType === 'credit' ? '+' : ''}
                      {formatCurrency(matchingPair.transaction.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text3)]">Data:</span>
                    <span className="text-[var(--text1)]">{formatDate(matchingPair.transaction.transactionDate)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl mb-6">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={18} className="text-yellow-600" />
                <span className="font-semibold text-yellow-800">
                  {language === 'ro' ? 'Verificare Sumă' : 'Amount Verification'}
                </span>
              </div>
              <p className="text-sm text-yellow-700">
                {Math.abs(getDocumentAmount(matchingPair.document) - Math.abs(matchingPair.transaction.amount)) < 0.01
                  ? (language === 'ro' ? '✓ Sumele se potrivesc perfect' : '✓ Amounts match perfectly')
                  : (language === 'ro'
                      ? `⚠ Diferență de sumă: ${Math.abs(getDocumentAmount(matchingPair.document) - Math.abs(matchingPair.transaction.amount)).toFixed(2)} RON`
                      : `⚠ Amount difference: ${Math.abs(getDocumentAmount(matchingPair.document) - Math.abs(matchingPair.transaction.amount)).toFixed(2)} RON`)
                }
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={onCancel} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium">
                {language === 'ro' ? 'Anulează' : 'Cancel'}
              </button>
              <button onClick={onConfirm} disabled={!!isCreating} className="px-6 py-3 bg-[var(--primary)] text-white rounded-xl hover:bg-[var(--primary)]/90 transition-colors font-medium disabled:opacity-50 flex items-center gap-2">
                {isCreating && <Loader2 size={16} className="animate-spin" />}
                {language === 'ro' ? 'Confirmă Reconcilierea' : 'Confirm Match'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MatchModal;

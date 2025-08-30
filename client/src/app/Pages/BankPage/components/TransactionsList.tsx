import React from 'react';
import { motion } from 'framer-motion';
import { CreditCard, RefreshCw, AlertTriangle, CheckSquare, Square, Eye, Target, Edit2, ChevronDown, ChevronRight, X, Calendar, ArrowRight } from 'lucide-react';

// Types aligned with BankPage.tsx usage
export interface BankTransactionItem {
  id: string | number;
  transactionDate: string;
  description: string;
  amount: number;
  transactionType: 'debit' | 'credit';
  referenceNumber?: string;
  balanceAfter?: number;
  reconciliation_status: 'unreconciled' | 'matched' | 'ignored' | 'auto_matched' | 'manually_matched' | 'pending';
  matched_document_id?: number;
  confidence_score?: number;
  bankStatementDocument?: {
    id?: number;
    name?: string;
    signedUrl?: string;
  } | null;
}

interface TransactionsListProps {
  language: 'ro' | 'en' | string;
  transactionsData: BankTransactionItem[];
  transactionsTotal: number;
  transactionsLoading: boolean;
  transactionsError: any;
  filteredTransactions: BankTransactionItem[];

  selectedItems: { documents: string[]; transactions: Array<string | number> };
  draggedItem: any;

  // UI helpers
  getStatusColor: (status?: string) => string;
  getStatusText: (status: string | undefined, language: string) => string;
  normalizeStatus: (status?: string) => string;
  formatDate: (d: any) => string;
  formatCurrency: (n: number) => string;

  // State/controls
  outstandingTxnIds: Set<string>;
  expandedSplits: Record<string | number, boolean>;
  unreconciling: Set<string | number>;

  // Handlers
  toggleTransactionSelection: (id: string | number) => void;
  setSelectedTransactionForAccount: (txn: BankTransactionItem) => void;
  setShowAccountReconcileModal: (open: boolean) => void;
  setSelectedTransactionForSplit: (txn: BankTransactionItem) => void;
  setShowSplitModal: (open: boolean) => void;
  handleUnreconcileTransaction: (id: string | number) => void;
  setExpandedSplits: React.Dispatch<React.SetStateAction<Record<string | number, boolean>>>;

  handleDragStart: (type: 'document' | 'transaction', id: string | number) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, targetType: 'document' | 'transaction', targetId: string | number) => void;
}

const TransactionsList: React.FC<TransactionsListProps> = ({
  language,
  transactionsData,
  transactionsTotal,
  transactionsLoading,
  transactionsError,
  filteredTransactions,
  selectedItems,
  draggedItem,
  getStatusColor,
  getStatusText,
  normalizeStatus,
  formatDate,
  formatCurrency,
  outstandingTxnIds,
  expandedSplits,
  unreconciling,
  toggleTransactionSelection,
  setSelectedTransactionForAccount,
  setShowAccountReconcileModal,
  setSelectedTransactionForSplit,
  setShowSplitModal,
  handleUnreconcileTransaction,
  setExpandedSplits,
  handleDragStart,
  handleDragOver,
  handleDrop,
}) => {
  return (
    <div className="bg-[var(--foreground)] rounded-2xl border border-[var(--text4)] shadow-sm overflow-hidden">
      <div className="p-4 border-b border-[var(--text4)] bg-[var(--background)]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--text1)] flex items-center gap-2">
            <CreditCard size={20} />
            {language === 'ro' ? 'Tranzacții Bancare' : 'Bank Transactions'}
          </h3>
          <span className="text-sm text-[var(--text3)]">
            {transactionsData.length}/{transactionsTotal} {language === 'ro' ? 'articole' : 'items'}
          </span>
        </div>
      </div>

      <div className="p-4 max-h-[600px] overflow-y-auto scrollbar-soft">
        {transactionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-[var(--text2)]">
              <RefreshCw size={20} className="animate-spin" />
              <span>{language === 'ro' ? 'Se încarcă tranzacțiile...' : 'Loading transactions...'}</span>
            </div>
          </div>
        ) : transactionsError ? (
          <div className="text-center py-12">
            <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
            <p className="text-red-600">{language === 'ro' ? 'Eroare la încărcarea tranzacțiilor' : 'Error loading transactions'}</p>
          </div>
        ) : filteredTransactions?.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard size={48} className="mx-auto text-[var(--text3)] mb-4" />
            <p className="text-[var(--text2)] text-lg mb-2">
              {language === 'ro' ? 'Nu s-au găsit tranzacții' : 'No transactions found'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map((txn: any, index: number) => {
              const isSelected = selectedItems.transactions.includes(txn.id as any);
              return (
                <motion.div
                  key={txn.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  draggable
                  onDragStart={() => handleDragStart('transaction', txn.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, 'transaction', txn.id)}
                  className={`p-4 bg-[var(--background)] rounded-xl border-2 transition-all duration-300 cursor-grab active:cursor-grabbing ${
                    isSelected
                      ? 'border-[var(--primary)] shadow-md bg-[var(--primary)]/5'
                      : 'border-[var(--text4)] hover:border-[var(--primary)]/50'
                  } ${draggedItem?.type === 'document' ? 'border-dashed border-emerald-400 bg-emerald-50' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => toggleTransactionSelection(txn.id)}
                      className="p-1 hover:bg-[var(--text4)]/20 bg-transparent rounded-lg transition-colors"
                    >
                      {isSelected ? (
                        <CheckSquare size={20} className="text-[var(--primary)]" />
                      ) : (
                        <Square size={20} className="text-[var(--text3)]" />
                      )}
                    </button>

                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      txn.transactionType === 'credit' ? 'bg-emerald-100' : 'bg-red-100'
                    }`}>
                      <ArrowRight size={18} className={`${
                        txn.transactionType === 'credit' ? 'text-emerald-600 rotate-180' : 'text-red-600'
                      }`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-[var(--text1)] truncate">{txn.description}</p>
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(txn.reconciliation_status)}`}>
                          {getStatusText(txn.reconciliation_status, language)}
                        </span>
                        {outstandingTxnIds.has(String(txn.id)) && (
                          <span className="px-2 py-1 rounded-lg text-xs font-medium bg-yellow-100 text-yellow-700">
                            {language === 'ro' ? 'În Așteptare' : 'Outstanding'}
                          </span>
                        )}
                        {txn.confidence_score && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-medium">
                            {Math.round(txn.confidence_score * 100)}%
                          </span>
                        )}
                      </div>
                      {txn.referenceNumber && (
                        <p className="text-sm text-[var(--text3)] mb-2 text-left">Ref: {txn.referenceNumber}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-[var(--text3)]">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(txn.transactionDate)}
                        </span>
                        <span className={`flex items-center gap-1 font-semibold ${
                          txn.transactionType === 'credit' ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {txn.transactionType === 'credit' ? '+' : ''}{formatCurrency(txn.amount)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 ml-2">
                      <button
                        className={`p-1 transition-colors rounded-lg ${
                          txn.bankStatementDocument?.signedUrl
                            ? 'hover:text-white hover:bg-[var(--primary)] bg-[var(--primary)]/20 text-[var(--primary)] cursor-pointer'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                        onClick={() => {
                          if (txn.bankStatementDocument?.signedUrl) {
                            window.open(txn.bankStatementDocument.signedUrl, '_blank', 'noopener,noreferrer');
                          } else {
                            alert(
                              language === 'ro'
                                ? 'Extractul bancar nu este disponibil pentru această tranzacție'
                                : 'Bank statement not available for this transaction'
                            );
                          }
                        }}
                        disabled={!txn.bankStatementDocument?.signedUrl}
                        title={language === 'ro' ? 'Vezi extrasul de cont bancar' : 'View bank statement'}
                      >
                        <Eye size={14} />
                      </button>

                      {(() => {
                        const normalized = normalizeStatus(txn.reconciliation_status);
                        const shouldShowAccountButton = normalized === 'unreconciled';
                        return shouldShowAccountButton;
                      })() && (
                        <button
                          className="p-1 transition-colors rounded-lg hover:text-white hover:bg-purple-500 bg-purple-200 text-purple-600 cursor-pointer"
                          onClick={() => {
                            setSelectedTransactionForAccount(txn);
                            setShowAccountReconcileModal(true);
                          }}
                          title={language === 'ro' ? 'Reconciliază cu cont contabil' : 'Reconcile with account code'}
                        >
                          <Target size={14} />
                        </button>
                      )}

                      {(() => {
                        const normalized = normalizeStatus(txn.reconciliation_status);
                        const shouldShowSplitButton = normalized === 'unreconciled';
                        return shouldShowSplitButton;
                      })() && (
                        <button
                          className="p-1 transition-colors rounded-lg hover:text-white hover:bg-blue-500 bg-blue-200 text-blue-600 cursor-pointer"
                          onClick={() => {
                            setSelectedTransactionForSplit(txn);
                            setShowSplitModal(true);
                          }}
                          title={language === 'ro' ? 'Împarte tranzacția' : 'Split transaction'}
                        >
                          <Edit2 size={14} />
                        </button>
                      )}

                      {/* Expand/collapse splits preview */}
                      <button
                        className="p-1 transition-colors rounded-lg hover:text-white hover:bg-gray-500/40 bg-gray-200 text-gray-700 cursor-pointer"
                        onClick={() =>
                          setExpandedSplits((prev: Record<string | number, boolean>) => ({ ...prev, [txn.id]: !prev[txn.id] }))
                        }
                        title={
                          expandedSplits[txn.id]
                            ? language === 'ro'
                              ? 'Ascunde împărțirile'
                              : 'Hide splits'
                            : language === 'ro'
                              ? 'Arată împărțirile'
                              : 'Show splits'
                        }
                      >
                        {expandedSplits[txn.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>

                      {(() => {
                        const normalized = normalizeStatus(txn.reconciliation_status);
                        const shouldShow = ['matched', 'auto_matched', 'manually_matched'].includes(normalized);
                        return shouldShow;
                      })() && (
                        <button
                          className={`p-1 transition-colors rounded-lg ${
                            unreconciling.has(txn.id)
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'hover:text-white hover:bg-red-500 bg-red-100 text-red-600 cursor-pointer'
                          }`}
                          onClick={() => handleUnreconcileTransaction(txn.id)}
                          disabled={unreconciling.has(txn.id)}
                          title={language === 'ro' ? 'Dereconciliază tranzacția' : 'Unreconcile transaction'}
                        >
                          {unreconciling.has(txn.id) ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400"></div>
                          ) : (
                            <X size={14} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionsList;

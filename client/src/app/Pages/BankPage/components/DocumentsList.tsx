import React from 'react';
import { motion } from 'framer-motion';
import { FileText, RefreshCw, AlertTriangle, CheckSquare, Square, Eye, Loader2, Check, Trash2, Clock, Calendar } from 'lucide-react';

// Types are aligned with BankPage.tsx usage
export interface DocumentItem {
  id: string;
  type: string;
  document_number?: string;
  name?: string;
  vendor?: string;
  reconciliation_status?: string;
  signedUrl?: string | null;
  path?: string | null;
}

interface DocumentsListProps {
  language: 'ro' | 'en' | string;
  documentsData: DocumentItem[];
  documentsTotal: number;
  documentsLoading: boolean;
  documentsError: any;
  filteredDocuments: DocumentItem[];
  selectedItems: { documents: string[]; transactions: Array<string | number> };
  outstandingDocIds: Set<string>;
  unreconciledTransactionsCount: number;

  // UI helpers from container
  getDocumentIcon: (type?: string) => React.ComponentType<any>;
  getStatusColor: (status?: string) => string;
  getStatusText: (status: string | undefined, language: string) => string;
  normalizeStatus: (status?: string) => string;
  formatDate: (d: any) => string;
  formatCurrency: (n: number) => string;
  getDocumentDate: (doc: any) => any;
  getDocumentAmount: (doc: any) => number;

  // Interactions and state from container
  draggedItem: any;
  updatingDocStatus: Set<string>;
  markingAsOutstanding: Set<string>;

  toggleFileSelection: (id: string) => void;
  handleToggleDocumentIgnored: (doc: DocumentItem) => void;
  handleMarkAsOutstanding: (doc: DocumentItem) => void;

  handleDragStart: (type: 'document' | 'transaction', id: string | number) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, targetType: 'document' | 'transaction', targetId: string | number) => void;
}

const DocumentsList: React.FC<DocumentsListProps> = ({
  language,
  documentsData,
  documentsTotal,
  documentsLoading,
  documentsError,
  filteredDocuments,
  selectedItems,
  outstandingDocIds,
  unreconciledTransactionsCount,
  getDocumentIcon,
  getStatusColor,
  getStatusText,
  normalizeStatus,
  formatDate,
  formatCurrency,
  getDocumentDate,
  getDocumentAmount,
  draggedItem,
  updatingDocStatus,
  markingAsOutstanding,
  toggleFileSelection,
  handleToggleDocumentIgnored,
  handleMarkAsOutstanding,
  handleDragStart,
  handleDragOver,
  handleDrop,
}) => {
  return (
    <div className="bg-[var(--foreground)] rounded-2xl border border-[var(--text4)] shadow-sm overflow-hidden">
      <div className="p-4 border-b border-[var(--text4)] bg-[var(--background)]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--text1)] flex items-center gap-2">
            <FileText size={20} />
            {language === 'ro' ? 'Documente' : 'Documents'}
          </h3>
          <span className="text-sm text-[var(--text3)]">
            {documentsData.length}/{documentsTotal} {language === 'ro' ? 'articole' : 'items'}
          </span>
        </div>
      </div>

      <div className="p-4 max-h-[600px] overflow-y-auto scrollbar-soft">
        {documentsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-[var(--text2)]">
              <RefreshCw size={20} className="animate-spin" />
              <span>{language === 'ro' ? 'Se încarcă documentele...' : 'Loading documents...'}</span>
            </div>
          </div>
        ) : documentsError ? (
          <div className="text-center py-12">
            <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
            <p className="text-red-600">{language === 'ro' ? 'Eroare la încărcarea documentelor' : 'Error loading documents'}</p>
          </div>
        ) : filteredDocuments?.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-[var(--text3)] mb-4" />
            <p className="text-[var(--text2)] text-lg mb-2">
              {language === 'ro' ? 'Nu s-au găsit documente' : 'No documents found'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDocuments.map((doc: any, index: number) => {
              const Icon = getDocumentIcon(doc.type);
              const isSelected = selectedItems.documents.includes(doc.id);

              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  draggable
                  onDragStart={() => handleDragStart('document', doc.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, 'document', doc.id)}
                  className={`p-4 bg-[var(--background)] rounded-xl border-2 transition-all duration-300 cursor-grab active:cursor-grabbing ${
                    isSelected
                      ? 'border-[var(--primary)] shadow-md bg-[var(--primary)]/5'
                      : 'border-[var(--text4)] hover:border-[var(--primary)]/50'
                  } ${draggedItem?.type === 'transaction' ? 'border-dashed border-emerald-400 bg-emerald-50' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => toggleFileSelection(doc.id)}
                      className="p-1 hover:bg-[var(--text4)]/20 bg-transparent rounded-lg transition-colors"
                    >
                      {isSelected ? (
                        <CheckSquare size={20} className="text-[var(--primary)]" />
                      ) : (
                        <Square size={20} className="text-[var(--text3)]" />
                      )}
                    </button>

                    <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon size={18} className="text-[var(--primary)]" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-[var(--text1)] truncate">{doc.document_number || doc.name}</p>
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(doc.reconciliation_status)}`}>
                          {getStatusText(doc.reconciliation_status, language)}
                        </span>
                        {outstandingDocIds.has(doc.id) && (
                          <span className="px-2 py-1 rounded-lg text-xs font-medium bg-yellow-100 text-yellow-700">
                            {language === 'ro' ? 'În Așteptare' : 'Outstanding'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[var(--text3)] mb-2 truncate text-left">{doc.vendor}</p>
                      <div className="flex items-center gap-4 text-xs text-[var(--text3)]">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(getDocumentDate(doc))}
                        </span>
                        <span className="flex items-center gap-1">
                          {formatCurrency(getDocumentAmount(doc))}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 ml-2">
                      <button
                        className="p-1 hover:text-white hover:bg-[var(--primary)] bg-[var(--primary)]/20 text-[var(--primary)] transition-colors rounded-lg"
                        onClick={() => {
                          if (doc.signedUrl || doc.path) {
                            window.open(doc.signedUrl || doc.path, '_blank', 'noopener,noreferrer');
                          }
                        }}
                        title={language === 'ro' ? 'Vezi documentul' : 'View document'}
                      >
                        <Eye size={14} />
                      </button>
                      {(() => {
                        const normalized = normalizeStatus(doc.reconciliation_status);
                        const isIgnored = normalized === 'ignored';
                        const isUpdating = updatingDocStatus.has(doc.id);
                        const title = isIgnored
                          ? (language === 'ro' ? 'Revenire la nereconciliat' : 'Revert to Unreconciled')
                          : (language === 'ro' ? 'Ignoră documentul' : 'Ignore document');
                        const btnClasses = isIgnored
                          ? (isUpdating
                              ? 'p-1 bg-gray-200 text-gray-400 cursor-not-allowed rounded-lg'
                              : 'p-1 hover:text-white hover:bg-emerald-600 bg-emerald-100 text-emerald-600 transition-colors rounded-lg')
                          : (isUpdating
                              ? 'p-1 bg-gray-200 text-gray-400 cursor-not-allowed rounded-lg'
                              : 'p-1 hover:text-white hover:bg-red-600 bg-red-100 text-red-600 transition-colors rounded-lg');
                        return (
                          <button
                            className={btnClasses}
                            onClick={() => handleToggleDocumentIgnored(doc)}
                            disabled={isUpdating}
                            title={title}
                          >
                            {isUpdating ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              isIgnored ? <Check size={14} /> : <Trash2 size={14} />
                            )}
                          </button>
                        );
                      })()}

                      {/* Mark as Outstanding - only show when no unreconciled transactions and document is unreconciled */}
                      {unreconciledTransactionsCount === 0 &&
                        ['unreconciled', 'pending'].includes(normalizeStatus(doc.reconciliation_status)) && (
                          <button
                            className="p-1 hover:text-white hover:bg-yellow-600 bg-yellow-100 text-yellow-600 transition-colors rounded-lg disabled:opacity-50"
                            onClick={() => handleMarkAsOutstanding(doc)}
                            disabled={markingAsOutstanding.has(doc.id)}
                            title={language === 'ro' ? 'Marchează ca Element în Așteptare' : 'Mark as Outstanding'}
                          >
                            {markingAsOutstanding.has(doc.id) ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Clock size={14} />
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

export default DocumentsList;

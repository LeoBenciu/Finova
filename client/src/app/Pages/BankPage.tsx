import { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { 
  Landmark, 
  Search, 
  CreditCard,
  FileText,
  Receipt,
  ArrowRight,
  Link,
  Calendar,
  AlertTriangle,
  Check,
  X,
  Zap,
  Target,
  TrendingUp,
  Eye,
  RefreshCw,
  Loader2,
  Square,
  CheckSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useGetBankReconciliationStatsQuery,
  useGetFinancialDocumentsQuery,
  useGetBankTransactionsQuery,
  useGetReconciliationSuggestionsQuery,
  useCreateManualMatchMutation,
  useCreateBulkMatchesMutation,
  useAcceptReconciliationSuggestionMutation,
  useRejectReconciliationSuggestionMutation
} from '@/redux/slices/apiSlice';

interface Document {
  id: number;
  name: string;
  type: 'Invoice' | 'Receipt' | 'Z Report' | 'Payment Order' | 'Collection Order';
  document_number?: string;
  total_amount: number;
  document_date: string;
  vendor?: string;
  buyer?: string;
  direction?: 'incoming' | 'outgoing';
  reconciliation_status: 'unreconciled' | 'auto_matched' | 'manually_matched' | 'disputed';
  matched_transactions?: string[];
  references?: number[];
  signedUrl?: string; 
  path?: string;      
}

interface BankTransaction {
  id: string;
  transactionDate: string;
  description: string;
  amount: number;
  transactionType: 'debit' | 'credit';
  referenceNumber?: string;
  balanceAfter?: number;
  reconciliation_status: 'unreconciled' | 'matched' | 'ignored';
  matched_document_id?: number;
  confidence_score?: number;
  bankStatementDocument?: {
    id: number;
    name: string;
    signedUrl?: string;
  };
}

interface ReconciliationSuggestion {
  id: number;
  document_id: number;
  transaction_id: string;
  confidenceScore: number;
  matchingCriteria: string[];
  reasons: string[];
  document: {
    id: number;
    name: string;
    type: string;
  };
  bankTransaction: {
    id: string;
    description: string;
    amount: number;
    transactionDate: string;
    transactionType: 'debit' | 'credit';
  };
}

const BankPage = () => {
  const language = useSelector((state: {user:{language:string}}) => state.user.language);
  const clientCompanyEin = useSelector((state: {clientCompany: {current: {ein: string}}}) => state.clientCompany.current.ein);
  // State management
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('unreconciled');
  const [activeTab, setActiveTab] = useState<'reconciliation' | 'suggestions' | 'reports'>('reconciliation');
  const [selectedItems, setSelectedItems] = useState<{documents: number[], transactions: string[]}>({documents: [], transactions: []});
  const [draggedItem, setDraggedItem] = useState<{type: 'document' | 'transaction', id: string | number} | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchingPair, setMatchingPair] = useState<{document: Document, transaction: BankTransaction} | null>(null);

  const normalizeStatus = (status: string): string => {
    const statusMap: Record<string, string> = {
      'UNRECONCILED': 'unreconciled',
      'PENDING': 'unreconciled', 
      'AUTO_MATCHED': 'auto_matched',
      'MANUALLY_MATCHED': 'manually_matched',
      'MATCHED': 'matched',
      'DISPUTED': 'disputed',
      'IGNORED': 'ignored'
    };
    
    return statusMap[status?.toUpperCase()] || status?.toLowerCase() || 'unreconciled';
  };

  const getStatusColor = (status: string) => {
    const normalizedStatus = normalizeStatus(status);
    
    switch(normalizedStatus) {
      case 'matched':
      case 'auto_matched': 
      case 'manually_matched':
        return 'text-emerald-500 bg-emerald-50';
      case 'unreconciled':
      case 'pending':
        return 'text-yellow-500 bg-yellow-50';
      case 'disputed':
        return 'text-red-500 bg-red-50';
      case 'ignored':
        return 'text-gray-500 bg-gray-50';
      default: 
        return 'text-gray-500 bg-gray-50';
    }
  };

  const getStatusText = (status: string, language: string) => {
    const normalizedStatus = normalizeStatus(status);
    
    const statusTexts: Record<string, Record<string, string>> = {
      'unreconciled': { ro: 'Nereconciliat', en: 'Unmatched' },
      'pending': { ro: 'În așteptare', en: 'Pending' },
      'auto_matched': { ro: 'Auto', en: 'Auto' },
      'manually_matched': { ro: 'Manual', en: 'Manual' },
      'matched': { ro: 'Reconciliat', en: 'Matched' },
      'disputed': { ro: 'Disputat', en: 'Disputed' },
      'ignored': { ro: 'Ignorat', en: 'Ignored' }
    };
    
    return statusTexts[normalizedStatus]?.[language === 'ro' ? 'ro' : 'en'] || normalizedStatus;
  };

  const getDocumentIcon = (fileType: string) => {
    const normalizedType = fileType.replace(/^\w/, c => c.toUpperCase());
    switch (normalizedType) {
      case 'Invoice': return FileText;
      case 'Receipt': return Receipt;
      case 'Z Report': return CreditCard;
      default: return FileText;
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      return dateString;
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(amount);
  };
  // API Calls
  const { data: stats, isLoading: statsLoading, error: statsError } = useGetBankReconciliationStatsQuery(clientCompanyEin, {
    skip: !clientCompanyEin
  });
  
  const { data: documents = [], isLoading: documentsLoading, error: documentsError } = useGetFinancialDocumentsQuery({
    clientEin: clientCompanyEin,
    unreconciled: filterStatus === 'unreconciled'
  }, {
    skip: !clientCompanyEin
  });

  console.log("DCS:", documents);
  
  const { data: transactions = [], isLoading: transactionsLoading, error: transactionsError } = useGetBankTransactionsQuery({
    clientEin: clientCompanyEin,
    unreconciled: filterStatus === 'unreconciled'
  }, {
    skip: !clientCompanyEin
  });
  
  const { data: suggestions = [], isLoading: suggestionsLoading, error: suggestionsError } = useGetReconciliationSuggestionsQuery(clientCompanyEin, {
    skip: !clientCompanyEin
  });

  // Mutation hooks
  const [createManualMatch, { isLoading: isCreatingMatch }] = useCreateManualMatchMutation();
  const [createBulkMatches, { isLoading: isCreatingBulkMatches }] = useCreateBulkMatchesMutation();
  const [acceptSuggestion, { isLoading: isAcceptingSuggestion }] = useAcceptReconciliationSuggestionMutation();
  const [rejectSuggestion, { isLoading: isRejectingSuggestion }] = useRejectReconciliationSuggestionMutation();

  // Statistics
  const statsData = useMemo(() => {
    if (!stats) return {
      documents: { total: 0, reconciled: 0, percentage: 0 },
      transactions: { total: 0, reconciled: 0, percentage: 0 },
      unmatched_amount: 0
    };

    return {
      documents: {
        total: stats.documents.total,
        reconciled: stats.documents.reconciled,
        percentage: stats.documents.reconciliationRate
      },
      transactions: {
        total: stats.transactions.total,
        reconciled: stats.transactions.reconciled,
        percentage: stats.transactions.reconciliationRate
      },
      unmatched_amount: stats.amounts.unmatchedAmount
    };
  }, [stats]);

  // Filtered data based on search and filters
  const filteredDocuments = useMemo(() => {
    if (!documents) return [];
    
    return documents.filter((doc: Document) => {
      const matchesSearch = searchTerm === '' || 
        doc.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.document_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.vendor?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const normalizedStatus = normalizeStatus(doc.reconciliation_status);
      
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'unreconciled' && ['unreconciled', 'pending'].includes(normalizedStatus)) ||
        (filterStatus === 'matched' && ['auto_matched', 'manually_matched', 'matched'].includes(normalizedStatus)) ||
        (filterStatus === 'disputed' && normalizedStatus === 'disputed');
      
      return matchesSearch && matchesStatus;
    });
  }, [documents, searchTerm, filterStatus]);

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    
    return transactions.filter((txn: BankTransaction) => {
      const matchesSearch = searchTerm === '' || 
        txn.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        txn.referenceNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const normalizedStatus = normalizeStatus(txn.reconciliation_status);
      
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'unreconciled' && ['unreconciled', 'pending'].includes(normalizedStatus)) ||
        (filterStatus === 'matched' && ['matched', 'auto_matched', 'manually_matched'].includes(normalizedStatus));
      
      return matchesSearch && matchesStatus;
    });
  }, [transactions, searchTerm, filterStatus]);

  // Drag & Drop handlers
  const handleDragStart = (type: 'document' | 'transaction', id: string | number) => {
    setDraggedItem({ type, id });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetType: 'document' | 'transaction', targetId: string | number) => {
    e.preventDefault();
    
    if (!draggedItem) return;
    
    // Can only match document with transaction and vice versa
    if (draggedItem.type === targetType) return;
    
    const document = draggedItem.type === 'document' 
      ? documents.find((d: Document) => d.id === draggedItem.id)
      : documents.find((d: Document) => d.id === targetId);
    
    const transaction = draggedItem.type === 'transaction'
      ? transactions.find((t: BankTransaction) => t.id === draggedItem.id)
      : transactions.find((t: BankTransaction) => t.id === targetId);
    
    if (document && transaction) {
      setMatchingPair({ document, transaction });
      setShowMatchModal(true);
    }
    
    setDraggedItem(null);
  };

  const handleManualMatch = async (confirmed: boolean, notes?: string) => {
    if (!matchingPair) return;
    
    if (confirmed) {
      try {
        await createManualMatch({
          documentId: matchingPair.document.id,
          bankTransactionId: matchingPair.transaction.id,
          notes
        }).unwrap();
        
        console.log('Manual match created successfully');
      } catch (error) {
        console.error('Failed to create manual match:', error);
        alert(language === 'ro' ? 'Eroare la crearea potrivirii' : 'Failed to create match');
      }
    }
    
    setMatchingPair(null);
    setShowMatchModal(false);
  };

  const handleBulkAction = async (action: 'match_selected' | 'ignore_selected' | 'unreconcile_selected') => {
    if (action === 'match_selected') {
      if (selectedItems.documents.length === 0 || selectedItems.transactions.length === 0) {
        alert(language === 'ro' ? 'Selectați documente și tranzacții pentru potrivire' : 'Select documents and transactions to match');
        return;
      }

      const matches = selectedItems.documents.map((docId, index) => ({
        documentId: docId,
        bankTransactionId: selectedItems.transactions[index % selectedItems.transactions.length],
        notes: 'Bulk match operation'
      }));
      
      try {
        await createBulkMatches({ matches }).unwrap();
        console.log('Bulk matches created successfully');
        setSelectedItems({documents: [], transactions: []});
        setShowBulkActions(false);
      } catch (error) {
        console.error('Failed to create bulk matches:', error);
        alert(language === 'ro' ? 'Eroare la crearea potrivirilor în masă' : 'Failed to create bulk matches');
      }
    }
    
    console.log('Bulk action:', action, selectedItems);
  };

  const toggleFileSelection = (fileId: number) => {
    const newSelected = new Set(selectedItems.documents);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedItems(prev => ({
      ...prev,
      documents: Array.from(newSelected)
    }));
    setShowBulkActions(newSelected.size > 0 || selectedItems.transactions.length > 0);
  };

  const toggleTransactionSelection = (transactionId: string) => {
    const newSelected = new Set(selectedItems.transactions);
    if (newSelected.has(transactionId)) {
      newSelected.delete(transactionId);
    } else {
      newSelected.add(transactionId);
    }
    setSelectedItems(prev => ({
      ...prev,
      transactions: Array.from(newSelected)
    }));
    setShowBulkActions(newSelected.size > 0 || selectedItems.documents.length > 0);
  };

  const deselectAllFiles = () => {
    setSelectedItems({documents: [], transactions: []});
    setShowBulkActions(false);
  };

  const [showBulkActions, setShowBulkActions] = useState(false);

  if (!clientCompanyEin) {
    return (
      <div className="min-h-screen p-8 bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle size={48} className="mx-auto text-yellow-500 mb-4" />
          <h2 className="text-xl font-bold text-[var(--text1)] mb-2">
            {language === 'ro' ? 'Companie neconfigurată' : 'Company not configured'}
          </h2>
          <p className="text-[var(--text2)]">
            {language === 'ro' ? 'Selectați o companie pentru a continua' : 'Select a company to continue'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-[var(--background)]">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gradient-to-br from-[var(--primary)] to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Landmark size={35} className="text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-[var(--text1)] mb-2 text-left">
                {language === 'ro' ? 'Reconciliere Bancară' : 'Bank Reconciliation'}
              </h1>
              <p className="text-[var(--text2)] text-lg text-left">
                {language === 'ro' 
                  ? 'Gestionează reconcilierea documentelor cu tranzacțiile bancare' 
                  : 'Manage document reconciliation with bank transactions'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Loading State for Stats */}
        {statsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-[var(--foreground)] rounded-2xl p-4 border border-[var(--text4)] shadow-sm animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-6 bg-gray-200 rounded mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : statsError ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle size={20} />
              <span>{language === 'ro' ? 'Eroare la încărcarea statisticilor' : 'Error loading statistics'}</span>
            </div>
          </div>
        ) : (
          /* Statistics Cards */
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <motion.div className="bg-[var(--foreground)] rounded-2xl p-4 border border-[var(--text4)] shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <FileText size={24} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-[var(--text3)]">{language === 'ro' ? 'Documente' : 'Documents'}</p>
                  <p className="text-xl font-bold text-[var(--text1)]">{statsData.documents.reconciled}/{statsData.documents.total}</p>
                  <p className="text-xs text-emerald-600">{statsData.documents.percentage.toFixed(1)}% {language === 'ro' ? 'reconciliate' : 'reconciled'}</p>
                </div>
              </div>
            </motion.div>

            <motion.div className="bg-[var(--foreground)] rounded-2xl p-4 border border-[var(--text4)] shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <CreditCard size={24} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-[var(--text3)]">{language === 'ro' ? 'Tranzacții' : 'Transactions'}</p>
                  <p className="text-xl font-bold text-[var(--text1)]">{statsData.transactions.reconciled}/{statsData.transactions.total}</p>
                  <p className="text-xs text-emerald-600">{statsData.transactions.percentage.toFixed(1)}% {language === 'ro' ? 'reconciliate' : 'reconciled'}</p>
                </div>
              </div>
            </motion.div>

            <motion.div className="bg-[var(--foreground)] rounded-2xl p-4 border border-[var(--text4)] shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <AlertTriangle size={24} className="text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-[var(--text3)]">{language === 'ro' ? 'Nereconciliate' : 'Unmatched'}</p>
                  <p className="text-xl font-bold text-[var(--text1)]">
                    {formatCurrency(statsData.unmatched_amount)}
                  </p>
                  <p className="text-xs text-orange-600">{language === 'ro' ? 'Necesită atenție' : 'Needs attention'}</p>
                </div>
              </div>
            </motion.div>

            <motion.div className="bg-[var(--foreground)] rounded-2xl p-4 border border-[var(--text4)] shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Zap size={24} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-[var(--text3)]">{language === 'ro' ? 'Sugerări' : 'Suggestions'}</p>
                  <p className="text-xl font-bold text-[var(--text1)]">{suggestions?.length || 0}</p>
                  <p className="text-xs text-purple-600">{language === 'ro' ? 'Disponibile' : 'Available'}</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex space-x-1 bg-[var(--foreground)] p-1 rounded-2xl border border-[var(--text4)] w-fit">
          {[
            { key: 'reconciliation', label: language === 'ro' ? 'Reconciliere' : 'Reconciliation', icon: Target },
            { key: 'suggestions', label: language === 'ro' ? 'Sugerări' : 'Suggestions', icon: Zap },
            { key: 'reports', label: language === 'ro' ? 'Rapoarte' : 'Reports', icon: TrendingUp }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                  activeTab === tab.key
                    ? 'bg-[var(--primary)] text-white shadow-md'
                    : 'text-[var(--primary)] bg-[var(--primary)]/20 hover:bg-[var(--primary)]/40'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[var(--foreground)] rounded-2xl p-4 border border-[var(--text4)] shadow-sm mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--text3)]" size={18} />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[var(--background)] border border-[var(--text4)] rounded-xl 
                focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                text-[var(--text1)] placeholder:text-[var(--text3)]"
                placeholder={language === 'ro' ? 'Caută documente sau tranzacții...' : 'Search documents or transactions...'}
              />
            </div>
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-3 bg-[var(--background)] border border-[var(--text4)] rounded-xl 
            focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--text1)]"
          >
            <option value="all">{language === 'ro' ? 'Toate statusurile' : 'All statuses'}</option>
            <option value="unreconciled">{language === 'ro' ? 'Nereconciliate' : 'Unreconciled'}</option>
            <option value="matched">{language === 'ro' ? 'Reconciliate' : 'Matched'}</option>
          </select>

          {/* Bulk Actions */}
          {showBulkActions && (
            <div className="flex gap-2">
              <button 
                onClick={() => handleBulkAction('match_selected')}
                disabled={isCreatingBulkMatches}
                className="px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {isCreatingBulkMatches && <Loader2 size={14} className="animate-spin" />}
                {language === 'ro' ? 'Reconciliază' : 'Match'}
              </button>
              <button 
                onClick={() => handleBulkAction('ignore_selected')}
                className="px-4 py-2 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-colors text-sm font-medium"
              >
                {language === 'ro' ? 'Ignoră' : 'Ignore'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {showBulkActions && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-[var(--foreground)] border border-[var(--primary)] text-[var(--text1)] rounded-2xl p-4 mb-6 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="font-semibold text-[var(--primary)]">
                  {selectedItems.documents.length + selectedItems.transactions.length} {language === 'ro' ? 'elemente selectate' : 'items selected'}
                </span>
                <button
                  onClick={deselectAllFiles}
                  className="text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 transition-colors text-sm px-3 py-1 rounded-lg"
                >
                  {language === 'ro' ? 'Deselectează toate' : 'Deselect all'}
                </button>
              </div>
              
              <button
                onClick={() => setShowBulkActions(false)}
                className="p-2 bg-[var(--background)] text-[var(--text3)] hover:text-red-500 hover:bg-red-500/20 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      {activeTab === 'reconciliation' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Documents Column */}
          <div className="bg-[var(--foreground)] rounded-2xl border border-[var(--text4)] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[var(--text4)] bg-[var(--background)]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[var(--text1)] flex items-center gap-2">
                  <FileText size={20} />
                  {language === 'ro' ? 'Documente' : 'Documents'}
                </h3>
                <span className="text-sm text-[var(--text3)]">
                  {filteredDocuments?.length || 0} {language === 'ro' ? 'articole' : 'items'}
                </span>
              </div>
            </div>
            
            <div className="p-4 max-h-[600px] overflow-y-auto">
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
                  {filteredDocuments?.map((doc: Document, index: number) => {
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
                            </div>
                            <p className="text-sm text-[var(--text3)] mb-2 truncate text-left">{doc.vendor}</p>
                            <div className="flex items-center gap-4 text-xs text-[var(--text3)]">
                              <span className="flex items-center gap-1">
                                <Calendar size={12} />
                                {formatDate(doc.document_date)}
                              </span>
                              <span className="flex items-center gap-1">
                                {formatCurrency(doc.total_amount)}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 ml-2">
                            <button className="p-1 hover:text-white hover:bg-[var(--primary)] bg-[var(--primary)]/20 text-[var(--primary)] transition-colors rounded-lg"
                            onClick={() => {
                              if (doc.signedUrl || doc.path) {
                                window.open(doc.signedUrl || doc.path, '_blank', 'noopener,noreferrer');
                              }
                            }}>
                              <Eye size={14} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Transactions Column */}
          <div className="bg-[var(--foreground)] rounded-2xl border border-[var(--text4)] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[var(--text4)] bg-[var(--background)]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[var(--text1)] flex items-center gap-2">
                  <CreditCard size={20} />
                  {language === 'ro' ? 'Tranzacții Bancare' : 'Bank Transactions'}
                </h3>
                <span className="text-sm text-[var(--text3)]">
                  {filteredTransactions?.length || 0} {language === 'ro' ? 'articole' : 'items'}
                </span>
              </div>
            </div>
            
            <div className="p-4 max-h-[600px] overflow-y-auto">
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
                  {filteredTransactions?.map((txn: BankTransaction, index: number) => {
                    const isSelected = selectedItems.transactions.includes(txn.id);
                    
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
                                alert(language === 'ro' 
                                  ? 'Extractul bancar nu este disponibil pentru această tranzacție' 
                                  : 'Bank statement not available for this transaction'
                                );
                              }
                            }}
                            disabled={!txn.bankStatementDocument?.signedUrl}
                            title={language === 'ro' ? 'Vezi extractul bancar' : 'View bank statement'}
                          >
                            <Eye size={14} />
                          </button>

                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'suggestions' && (
        <div className="bg-[var(--foreground)] rounded-2xl border border-[var(--text4)] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[var(--text4)] bg-[var(--background)]">
            <h3 className="text-lg font-bold text-[var(--text1)] flex items-center gap-2">
              <Zap size={20} />
              {language === 'ro' ? 'Sugerări de Reconciliere' : 'Reconciliation Suggestions'}
            </h3>
          </div>
          <div className="p-6">
            {suggestionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3 text-[var(--text2)]">
                  <RefreshCw size={20} className="animate-spin" />
                  <span>{language === 'ro' ? 'Se încarcă sugerările...' : 'Loading suggestions...'}</span>
                </div>
              </div>
            ) : suggestionsError ? (
              <div className="text-center py-12">
                <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
                <p className="text-red-600">{language === 'ro' ? 'Eroare la încărcarea sugerărilor' : 'Error loading suggestions'}</p>
              </div>
            ) : suggestions?.length === 0 ? (
              <div className="text-center py-12">
                <Zap size={48} className="mx-auto text-[var(--text3)] mb-4" />
                <p className="text-[var(--text2)] text-lg mb-2">
                  {language === 'ro' ? 'Nu există sugerări disponibile' : 'No suggestions available'}
                </p>
                <p className="text-[var(--text3)] text-sm">
                  {language === 'ro' 
                    ? 'Sugerările vor apărea când sistemul găsește potriviri posibile'
                    : 'Suggestions will appear when the system finds possible matches'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {suggestions?.map((suggestion: ReconciliationSuggestion, index: number) => (
                  <motion.div
                    key={suggestion.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-4 border-2 border-blue-200 bg-blue-50 rounded-xl"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                          <Target size={20} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-[var(--text1)]">
                            {language === 'ro' ? 'Potrivire sugerată' : 'Suggested Match'}
                          </p>
                          <p className="text-sm text-blue-600 font-medium">
                            {language === 'ro' ? 'Încredere' : 'Confidence'}: {Math.round(suggestion.confidenceScore * 100)}%
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            try {
                              await acceptSuggestion({
                                suggestionId: suggestion.id,
                                notes: `Accepted suggestion with ${Math.round(suggestion.confidenceScore * 100)}% confidence`
                              }).unwrap();
                              console.log('Suggestion accepted');
                            } catch (error) {
                              console.error('Failed to accept suggestion:', error);
                              alert(language === 'ro' ? 'Eroare la acceptarea sugestiei' : 'Failed to accept suggestion');
                            }
                          }}
                          disabled={isAcceptingSuggestion}
                          className="px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                        >
                          {isAcceptingSuggestion && <Loader2 size={16} className="animate-spin" />}
                          <Check size={16} />
                          {language === 'ro' ? 'Acceptă' : 'Accept'}
                        </button>
                        <button 
                          onClick={async () => {
                            try {
                              await rejectSuggestion({
                                suggestionId: suggestion.id,
                                reason: 'Manual rejection by user'
                              }).unwrap();
                              console.log('Suggestion rejected');
                            } catch (error) {
                              console.error('Failed to reject suggestion:', error);
                              alert(language === 'ro' ? 'Eroare la respingerea sugestiei' : 'Failed to reject suggestion');
                            }
                          }}
                          disabled={isRejectingSuggestion}
                          className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                        >
                          {isRejectingSuggestion && <Loader2 size={16} className="animate-spin" />}
                          <X size={16} />
                          {language === 'ro' ? 'Respinge' : 'Reject'}
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <p className="text-sm font-semibold text-[var(--text1)] mb-2">Document</p>
                        <p className="text-sm text-[var(--text2)]">{suggestion.document? suggestion.document.name :''}</p>
                        <p className="text-xs text-[var(--text3)]">{suggestion.document.type.replace(/^\w/, c => c.toUpperCase())}</p>
                      </div>
                      
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <p className="text-sm font-semibold text-[var(--text1)] mb-2">Tranzacție</p>
                        <p className="text-sm text-[var(--text2)] truncate">{suggestion.bankTransaction.description}</p>
                        <p className="text-xs text-[var(--text3)]">{formatDate(suggestion.bankTransaction.transactionDate)}</p>
                        <p className={`text-sm font-medium ${suggestion.bankTransaction.transactionType === 'credit' ? 'text-emerald-500' : 'text-red-600'}`}>
                          {suggestion.bankTransaction.transactionType === 'credit' ? '+' : ''}{formatCurrency(suggestion.bankTransaction.amount)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="bg-[var(--foreground)] rounded-2xl border border-[var(--text4)] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[var(--text4)] bg-[var(--background)]">
            <h3 className="text-lg font-bold text-[var(--text1)] flex items-center gap-2">
              <TrendingUp size={20} />
              {language === 'ro' ? 'Rapoarte de Reconciliere' : 'Reconciliation Reports'}
            </h3>
          </div>
          <div className="p-6">
            <div className="text-center py-12">
              <TrendingUp size={48} className="mx-auto text-[var(--text3)] mb-4" />
              <p className="text-[var(--text2)] text-lg mb-2">
                {language === 'ro' ? 'Rapoarte în curs de dezvoltare' : 'Reports coming soon'}
              </p>
              <p className="text-[var(--text3)] text-sm">
                {language === 'ro' 
                  ? 'Rapoartele detaliate de reconciliere vor fi disponibile în curând'
                  : 'Detailed reconciliation reports will be available soon'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Match Confirmation Modal */}
      <AnimatePresence>
        {showMatchModal && matchingPair && (
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
                        {formatCurrency(matchingPair.document.total_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text3)]">Data:</span>
                      <span className="text-[var(--text1)]">{formatDate(matchingPair.document.document_date)}</span>
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
                        {matchingPair.transaction.transactionType === 'credit' ? '+' : ''}{formatCurrency(matchingPair.transaction.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text3)]">Data:</span>
                      <span className="text-[var(--text1)]">{formatDate(matchingPair.transaction.transactionDate)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Amount verification */}
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={18} className="text-yellow-600" />
                  <span className="font-semibold text-yellow-800">
                    {language === 'ro' ? 'Verificare Sumă' : 'Amount Verification'}
                  </span>
                </div>
                <p className="text-sm text-yellow-700">
                  {Math.abs(matchingPair.document.total_amount - Math.abs(matchingPair.transaction.amount)) < 0.01 
                    ? (language === 'ro' ? '✓ Sumele se potrivesc perfect' : '✓ Amounts match perfectly')
                    : (language === 'ro' 
                        ? `⚠ Diferență de sumă: ${Math.abs(matchingPair.document.total_amount - Math.abs(matchingPair.transaction.amount)).toFixed(2)} RON`
                        : `⚠ Amount difference: ${Math.abs(matchingPair.document.total_amount - Math.abs(matchingPair.transaction.amount)).toFixed(2)} RON`)
                  }
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => handleManualMatch(false)}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                >
                  {language === 'ro' ? 'Anulează' : 'Cancel'}
                </button>
                <button
                  onClick={() => handleManualMatch(true)}
                  disabled={isCreatingMatch}
                  className="px-6 py-3 bg-[var(--primary)] text-white rounded-xl hover:bg-[var(--primary)]/90 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {isCreatingMatch && <Loader2 size={16} className="animate-spin" />}
                  {language === 'ro' ? 'Confirmă Reconcilierea' : 'Confirm Match'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BankPage;
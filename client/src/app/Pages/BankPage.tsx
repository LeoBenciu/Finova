import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { allAccounts } from '@/app/helper/allAccounts';
import { 
  Landmark, 
  CreditCard,
  FileText,
  Receipt,
  AlertTriangle,
  Zap,
  Target,
  TrendingUp,
  Loader2,
  Edit2,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  useGetBankReconciliationStatsQuery,
  useGetFinancialDocumentsQuery,
  useGetBankTransactionsQuery,
  useGetReconciliationSuggestionsQuery,
  useCreateManualMatchMutation,
  useAcceptReconciliationSuggestionMutation,
  useRejectReconciliationSuggestionMutation,
  useUnreconcileTransactionMutation,
  useRegenerateAllSuggestionsMutation,
  useRegenerateTransactionSuggestionsMutation,
  useCreateManualAccountReconciliationMutation,
  useCreateBulkMatchesMutation,
  useCreateOutstandingItemMutation,
  useGetOutstandingItemsQuery,
  useUpdateDocumentReconciliationStatusMutation,
  // Multi-Bank Account API hooks
  useGetBankAccountsQuery,
  useCreateBankAccountMutation,
  useUpdateBankAccountMutation,
  useDeactivateBankAccountMutation,
  useGetBankTransactionsByAccountQuery,
  useGetConsolidatedAccountViewQuery,
  // Bank Account Analytic minimal hooks
  useGetBankAccountAnalyticsQuery,
  useCreateBankAccountAnalyticMutation,
  useUpdateBankAccountAnalyticMutation,
  // Transfer Reconciliation API hooks
  useCreateTransferReconciliationMutation,
  useGetPendingTransferReconciliationsQuery,
  useDeleteTransferReconciliationMutation,
  
} from '@/redux/slices/apiSlice';
import OutstandingItemsManagement from '@/app/Components/OutstandingItemsManagement';
import SplitTransactionModal from '@/app/Components/SplitTransactionModal';
import ToastPortal from './BankPage/components/ToastPortal';
import ConfirmModal from './BankPage/components/ConfirmModal';
import FiltersToolbar from './BankPage/components/FiltersToolbar';
import SuggestionsList from './BankPage/components/SuggestionsList';
import DocumentsList from './BankPage/components/DocumentsList';
import TransactionsList from './BankPage/components/TransactionsList';
import BankAccountModal from './BankPage/components/BankAccountModal';
import MatchModal from './BankPage/components/MatchModal';
import TransferModal from './BankPage/components/TransferModal';
import AccountReconcileModal from './BankPage/components/AccountReconcileModal';
import ComprehensiveReportingSystem from './BankPage/components/ComprehensiveReportingSystem';
import BulkActionsBar from './BankPage/components/BulkActionsBar';
import PendingTransfersList from './BankPage/components/PendingTransfersList';

// Simple toast type
type Toast = { id: number; type: 'success' | 'error' | 'info'; message: string };

interface Document {
  id: number;
  name: string;
  type: 'Invoice' | 'Receipt' | 'Z Report' | 'Payment Order' | 'Collection Order';
  document_number?: string;
  total_amount?: number; // Made optional since different doc types use different field names
  document_date?: string; // Made optional since different doc types use different field names
  vendor?: string;
  buyer?: string;
  direction?: 'incoming' | 'outgoing';
  reconciliation_status: 'unreconciled' | 'auto_matched' | 'manually_matched' | 'disputed' | 'ignored' | 'pending' | 'matched';
  matched_transactions?: string[];
  references?: number[];
  signedUrl?: string; 
  path?: string;
  // Additional fields based on document type
  receipt_number?: string;
  order_number?: string;
  amount?: number;
  order_date?: string;
  report_number?: string;
  business_date?: string;
  total_sales?: number;
  [key: string]: any; // Allow for dynamic fields from extracted data
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
  id: number | string;
  document_id: number;
  transaction_id: string;
  confidenceScore: number;
  matchingCriteria: {
    component_match?: boolean;
    component_type?: string;
    is_partial_match?: boolean;
    type?: 'TRANSFER' | string;
    dateDiffDays?: number;
    crossCurrency?: boolean;
    impliedFxRate?: number;
    [key: string]: any;
  };
  reasons: string[];
  document: {
    id: number;
    name: string;
    type: string;
    total_amount?: number;
    processedData?: Array<{
      extractedFields: {
        result?: {
          total_sales?: number;
          [key: string]: any;
        };
        [key: string]: any;
      };
    }>;
  } | null;
  bankTransaction: {
    id: string;
    description: string;
    amount: number;
    transactionDate: string;
    transactionType: 'debit' | 'credit';
    bankStatementDocument?: {
      id: number;
      name: string;
      signedUrl?: string;
    } | null;
  } | null;
  chartOfAccount?: {
    accountCode?: string;
    accountName?: string;
    code?: string;
    name?: string;
  } | null;
  // Present only for unified transfer suggestions
  transfer?: {
    sourceTransactionId: string;
    destinationTransactionId: string;
    counterpartyTransaction: {
      id: string;
      description: string;
      amount: number;
      transactionDate: string;
      transactionType: 'debit' | 'credit';
      bankStatementDocument?: {
        id: number;
        name: string;
        signedUrl?: string;
      } | null;
    };
    crossCurrency?: boolean;
    impliedFxRate?: number;
    dateDiffDays?: number;
  };
}

//

// Account Code Selector Component
interface AccountCodeSelectorProps {
  onSelect: (accountCode: string, notes?: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  language: string;
}

const AccountCodeSelector: React.FC<AccountCodeSelectorProps> = ({ onSelect, onCancel, isLoading, language }) => {
  const [selectedAccountCode, setSelectedAccountCode] = useState('');
  const [notes, setNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Enhanced search functionality with relevance scoring and fuzzy matching
  const getSearchRelevance = (account: { code: string; name: string }, searchTerm: string): number => {
    const searchLower = searchTerm.toLowerCase().trim();
    const codeLower = account.code.toLowerCase();
    const nameLower = account.name.toLowerCase();
    
    if (!searchLower) return 0;
    
    let score = 0;
    
    // Exact matches get highest priority
    if (codeLower === searchLower) score += 1000;
    if (nameLower === searchLower) score += 900;
    
    // Code prefix matches (very important for numeric searches)
    if (codeLower.startsWith(searchLower)) score += 800;
    
    // Name starts with search term
    if (nameLower.startsWith(searchLower)) score += 700;
    
    // Code contains search term
    if (codeLower.includes(searchLower)) score += 600;
    
    // Name contains search term
    if (nameLower.includes(searchLower)) score += 500;
    
    // Word boundary matches in name (whole word matches)
    const words = nameLower.split(/\s+/);
    const searchWords = searchLower.split(/\s+/);
    
    searchWords.forEach(searchWord => {
      words.forEach(word => {
        if (word.startsWith(searchWord)) score += 400;
        if (word.includes(searchWord)) score += 200;
      });
    });
    
    // Fuzzy matching for typos (simple character similarity)
    const fuzzyMatch = (str1: string, str2: string): number => {
      if (str1.length === 0 || str2.length === 0) return 0;
      
      let matches = 0;
      const minLength = Math.min(str1.length, str2.length);
      
      for (let i = 0; i < minLength; i++) {
        if (str1[i] === str2[i]) matches++;
      }
      
      const similarity = matches / Math.max(str1.length, str2.length);
      return similarity > 0.6 ? similarity * 100 : 0;
    };
    
    // Add fuzzy matching bonus for similar terms
    score += fuzzyMatch(codeLower, searchLower);
    score += fuzzyMatch(nameLower, searchLower) * 0.5;
    
    return score;
  };
  
  const filteredAccounts = allAccounts
    .map(account => ({
      ...account,
      relevance: getSearchRelevance(account, searchTerm)
    }))
    .filter(account => account.relevance > 0 || !searchTerm.trim())
    .sort((a, b) => {
      // Sort by relevance score (descending)
      if (b.relevance !== a.relevance) {
        return b.relevance - a.relevance;
      }
      // If same relevance, sort by code numerically
      const aCode = parseInt(a.code);
      const bCode = parseInt(b.code);
      if (!isNaN(aCode) && !isNaN(bCode)) {
        return aCode - bCode;
      }
      // Fallback to alphabetical
      return a.code.localeCompare(b.code);
    })
    .slice(0, 50); // Limit results to prevent performance issues

  const handleSubmit = () => {
    if (selectedAccountCode.trim()) {
      onSelect(selectedAccountCode.trim(), notes.trim() || undefined);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and select account */}
      <div>
        <label className="block text-sm font-medium text-[var(--text1)] mb-2">
          {language === 'ro' ? 'Selectează cont contabil' : 'Select account code'}
        </label>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={language === 'ro' ? 'Caută cont...' : 'Search account...'}
          className="w-full px-3 py-2 border border-[var(--text4)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-[var(--background)] text-[var(--text1)] mb-3"
        />
        
        <div className="max-h-40 overflow-y-auto scrollbar-soft space-y-1">
          {filteredAccounts.map((account) => (
            <button
              key={account.code}
              onClick={() => setSelectedAccountCode(account.code)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                selectedAccountCode === account.code
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--background)] hover:bg-gray-100 text-[var(--text1)]'
              }`}
            >
              <div className="font-medium">{account.code}</div>
              <div className="text-sm opacity-75">{account.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-[var(--text1)] mb-2">
          {language === 'ro' ? 'Note (opțional)' : 'Notes (optional)'}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={language === 'ro' ? 'Adaugă note despre această reconciliere...' : 'Add notes about this reconciliation...'}
          rows={3}
          className="w-full px-3 py-2 border border-[var(--text4)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-[var(--background)] text-[var(--text1)]"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
        >
          {language === 'ro' ? 'Anulează' : 'Cancel'}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!selectedAccountCode.trim() || isLoading}
          className="px-6 py-3 bg-[var(--primary)] text-white rounded-xl hover:bg-[var(--primary)]/90 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading && <Loader2 size={16} className="animate-spin" />}
          {language === 'ro' ? 'Confirmă Reconcilierea' : 'Confirm Reconciliation'}
        </button>
      </div>
    </div>
  );
};

const getDocumentAmount = (doc: Document): number => {
  const possibleAmountFields = [
    'total_amount',
    'amount', 
    'total_sales',
    'totalAmount',
    'totalSales'
  ];
  
  for (const field of possibleAmountFields) {
    if (doc[field] !== undefined && doc[field] !== null && !isNaN(Number(doc[field]))) {
      return Number(doc[field]);
    }
  }
  
  return 0;
};

const getDocumentDate = (doc: Document): string => {
  const possibleDateFields = [
    'document_date',
    'order_date',
    'business_date',
    'documentDate',
    'orderDate',
    'businessDate'
  ];
  
  for (const field of possibleDateFields) {
    if (doc[field] && typeof doc[field] === 'string' && doc[field].trim() !== '') {
      return doc[field];
    }
  }
  
  return '';
};

const BankPage = () => {
  const language = useSelector((state: {user:{language:string}}) => state.user.language);
  const clientCompanyEin = useSelector((state: {clientCompany: {current: {ein: string}}}) => state.clientCompany.current.ein);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('unreconciled');
  const [excludeOutstanding, setExcludeOutstanding] = useState<boolean>(true);

  // Debug helper to print minimal transfer fields
  const dbgTransfer = useCallback((s: any) => ({
    id: s?.id,
    matchingType: s?.matchingCriteria?.type,
    bankTransactionId: s?.bankTransaction?.id,
    srcId: s?.transfer?.sourceTransactionId,
    dstId: s?.transfer?.destinationTransactionId,
    hasCounterparty: Boolean(s?.transfer?.counterpartyTransaction),
  }), []);
  const [showOutstandingPanel, setShowOutstandingPanel] = useState<boolean>(false);
  const [updatingDocStatus, setUpdatingDocStatus] = useState<Set<number>>(new Set());
  const [updateDocumentReconciliationStatus] = useUpdateDocumentReconciliationStatusMutation();

  const handleToggleDocumentIgnored = async (doc: Document) => {
    const normalized = normalizeStatus(doc.reconciliation_status);
    const nextStatus: 'IGNORED' | 'UNRECONCILED' = normalized === 'ignored' ? 'UNRECONCILED' : 'IGNORED';
    setUpdatingDocStatus(prev => new Set(prev).add(doc.id));
    try {
      await updateDocumentReconciliationStatus({
        clientEin: clientCompanyEin,
        documentId: doc.id,
        status: nextStatus
      }).unwrap();

      // Optimistically hide suggestions that referenced this document
      try {
        const toRemove = (suggestionsData || [])
          .filter((s: any) => s?.document?.id === doc.id || s?.document_id === doc.id)
          .map((s: any) => s.id);
        if (toRemove.length) {
          setRemovedSuggestions(prev => {
            const copy = new Set(prev);
            toRemove.forEach(id => copy.add(id));
            return copy;
          });
        }
      } catch {}

      // Regenerate suggestions backend-side and refetch
      try {
        await regenerateAllSuggestions(clientCompanyEin).unwrap();
        await refetchSuggestions();
      } catch (e) {
        console.error('Failed to regenerate/refetch suggestions after ignore toggle', e);
      }
    } catch (e) {
      console.error('Failed to update document status', e);
      alert(language === 'ro' ? 'Actualizarea stării documentului a eșuat.' : 'Failed to update document status.');
    } finally {
      setUpdatingDocStatus(prev => {
        const copy = new Set(prev);
        copy.delete(doc.id);
        return copy;
      });
    }
  };
  const [activeTab, setActiveTab] = useState<'reconciliation' | 'suggestions' | 'reports'>('reconciliation');
  const [selectedItems, setSelectedItems] = useState<{documents: number[], transactions: string[]}>({documents: [], transactions: []});
  const [draggedItem, setDraggedItem] = useState<{type: 'document' | 'transaction', id: string | number} | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [showAccountReconcileModal, setShowAccountReconcileModal] = useState(false);
  const [selectedTransactionForAccount, setSelectedTransactionForAccount] = useState<BankTransaction | null>(null);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [selectedTransactionForSplit, setSelectedTransactionForSplit] = useState<BankTransaction | null>(null);
  const [expandedSplits, setExpandedSplits] = useState<Record<string, boolean>>({});
  
  
  // Multi-Bank Account state
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<number | null>(null);
  const [showBankAccountModal, setShowBankAccountModal] = useState(false);
  const [showConsolidatedView, setShowConsolidatedView] = useState(false);
  const [editingBankAccount, setEditingBankAccount] = useState<any>(null);

  // Transfer Reconciliation state
  const [showTransferModal, setShowTransferModal] = useState(false);
  
  // Bank Account Analytic Suffix (simple field handled via form input)
  const [transferForm, setTransferForm] = useState<{
    fxRate: string;
    notes: string;
  }>({ fxRate: '1', notes: '' });
  const [createTransferReconciliation, { isLoading: creatingTransfer }] = useCreateTransferReconciliationMutation();
  const { data: pendingTransfersData, refetch: refetchPendingTransfers } = useGetPendingTransferReconciliationsQuery(
    { clientEin: clientCompanyEin },
    { skip: !clientCompanyEin }
  );
  const [deleteTransferReconciliation, { isLoading: deletingTransfer }] = useDeleteTransferReconciliationMutation();

  // Removed per-transaction transfer candidates modal/query to simplify UI

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(1);
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info', durationMs = 3500) => {
    const id = toastIdRef.current++;
    const toast: Toast = { id, type, message };
    setToasts((prev) => [...prev, toast]);
    // Auto-remove after duration
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, durationMs);
  };

  // Confirm modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const confirmActionRef = useRef<null | (() => Promise<void> | void)>(null);
  const openConfirm = (message: string, onConfirm: () => Promise<void> | void) => {
    setConfirmMessage(message);
    confirmActionRef.current = onConfirm;
    setConfirmOpen(true);
  };
  const closeConfirm = () => {
    setConfirmOpen(false);
    setConfirmMessage('');
    confirmActionRef.current = null;
  };

  const [documentsPage, setDocumentsPage] = useState(1);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [suggestionsPage, setSuggestionsPage] = useState(1);

  const pageSize = 25;

  const documentsEndRef = useRef<HTMLDivElement | null>(null);
  const transactionsEndRef = useRef<HTMLDivElement | null>(null);
  const suggestionsEndRef = useRef<HTMLDivElement | null>(null);

  const [documentsData, setDocumentsData] = useState<Document[]>([]);
  const [transactionsData, setTransactionsData] = useState<BankTransaction[]>([]);
  const [suggestionsData, setSuggestionsData] = useState<ReconciliationSuggestion[]>([]);
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
        return 'text-purple-800 bg-purple-50';
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
    if (!dateString || dateString.trim() === '') return '';
    
    try {
      let normalizedDate = dateString;
      
      if (dateString.includes('/')) {
        normalizedDate = dateString.replace(/\//g, '-');
      }
      
      const ddmmyyyyPattern = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
      const match = normalizedDate.match(ddmmyyyyPattern);
      
      if (match) {
        const [, day, month, year] = match;
        const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
        
        if (!isNaN(date.getTime())) {
          const formattedDay = date.getDate().toString().padStart(2, '0');
          const formattedMonth = (date.getMonth() + 1).toString().padStart(2, '0');
          const formattedYear = date.getFullYear();
          return `${formattedDay}-${formattedMonth}-${formattedYear}`;
        }
      }
      
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
      }
      
      return dateString;
    } catch (error) {
      return dateString;
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(amount);
  };
  
  const { data: stats, isLoading: statsLoading, error: statsError } = useGetBankReconciliationStatsQuery(clientCompanyEin, {
    skip: !clientCompanyEin
  });
  
  const { data: documentsResp = { items: [], total: 0 }, isLoading: documentsLoading, error: documentsError } = useGetFinancialDocumentsQuery({
    clientEin: clientCompanyEin,
    status: filterStatus as 'all' | 'reconciled' | 'unreconciled' | 'ignored',
    page: documentsPage,
    size: pageSize
  }, {
    skip: !clientCompanyEin
  });
  const { items: documentsItems, total: documentsTotal } = documentsResp;

  const { data: transactionsResp = { items: [], total: 0 }, isLoading: transactionsLoading, error: transactionsError } = useGetBankTransactionsQuery({
    clientEin: clientCompanyEin,
    status: (filterStatus === 'ignored' ? 'all' : filterStatus) as 'all' | 'reconciled' | 'unreconciled',
    page: transactionsPage,
    size: pageSize
  }, {
    skip: !clientCompanyEin
  });
  
  const { data: suggestionsResp, isLoading: suggestionsLoading, error: suggestionsError, refetch: refetchSuggestions } = useGetReconciliationSuggestionsQuery({
    clientEin: clientCompanyEin,
    page: suggestionsPage,
    size: pageSize
  }, {
    skip: !clientCompanyEin
  });
  
  // Robust extraction of suggestions data with fallbacks
  const suggestionsItems = useMemo(() => {
    if (!suggestionsResp) return [];
    
    // The API always returns { items: [], total: 0 } due to transformResponse
    if (suggestionsResp?.items && Array.isArray(suggestionsResp.items)) {
      return suggestionsResp.items;
    }
    
    // Fallback to empty array
    console.warn('[BankPage] Unexpected suggestions response format:', suggestionsResp);
    return [];
  }, [suggestionsResp]);
  
  const suggestionsTotal = useMemo(() => {
    if (!suggestionsResp) return 0;
    
    // The API always returns { items: [], total: 0 } due to transformResponse
    if (typeof suggestionsResp === 'object' && suggestionsResp !== null) {
      return (suggestionsResp as any).total || 0;
    }
    
    return 0;
  }, [suggestionsResp]);

  // Outstanding items (for filtering and badges)
  const { data: outstandingList } = useGetOutstandingItemsQuery({
    clientEin: clientCompanyEin,
    status: 'OUTSTANDING'
  }, {
    skip: !clientCompanyEin
  });

  const { outstandingDocIds, outstandingTxnIds } = useMemo(() => {
    const res = Array.isArray(outstandingList) ? outstandingList : (outstandingList?.items || []);
    const d = new Set<number>();
    const t = new Set<string>();
    for (const it of res) {
      if (it?.relatedDocumentId != null) d.add(it.relatedDocumentId as number);
      if (it?.relatedTransactionId != null) t.add(String(it.relatedTransactionId));
    }
    return { outstandingDocIds: d, outstandingTxnIds: t };
  }, [outstandingList]);

  // Local state to optimistically remove suggestions that were just accepted/rejected
  const [removedSuggestions, setRemovedSuggestions] = useState<Set<string>>(new Set());

  // Multi-Bank Account API queries
  const { data: bankAccounts = [], isLoading: bankAccountsLoading } = useGetBankAccountsQuery(clientCompanyEin, {
    skip: !clientCompanyEin
  });

  const { data: consolidatedView } = useGetConsolidatedAccountViewQuery(clientCompanyEin, {
    skip: !clientCompanyEin || !showConsolidatedView
  });

  // Use account-filtered transactions when a specific account is selected
  const { data: accountTransactionsResp } = useGetBankTransactionsByAccountQuery({
    clientEin: clientCompanyEin,
    accountId: selectedBankAccountId || undefined,
    status: (filterStatus === 'ignored' ? 'all' : filterStatus) as 'all' | 'reconciled' | 'unreconciled',
    page: transactionsPage,
    size: pageSize
  }, {
    skip: !clientCompanyEin || !selectedBankAccountId
  });

  // Use account-filtered transactions when an account is selected, otherwise use regular transactions
  const effectiveTransactionsResp = selectedBankAccountId ? accountTransactionsResp : transactionsResp;
  const { items: transactionsItems, total: transactionsTotal } = effectiveTransactionsResp || { items: [], total: 0 };

  // Build a transaction ID set for the selected account to filter suggestions
  const accountTransactionIdSet = useMemo(() => {
    const list = (accountTransactionsResp?.items ?? []) as any[];
    return new Set(list.map(t => String(t.id)));
  }, [accountTransactionsResp]);

  // Suggestions displayed in UI, filtered by selected bank account (if any) and local removals
  const displayedSuggestions = useMemo(() => {
    const base = Array.isArray(suggestionsItems) ? suggestionsItems : [];
    const hasAccountFilterReady = !!selectedBankAccountId && accountTransactionIdSet.size > 0;
    const isTransferLike = (s: any): boolean => {
      const t = (s?.matchingCriteria?.type || s?.matchingCriteria || '').toString();
      const byType = typeof t === 'string' && t.toUpperCase() === 'TRANSFER';
      const byPayload = Boolean(s?.transfer);
      return byType || byPayload;
    };

    const prelim = base.filter((s: any) => {
      if (removedSuggestions.has(String(s.id))) {
        try {
          console.log('[UI][filter][REMOVED][local]', { sid: s.id });
        } catch {}
        return false;
      }
      
      // Apply account-specific filtering when a bank account is selected
      if (hasAccountFilterReady) {
        const isTransferAny = isTransferLike(s);
        if (isTransferAny) {
          // For transfer suggestions, check if any of the transfer transactions are in the selected account
          const srcId = s.transfer?.sourceTransactionId;
          const dstId = s.transfer?.destinationTransactionId;
          const selfTxnId = s.bankTransaction?.id;
          const srcInSet = srcId ? accountTransactionIdSet.has(String(srcId)) : false;
          const dstInSet = dstId ? accountTransactionIdSet.has(String(dstId)) : false;
          const selfInSet = selfTxnId ? accountTransactionIdSet.has(String(selfTxnId)) : false;
          
          if (!srcInSet && !dstInSet && !selfInSet) {
            try {
              console.log('[UI][filter][TRANSFER][excluded]', {
                sid: s.id,
                srcId,
                dstId,
                selfTxnId,
                srcInSet,
                dstInSet,
                selfInSet,
                selectedBankAccountId,
              });
            } catch {}
            return false;
          }
        } else {
          // For non-transfer suggestions, check if the bank transaction is in the selected account
          const txnId = s.bankTransaction?.id;
          const inSet = txnId ? accountTransactionIdSet.has(String(txnId)) : false;
          
          if (!inSet) {
            try {
              console.log('[UI][filter][NONTRANSFER][excluded]', {
                sid: s.id,
                txnId,
                inSet,
                selectedBankAccountId,
              });
            } catch {}
            return false;
          }
        }
      }
      return true;
    });

    // Debug: list unique types seen in prelim
    try {
      const uniqueTypes = Array.from(new Set((prelim as any[]).map(p => (p?.matchingCriteria?.type || p?.matchingCriteria || '(none)'))));
      console.log('[UI][types] prelim unique matchingCriteria.type', uniqueTypes);
      
      // Log detailed breakdown of suggestion types
      const typeBreakdown = prelim.reduce((acc: any, s: any) => {
        const type = s?.matchingCriteria?.type || s?.matchingCriteria || 'UNKNOWN';
        if (!acc[type]) acc[type] = [];
        acc[type].push({
          id: s.id,
          hasDocument: !!s.document,
          hasBankTransaction: !!s.bankTransaction,
          hasChartOfAccount: !!s.chartOfAccount,
          hasTransfer: !!s.transfer,
          confidenceScore: s.confidenceScore
        });
        return acc;
      }, {});
      
      console.log('[UI][types] detailed breakdown:', typeBreakdown);
      
      // Expose for ad-hoc inspection
      (window as any).__finovaPrelim = prelim;
      (window as any).__finovaTypeBreakdown = typeBreakdown;
    } catch {}

    // Collect transfer suggestions (robust detection)
    const transferItems = prelim.filter((s: any) => isTransferLike(s));
    const involvedTxnIds = new Set<string>();
    for (const t of transferItems) {
      if (t?.transfer?.sourceTransactionId) involvedTxnIds.add(String(t.transfer.sourceTransactionId));
      if (t?.transfer?.destinationTransactionId) involvedTxnIds.add(String(t.transfer.destinationTransactionId));
      if (t?.bankTransaction?.id) involvedTxnIds.add(String(t.bankTransaction.id));
    }
    try {
      console.log('[UI][dedupe] transferItems/involvedTxnIds', {
        transferCount: transferItems.length,
        involved: Array.from(involvedTxnIds).slice(0, 10),
      });
    } catch {}

    // Show all suggestions - no filtering based on transfer involvement
    const finalSuggestions = prelim;

    const transfersCount = finalSuggestions.filter((s: any) => s?.matchingCriteria?.type === 'TRANSFER' && s?.transfer).length;
    if (!selectedBankAccountId) {
      console.log('[UI] displayedSuggestions (no account filter)', {
        base: base.length,
        removed: removedSuggestions.size,
        prelim: prelim.length,
        transfers: transfersCount,
        hiddenDueToTransfer: prelim.length - finalSuggestions.length,
        involvedTxnIds: Array.from(involvedTxnIds),
      });
    } else {
      console.log('[UI] displayedSuggestions (with account filter)', {
        base: base.length,
        removed: removedSuggestions.size,
        selectedBankAccountId,
        prelim: prelim.length,
        transfers: transfersCount,
        hiddenDueToTransfer: prelim.length - finalSuggestions.length,
        accountTransactionIdSetSize: accountTransactionIdSet.size,
        hasAccountFilterReady,
        involvedTxnIds: Array.from(involvedTxnIds),
      });
    }

    return finalSuggestions;
  }, [suggestionsItems, removedSuggestions, selectedBankAccountId, accountTransactionIdSet]);

  useEffect(() => {
    if (documentsPage === 1) setDocumentsData([]);
    if (documentsItems.length) {
      setDocumentsData(prev => documentsPage === 1 ? documentsItems : [...prev, ...documentsItems]);
    }
  }, [documentsItems]);
  useEffect(() => {
    if (transactionsPage === 1) setTransactionsData([]);
    if (transactionsItems.length) {
      setTransactionsData(prev => transactionsPage === 1 ? transactionsItems : [...prev, ...transactionsItems]);
    }
  }, [transactionsItems]);
  useEffect(() => {
    if (suggestionsPage === 1) setSuggestionsData([]);
    if (suggestionsItems.length) {
      setSuggestionsData(prev => suggestionsPage === 1 ? suggestionsItems : [...prev, ...suggestionsItems]);
      const transfers = (suggestionsItems as any[]).filter(it => it?.matchingCriteria?.type === 'TRANSFER');
      console.log('[UI] suggestionsItems fetched', {
        page: suggestionsPage,
        pageSize: suggestionsItems.length,
        transferCount: transfers.length,
        samples: transfers.slice(0, 5).map(dbgTransfer)
      });
    }
  }, [suggestionsItems]);

  useEffect(() => {
    const base = Array.isArray(suggestionsData) ? suggestionsData : [];
    const transfers = (base as any[]).filter(s => s?.matchingCriteria?.type === 'TRANSFER');
    console.log('[UI] suggestionsData aggregate', {
      total: base.length,
      transfers: transfers.length,
      removedLocal: removedSuggestions.size,
      samples: transfers.slice(0, 5).map(dbgTransfer)
    });
  }, [suggestionsData, removedSuggestions]);
  
  const [createManualMatch, { isLoading: isCreatingMatch }] = useCreateManualMatchMutation();
  const [createBulkMatches, { isLoading: isCreatingBulkMatches }] = useCreateBulkMatchesMutation();
  const [createManualAccountReconciliation, { isLoading: isCreatingAccountReconciliation }] = useCreateManualAccountReconciliationMutation();
  const [acceptSuggestion] = useAcceptReconciliationSuggestionMutation();
  const [loadingSuggestions, setLoadingSuggestions] = useState<Set<string>>(new Set());
  const [rejectSuggestion] = useRejectReconciliationSuggestionMutation();
  const [rejectingSuggestions, setRejectingSuggestions] = useState<Set<string>>(new Set());
  const [regenerateAllSuggestions, { isLoading: isRegeneratingAll }] = useRegenerateAllSuggestionsMutation();
  const [regenerateTransactionSuggestions] = useRegenerateTransactionSuggestionsMutation();
  const [regeneratingTransactions, setRegeneratingTransactions] = useState<Set<number>>(new Set());
  const [unreconcileTransaction] = useUnreconcileTransactionMutation();
  const [createOutstandingItem] = useCreateOutstandingItemMutation();

  // Multi-Bank Account mutations
  const [createBankAccount] = useCreateBankAccountMutation();
  const [updateBankAccount] = useUpdateBankAccountMutation();
  const [deactivateBankAccount] = useDeactivateBankAccountMutation();

  // Bank Account Analytic lookups and mutations (no UI list)
  const { data: accountAnalytics = [], refetch: refetchAccountAnalytics } = useGetBankAccountAnalyticsQuery({ clientEin: clientCompanyEin }, { skip: !clientCompanyEin });
  const [createAccountAnalytic] = useCreateBankAccountAnalyticMutation();
  const [updateAccountAnalytic] = useUpdateBankAccountAnalyticMutation();

  const [unreconciling, setUnreconciling] = useState<Set<string>>(new Set());
  const [markingAsOutstanding, setMarkingAsOutstanding] = useState<Set<number>>(new Set());

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

  const filteredDocuments = useMemo(() => {
    const dList: Document[] = Array.isArray(documentsData) ? documentsData : [];
    console.log(`🔍 DOCUMENT FILTERING DEBUG:`);
    console.log(`📄 Total documents: ${dList.length}`);
    console.log(`🔍 Filter status: ${filterStatus}`);
    console.log(`🔍 Search term: '${searchTerm}'`);
    
    if (dList.length === 0) {
      console.log(`❌ No documents to filter`);
      return [];
    }
    
    // Log all document statuses for debugging
    const statusCounts = dList.reduce((acc, doc) => {
      const normalized = normalizeStatus(doc.reconciliation_status);
      acc[doc.reconciliation_status] = (acc[doc.reconciliation_status] || 0) + 1;
      acc[`normalized_${normalized}`] = (acc[`normalized_${normalized}`] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`📊 Document status counts:`, statusCounts);
    
    const filtered = dList.filter((doc: Document) => {
      const matchesSearch = searchTerm === '' || 
        doc.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.document_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.vendor?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const normalizedStatus = normalizeStatus(doc.reconciliation_status);
      
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'unreconciled' && ['unreconciled', 'pending'].includes(normalizedStatus)) ||
        (filterStatus === 'reconciled' && ['auto_matched', 'manually_matched', 'matched'].includes(normalizedStatus)) ||
        (filterStatus === 'disputed' && normalizedStatus === 'disputed') ||
        (filterStatus === 'ignored' && normalizedStatus === 'ignored');

      const notOutstanding = !excludeOutstanding || !outstandingDocIds.has(doc.id);
      
      // Debug individual document filtering
      if (filterStatus === 'reconciled') {
        console.log(`📄 Doc ${doc.id} (${doc.name}): status='${doc.reconciliation_status}' normalized='${normalizedStatus}' matches=${matchesStatus}`);
      }
      
      return matchesSearch && matchesStatus && notOutstanding;
    });
    
    console.log(`✅ Filtered documents: ${filtered.length}/${dList.length}`);
    return filtered;
  }, [documentsData, searchTerm, filterStatus, excludeOutstanding, outstandingDocIds]);

  const filteredTransactions = useMemo(() => {
    const tList: BankTransaction[] = Array.isArray(transactionsData) ? transactionsData : [];
    
    if (tList.length === 0) {
      return [];
    }
    
    // Log all transaction statuses for debugging
    const statusCounts = tList.reduce((acc, txn) => {
      const normalized = normalizeStatus(txn.reconciliation_status);
      acc[txn.reconciliation_status] = (acc[txn.reconciliation_status] || 0) + 1;
      acc[`normalized_${normalized}`] = (acc[`normalized_${normalized}`] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`📊 Transaction status counts:`, statusCounts);
    
    const filtered = tList.filter((txn: BankTransaction) => {
      const matchesSearch = searchTerm === '' || 
        txn.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        txn.referenceNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const normalizedStatus = normalizeStatus(txn.reconciliation_status);
      
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'unreconciled' && ['unreconciled', 'pending'].includes(normalizedStatus)) ||
        (filterStatus === 'reconciled' && ['matched', 'auto_matched', 'manually_matched'].includes(normalizedStatus));

      const notOutstanding = !excludeOutstanding || !outstandingTxnIds.has(String(txn.id));
      
      // Debug individual transaction filtering
      if (filterStatus === 'reconciled') {
        console.log(`💳 Txn ${txn.id}: status='${txn.reconciliation_status}' normalized='${normalizedStatus}' matches=${matchesStatus}`);
      }
      
      return matchesSearch && matchesStatus && notOutstanding;
    });
    
    console.log(`✅ Filtered transactions: ${filtered.length}/${tList.length}`);
    return filtered;
  }, [transactionsData, searchTerm, filterStatus, excludeOutstanding, outstandingTxnIds]);

  // Calculate unreconciled transactions count (for Mark as Outstanding logic)
  const unreconciledTransactionsCount = useMemo(() => {
    const tList: BankTransaction[] = Array.isArray(transactionsData) ? transactionsData : [];
    return tList.filter((txn: BankTransaction) => {
      const normalizedStatus = normalizeStatus(txn.reconciliation_status);
      return ['unreconciled', 'pending'].includes(normalizedStatus);
    }).length;
  }, [transactionsData]);

  // Handler for marking document as outstanding item
  const handleMarkAsOutstanding = async (doc: Document) => {
    if (markingAsOutstanding.has(doc.id)) return;
    
    setMarkingAsOutstanding(prev => new Set([...prev, doc.id]));
    
    try {
      // Map document type to outstanding item type
      let outstandingType: 'OUTSTANDING_CHECK' | 'DEPOSIT_IN_TRANSIT' | 'PENDING_TRANSFER';
      let description: string;
      
      if (doc.type === 'Payment Order' || doc.type === 'Collection Order') {
        outstandingType = 'OUTSTANDING_CHECK';
        description = `${doc.type} ${doc.document_number || doc.name}`;
      } else if (doc.type === 'Invoice' || doc.type === 'Receipt' || doc.type === 'Z Report') {
        outstandingType = 'DEPOSIT_IN_TRANSIT';
        description = `${doc.type} ${doc.document_number || doc.name}`;
      } else {
        // Default fallback
        outstandingType = 'DEPOSIT_IN_TRANSIT';
        description = `${doc.type} ${doc.document_number || doc.name}`;
      }
      
      const payload = {
        type: outstandingType,
        referenceNumber: doc.document_number || doc.name,
        description: description,
        amount: getDocumentAmount(doc),
        issueDate: getDocumentDate(doc),
        payeeBeneficiary: doc.vendor || doc.buyer || undefined,
        notes: `Auto-created from unreconciled ${doc.type.toLowerCase()}`,
        relatedDocumentId: doc.id
      };
      
      await createOutstandingItem({ clientEin: clientCompanyEin, data: payload }).unwrap();
      
      // Show success message
      alert(language === 'ro' 
        ? `Document ${doc.document_number || doc.name} a fost marcat ca element în așteptare!` 
        : `Document ${doc.document_number || doc.name} marked as outstanding item!`);
      
      // Optionally refresh data or show success indicator
      
    } catch (error) {
      console.error('Failed to mark document as outstanding:', error);
      alert(language === 'ro' 
        ? 'Eroare la marcarea documentului ca element în așteptare' 
        : 'Failed to mark document as outstanding');
    } finally {
      setMarkingAsOutstanding(prev => {
        const newSet = new Set(prev);
        newSet.delete(doc.id);
        return newSet;
      });
    }
  };

  // Infinite scroll observers
  useEffect(() => {
    const options = { root: null, rootMargin: '0px', threshold: 1.0 };

    const createObserver = (ref: React.RefObject<HTMLDivElement>, hasMore: boolean, loading: boolean, incPage: () => void) => {
      if (!ref.current) return undefined;
      const obs = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          incPage();
        }
      }, options);
      obs.observe(ref.current);
      return obs;
    };

    const docObs = createObserver(documentsEndRef, documentsData.length < documentsTotal, documentsLoading, () => setDocumentsPage(p => p + 1));
    const txnObs = createObserver(transactionsEndRef, transactionsData.length < transactionsTotal, transactionsLoading, () => setTransactionsPage(p => p + 1));
    const sugObs = createObserver(suggestionsEndRef, suggestionsData.length < suggestionsTotal, suggestionsLoading, () => setSuggestionsPage(p => p + 1));

    return () => {
      docObs?.disconnect();
      txnObs?.disconnect();
      sugObs?.disconnect();
    };
  }, [documentsData.length, documentsTotal, documentsLoading, transactionsData.length, transactionsTotal, transactionsLoading, suggestionsData.length, suggestionsTotal, suggestionsLoading]);

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
      ? documentsData.find((d: Document) => d.id === draggedItem.id)
      : documentsData.find((d: Document) => d.id === targetId);
    
    const transaction = draggedItem.type === 'transaction'
      ? transactionsData.find((t: BankTransaction) => t.id === draggedItem.id)
      : transactionsData.find((t: BankTransaction) => t.id === targetId);
    
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



  const handleAccountReconciliation = async (accountCode: string, notes?: string) => {
    if (!selectedTransactionForAccount) return;
    
    try {
      await createManualAccountReconciliation({
        transactionId: selectedTransactionForAccount.id,
        accountCode,
        notes
      }).unwrap();
      
      console.log('Manual account reconciliation created successfully');
      setShowAccountReconcileModal(false);
      setSelectedTransactionForAccount(null);
    } catch (error: any) {
      console.error('Failed to create manual account reconciliation:', error);
      if (error?.status === 401 || error?.data?.statusCode === 401) {
        console.warn('Authentication failed - redirecting to login');
        window.location.href = '/authentication';
      } else {
        const errorMsg = error?.data?.message || error?.message || 'Unknown error';
        alert(language === 'ro' ? `Eroare la reconcilierea cu contul: ${errorMsg}` : `Failed to reconcile with account: ${errorMsg}`);
      }
    }
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

  const handleRegenerateAllSuggestions = async () => {
    try {
      await regenerateAllSuggestions(clientCompanyEin).unwrap();
      console.log('All suggestions regenerated successfully');
      // Refresh suggestions data
      setSuggestionsData([]);
      setSuggestionsPage(1);
    } catch (error: any) {
      console.error('Failed to regenerate all suggestions:', error);
      if (error?.status === 401 || error?.data?.statusCode === 401) {
        console.warn('Authentication failed - redirecting to login');
        window.location.href = '/authentication';
      } else {
        const errorMsg = error?.data?.message || error?.message || 'Unknown error';
        console.error('Regenerate all suggestions error details:', errorMsg);
        alert(language === 'ro' ? `Eroare la regenerarea sugestiilor: ${errorMsg}` : `Failed to regenerate suggestions: ${errorMsg}`);
      }
    }
  };

  const handleRegenerateTransactionSuggestions = async (transactionId: string) => {
    const txnId = parseInt(transactionId);
    setRegeneratingTransactions(prev => new Set(prev).add(txnId));
    try {
      await regenerateTransactionSuggestions(transactionId).unwrap();
      console.log(`Suggestions for transaction ${transactionId} regenerated successfully`);
      setSuggestionsData([]);
      setSuggestionsPage(1);
    } catch (error: any) {
      console.error(`Failed to regenerate suggestions for transaction ${transactionId}:`, error);
      if (error?.status === 401 || error?.data?.statusCode === 401) {
        console.warn('Authentication failed - redirecting to login');
        window.location.href = '/authentication';
      } else {
        const errorMsg = error?.data?.message || error?.message || 'Unknown error';
        console.error('Regenerate transaction suggestions error details:', errorMsg);
        alert(language === 'ro' ? `Eroare la regenerarea sugestiilor pentru tranzacție: ${errorMsg}` : `Failed to regenerate transaction suggestions: ${errorMsg}`);
      }
    } finally {
      setRegeneratingTransactions(prev => {
        const newSet = new Set(prev);
        newSet.delete(txnId);
        return newSet;
      });
    }
  };

  const handleUnreconcileTransaction = async (transactionId: string) => {
    setUnreconciling(prev => new Set(prev).add(transactionId));
    try {
      await unreconcileTransaction({ transactionId }).unwrap();
      console.log(`Transaction ${transactionId} unreconciled successfully`);
      
      // Refresh data
      setDocumentsData([]);
      setTransactionsData([]);
      setSuggestionsData([]);
      setDocumentsPage(1);
      setTransactionsPage(1);
      setSuggestionsPage(1);
      
      alert(language === 'ro' ? 'Tranzacția a fost dereconciliată cu succes!' : 'Transaction unreconciled successfully!');
    } catch (error: any) {
      console.error(`Failed to unreconcile transaction ${transactionId}:`, error);
      if (error?.status === 401 || error?.data?.statusCode === 401) {
        console.warn('Authentication failed - redirecting to login');
        window.location.href = '/authentication';
      } else {
        const errorMsg = error?.data?.message || error?.message || 'Unknown error';
        console.error('Unreconcile transaction error details:', errorMsg);
        alert(language === 'ro' ? `Eroare la dereconcilierea tranzacției: ${errorMsg}` : `Failed to unreconcile transaction: ${errorMsg}`);
      }
    } finally {
      setUnreconciling(prev => {
        const newSet = new Set(prev);
        newSet.delete(transactionId);
        return newSet;
      });
    }
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

        {/* Multi-Bank Account Selector */}
        <div className="bg-[var(--foreground)] rounded-2xl p-6 border border-[var(--text4)] shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-xl flex items-center justify-center">
                <CreditCard size={20} className="text-[var(--primary)]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--text1)]">
                  {language === 'ro' ? 'Conturi Bancare' : 'Bank Accounts'}
                </h3>
                <p className="text-sm text-[var(--text2)]">
                  {language === 'ro' ? 'Selectează sau gestionează conturile bancare' : 'Select or manage bank accounts'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowConsolidatedView(!showConsolidatedView)}
                className={`px-4 py-2 flex items-center gap-2 rounded-xl transition-all duration-200 ${
                  showConsolidatedView
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20'
                }`}
              >
                <TrendingUp size={16} className="mr-2" />
                {language === 'ro' ? 'Vedere Consolidată' : 'Consolidated View'}
              </button>
              <button
                onClick={() => {
                  setEditingBankAccount(null);
                  setShowBankAccountModal(true);
                }}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-all duration-200 flex items-center gap-2"
              >
                <Zap size={16} />
                {language === 'ro' ? 'Adaugă Cont' : 'Add Account'}
              </button>
            </div>
          </div>

          {/* Bank Account Selection */}
          {bankAccountsLoading ? (
            <div className="flex gap-3 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded-xl flex-1"></div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {/* All Accounts Option */}
              <button
                onClick={() => setSelectedBankAccountId(null)}
                className={`p-4 rounded-xl border-2 transition-all duration-200 min-w-[200px] ${
                  selectedBankAccountId === null
                    ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                    : 'border-[var(--text4)] hover:border-[var(--primary)]/50 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                    <Landmark size={16} className="text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-[var(--text1)]">
                      {language === 'ro' ? 'Toate Conturile' : 'All Accounts'}
                    </div>
                    <div className="text-sm text-[var(--text2)]">
                      {bankAccounts.length} {language === 'ro' ? 'conturi' : 'accounts'}
                    </div>
                  </div>
                </div>
              </button>

              {/* Individual Bank Accounts */}
              {bankAccounts.map((account: any) => (
                <button
                  key={account.id}
                  onClick={() => setSelectedBankAccountId(account.id)}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 min-w-[250px] ${
                    selectedBankAccountId === account.id
                      ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                      : 'border-[var(--text4)] hover:border-[var(--primary)]/50 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[var(--primary)] rounded-lg flex items-center justify-center">
                        <CreditCard size={16} className="text-white" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-[var(--text1)] truncate max-w-[150px]">
                          {account.accountName}
                        </div>
                        <div className="text-xs text-[var(--text3)] truncate max-w-[150px]">
                          {account.bankName}
                        </div>
                        <div className="text-sm text-[var(--text2)]">
                          {account.iban.slice(-6)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            title={language === 'ro' ? 'Modifică' : 'Edit'}
                            className="p-1 rounded text-[var(--primary)]
                            hover:text-white bg-[var(--primary)]/30 hover:bg-[var(--primary)]"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingBankAccount(account);
                              setShowBankAccountModal(true);
                            }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            title={language === 'ro' ? 'Dezactivează' : 'Deactivate'}
                            className="p-1 rounded hover:bg-red-500 bg-red-200 hover:text-white text-red-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              openConfirm(
                                language === 'ro' ? 'Sigur dezactivezi contul?' : 'Deactivate this account?',
                                async () => {
                                  try {
                                    await deactivateBankAccount({ accountId: account.id }).unwrap();
                                    addToast(
                                      language === 'ro' ? 'Contul a fost dezactivat.' : 'Bank account deactivated.',
                                      'success'
                                    );
                                  } catch (error) {
                                    console.error(error);
                                    addToast(
                                      language === 'ro' ? 'Eroare la dezactivarea contului.' : 'Failed to deactivate account.',
                                      'error'
                                    );
                                  } finally {
                                    closeConfirm();
                                  }
                                }
                              );
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="text-sm font-medium text-[var(--text1)]">
                                  {account.unreconciledTransactionsCount}
                                </div>
                                <div className="text-xs text-[var(--text2)]">
                                  {language === 'ro' ? 'nereconciliate' : 'unreconciled'}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

            </div>
        

        {/* Consolidated View */}
        {showConsolidatedView && consolidatedView && (
          <div className="bg-[var(--foreground)] rounded-2xl p-6 border border-[var(--text4)] shadow-sm mb-6">
            <div className="flex flex-row items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-xl flex items-center justify-center">
                <TrendingUp size={20} className="text-[var(--primary)]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--text1)]">
                  {language === 'ro' ? 'Vedere Consolidată' : 'Consolidated View'}
                </h3>
                <p className="text-sm text-[var(--text2)]">
                  {language === 'ro' ? 'Sumar pentru toate conturile bancare' : 'Summary across all bank accounts'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-[var(--primary)]/5 rounded-xl p-4">
                <div className="text-2xl font-bold text-[var(--primary)]">
                  {consolidatedView.totalAccounts}
                </div>
                <div className="text-sm text-[var(--text2)]">
                  {language === 'ro' ? 'Conturi Totale' : 'Total Accounts'}
                </div>
              </div>
              <div className="bg-orange-500/5 rounded-xl p-4">
                <div className="text-2xl font-bold text-orange-600">
                  {consolidatedView.totalUnreconciledTransactions}
                </div>
                <div className="text-sm text-[var(--text2)]">
                  {language === 'ro' ? 'Tranzacții Nereconciliate' : 'Unreconciled Transactions'}
                </div>
              </div>
              <div className="bg-green-500/5 rounded-xl p-4">
                <div className="text-2xl font-bold text-green-600">
                  {consolidatedView.accountSummaries.filter((acc: any) => acc.unreconciledCount === 0).length}
                </div>
                <div className="text-sm text-[var(--text2)]">
                  {language === 'ro' ? 'Conturi Reconciliate' : 'Reconciled Accounts'}
                </div>
              </div>
            </div>

            {/* Account Summaries */}
            <div className="space-y-3">
              {consolidatedView.accountSummaries.map((account: any) => (
                <div key={account.id} className="bg-white/50 rounded-xl p-4 border border-[var(--text4)]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-blue-500 rounded-lg flex items-center justify-center">
                        <CreditCard size={12} className="text-white" />
                      </div>
                      <div>
                        <div className="font-semibold text-[var(--text1)]">{account.accountName}</div>
                        <div className="text-sm text-[var(--text2)]">{account.iban}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${
                        account.unreconciledCount === 0 ? 'text-green-600' : 'text-orange-600'
                      }`}>
                        {account.unreconciledCount} {language === 'ro' ? 'nereconciliate' : 'unreconciled'}
                      </div>
                    </div>
                  </div>
                  {account.recentTransactions.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs text-[var(--text2)] mb-1">
                        {language === 'ro' ? 'Tranzacții Recente:' : 'Recent Transactions:'}
                      </div>
                      {account.recentTransactions.slice(0, 3).map((tx: any) => (
                        <div key={tx.id} className="text-xs bg-gray-50 rounded p-2 flex justify-between">
                          <span className="truncate max-w-[200px]">{tx.description}</span>
                          <span className={`font-medium ${
                            tx.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {tx.type === 'CREDIT' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
                  <p className="text-sm text-[var(--text3)]">{language === 'ro' ? 'Sugestii' : 'Suggestions'}</p>
                  <p className="text-xl font-bold text-[var(--text1)]">{suggestionsTotal}</p>
                  <p className="text-xs text-purple-600">
                    {language === 'ro' ? 'Disponibile' : 'Available'}
                  </p>
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
            { key: 'suggestions', label: language === 'ro' ? 'Sugestii' : 'Suggestions', icon: Zap },
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
      <FiltersToolbar
        language={language as string}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        excludeOutstanding={excludeOutstanding}
        setExcludeOutstanding={setExcludeOutstanding}
        showBulkActions={showBulkActions}
        isCreatingBulkMatches={isCreatingBulkMatches}
        handleBulkAction={handleBulkAction}
        setShowOutstandingPanel={setShowOutstandingPanel}
      />

      {/* Slide-over Outstanding Items Management Panel */}
      {showOutstandingPanel && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowOutstandingPanel(false)}></div>
          <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {language === 'ro' ? 'Elemente în Așteptare' : 'Outstanding Items'}
              </h3>
              <button onClick={() => setShowOutstandingPanel(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="flex-1 overflow-auto scrollbar-soft p-6 bg-gray-50">
              <OutstandingItemsManagement clientEin={clientCompanyEin} language={language as any} />
            </div>
          </div>
        </div>
      )}

      {/* Transfer candidates modal and button removed to keep UI simple as requested */}

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {showBulkActions && (
          <div>
            <BulkActionsBar
              language={language as string}
              selectedCount={selectedItems.documents.length + selectedItems.transactions.length}
              selectedTransactionsCount={selectedItems.transactions.length}
              onDeselectAll={deselectAllFiles}
              onOpenTransfer={() => setShowTransferModal(true)}
              onClose={() => setShowBulkActions(false)}
            />
          </div>
        )}
      </AnimatePresence>

      <TransferModal
        open={showTransferModal}
        language={language as any}
        fxRate={transferForm.fxRate}
        notes={transferForm.notes}
        onChange={(field, value) => setTransferForm(prev => ({ ...prev, [field]: value }))}
        creating={creatingTransfer}
        onCancel={() => setShowTransferModal(false)}
        onSave={async () => {
          try {
            const txns = selectedItems.transactions;
            if (txns.length !== 2) {
              alert(language === 'ro' ? 'Selectați exact 2 tranzacții' : 'Select exactly 2 transactions');
              return;
            }
            const t1 = transactionsData.find((t: any) => t.id === txns[0]);
            const t2 = transactionsData.find((t: any) => t.id === txns[1]);
            if (!t1 || !t2) {
              alert(language === 'ro' ? 'Tranzacții invalide' : 'Invalid transactions');
              return;
            }
            const debit = (t1.transactionType === 'debit') ? t1 : (t2.transactionType === 'debit') ? t2 : t1;
            const credit = (debit.id === t1.id) ? t2 : t1;
            const payload: any = {
              sourceTransactionId: debit.id,
              destinationTransactionId: credit.id,
              fxRate: transferForm.fxRate ? parseFloat(transferForm.fxRate) : undefined,
              notes: transferForm.notes || undefined,
            };
            await createTransferReconciliation({ clientEin: clientCompanyEin, data: payload }).unwrap();
            addToast(language === 'ro' ? 'Transfer creat' : 'Transfer created', 'success');
            setShowTransferModal(false);
            setTransferForm({ fxRate: '1', notes: '' });
            setSelectedItems({ documents: [], transactions: [] });
            setShowBulkActions(false);
            refetchPendingTransfers();
          } catch (error: any) {
            if (error?.status === 401 || error?.data?.statusCode === 401) {
              window.location.href = '/authentication';
              return;
            }
            const msg = error?.data?.message || error?.message || 'Unknown error';
            addToast((language === 'ro' ? 'Eroare: ' : 'Error: ') + msg, 'error');
          }
        }}
      />

      {/* Pending Transfers */}
      {pendingTransfersData && Array.isArray(pendingTransfersData) && (
        <PendingTransfersList
          language={language as string}
          items={pendingTransfersData as any}
          deleting={deletingTransfer as any}
          onRefresh={() => refetchPendingTransfers()}
          onDelete={async (id: number) => {
            try {
              await deleteTransferReconciliation({ clientEin: clientCompanyEin, id }).unwrap();
              addToast(language === 'ro' ? 'Transfer șters' : 'Transfer deleted', 'success');
              refetchPendingTransfers();
            } catch (error: any) {
              if (error?.status === 401 || error?.data?.statusCode === 401) {
                window.location.href = '/authentication';
                return;
              }
              const msg = error?.data?.message || error?.message || 'Unknown error';
              addToast((language === 'ro' ? 'Eroare: ' : 'Error: ') + msg, 'error');
            }
          }}
        />
      )}

      {/* Split Transaction Modal */}
      {showSplitModal && selectedTransactionForSplit && (
        <SplitTransactionModal
          isOpen={showSplitModal}
          onClose={() => {
            setShowSplitModal(false);
            setSelectedTransactionForSplit(null);
          }}
          transaction={{
            id: selectedTransactionForSplit.id,
            amount: selectedTransactionForSplit.amount,
            description: selectedTransactionForSplit.description,
            transactionType: selectedTransactionForSplit.transactionType,
            referenceNumber: selectedTransactionForSplit.referenceNumber,
            transactionDate: selectedTransactionForSplit.transactionDate,
          }}
          language={language as any}
        />
      )}

      {/* Main Content */}
      {activeTab === 'reconciliation' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <DocumentsList
            language={language as any}
            documentsData={documentsData as any}
            documentsTotal={documentsTotal}
            documentsLoading={documentsLoading}
            documentsError={documentsError}
            filteredDocuments={filteredDocuments as any}
            selectedItems={selectedItems as any}
            outstandingDocIds={outstandingDocIds as any}
            unreconciledTransactionsCount={unreconciledTransactionsCount}
            getDocumentIcon={getDocumentIcon as any}
            getStatusColor={getStatusColor as any}
            getStatusText={getStatusText as any}
            normalizeStatus={normalizeStatus as any}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
            getDocumentDate={getDocumentDate as any}
            getDocumentAmount={getDocumentAmount as any}
            draggedItem={draggedItem as any}
            updatingDocStatus={updatingDocStatus as any}
            markingAsOutstanding={markingAsOutstanding as any}
            toggleFileSelection={toggleFileSelection as any}
            handleToggleDocumentIgnored={handleToggleDocumentIgnored as any}
            handleMarkAsOutstanding={handleMarkAsOutstanding as any}
            handleDragStart={handleDragStart as any}
            handleDragOver={handleDragOver as any}
            handleDrop={handleDrop as any}
          />

          <TransactionsList
            language={language as any}
            transactionsData={transactionsData as any}
            transactionsTotal={transactionsTotal}
            transactionsLoading={transactionsLoading}
            transactionsError={transactionsError}
            filteredTransactions={filteredTransactions as any}
            selectedItems={selectedItems as any}
            draggedItem={draggedItem as any}
            getStatusColor={getStatusColor as any}
            getStatusText={getStatusText as any}
            normalizeStatus={normalizeStatus as any}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
            outstandingTxnIds={outstandingTxnIds as any}
            expandedSplits={expandedSplits as any}
            unreconciling={unreconciling as any}
            toggleTransactionSelection={toggleTransactionSelection as any}
            setSelectedTransactionForAccount={setSelectedTransactionForAccount as any}
            setShowAccountReconcileModal={setShowAccountReconcileModal}
            setSelectedTransactionForSplit={setSelectedTransactionForSplit as any}
            setShowSplitModal={setShowSplitModal}
            handleUnreconcileTransaction={handleUnreconcileTransaction as any}
            setExpandedSplits={setExpandedSplits as any}
            handleDragStart={handleDragStart as any}
            handleDragOver={handleDragOver as any}
            handleDrop={handleDrop as any}
          />
        </div>
      )}

      {activeTab === 'suggestions' && (
        <SuggestionsList
          language={language as string}
          suggestionsLoading={suggestionsLoading}
          suggestionsError={suggestionsError}
          displayedSuggestions={displayedSuggestions}
          isRegeneratingAll={isRegeneratingAll}
          handleRegenerateAllSuggestions={handleRegenerateAllSuggestions}
          loadingSuggestions={loadingSuggestions}
          setLoadingSuggestions={setLoadingSuggestions}
          rejectingSuggestions={rejectingSuggestions}
          setRejectingSuggestions={setRejectingSuggestions}
          setRemovedSuggestions={setRemovedSuggestions}
          regeneratingTransactions={regeneratingTransactions}
          handleRegenerateTransactionSuggestions={handleRegenerateTransactionSuggestions}
          clientCompanyEin={clientCompanyEin}
          transactionsData={transactionsData}
          acceptSuggestion={acceptSuggestion}
          rejectSuggestion={rejectSuggestion}
          createManualAccountReconciliation={createManualAccountReconciliation}
          createTransferReconciliation={createTransferReconciliation}
          refetchSuggestions={refetchSuggestions as any}
          formatDate={formatDate}
          formatCurrency={formatCurrency}
        />
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
            <ComprehensiveReportingSystem 
              clientEin={clientCompanyEin} 
              language={language as 'ro' | 'en'} 
            />
          </div>
        </div>
      )}

      <MatchModal
        open={showMatchModal}
        language={language as any}
        matchingPair={matchingPair as any}
        onCancel={() => handleManualMatch(false)}
        onConfirm={() => handleManualMatch(true)}
        isCreating={isCreatingMatch}
        formatDate={formatDate}
        formatCurrency={formatCurrency}
        getDocumentDate={getDocumentDate as any}
        getDocumentAmount={getDocumentAmount as any}
      />

      <AccountReconcileModal
        open={showAccountReconcileModal}
        language={language as any}
        selectedTransaction={selectedTransactionForAccount as any}
        isLoading={isCreatingAccountReconciliation}
        onCancel={() => {
          setShowAccountReconcileModal(false);
          setSelectedTransactionForAccount(null);
        }}
        onSelect={handleAccountReconciliation as any}
        formatDate={formatDate}
        formatCurrency={formatCurrency}
        AccountCodeSelector={AccountCodeSelector as any}
      />

      <BankAccountModal
        open={showBankAccountModal}
        language={language as any}
        editingBankAccount={editingBankAccount}
        onClose={() => { setShowBankAccountModal(false); setEditingBankAccount(null); }}
        clientCompanyEin={clientCompanyEin}
        accountAnalytics={accountAnalytics as any}
        createBankAccount={createBankAccount as any}
        updateBankAccount={updateBankAccount as any}
        createAccountAnalytic={createAccountAnalytic as any}
        updateAccountAnalytic={updateAccountAnalytic as any}
        refetchAccountAnalytics={refetchAccountAnalytics as any}
        addToast={addToast}
      />

      {/* Toast Notifications */}
      <ToastPortal toasts={toasts} />

      {/* Confirm Modal */}
      <ConfirmModal
        open={confirmOpen}
        message={confirmMessage}
        language={language as any}
        onCancel={closeConfirm}
        onConfirm={async () => {
          if (confirmActionRef.current) {
            await Promise.resolve(confirmActionRef.current());
          } else {
            closeConfirm();
          }
        }}
      />
    </div>
  );
};

export default BankPage;
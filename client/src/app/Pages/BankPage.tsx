import { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { 
  Landmark, 
  Search, 
  CheckCircle, 
  CreditCard,
  FileText,
  Receipt,
  ArrowRight,
  Link,
  DollarSign,
  Calendar,
  AlertTriangle,
  Check,
  X,
  Zap,
  Target,
  TrendingUp,
  Eye,
  Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
}

interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  reference?: string;
  balance_after?: number;
  reconciliation_status: 'unreconciled' | 'matched' | 'ignored';
  matched_document_id?: number;
  confidence_score?: number;
}

interface ReconciliationSuggestion {
  document_id: number;
  transaction_id: string;
  confidence: number;
  matching_criteria: string[];
  reasons: string[];
}

const BankPage = () => {
  const language = useSelector((state: {user:{language:string}}) => state.user.language);
  
  // State management
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('unreconciled');
  const [activeTab, setActiveTab] = useState<'reconciliation' | 'suggestions' | 'reports'>('reconciliation');
  const [selectedItems, setSelectedItems] = useState<{documents: number[], transactions: string[]}>({documents: [], transactions: []});
  const [draggedItem, setDraggedItem] = useState<{type: 'document' | 'transaction', id: string | number} | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchingPair, setMatchingPair] = useState<{document: Document, transaction: BankTransaction} | null>(null);

  // Mock data - replace with your actual API calls
  const documents: Document[] = [
    {
      id: 1,
      name: 'INV-2025-001.pdf',
      type: 'Invoice',
      document_number: 'INV-2025-001',
      total_amount: 2500.00,
      document_date: '2025-01-15',
      vendor: 'ABC SRL',
      direction: 'incoming',
      reconciliation_status: 'unreconciled',
      references: []
    },
    {
      id: 2,
      name: 'INV-2025-002.pdf', 
      type: 'Invoice',
      document_number: 'INV-2025-002',
      total_amount: 1200.50,
      document_date: '2025-01-16',
      vendor: 'XYZ SRL',
      direction: 'outgoing',
      reconciliation_status: 'auto_matched',
      matched_transactions: ['TXN-001'],
      references: []
    },
    {
      id: 3,
      name: 'REC-2025-001.pdf',
      type: 'Receipt',
      document_number: 'REC-2025-001', 
      total_amount: 850.00,
      document_date: '2025-01-17',
      vendor: 'DEF SRL',
      reconciliation_status: 'manually_matched',
      matched_transactions: ['TXN-003'],
      references: []
    }
  ];

  const transactions: BankTransaction[] = [
    {
      id: 'TXN-001',
      date: '2025-01-16',
      description: 'Transfer pentru INV-2025-002 - XYZ SRL',
      amount: -1200.50,
      type: 'debit',
      reference: 'INV-2025-002',
      balance_after: 98799.50,
      reconciliation_status: 'matched',
      matched_document_id: 2,
      confidence_score: 0.95
    },
    {
      id: 'TXN-002',
      date: '2025-01-15',
      description: 'Plata cash - ABC SRL',
      amount: 2500.00,
      type: 'credit',
      balance_after: 101300.00,
      reconciliation_status: 'unreconciled'
    },
    {
      id: 'TXN-003',
      date: '2025-01-17',
      description: 'Incasare REC-2025-001',
      amount: 850.00,
      type: 'credit',
      reference: 'REC-2025-001',
      balance_after: 102150.00,
      reconciliation_status: 'matched',
      matched_document_id: 3,
      confidence_score: 0.88
    },
    {
      id: 'TXN-004',
      date: '2025-01-18',
      description: 'Transfer bancar - Furnizor necunoscut',
      amount: -750.00,
      type: 'debit',
      balance_after: 101400.00,
      reconciliation_status: 'unreconciled'
    }
  ];

  const suggestions: ReconciliationSuggestion[] = [
    {
      document_id: 1,
      transaction_id: 'TXN-002',
      confidence: 0.85,
      matching_criteria: ['amount_match', 'vendor_match', 'date_proximity'],
      reasons: [
        'Exact amount match: 2500.00 RON',
        'Vendor name similarity: ABC SRL',
        'Date within 1 day of invoice date'
      ]
    }
  ];

  // Filtered data based on search and filters
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const matchesSearch = searchTerm === '' || 
        doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.document_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.vendor?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || doc.reconciliation_status === filterStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [documents, searchTerm, filterStatus]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(txn => {
      const matchesSearch = searchTerm === '' || 
        txn.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        txn.reference?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || txn.reconciliation_status === filterStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [transactions, searchTerm, filterStatus]);

  // Statistics
  const stats = useMemo(() => {
    const totalDocs = documents.length;
    const reconciledDocs = documents.filter(d => d.reconciliation_status !== 'unreconciled').length;
    const totalTxns = transactions.length;
    const reconciledTxns = transactions.filter(t => t.reconciliation_status !== 'unreconciled').length;
    
    return {
      documents: { total: totalDocs, reconciled: reconciledDocs, percentage: (reconciledDocs / totalDocs) * 100 },
      transactions: { total: totalTxns, reconciled: reconciledTxns, percentage: (reconciledTxns / totalTxns) * 100 },
      unmatched_amount: documents.filter(d => d.reconciliation_status === 'unreconciled').reduce((sum, d) => sum + d.total_amount, 0)
    };
  }, [documents, transactions]);

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
      ? documents.find(d => d.id === draggedItem.id)
      : documents.find(d => d.id === targetId);
    
    const transaction = draggedItem.type === 'transaction'
      ? transactions.find(t => t.id === draggedItem.id)
      : transactions.find(t => t.id === targetId);
    
    if (document && transaction) {
      setMatchingPair({ document, transaction });
      setShowMatchModal(true);
    }
    
    setDraggedItem(null);
  };

  const handleManualMatch = (confirmed: boolean, notes?: string) => {
    if (!matchingPair) return;
    
    if (confirmed) {
      // In real implementation, call your API to create the match
      console.log('Creating manual match:', {
        document_id: matchingPair.document.id,
        transaction_id: matchingPair.transaction.id,
        notes
      });
      
      // Update local state (in real app, refetch data)
      // This would be handled by your state management
    }
    
    setMatchingPair(null);
    setShowMatchModal(false);
  };

  const handleBulkAction = (action: 'match_selected' | 'ignore_selected' | 'unreconcile_selected') => {
    console.log('Bulk action:', action, selectedItems);
    // Implement bulk operations
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'matched':
      case 'auto_matched': 
      case 'manually_matched':
        return 'text-green-500 bg-green-50';
      case 'unreconciled':
        return 'text-yellow-500 bg-yellow-50';
      case 'disputed':
        return 'text-red-500 bg-red-50';
      case 'ignored':
        return 'text-gray-500 bg-gray-50';
      default: 
        return 'text-gray-500 bg-gray-50';
    }
  };

  const getDocumentIcon = (type: string) => {
    switch(type) {
      case 'Invoice': return FileText;
      case 'Receipt': return Receipt;
      case 'Z Report': return CreditCard;
      default: return FileText;
    }
  };

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

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <motion.div className="bg-[var(--foreground)] rounded-2xl p-4 border border-[var(--text4)] shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <FileText size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-[var(--text3)]">{language === 'ro' ? 'Documente' : 'Documents'}</p>
                <p className="text-xl font-bold text-[var(--text1)]">{stats.documents.reconciled}/{stats.documents.total}</p>
                <p className="text-xs text-green-600">{stats.documents.percentage.toFixed(1)}% {language === 'ro' ? 'reconciliate' : 'reconciled'}</p>
              </div>
            </div>
          </motion.div>

          <motion.div className="bg-[var(--foreground)] rounded-2xl p-4 border border-[var(--text4)] shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CreditCard size={24} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-[var(--text3)]">{language === 'ro' ? 'Tranzacții' : 'Transactions'}</p>
                <p className="text-xl font-bold text-[var(--text1)]">{stats.transactions.reconciled}/{stats.transactions.total}</p>
                <p className="text-xs text-green-600">{stats.transactions.percentage.toFixed(1)}% {language === 'ro' ? 'reconciliate' : 'reconciled'}</p>
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
                  {new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(stats.unmatched_amount)}
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
                <p className="text-xl font-bold text-[var(--text1)]">{suggestions.length}</p>
                <p className="text-xs text-purple-600">{language === 'ro' ? 'Disponibile' : 'Available'}</p>
              </div>
            </div>
          </motion.div>
        </div>
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
                    : 'text-[var(--text2)] hover:bg-[var(--primary)]/10'
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
            <option value="auto_matched">{language === 'ro' ? 'Auto-reconciliate' : 'Auto-matched'}</option>
            <option value="manually_matched">{language === 'ro' ? 'Manual reconciliate' : 'Manually matched'}</option>
            <option value="disputed">{language === 'ro' ? 'Disputate' : 'Disputed'}</option>
          </select>

          {/* Bulk Actions */}
          {selectedItems.documents.length > 0 || selectedItems.transactions.length > 0 ? (
            <div className="flex gap-2">
              <button 
                onClick={() => handleBulkAction('match_selected')}
                className="px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors text-sm font-medium"
              >
                {language === 'ro' ? 'Reconciliază' : 'Match'}
              </button>
              <button 
                onClick={() => handleBulkAction('ignore_selected')}
                className="px-4 py-2 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-colors text-sm font-medium"
              >
                {language === 'ro' ? 'Ignoră' : 'Ignore'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Main Content */}
      {activeTab === 'reconciliation' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Unmatched Documents */}
          <div className="bg-[var(--foreground)] rounded-2xl border border-[var(--text4)] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[var(--text4)] bg-[var(--background)]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[var(--text1)] flex items-center gap-2">
                  <FileText size={20} />
                  {language === 'ro' ? 'Documente Nereconciliate' : 'Unmatched Documents'}
                </h3>
                <span className="text-sm text-[var(--text3)]">
                  {filteredDocuments.filter(d => d.reconciliation_status === 'unreconciled').length} {language === 'ro' ? 'articole' : 'items'}
                </span>
              </div>
            </div>
            <div className="p-4 max-h-[600px] overflow-y-auto">
              <div className="space-y-3">
                {filteredDocuments.filter(doc => filterStatus === 'all' || doc.reconciliation_status === 'unreconciled').map((doc) => {
                  const Icon = getDocumentIcon(doc.type);
                  const isSelected = selectedItems.documents.includes(doc.id);
                  
                  return (
                    <motion.div
                      key={doc.id}
                      draggable
                      onDragStart={() => handleDragStart('document', doc.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, 'document', doc.id)}
                      whileHover={{ scale: 1.02 }}
                      className={`p-4 bg-[var(--background)] rounded-xl border-2 transition-all duration-300 cursor-grab active:cursor-grabbing ${
                        isSelected 
                          ? 'border-[var(--primary)] bg-[var(--primary)]/5' 
                          : 'border-[var(--text4)] hover:border-[var(--primary)]/50'
                      } ${draggedItem?.type === 'transaction' ? 'border-dashed border-green-400 bg-green-50' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedItems(prev => ({
                                  ...prev,
                                  documents: [...prev.documents, doc.id]
                                }));
                              } else {
                                setSelectedItems(prev => ({
                                  ...prev,
                                  documents: prev.documents.filter(id => id !== doc.id)
                                }));
                              }
                            }}
                            className="mt-1 accent-[var(--primary)]"
                          />
                          <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Icon size={18} className="text-[var(--primary)]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-[var(--text1)] truncate">{doc.document_number}</p>
                              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(doc.reconciliation_status)}`}>
                                {doc.reconciliation_status === 'unreconciled' ? (language === 'ro' ? 'Nereconciliat' : 'Unmatched') : 
                                 doc.reconciliation_status === 'auto_matched' ? (language === 'ro' ? 'Auto' : 'Auto') :
                                 doc.reconciliation_status === 'manually_matched' ? (language === 'ro' ? 'Manual' : 'Manual') : 'Disputed'}
                              </span>
                            </div>
                            <p className="text-sm text-[var(--text3)] mb-2 truncate">{doc.vendor}</p>
                            <div className="flex items-center gap-4 text-xs text-[var(--text3)]">
                              <span className="flex items-center gap-1">
                                <Calendar size={12} />
                                {doc.document_date}
                              </span>
                              <span className="flex items-center gap-1">
                                <DollarSign size={12} />
                                {new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(doc.total_amount)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button className="p-1 text-[var(--text3)] hover:text-[var(--primary)] transition-colors">
                            <Eye size={14} />
                          </button>
                          <button className="p-1 text-[var(--text3)] hover:text-[var(--primary)] transition-colors">
                            <Edit3 size={14} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Unmatched Transactions */}
          <div className="bg-[var(--foreground)] rounded-2xl border border-[var(--text4)] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[var(--text4)] bg-[var(--background)]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[var(--text1)] flex items-center gap-2">
                  <CreditCard size={20} />
                  {language === 'ro' ? 'Tranzacții Nereconciliate' : 'Unmatched Transactions'}
                </h3>
                <span className="text-sm text-[var(--text3)]">
                  {filteredTransactions.filter(t => t.reconciliation_status === 'unreconciled').length} {language === 'ro' ? 'articole' : 'items'}
                </span>
              </div>
            </div>
            <div className="p-4 max-h-[600px] overflow-y-auto">
              <div className="space-y-3">
                {filteredTransactions.filter(txn => filterStatus === 'all' || txn.reconciliation_status === 'unreconciled').map((txn) => {
                  const isSelected = selectedItems.transactions.includes(txn.id);
                  
                  return (
                    <motion.div
                      key={txn.id}
                      draggable
                      onDragStart={() => handleDragStart('transaction', txn.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, 'transaction', txn.id)}
                      whileHover={{ scale: 1.02 }}
                      className={`p-4 bg-[var(--background)] rounded-xl border-2 transition-all duration-300 cursor-grab active:cursor-grabbing ${
                        isSelected 
                          ? 'border-[var(--primary)] bg-[var(--primary)]/5' 
                          : 'border-[var(--text4)] hover:border-[var(--primary)]/50'
                      } ${draggedItem?.type === 'document' ? 'border-dashed border-green-400 bg-green-50' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedItems(prev => ({
                                  ...prev,
                                  transactions: [...prev.transactions, txn.id]
                                }));
                              } else {
                                setSelectedItems(prev => ({
                                  ...prev,
                                  transactions: prev.transactions.filter(id => id !== txn.id)
                                }));
                              }
                            }}
                            className="mt-1 accent-[var(--primary)]"
                          />
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            txn.type === 'credit' ? 'bg-green-100' : 'bg-red-100'
                          }`}>
                            <ArrowRight size={18} className={`${
                              txn.type === 'credit' ? 'text-green-600 rotate-180' : 'text-red-600'
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
                            {txn.reference && (
                              <p className="text-sm text-[var(--text3)] mb-2">Ref: {txn.reference}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-[var(--text3)]">
                              <span className="flex items-center gap-1">
                                <Calendar size={12} />
                                {txn.date}
                              </span>
                              <span className={`flex items-center gap-1 font-semibold ${
                                txn.type === 'credit' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                <DollarSign size={12} />
                                {txn.type === 'credit' ? '+' : ''}{new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(txn.amount)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button className="p-1 text-[var(--text3)] hover:text-[var(--primary)] transition-colors">
                            <Eye size={14} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
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
            <div className="space-y-4">
              {suggestions.map((suggestion, index) => {
                const doc = documents.find(d => d.id === suggestion.document_id);
                const txn = transactions.find(t => t.id === suggestion.transaction_id);
                
                if (!doc || !txn) return null;
                
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
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
                            {language === 'ro' ? 'Încredere' : 'Confidence'}: {Math.round(suggestion.confidence * 100)}%
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setMatchingPair({ document: doc, transaction: txn });
                            setShowMatchModal(true);
                          }}
                          className="px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors text-sm font-medium"
                        >
                          <Check size={16} className="inline mr-1" />
                          {language === 'ro' ? 'Acceptă' : 'Accept'}
                        </button>
                        <button className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors text-sm font-medium">
                          <X size={16} className="inline mr-1" />
                          {language === 'ro' ? 'Respinge' : 'Reject'}
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <p className="text-sm font-semibold text-[var(--text1)] mb-2">Document</p>
                        <p className="text-sm text-[var(--text2)]">{doc.document_number}</p>
                        <p className="text-xs text-[var(--text3)]">{doc.vendor}</p>
                        <p className="text-sm font-medium text-[var(--primary)]">
                          {new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(doc.total_amount)}
                        </p>
                      </div>
                      
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <p className="text-sm font-semibold text-[var(--text1)] mb-2">Tranzacție</p>
                        <p className="text-sm text-[var(--text2)] truncate">{txn.description}</p>
                        <p className="text-xs text-[var(--text3)]">{txn.date}</p>
                        <p className={`text-sm font-medium ${txn.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                          {txn.type === 'credit' ? '+' : ''}{new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(txn.amount)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-[var(--text1)]">
                        {language === 'ro' ? 'Motivele potrivirii:' : 'Matching reasons:'}
                      </p>
                      {suggestion.reasons.map((reason, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-[var(--text2)]">
                          <CheckCircle size={14} className="text-green-500" />
                          {reason}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
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
                        {new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(matchingPair.document.total_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text3)]">Data:</span>
                      <span className="text-[var(--text1)]">{matchingPair.document.document_date}</span>
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
                      <span className="text-[var(--text1)]">{matchingPair.transaction.reference || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text3)]">Sumă:</span>
                      <span className={`font-semibold ${matchingPair.transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                        {matchingPair.transaction.type === 'credit' ? '+' : ''}{new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(matchingPair.transaction.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text3)]">Data:</span>
                      <span className="text-[var(--text1)]">{matchingPair.transaction.date}</span>
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
                  className="px-6 py-3 bg-[var(--primary)] text-white rounded-xl hover:bg-[var(--primary)]/90 transition-colors font-medium"
                >
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
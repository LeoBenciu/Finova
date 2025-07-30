import { useState } from 'react';
import { useSelector } from 'react-redux';
import { 
  Landmark, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  CreditCard,
  FileText,
  Receipt,
  ArrowRight,
  Link,
  Unlink,
  RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';
import InitialClientCompanyModalSelect from '../Components/InitialClientCompanyModalSelect';
import BankConnectionModal from '../Components/BankConnectionModal';

interface BankAccount {
  id: string;
  name: string;
  bank: string;
  accountNumber: string;
  balance: number;
  connected: boolean;
  lastSync: string;
}

interface Document {
  id: string;
  type: 'invoice' | 'z_report' | 'receipt' | 'expense';
  number: string;
  amount: number;
  date: string;
  description: string;
  status: 'pending' | 'matched' | 'unmatched';
  bankTransaction?: string;
}

interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  status: 'pending' | 'matched' | 'ignored';
  matchedDocument?: string;
}

type clientCompany = {
  clientCompany:{
    current:{
      name:string,
      ein:string
    }
  }
}

const BankPage = () => {
  const language = useSelector((state: {user:{language:string}}) => state.user.language);
  
  const clientCompanyName = useSelector((state:clientCompany)=>state.clientCompany.current.name);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'reconciliation' | 'documents' | 'transactions'>('reconciliation');
  const [isBankModalOpen, setIsBankModalOpen] = useState<boolean>(false);

  if(false){
    console.log(selectedAccount);
  }

  // Mock data - replace with your actual data
  const bankAccounts: BankAccount[] = [
    {
      id: '1',
      name: 'Cont Principal',
      bank: 'BCR',
      accountNumber: 'RO89RNCB0082****5678',
      balance: 125000.50,
      connected: true,
      lastSync: '2025-06-20 10:30'
    },
    {
      id: '2',
      name: 'Cont Operațional',
      bank: 'BRD',
      accountNumber: 'RO12BRDE****1234',
      balance: 45000.00,
      connected: false,
      lastSync: '2025-06-18 14:20'
    }
  ];

  const documents: Document[] = [
    {
      id: '1',
      type: 'invoice',
      number: 'INV-2025-001',
      amount: 2500.00,
      date: '2025-06-19',
      description: 'Factură client ABC SRL',
      status: 'pending'
    },
    {
      id: '2',
      type: 'z_report',
      number: 'Z-2025-06-19',
      amount: 1200.50,
      date: '2025-06-19',
      description: 'Raport Z - Casa 1',
      status: 'matched',
      bankTransaction: 'TXN-001'
    }
  ];

  const transactions: BankTransaction[] = [
    {
      id: 'TXN-001',
      date: '2025-06-19',
      description: 'Transfer BCR',
      amount: 1200.50,
      type: 'credit',
      status: 'matched',
      matchedDocument: '2'
    },
    {
      id: 'TXN-002',
      date: '2025-06-19',
      description: 'Plata furnizor XYZ',
      amount: -850.00,
      type: 'debit',
      status: 'pending'
    }
  ];

  const getDocumentIcon = (type: string) => {
    switch(type) {
      case 'invoice': return FileText;
      case 'z_report': return Receipt;
      case 'receipt': return Receipt;
      case 'expense': return CreditCard;
      default: return FileText;
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'matched': return 'text-green-500';
      case 'pending': return 'text-yellow-500';
      case 'unmatched': return 'text-red-500';
      default: return 'text-[var(--text3)]';
    }
  };

  const handleBankConnect = (bankData: any) => {
    console.log('Connecting to bank:', bankData);
    // Here you would integrate with your backend API to store the bank connection
    // For now, we'll just show a success message or update the UI
    
    // Example: Add the connected bank to the bankAccounts array
    // You would typically make an API call here to save the connection
    alert(`Successfully initiated connection to ${bankData.bank.displayName} in ${bankData.environment} mode!`);
  };

  return (
    <div className="min-h-screen p-8">
        {clientCompanyName===''&&(
            <div style={{ zIndex: 9999, position: 'fixed', inset: 0 }}>
             <InitialClientCompanyModalSelect/>
            </div>
        )}
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

          <div className="flex gap-3">

            {/* MADE THIS VISIBLE TO IMPLEMENT BANK INTEGRATIONS */}
            {false&&(<motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsBankModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[var(--primary)] to-blue-500 
              text-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold"
            >
              <Plus size={18} />
              {language === 'ro' ? 'Conectează Banca' : 'Connect Bank'}
            </motion.button>)}
          </div>
        </div>

        {/* Bank Accounts Overview - MAKE ALSO THIS VISIBLE WHEN ENABLING BANK INTEGRATIONS */}
        {false&&(<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {bankAccounts.map((account) => (
            <motion.div
              key={account.id}
              whileHover={{ scale: 1.02 }}
              className="bg-[var(--foreground)] rounded-2xl p-4 border border-[var(--text4)] shadow-lg cursor-pointer"
              onClick={() => setSelectedAccount(account.id)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${account.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm font-medium text-[var(--text2)]">{account.bank}</span>
                </div>
                {account.connected ? (
                  <Link size={16} className="text-green-500" />
                ) : (
                  <Unlink size={16} className="text-red-500" />
                )}
              </div>
              
              <h3 className="font-semibold text-[var(--text1)] mb-1">{account.name}</h3>
              <p className="text-xs text-[var(--text3)] mb-2">{account.accountNumber}</p>
              <p className="text-lg font-bold text-[var(--primary)]">
                {new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(account.balance)}
              </p>
              <p className="text-xs text-[var(--text3)] mt-2">
                {language === 'ro' ? 'Ultima sincronizare: ' : 'Last sync: '}{account.lastSync}
              </p>
            </motion.div>
          ))}
        </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex space-x-1 bg-[var(--background)] p-1 rounded-2xl border border-[var(--text4)] w-fit">
          {[
            { key: 'reconciliation', label: language === 'ro' ? 'Reconciliere' : 'Reconciliation' },
            { key: 'documents', label: language === 'ro' ? 'Documente' : 'Documents' },
            { key: 'transactions', label: language === 'ro' ? 'Tranzacții' : 'Transactions' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-6 py-2 rounded-xl font-medium transition-all duration-300 ${
                activeTab === tab.key
                  ? 'bg-[var(--primary)] text-white shadow-md'
                  : 'bg-[var(--primary)]/20 text-[var(--primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-[var(--foreground)] rounded-2xl p-4 border border-[var(--text4)] shadow-lg mb-6">
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
            <option value="pending">{language === 'ro' ? 'În așteptare' : 'Pending'}</option>
            <option value="matched">{language === 'ro' ? 'Reconciliate' : 'Matched'}</option>
            <option value="unmatched">{language === 'ro' ? 'Nereconciliate' : 'Unmatched'}</option>
          </select>

          <div className="flex gap-2">
            <button className="p-3 bg-[var(--background)] border border-[var(--text4)] rounded-xl 
            hover:bg-[var(--primary)]/10 transition-colors duration-200">
              <Filter size={18} className="text-[var(--text2)]" />
            </button>
            
            <button className="p-3 bg-[var(--background)] border border-[var(--text4)] rounded-xl 
            hover:bg-[var(--primary)]/10 transition-colors duration-200">
              <RefreshCw size={18} className="text-[var(--text2)]" />
            </button>
          </div>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'reconciliation' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Unmatched Documents */}
          <div className="bg-[var(--foreground)] rounded-2xl border border-[var(--text4)] shadow-lg overflow-hidden">
            <div className="p-4 border-b border-[var(--text4)] bg-[var(--background)]">
              <h3 className="text-lg font-bold text-[var(--text1)] flex items-center gap-2">
                <FileText size={20} />
                {language === 'ro' ? 'Documente de Reconciliat' : 'Documents to Reconcile'}
              </h3>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              <div className="space-y-3">
                {documents.filter(doc => doc.status === 'pending').map((doc) => {
                  const Icon = getDocumentIcon(doc.type);
                  return (
                    <motion.div
                      key={doc.id}
                      whileHover={{ scale: 1.02 }}
                      className="p-3 bg-[var(--background)] rounded-xl border border-[var(--text4)] 
                      hover:border-[var(--primary)]/50 cursor-pointer transition-all duration-300"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-lg flex items-center justify-center">
                            <Icon size={18} className="text-[var(--primary)]" />
                          </div>
                          <div>
                            <p className="font-semibold text-[var(--text1)]">{doc.number}</p>
                            <p className="text-sm text-[var(--text3)]">{doc.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-[var(--primary)]">
                            {new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(doc.amount)}
                          </p>
                          <p className="text-xs text-[var(--text3)]">{doc.date}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Unmatched Transactions */}
          <div className="bg-[var(--foreground)] rounded-2xl border border-[var(--text4)] shadow-lg overflow-hidden">
            <div className="p-4 border-b border-[var(--text4)] bg-[var(--background)]">
              <h3 className="text-lg font-bold text-[var(--text1)] flex items-center gap-2">
                <CreditCard size={20} />
                {language === 'ro' ? 'Tranzacții Bancare' : 'Bank Transactions'}
              </h3>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              <div className="space-y-3">
                {transactions.filter(txn => txn.status === 'pending').map((txn) => (
                  <motion.div
                    key={txn.id}
                    whileHover={{ scale: 1.02 }}
                    className="p-3 bg-[var(--background)] rounded-xl border border-[var(--text4)] 
                    hover:border-[var(--primary)]/50 cursor-pointer transition-all duration-300"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          txn.type === 'credit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                        }`}>
                          <ArrowRight size={18} className={txn.type === 'credit' ? 'rotate-180' : ''} />
                        </div>
                        <div>
                          <p className="font-semibold text-[var(--text1)]">{txn.description}</p>
                          <p className="text-xs text-[var(--text3)]">{txn.date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${txn.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                          {txn.type === 'credit' ? '+' : ''}{new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(txn.amount)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="bg-[var(--foreground)] rounded-2xl border border-[var(--text4)] shadow-lg overflow-hidden">
          <div className="p-4 border-b border-[var(--text4)] bg-[var(--background)]">
            <h3 className="text-lg font-bold text-[var(--text1)]">
              {language === 'ro' ? 'Toate Documentele' : 'All Documents'}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--background)] border-b border-[var(--text4)]">
                <tr>
                  <th className="px-4 py-3 text-left text-[var(--text2)] font-semibold">
                    {language === 'ro' ? 'Document' : 'Document'}
                  </th>
                  <th className="px-4 py-3 text-left text-[var(--text2)] font-semibold">
                    {language === 'ro' ? 'Sumă' : 'Amount'}
                  </th>
                  <th className="px-4 py-3 text-left text-[var(--text2)] font-semibold">
                    {language === 'ro' ? 'Data' : 'Date'}
                  </th>
                  <th className="px-4 py-3 text-left text-[var(--text2)] font-semibold">Status</th>
                  <th className="px-4 py-3 text-left text-[var(--text2)] font-semibold">
                    {language === 'ro' ? 'Acțiuni' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const Icon = getDocumentIcon(doc.type);
                  return (
                    <tr key={doc.id} className="border-b border-[var(--text5)] hover:bg-[var(--background)] transition-colors duration-200">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Icon size={18} className="text-[var(--primary)]" />
                          <div>
                            <p className="font-semibold text-[var(--text1)]">{doc.number}</p>
                            <p className="text-sm text-[var(--text3)]">{doc.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[var(--primary)]">
                        {new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(doc.amount)}
                      </td>
                      <td className="px-4 py-3 text-[var(--text2)]">{doc.date}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(doc.status)}`}>
                          {doc.status === 'matched' && <CheckCircle size={12} />}
                          {doc.status === 'pending' && <Clock size={12} />}
                          {doc.status === 'unmatched' && <AlertCircle size={12} />}
                          {language === 'ro' 
                            ? (doc.status === 'matched' ? 'Reconciliat' : doc.status === 'pending' ? 'În așteptare' : 'Nereconciliat')
                            : (doc.status === 'matched' ? 'Matched' : doc.status === 'pending' ? 'Pending' : 'Unmatched')
                          }
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-white hover:text-white/70 bg-[var(--primary)] text-sm font-medium">
                          {language === 'ro' ? 'Vezi detalii' : 'View details'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="bg-[var(--foreground)] rounded-2xl border border-[var(--text4)] shadow-lg overflow-hidden">
          <div className="p-4 border-b border-[var(--text4)] bg-[var(--background)]">
            <h3 className="text-lg font-bold text-[var(--text1)]">
              {language === 'ro' ? 'Toate Tranzacțiile' : 'All Transactions'}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--background)] border-b border-[var(--text4)]">
                <tr>
                  <th className="px-4 py-3 text-left text-[var(--text2)] font-semibold">
                    {language === 'ro' ? 'Descriere' : 'Description'}
                  </th>
                  <th className="px-4 py-3 text-left text-[var(--text2)] font-semibold">
                    {language === 'ro' ? 'Sumă' : 'Amount'}
                  </th>
                  <th className="px-4 py-3 text-left text-[var(--text2)] font-semibold">
                    {language === 'ro' ? 'Data' : 'Date'}
                  </th>
                  <th className="px-4 py-3 text-left text-[var(--text2)] font-semibold">Status</th>
                  <th className="px-4 py-3 text-left text-[var(--text2)] font-semibold">
                    {language === 'ro' ? 'Acțiuni' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => (
                  <tr key={txn.id} className="border-b border-[var(--text5)] hover:bg-[var(--background)] transition-colors duration-200">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          txn.type === 'credit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                        }`}>
                          <ArrowRight size={14} className={txn.type === 'credit' ? 'rotate-180' : ''} />
                        </div>
                        <p className="font-semibold text-[var(--text1)]">{txn.description}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${txn.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                        {txn.type === 'credit' ? '+' : ''}{new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(txn.amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text2)]">{txn.date}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(txn.status)}`}>
                        {txn.status === 'matched' && <CheckCircle size={12} />}
                        {txn.status === 'pending' && <Clock size={12} />}
                        {language === 'ro' 
                          ? (txn.status === 'matched' ? 'Reconciliat' : 'În așteptare')
                          : (txn.status === 'matched' ? 'Matched' : 'Pending')
                        }
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="bg-[var(--primary)] text-white hover:text-white/70 text-sm font-medium">
                        {language === 'ro' ? 'Reconciliază' : 'Reconcile'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Bank Connection Modal */}
      <BankConnectionModal
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
        onConnect={handleBankConnect}
      />
    </div>
  );
};

export default BankPage;
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
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

  // Complete Romanian chart of accounts from backend (romanianChartOfAccounts.ts)
  const allAccounts = [
    // Clasa 1 - Conturi de capitaluri, provizioane, imprumuturi si datorii asimilate
    
    // 10. Capital si rezerve
    { code: '101', name: 'Capital' },
    { code: '1011', name: 'Capital subscris nevarsat' },
    { code: '1012', name: 'Capital subscris varsat' },
    { code: '1015', name: 'Patrimoniul regiei' },
    { code: '1016', name: 'Patrimoniul public' },
    { code: '1017', name: 'Patrimoniul privat' },
    { code: '1018', name: 'Patrimoniul institutelor nationale de cercetare-dezvoltare' },
    
    { code: '103', name: 'Alte elemente de capitaluri proprii' },
    { code: '1031', name: 'Beneficii acordate angajatilor sub forma instrumentelor de capitaluri proprii' },
    { code: '1033', name: 'Diferente de curs valutar in relatie cu investitia neta intr-o entitate straina' },
    { code: '1038', name: 'Diferente din modificarea valorii juste a activelor financiare disponibile in vederea vanzarii si alte elemente de capitaluri proprii' },
    
    { code: '104', name: 'Prime de capital' },
    { code: '1041', name: 'Prime de emisiune' },
    { code: '1042', name: 'Prime de fuziune/divizare' },
    { code: '1043', name: 'Prime de aport' },
    { code: '1044', name: 'Prime de conversie a obligatiunilor in actiuni' },
    
    { code: '105', name: 'Rezerve din reevaluare' },
    
    { code: '106', name: 'Rezerve' },
    { code: '1061', name: 'Rezerve legale' },
    { code: '1063', name: 'Rezerve statutare sau contractuale' },
    { code: '1068', name: 'Alte rezerve' },
    
    { code: '107', name: 'Diferente de curs valutar din conversie' },
    
    { code: '108', name: 'Interese care nu controleaza' },
    { code: '1081', name: 'Interese care nu controleaza - rezultatul exercitiului financiar' },
    { code: '1082', name: 'Interese care nu controleaza - alte capitaluri proprii' },
    
    { code: '109', name: 'Actiuni proprii' },
    { code: '1091', name: 'Actiuni proprii detinute pe termen scurt' },
    { code: '1092', name: 'Actiuni proprii detinute pe termen lung' },
    { code: '1095', name: 'Actiuni proprii reprezentand titluri detinute de societatea absorbita la societatea absorbanta' },
    
    // 11. Rezultatul reportat
    { code: '117', name: 'Rezultatul reportat' },
    { code: '1171', name: 'Rezultatul reportat reprezentand profitul nerepartizat sau pierderea neacoperita' },
    { code: '1172', name: 'Rezultatul reportat provenit din adoptarea pentru prima data a IAS, mai putin IAS 29' },
    { code: '1173', name: 'Rezultatul reportat provenit din modificarile politicilor contabile' },
    { code: '1174', name: 'Rezultatul reportat provenit din corectarea erorilor contabile' },
    { code: '1175', name: 'Rezultatul reportat reprezentand surplusul realizat din rezerve din reevaluare' },
    { code: '1176', name: 'Rezultatul reportat provenit din trecerea la aplicarea reglementarilor contabile conforme cu directivele europene' },
    
    // 12. Rezultatul exercitiului financiar
    { code: '121', name: 'Profit sau pierdere' },
    { code: '129', name: 'Repartizarea profitului' },
    
    // 14. Castiguri sau pierderi legate de instrumentele de capitaluri proprii
    { code: '141', name: 'Castiguri legate de vanzarea sau anularea instrumentelor de capitaluri proprii' },
    { code: '1411', name: 'Castiguri legate de vanzarea instrumentelor de capitaluri proprii' },
    { code: '1412', name: 'Castiguri legate de anularea instrumentelor de capitaluri proprii' },
    
    { code: '149', name: 'Pierderi legate de emiterea, rascumpararea, vanzarea, cedarea cu titlu gratuit sau anularea instrumentelor de capitaluri proprii' },
    { code: '1491', name: 'Pierderi rezultate din vanzarea instrumentelor de capitaluri proprii' },
    { code: '1495', name: 'Pierderi rezultate din reorganizari, care sunt determinate de anularea titlurilor detinute' },
    { code: '1496', name: 'Pierderi rezultate din reorganizari de societati, corespunzatoare activului net negativ al societatii absorbite' },
    { code: '1498', name: 'Alte pierderi legate de instrumentele de capitaluri proprii' },
    
    // 15. Provizioane
    { code: '151', name: 'Provizioane' },
    { code: '1511', name: 'Provizioane pentru litigii' },
    { code: '1512', name: 'Provizioane pentru garantii acordate clientilor' },
    { code: '1513', name: 'Provizioane pentru dezafectare imobilizari corporale si alte actiuni similare legate de acestea' },
    { code: '1514', name: 'Provizioane pentru restructurare' },
    { code: '1515', name: 'Provizioane pentru pensii si obligatii similare' },
    { code: '1516', name: 'Provizioane pentru impozite' },
    { code: '1517', name: 'Provizioane pentru terminarea contractului de munca' },
    { code: '1518', name: 'Alte provizioane' },
    
    // 16. Imprumuturi si datorii asimilate
    { code: '161', name: 'Imprumuturi din emisiuni de obligatiuni' },
    { code: '1614', name: 'Imprumuturi externe din emisiuni de obligatiuni garantate de stat' },
    { code: '1615', name: 'Imprumuturi externe din emisiuni de obligatiuni garantate de banci' },
    { code: '1617', name: 'Imprumuturi interne din emisiuni de obligatiuni garantate de stat' },
    { code: '1618', name: 'Alte imprumuturi din emisiuni de obligatiuni' },
    
    { code: '162', name: 'Credite bancare pe termen lung' },
    { code: '1621', name: 'Credite bancare pe termen lung' },
    { code: '1622', name: 'Credite bancare pe termen lung nerambursate la scadenta' },
    { code: '1623', name: 'Credite externe guvernamentale' },
    { code: '1624', name: 'Credite bancare externe garantate de stat' },
    { code: '1625', name: 'Credite bancare externe garantate de banci' },
    { code: '1626', name: 'Credite de la trezoreria statului' },
    { code: '1627', name: 'Credite bancare interne garantate de stat' },
    
    { code: '166', name: 'Datorii care privesc imobilizarile financiare' },
    { code: '1661', name: 'Datorii fata de entitatile afiliate' },
    { code: '1663', name: 'Datorii fata de entitatile asociate si entitatile controlate in comun' },
    
    { code: '167', name: 'Alte imprumuturi si datorii asimilate' },
    
    { code: '168', name: 'Dobanzi aferente imprumuturilor si datoriilor asimilate' },
    { code: '1681', name: 'Dobanzi aferente imprumuturilor din emisiuni de obligatiuni' },
    { code: '1682', name: 'Dobanzi aferente creditelor bancare pe termen lung' },
    { code: '1685', name: 'Dobanzi aferente datoriilor fata de entitatile afiliate' },
    { code: '1686', name: 'Dobanzi aferente datoriilor fata de entitatile asociate si entitatile controlate in comun' },
    { code: '1687', name: 'Dobanzi aferente altor imprumuturi si datorii asimilate' },
    
    { code: '169', name: 'Prime privind rambursarea obligatiunilor si a altor datorii' },
    { code: '1691', name: 'Prime privind rambursarea obligatiunilor' },
    { code: '1692', name: 'Prime privind rambursarea altor datorii' },

    // Clasa 2 - Conturi de imobilizari
    
    // 20. Imobilizari necorporale
    { code: '201', name: 'Cheltuieli de constituire' },
    { code: '203', name: 'Cheltuieli de dezvoltare' },
    { code: '205', name: 'Concesiuni, brevete, licente, marci comerciale, drepturi si active similare' },
    { code: '206', name: 'Active necorporale de explorare si evaluare a resurselor minerale' },
    { code: '207', name: 'Fond comercial' },
    { code: '2071', name: 'Fond comercial pozitiv' },
    { code: '2075', name: 'Fond comercial negativ' },
    { code: '208', name: 'Alte imobilizari necorporale' },
    
    // 21. Imobilizari corporale
    { code: '211', name: 'Terenuri si amenajari de terenuri' },
    { code: '2111', name: 'Terenuri' },
    { code: '2112', name: 'Amenajari de terenuri' },
    { code: '212', name: 'Constructii' },
    { code: '213', name: 'Instalatii tehnice si mijloace de transport' },
    { code: '2131', name: 'Echipamente tehnologice (masini, utilaje si instalatii de lucru)' },
    { code: '2132', name: 'Aparate si instalatii de masurare, control si reglare' },
    { code: '2133', name: 'Mijloace de transport' },
    { code: '214', name: 'Mobilier, aparatura birotica, echipamente de protectie a valorilor umane si materiale si alte active corporale' },
    { code: '215', name: 'Investitii imobiliare' },
    { code: '216', name: 'Active corporale de explorare si evaluare a resurselor minerale' },
    { code: '217', name: 'Active biologice productive' },
    
    // 22. Imobilizari corporale in curs de aprovizionare
    { code: '223', name: 'Instalatii tehnice si mijloace de transport in curs de aprovizionare' },
    { code: '224', name: 'Mobilier, aparatura birotica, echipamente de protectie a valorilor umane si materiale si alte active corporale in curs de aprovizionare' },
    { code: '227', name: 'Active biologice productive in curs de aprovizionare' },
    
    // 23. Imobilizari in curs
    { code: '231', name: 'Imobilizari corporale in curs de executie' },
    { code: '235', name: 'Investitii imobiliare in curs de executie' },
    
    // 26. Imobilizari financiare
    { code: '261', name: 'Actiuni detinute la entitatile afiliate' },
    { code: '262', name: 'Actiuni detinute la entitati asociate' },
    { code: '263', name: 'Actiuni detinute la entitati controlate in comun' },
    { code: '264', name: 'Titluri puse in echivalenta' },
    { code: '265', name: 'Alte titluri imobilizate' },
    { code: '266', name: 'Certificate verzi amanate' },
    { code: '267', name: 'Creante imobilizate' },
    { code: '2671', name: 'Sume de incasat de la entitatile afiliate' },
    { code: '2672', name: 'Dobanda aferenta sumelor de incasat de la entitatile afiliate' },
    { code: '2673', name: 'Creante fata de entitatile asociate si entitatile controlate in comun' },
    { code: '2674', name: 'Dobanda aferenta creantelor fata de entitatile asociate si entitatile controlate in comun' },
    { code: '2675', name: 'Imprumuturi acordate pe termen lung' },
    { code: '2676', name: 'Dobanda aferenta imprumuturilor acordate pe termen lung' },
    { code: '2677', name: 'Obligatiuni achizitionate cu ocazia emisiunilor efectuate de terti' },
    { code: '2678', name: 'Alte creante imobilizate' },
    { code: '2679', name: 'Dobanzi aferente altor creante imobilizate' },
    { code: '269', name: 'Varsaminte de efectuat pentru imobilizari financiare' },
    { code: '2691', name: 'Varsaminte de efectuat privind actiunile detinute la entitatile afiliate' },
    { code: '2692', name: 'Varsaminte de efectuat privind actiunile detinute la entitati asociate' },
    { code: '2693', name: 'Varsaminte de efectuat privind actiunile detinute la entitati controlate in comun' },
    { code: '2695', name: 'Varsaminte de efectuat pentru alte imobilizari financiare' },
    
    // 28. Amortizari privind imobilizarile
    { code: '280', name: 'Amortizari privind imobilizarile necorporale' },
    { code: '2801', name: 'Amortizarea cheltuielilor de constituire' },
    { code: '2803', name: 'Amortizarea cheltuielilor de dezvoltare' },
    { code: '2805', name: 'Amortizarea concesiunilor, brevetelor, licentelor, marcilor comerciale, drepturilor si activelor similare' },
    { code: '2806', name: 'Amortizarea activelor necorporale de explorare si evaluare a resurselor minerale' },
    { code: '2807', name: 'Amortizarea fondului comercial' },
    { code: '2808', name: 'Amortizarea altor imobilizari necorporale' },
    { code: '281', name: 'Amortizari privind imobilizarile corporale' },
    { code: '2811', name: 'Amortizarea amenajarilor de terenuri' },
    { code: '2812', name: 'Amortizarea constructiilor' },
    { code: '2813', name: 'Amortizarea instalatiilor si mijloacelor de transport' },
    { code: '2814', name: 'Amortizarea altor imobilizari corporale' },
    { code: '2815', name: 'Amortizarea investitiilor imobiliare' },
    { code: '2816', name: 'Amortizarea activelor corporale de explorare si evaluare a resurselor minerale' },
    { code: '2817', name: 'Amortizarea activelor biologice productive' },
    
    // 29. Ajustari pentru deprecierea sau pierderea de valoare a imobilizarilor
    { code: '290', name: 'Ajustari pentru deprecierea imobilizarilor necorporale' },
    { code: '2903', name: 'Ajustari pentru deprecierea cheltuielilor de dezvoltare' },
    { code: '2905', name: 'Ajustari pentru deprecierea concesiunilor, brevetelor, licentelor, marcilor comerciale, drepturilor si activelor similare' },
    { code: '2906', name: 'Ajustari pentru deprecierea activelor necorporale de explorare si evaluare a resurselor minerale' },
    { code: '2908', name: 'Ajustari pentru deprecierea altor imobilizari necorporale' },
    { code: '291', name: 'Ajustari pentru deprecierea imobilizarilor corporale' },
    { code: '2911', name: 'Ajustari pentru deprecierea terenurilor si amenajarilor de terenuri' },
    { code: '2912', name: 'Ajustari pentru deprecierea constructiilor' },
    { code: '2913', name: 'Ajustari pentru deprecierea instalatiilor si mijloacelor de transport' },
    { code: '2914', name: 'Ajustari pentru deprecierea altor imobilizari corporale' },
    { code: '2915', name: 'Ajustari pentru deprecierea investitiilor imobiliare' },
    { code: '2916', name: 'Ajustari pentru deprecierea activelor corporale de explorare si evaluare a resurselor minerale' },
    { code: '2917', name: 'Ajustari pentru deprecierea activelor biologice productive' },
    { code: '293', name: 'Ajustari pentru deprecierea imobilizarilor in curs de executie' },
    { code: '2931', name: 'Ajustari pentru deprecierea imobilizarilor corporale in curs de executie' },
    { code: '2935', name: 'Ajustari pentru deprecierea investitiilor imobiliare in curs de executie' },
    { code: '296', name: 'Ajustari pentru pierderea de valoare a imobilizarilor financiare' },
    { code: '2961', name: 'Ajustari pentru pierderea de valoare a actiunilor detinute la entitatile afiliate' },
    { code: '2962', name: 'Ajustari pentru pierderea de valoare a actiunilor detinute la entitati asociate si entitati controlate in comun' },
    { code: '2963', name: 'Ajustari pentru pierderea de valoare a altor titluri imobilizate' },
    { code: '2964', name: 'Ajustari pentru pierderea de valoare a sumelor de incasat de la entitatile afiliate' },
    { code: '2965', name: 'Ajustari pentru pierderea de valoare a creantelor fata de entitatile asociate si entitatile controlate in comun' },
    { code: '2966', name: 'Ajustari pentru pierderea de valoare a imprumuturilor acordate pe termen lung' },
    { code: '2968', name: 'Ajustari pentru pierderea de valoare a altor creante imobilizate' },

    // Clasa 3 - Conturi de stocuri si productie in curs de executie
    
    // 30. Stocuri de materii prime si materiale
    { code: '301', name: 'Materii prime' },
    { code: '302', name: 'Materiale consumabile' },
    { code: '3021', name: 'Materiale auxiliare' },
    { code: '3022', name: 'Combustibili' },
    { code: '3023', name: 'Materiale pentru ambalat' },
    { code: '3024', name: 'Piese de schimb' },
    { code: '3025', name: 'Seminte si materiale de plantat' },
    { code: '3026', name: 'Furaje' },
    { code: '3028', name: 'Alte materiale consumabile' },
    { code: '303', name: 'Materiale de natura obiectelor de inventar' },
    { code: '308', name: 'Diferente de pret la materii prime si materiale' },
    
    // 32. Stocuri in curs de aprovizionare
    { code: '321', name: 'Materii prime in curs de aprovizionare' },
    { code: '322', name: 'Materiale consumabile in curs de aprovizionare' },
    { code: '323', name: 'Materiale de natura obiectelor de inventar in curs de aprovizionare' },
    { code: '326', name: 'Active biologice de natura stocurilor in curs de aprovizionare' },
    { code: '327', name: 'Marfuri in curs de aprovizionare' },
    { code: '328', name: 'Ambalaje in curs de aprovizionare' },
    
    // 33. Productie in curs de executie
    { code: '331', name: 'Produse in curs de executie' },
    { code: '332', name: 'Servicii in curs de executie' },
    
    // 34. Produse
    { code: '341', name: 'Semifabricate' },
    { code: '345', name: 'Produse finite' },
    { code: '346', name: 'Produse reziduale' },
    { code: '347', name: 'Produse agricole' },
    { code: '348', name: 'Diferente de pret la produse' },
    
    // 35. Stocuri aflate la terti
    { code: '351', name: 'Materii si materiale aflate la terti' },
    { code: '354', name: 'Produse aflate la terti' },
    { code: '356', name: 'Active biologice de natura stocurilor aflate la terti' },
    { code: '357', name: 'Marfuri aflate la terti' },
    { code: '358', name: 'Ambalaje aflate la terti' },
    
    // 36. Active biologice de natura stocurilor
    { code: '361', name: 'Active biologice de natura stocurilor' },
    { code: '368', name: 'Diferente de pret la active biologice de natura stocurilor' },
    
    // 37. Marfuri
    { code: '371', name: 'Marfuri' },
    { code: '378', name: 'Diferente de pret la marfuri' },
    
    // 38. Ambalaje
    { code: '381', name: 'Ambalaje' },
    { code: '388', name: 'Diferente de pret la ambalaje' },
    
    // 39. Ajustari pentru deprecierea stocurilor si productiei in curs de executie
    { code: '391', name: 'Ajustari pentru deprecierea materiilor prime' },
    { code: '392', name: 'Ajustari pentru deprecierea materialelor' },
    { code: '3921', name: 'Ajustari pentru deprecierea materialelor consumabile' },
    { code: '3922', name: 'Ajustari pentru deprecierea materialelor de natura obiectelor de inventar' },
    { code: '393', name: 'Ajustari pentru deprecierea productiei in curs de executie' },
    { code: '394', name: 'Ajustari pentru deprecierea produselor' },
    { code: '3941', name: 'Ajustari pentru deprecierea semifabricatelor' },
    { code: '3945', name: 'Ajustari pentru deprecierea produselor finite' },
    { code: '3946', name: 'Ajustari pentru deprecierea produselor reziduale' },
    { code: '3947', name: 'Ajustari pentru deprecierea produselor agricole' },
    { code: '395', name: 'Ajustari pentru deprecierea stocurilor aflate la terti' },
    { code: '3951', name: 'Ajustari pentru deprecierea materiilor si materialelor aflate la terti' },
    { code: '3952', name: 'Ajustari pentru deprecierea semifabricatelor aflate la terti' },
    { code: '3953', name: 'Ajustari pentru deprecierea produselor finite aflate la terti' },
    { code: '3954', name: 'Ajustari pentru deprecierea produselor reziduale aflate la terti' },
    { code: '3955', name: 'Ajustari pentru deprecierea produselor agricole aflate la terti' },
    { code: '3956', name: 'Ajustari pentru deprecierea activelor biologice de natura stocurilor aflate la terti' },
    { code: '3957', name: 'Ajustari pentru deprecierea marfurilor aflate la terti' },
    { code: '3958', name: 'Ajustari pentru deprecierea ambalajelor aflate la terti' },
    { code: '396', name: 'Ajustari pentru deprecierea activelor biologice de natura stocurilor' },
    { code: '397', name: 'Ajustari pentru deprecierea marfurilor' },
    { code: '398', name: 'Ajustari pentru deprecierea ambalajelor' },

    // Clasa 4 - Conturi de terti
    
    // 40. Furnizori si conturi asimilate
    { code: '401', name: 'Furnizori' },
    { code: '403', name: 'Efecte de platit' },
    { code: '404', name: 'Furnizori de imobilizari' },
    { code: '405', name: 'Efecte de platit pentru imobilizari' },
    { code: '408', name: 'Furnizori - facturi nesosite' },
    { code: '409', name: 'Furnizori - debitori' },
    { code: '4091', name: 'Furnizori - debitori pentru cumparari de bunuri de natura stocurilor' },
    { code: '4092', name: 'Furnizori - debitori pentru prestari de servicii' },
    { code: '4093', name: 'Avansuri acordate pentru imobilizari corporale' },
    { code: '4094', name: 'Avansuri acordate pentru imobilizari necorporale' },
    
    // 41. Clienti si conturi asimilate
    { code: '411', name: 'Clienti' },
    { code: '4111', name: 'Clienti' },
    { code: '4118', name: 'Clienti incerti sau in litigiu' },
    { code: '413', name: 'Efecte de primit de la clienti' },
    { code: '418', name: 'Clienti - facturi de intocmit' },
    { code: '419', name: 'Clienti - creditori' },
    
    // 42. Personal si conturi asimilate
    { code: '421', name: 'Personal - salarii datorate' },
    { code: '423', name: 'Personal - ajutoare materiale datorate' },
    { code: '424', name: 'Prime reprezentand participarea personalului la profit' },
    { code: '425', name: 'Avansuri acordate personalului' },
    { code: '426', name: 'Drepturi de personal neridicate' },
    { code: '427', name: 'Retineri din salarii datorate tertilor' },
    { code: '428', name: 'Alte datorii si creante in legatura cu personalul' },
    { code: '4281', name: 'Alte datorii in legatura cu personalul' },
    { code: '4282', name: 'Alte creante in legatura cu personalul' },
    
    // 43. Asigurari sociale, protectia sociala si conturi asimilate
    { code: '431', name: 'Asigurari sociale' },
    { code: '4311', name: 'Contributia unitatii la asigurarile sociale' },
    { code: '4312', name: 'Contributia personalului la asigurarile sociale' },
    { code: '4313', name: 'Contributia angajatorului pentru asigurarile sociale de sanatate' },
    { code: '4314', name: 'Contributia angajatilor pentru asigurarile sociale de sanatate' },
    { code: '4315', name: 'Contributia de asigurari sociale' },
    { code: '4316', name: 'Contributia de asigurari sociale de sanatate' },
    { code: '4318', name: 'Alte contributii pentru asigurarile sociale de sanatate' },
    { code: '436', name: 'Contributia asiguratorie pentru munca' },
    { code: '437', name: 'Ajutor de somaj' },
    { code: '4371', name: 'Contributia unitatii la fondul de somaj' },
    { code: '4372', name: 'Contributia personalului la fondul de somaj' },
    { code: '438', name: 'Alte datorii si creante sociale' },
    { code: '4381', name: 'Alte datorii sociale' },
    { code: '4382', name: 'Alte creante sociale' },
    
    // 44. Bugetul statului, fonduri speciale si conturi asimilate
    { code: '441', name: 'Impozitul pe profit si alte impozite' },
    { code: '4411', name: 'Impozitul pe profit' },
    { code: '4415', name: 'Impozitul specific unor activitati' },
    { code: '4417', name: 'Impozitul pe profit la nivelul impozitului minim pe cifra de afaceri' },
    { code: '4418', name: 'Impozitul pe venit' },
    { code: '442', name: 'Taxa pe valoarea adaugata' },
    { code: '4423', name: 'TVA de plata' },
    { code: '4424', name: 'TVA de recuperat' },
    { code: '4426', name: 'TVA deductibila' },
    { code: '4427', name: 'TVA colectata' },
    { code: '4428', name: 'TVA neexigibila' },
    { code: '444', name: 'Impozitul pe venituri de natura salariilor' },
    { code: '445', name: 'Subventii' },
    { code: '4451', name: 'Subventii guvernamentale' },
    { code: '4452', name: 'Imprumuturi nerambursabile cu caracter de subventii' },
    { code: '4458', name: 'Alte sume primite cu caracter de subventii' },
    { code: '446', name: 'Alte impozite, taxe si varsaminte asimilate' },
    { code: '447', name: 'Fonduri speciale - taxe si varsaminte asimilate' },
    { code: '448', name: 'Alte datorii si creante cu bugetul statului' },
    { code: '4481', name: 'Alte datorii fata de bugetul statului' },
    { code: '4482', name: 'Alte creante privind bugetul statului' },
    
    // 45. Grup si actionari/asociati
    { code: '451', name: 'Decontari intre entitatile afiliate' },
    { code: '4511', name: 'Decontari intre entitatile afiliate' },
    { code: '4518', name: 'Dobanzi aferente decontarilor intre entitatile afiliate' },
    { code: '453', name: 'Decontari cu entitatile asociate si entitatile controlate in comun' },
    { code: '4531', name: 'Decontari cu entitatile asociate si entitatile controlate in comun' },
    { code: '4538', name: 'Dobanzi aferente decontarilor cu entitatile asociate si entitatile controlate in comun' },
    { code: '455', name: 'Sume datorate actionarilor/asociatilor' },
    { code: '4551', name: 'Actionari/Asociati - conturi curente' },
    { code: '4558', name: 'Actionari/Asociati - dobanzi la conturi curente' },
    { code: '456', name: 'Decontari cu actionarii/asociatii privind capitalul' },
    { code: '457', name: 'Dividende de plata' },
    { code: '458', name: 'Decontari din operatiuni in participatie' },
    { code: '4581', name: 'Decontari din operatiuni in participatie - pasiv' },
    { code: '4582', name: 'Decontari din operatiuni in participatie - activ' },
    
    // 46. Debitori si creditori diversi
    { code: '461', name: 'Debitori diversi' },
    { code: '462', name: 'Creditori diversi' },
    { code: '463', name: 'Creante reprezentand dividende repartizate in cursul exercitiului financiar' },
    { code: '466', name: 'Decontari din operatiuni de fiducie' },
    { code: '4661', name: 'Datorii din operatiuni de fiducie' },
    { code: '4662', name: 'Creante din operatiuni de fiducie' },
    { code: '467', name: 'Datorii aferente distribuirilor interimare de dividende' },
    
    // 47. Conturi de subventii, regularizare si asimilate
    { code: '471', name: 'Cheltuieli inregistrate in avans' },
    { code: '472', name: 'Venituri inregistrate in avans' },
    { code: '473', name: 'Decontari din operatiuni in curs de clarificare' },
    { code: '475', name: 'Subventii pentru investitii' },
    { code: '4751', name: 'Subventii guvernamentale pentru investitii' },
    { code: '4752', name: 'Imprumuturi nerambursabile cu caracter de subventii pentru investitii' },
    { code: '4753', name: 'Donatii pentru investitii' },
    { code: '4754', name: 'Plusuri de inventar de natura imobilizarilor' },
    { code: '4758', name: 'Alte sume primite cu caracter de subventii pentru investitii' },
    { code: '478', name: 'Venituri in avans aferente activelor primite prin transfer de la clienti' },
    
    // 48. Decontari in cadrul unitatii
    { code: '481', name: 'Decontari intre unitate si subunitati' },
    { code: '482', name: 'Decontari intre subunitati' },
    
    // 49. Ajustari pentru deprecierea creantelor
    { code: '490', name: 'Ajustari pentru deprecierea creantelor reprezentand avansuri acordate furnizorilor' },
    { code: '4901', name: 'Ajustari pentru deprecierea creantelor aferente cumpararilor de bunuri de natura stocurilor' },
    { code: '4902', name: 'Ajustari pentru deprecierea creantelor aferente prestarilor de servicii' },
    { code: '4903', name: 'Ajustari pentru deprecierea creantelor aferente imobilizarilor corporale' },
    { code: '4904', name: 'Ajustari pentru deprecierea creantelor aferente imobilizarilor necorporale' },
    { code: '491', name: 'Ajustari pentru deprecierea creantelor - clienti' },
    { code: '495', name: 'Ajustari pentru deprecierea creantelor - decontari in cadrul grupului si cu actionarii/asociatii' },
    { code: '496', name: 'Ajustari pentru deprecierea creantelor - debitori diversi' },

    // Clasa 5 - Conturi de trezorerie
    
    // 50. Investitii pe termen scurt
    { code: '501', name: 'Actiuni detinute la entitatile afiliate' },
    { code: '505', name: 'Obligatiuni emise si rascumparate' },
    { code: '506', name: 'Obligatiuni' },
    { code: '507', name: 'Certificate verzi primite' },
    { code: '508', name: 'Alte investitii pe termen scurt si creante asimilate' },
    { code: '5081', name: 'Alte titluri de plasament' },
    { code: '5088', name: 'Dobanzi la obligatiuni si titluri de plasament' },
    { code: '509', name: 'Varsaminte de efectuat pentru investitiile pe termen scurt' },
    { code: '5091', name: 'Varsaminte de efectuat pentru actiunile detinute la entitatile afiliate' },
    { code: '5092', name: 'Varsaminte de efectuat pentru alte investitii pe termen scurt' },
    
    // 51. Conturi la banci
    { code: '511', name: 'Valori de incasat' },
    { code: '5112', name: 'Cecuri de incasat' },
    { code: '5113', name: 'Efecte de incasat' },
    { code: '5114', name: 'Efecte remise spre scontare' },
    { code: '512', name: 'Conturi curente la banci' },
    { code: '5121', name: 'Conturi la banci in lei' },
    { code: '5124', name: 'Conturi la banci in valuta' },
    { code: '5125', name: 'Sume in curs de decontare' },
    { code: '518', name: 'Dobanzi' },
    { code: '5186', name: 'Dobanzi de platit' },
    { code: '5187', name: 'Dobanzi de incasat' },
    { code: '519', name: 'Credite bancare pe termen scurt' },
    { code: '5191', name: 'Credite bancare pe termen scurt' },
    { code: '5192', name: 'Credite bancare pe termen scurt nerambursate la scadenta' },
    { code: '5193', name: 'Credite externe guvernamentale' },
    { code: '5194', name: 'Credite externe garantate de stat' },
    { code: '5195', name: 'Credite externe garantate de banci' },
    { code: '5196', name: 'Credite de la Trezoreria Statului' },
    { code: '5197', name: 'Credite interne garantate de stat' },
    { code: '5198', name: 'Dobanzi aferente creditelor bancare pe termen scurt' },
    
    // 53. Casa
    { code: '531', name: 'Casa' },
    { code: '5311', name: 'Casa in lei' },
    { code: '5314', name: 'Casa in valuta' },
    { code: '532', name: 'Alte valori' },
    { code: '5321', name: 'Timbre fiscale si postale' },
    { code: '5322', name: 'Bilete de tratament si odihna' },
    { code: '5323', name: 'Tichete si bilete de calatorie' },
    { code: '5328', name: 'Alte valori' },
    
    // 54. Acreditive
    { code: '541', name: 'Acreditive' },
    { code: '5411', name: 'Acreditive in lei' },
    { code: '5414', name: 'Acreditive in valuta' },
    { code: '542', name: 'Avansuri de trezorerie' },
    
    // 58. Viramente interne
    { code: '581', name: 'Viramente interne' },
    
    // 59. Ajustari pentru pierderea de valoare a conturilor de trezorerie
    { code: '591', name: 'Ajustari pentru pierderea de valoare a actiunilor detinute la entitatile afiliate' },
    { code: '595', name: 'Ajustari pentru pierderea de valoare a obligatiunilor emise si rascumparate' },
    { code: '596', name: 'Ajustari pentru pierderea de valoare a obligatiunilor' },
    { code: '598', name: 'Ajustari pentru pierderea de valoare a altor investitii pe termen scurt si creante asimilate' },

    // Clasa 6 - Conturi de cheltuieli
    
    // 60. Cheltuieli privind stocurile si alte consumuri
    { code: '601', name: 'Cheltuieli cu materiile prime' },
    { code: '602', name: 'Cheltuieli cu materialele consumabile' },
    { code: '6021', name: 'Cheltuieli cu materialele auxiliare' },
    { code: '6022', name: 'Cheltuieli privind combustibilii' },
    { code: '6023', name: 'Cheltuieli privind materialele pentru ambalat' },
    { code: '6024', name: 'Cheltuieli privind piesele de schimb' },
    { code: '6025', name: 'Cheltuieli privind semintele si materialele de plantat' },
    { code: '6026', name: 'Cheltuieli privind furajele' },
    { code: '6028', name: 'Cheltuieli privind alte materiale consumabile' },
    { code: '603', name: 'Cheltuieli privind materialele de natura obiectelor de inventar' },
    { code: '604', name: 'Cheltuieli privind materialele nestocate' },
    { code: '605', name: 'Cheltuieli privind utilitatile' },
    { code: '6051', name: 'Cheltuieli privind consumul de energie' },
    { code: '6052', name: 'Cheltuieli privind consumul de apa' },
    { code: '6053', name: 'Cheltuieli privind consumul de gaze naturale' },
    { code: '6058', name: 'Cheltuieli cu alte utilitati' },
    { code: '606', name: 'Cheltuieli privind activele biologice de natura stocurilor' },
    { code: '607', name: 'Cheltuieli privind marfurile' },
    { code: '608', name: 'Cheltuieli privind ambalajele' },
    { code: '609', name: 'Reduceri comerciale primite' },
    
    // 61. Cheltuieli cu serviciile executate de terti
    { code: '611', name: 'Cheltuieli cu intretinerea si reparatiile' },
    { code: '612', name: 'Cheltuieli cu redeventele, locatiile de gestiune si chiriile' },
    { code: '6121', name: 'Cheltuieli cu redeventele' },
    { code: '6122', name: 'Cheltuieli cu locatiile de gestiune' },
    { code: '6123', name: 'Cheltuieli cu chiriile' },
    { code: '613', name: 'Cheltuieli cu primele de asigurare' },
    { code: '614', name: 'Cheltuieli cu studiile si cercetarile' },
    { code: '615', name: 'Cheltuieli cu pregatirea personalului' },
    { code: '616', name: 'Cheltuieli aferente drepturilor de proprietate intelectuala' },
    { code: '617', name: 'Cheltuieli de management' },
    { code: '618', name: 'Cheltuieli de consultanta' },
    
    // 62. Cheltuieli cu alte servicii executate de terti
    { code: '621', name: 'Cheltuieli cu colaboratorii' },
    { code: '622', name: 'Cheltuieli privind comisioanele si onorariile' },
    { code: '623', name: 'Cheltuieli de protocol, reclama si publicitate' },
    { code: '6231', name: 'Cheltuieli de protocol' },
    { code: '6232', name: 'Cheltuieli de reclama si publicitate' },
    { code: '624', name: 'Cheltuieli cu transportul de bunuri si personal' },
    { code: '625', name: 'Cheltuieli cu deplasari, detasari si transferari' },
    { code: '626', name: 'Cheltuieli postale si taxe de telecomunicatii' },
    { code: '627', name: 'Cheltuieli cu serviciile bancare si asimilate' },
    { code: '628', name: 'Alte cheltuieli cu serviciile executate de terti' },
    
    // 63. Cheltuieli cu alte impozite, taxe si varsaminte asimilate
    { code: '635', name: 'Cheltuieli cu alte impozite, taxe si varsaminte asimilate' },
    { code: '6351', name: 'Cheltuieli cu impozitul suplimentar pentru sectoarele de activitate specifice' },
    
    // 64. Cheltuieli cu personalul
    { code: '641', name: 'Cheltuieli cu salariile personalului' },
    { code: '642', name: 'Cheltuieli cu avantajele in natura si tichetele acordate salariatilor' },
    { code: '6421', name: 'Cheltuieli cu avantajele in natura acordate salariatilor' },
    { code: '6422', name: 'Cheltuieli cu tichetele acordate salariatilor' },
    { code: '643', name: 'Cheltuieli cu remunerarea in instrumente de capitaluri proprii' },
    { code: '644', name: 'Cheltuieli cu primele reprezentand participarea personalului la profit' },
    { code: '645', name: 'Cheltuieli privind asigurarile si protectia sociala' },
    { code: '6451', name: 'Cheltuieli privind contributia unitatii la asigurarile sociale' },
    { code: '6452', name: 'Cheltuieli privind contributia unitatii pentru ajutorul de somaj' },
    { code: '6453', name: 'Cheltuieli privind contributia angajatorului pentru asigurarile sociale de sanatate' },
    { code: '6455', name: 'Cheltuieli privind contributia unitatii la asigurarile de viata' },
    { code: '6456', name: 'Cheltuieli privind contributia unitatii la fondurile de pensii facultative' },
    { code: '6457', name: 'Cheltuieli privind contributia unitatii la primele de asigurare voluntara de sanatate' },
    { code: '6458', name: 'Alte cheltuieli privind asigurarile si protectia sociala' },
    { code: '646', name: 'Cheltuieli privind contributia asiguratorie pentru munca' },
    { code: '6461', name: 'Cheltuieli privind contributia asiguratorie pentru munca corespunzatoare salariatilor' },
    { code: '6462', name: 'Cheltuieli privind contributia asiguratorie pentru munca corespunzatoare altor persoane, decat salariatii' },
    
    // 65. Alte cheltuieli de exploatare
    { code: '651', name: 'Cheltuieli din operatiuni de fiducie' },
    { code: '6511', name: 'Cheltuieli ocazionate de constituirea fiduciei' },
    { code: '6512', name: 'Cheltuieli din derularea operatiunilor de fiducie' },
    { code: '6513', name: 'Cheltuieli din lichidarea operatiunilor de fiducie' },
    { code: '652', name: 'Cheltuieli cu protectia mediului inconjurator' },
    { code: '654', name: 'Pierderi din creante si debitori diversi' },
    { code: '655', name: 'Cheltuieli din reevaluarea imobilizarilor corporale' },
    { code: '658', name: 'Alte cheltuieli de exploatare' },
    { code: '6581', name: 'Despagubiri, amenzi si penalitati' },
    { code: '6582', name: 'Donatii acordate' },
    { code: '6583', name: 'Cheltuieli privind activele cedate si alte operatiuni de capital' },
    { code: '6584', name: 'Cheltuieli cu sumele sau bunurile acordate ca sponsorizari' },
    { code: '6586', name: 'Cheltuieli reprezentand transferuri si contributii datorate in baza unor acte normative speciale' },
    { code: '6587', name: 'Cheltuieli privind calamitatile si alte evenimente similare' },
    { code: '6588', name: 'Alte cheltuieli de exploatare' },
    
    // 66. Cheltuieli financiare
    { code: '663', name: 'Pierderi din creante legate de participatii' },
    { code: '664', name: 'Cheltuieli privind investitiile financiare cedate' },
    { code: '6641', name: 'Cheltuieli privind imobilizarile financiare cedate' },
    { code: '6642', name: 'Pierderi din investitiile pe termen scurt cedate' },
    { code: '665', name: 'Cheltuieli din diferente de curs valutar' },
    { code: '6651', name: 'Diferente nefavorabile de curs valutar legate de elementele monetare exprimate in valuta' },
    { code: '6652', name: 'Diferente nefavorabile de curs valutar din evaluarea elementelor monetare care fac parte din investitia neta intr-o entitate straina' },
    { code: '666', name: 'Cheltuieli privind dobanzile' },
    { code: '667', name: 'Cheltuieli privind sconturile acordate' },
    { code: '668', name: 'Alte cheltuieli financiare' },
    
    // 68. Cheltuieli cu amortizarile, provizioanele si ajustarile pentru depreciere sau pierdere de valoare
    { code: '681', name: 'Cheltuieli de exploatare privind amortizarile, provizioanele si ajustarile pentru depreciere' },
    { code: '6811', name: 'Cheltuieli de exploatare privind amortizarea imobilizarilor' },
    { code: '6812', name: 'Cheltuieli de exploatare privind provizioanele' },
    { code: '6813', name: 'Cheltuieli de exploatare privind ajustarile pentru deprecierea imobilizarilor' },
    { code: '6814', name: 'Cheltuieli de exploatare privind ajustarile pentru deprecierea activelor circulante' },
    { code: '6817', name: 'Cheltuieli de exploatare privind ajustarile pentru deprecierea fondului comercial' },
    { code: '6818', name: 'Cheltuieli de exploatare privind ajustarile pentru deprecierea creantelor reprezentand avansuri acordate furnizorilor' },
    { code: '686', name: 'Cheltuieli financiare privind amortizarile, provizioanele si ajustarile pentru pierdere de valoare' },
    { code: '6861', name: 'Cheltuieli privind actualizarea provizioanelor' },
    { code: '6863', name: 'Cheltuieli financiare privind ajustarile pentru pierderea de valoare a imobilizarilor financiare' },
    { code: '6864', name: 'Cheltuieli financiare privind ajustarile pentru pierderea de valoare a activelor circulante' },
    { code: '6865', name: 'Cheltuieli financiare privind amortizarea diferentelor aferente titlurilor de stat' },
    { code: '6868', name: 'Cheltuieli financiare privind amortizarea primelor de rambursare a obligatiunilor si a altor datorii' },
    
    // 69. Cheltuieli cu impozitul pe profit si alte impozite
    { code: '691', name: 'Cheltuieli cu impozitul pe profit' },
    { code: '694', name: 'Cheltuieli cu impozitul pe profit rezultat din decontarile in cadrul grupului fiscal in domeniul impozitului pe profit' },
    { code: '695', name: 'Cheltuieli cu impozitul specific unor activitati' },
    { code: '697', name: 'Cheltuieli cu impozitul pe profit la nivelul impozitului minim pe cifra de afaceri' },
    { code: '698', name: 'Cheltuieli cu impozitul pe venit si cu alte impozite care nu apar in elementele de mai sus' },

    // Clasa 7 - Conturi de venituri
    
    // 70. Cifra de afaceri neta
    { code: '701', name: 'Venituri din vanzarea produselor finite, produselor agricole si a activelor biologice de natura stocurilor' },
    { code: '7015', name: 'Venituri din vanzarea produselor finite' },
    { code: '7017', name: 'Venituri din vanzarea produselor agricole' },
    { code: '7018', name: 'Venituri din vanzarea activelor biologice de natura stocurilor' },
    { code: '702', name: 'Venituri din vanzarea semifabricatelor' },
    { code: '703', name: 'Venituri din vanzarea produselor reziduale' },
    { code: '704', name: 'Venituri din servicii prestate' },
    { code: '705', name: 'Venituri din studii si cercetari' },
    { code: '706', name: 'Venituri din redevente, locatii de gestiune si chirii' },
    { code: '707', name: 'Venituri din vanzarea marfurilor' },
    { code: '708', name: 'Venituri din activitati diverse' },
    { code: '709', name: 'Reduceri comerciale acordate' },
    
    // 71. Venituri aferente costului productiei in curs de executie
    { code: '711', name: 'Venituri aferente costurilor stocurilor de produse' },
    { code: '712', name: 'Venituri aferente costurilor serviciilor in curs de executie' },
    
    // 72. Venituri din productia de imobilizari
    { code: '721', name: 'Venituri din productia de imobilizari necorporale' },
    { code: '722', name: 'Venituri din productia de imobilizari corporale' },
    { code: '725', name: 'Venituri din productia de investitii imobiliare' },
    
    // 74. Venituri din subventii de exploatare
    { code: '741', name: 'Venituri din subventii de exploatare' },
    { code: '7411', name: 'Venituri din subventii de exploatare aferente cifrei de afaceri' },
    { code: '7412', name: 'Venituri din subventii de exploatare pentru materii prime si materiale' },
    { code: '7413', name: 'Venituri din subventii de exploatare pentru alte cheltuieli externe' },
    { code: '7414', name: 'Venituri din subventii de exploatare pentru plata personalului' },
    { code: '7415', name: 'Venituri din subventii de exploatare pentru asigurari si protectie sociala' },
    { code: '7416', name: 'Venituri din subventii de exploatare pentru alte cheltuieli de exploatare' },
    { code: '7417', name: 'Venituri din subventii de exploatare in caz de calamitati si alte evenimente similare' },
    { code: '7418', name: 'Venituri din subventii de exploatare pentru dobanda datorata' },
    { code: '7419', name: 'Venituri din subventii de exploatare aferente altor venituri' },
    
    // 75. Alte venituri din exploatare
    { code: '751', name: 'Venituri din operatiuni de fiducie' },
    { code: '7511', name: 'Venituri ocazionate de constituirea fiduciei' },
    { code: '7512', name: 'Venituri din derularea operatiunilor de fiducie' },
    { code: '7513', name: 'Venituri din lichidarea operatiunilor de fiducie' },
    { code: '754', name: 'Venituri din creante reactivate si debitori diversi' },
    { code: '755', name: 'Venituri din reevaluarea imobilizarilor corporale' },
    { code: '758', name: 'Alte venituri din exploatare' },
    { code: '7581', name: 'Venituri din despagubiri, amenzi si penalitati' },
    { code: '7582', name: 'Venituri din donatii primite' },
    { code: '7583', name: 'Venituri din vanzarea activelor si alte operatiuni de capital' },
    { code: '7584', name: 'Venituri din subventii pentru investitii' },
    { code: '7586', name: 'Venituri reprezentand transferuri cuvenite in baza unor acte normative speciale' },
    { code: '7588', name: 'Alte venituri din exploatare' },
    
    // 76. Venituri financiare
    { code: '761', name: 'Venituri din imobilizari financiare' },
    { code: '7611', name: 'Venituri din actiuni detinute la entitatile afiliate' },
    { code: '7612', name: 'Venituri din actiuni detinute la entitati asociate' },
    { code: '7613', name: 'Venituri din actiuni detinute la entitati controlate in comun' },
    { code: '7615', name: 'Venituri din alte imobilizari financiare' },
    { code: '762', name: 'Venituri din investitii financiare pe termen scurt' },
    { code: '764', name: 'Venituri din investitii financiare cedate' },
    { code: '7641', name: 'Venituri din imobilizari financiare cedate' },
    { code: '7642', name: 'Castiguri din investitii pe termen scurt cedate' },
    { code: '765', name: 'Venituri din diferente de curs valutar' },
    { code: '7651', name: 'Diferente favorabile de curs valutar legate de elementele monetare exprimate in valuta' },
    { code: '7652', name: 'Diferente favorabile de curs valutar din evaluarea elementelor monetare care fac parte din investitia neta intr-o entitate straina' },
    { code: '766', name: 'Venituri din dobanzi' },
    { code: '767', name: 'Venituri din sconturi obtinute' },
    { code: '768', name: 'Alte venituri financiare' },
    
    // 78. Venituri din provizioane, amortizari si ajustari pentru depreciere sau pierdere de valoare
    { code: '781', name: 'Venituri din provizioane si ajustari pentru depreciere privind activitatea de exploatare' },
    { code: '7812', name: 'Venituri din provizioane' },
    { code: '7813', name: 'Venituri din ajustari pentru deprecierea imobilizarilor' },
    { code: '7814', name: 'Venituri din ajustari pentru deprecierea activelor circulante' },
    { code: '7815', name: 'Venituri din fondul comercial negativ' },
    { code: '7818', name: 'Venituri din ajustari pentru deprecierea creantelor reprezentand avansuri acordate furnizorilor' },
    { code: '786', name: 'Venituri financiare din amortizari si ajustari pentru pierdere de valoare' },
    { code: '7863', name: 'Venituri financiare din ajustari pentru pierderea de valoare a imobilizarilor financiare' },
    { code: '7864', name: 'Venituri financiare din ajustari pentru pierderea de valoare a activelor circulante' },
    { code: '7865', name: 'Venituri financiare din amortizarea diferentelor aferente titlurilor de stat' },
    
    // 79. Venituri din impozitul pe profit
    { code: '794', name: 'Venituri din impozitul pe profit rezultat din decontarile in cadrul grupului fiscal in domeniul impozitului pe profit' },

    // Clasa 8 - Conturi speciale
    
    // 80. Conturi in afara bilantului
    { code: '801', name: 'Angajamente acordate' },
    { code: '8011', name: 'Giruri si garantii acordate' },
    { code: '8018', name: 'Alte angajamente acordate' },
    { code: '802', name: 'Angajamente primite' },
    { code: '8021', name: 'Giruri si garantii primite' },
    { code: '8028', name: 'Alte angajamente primite' },
    { code: '803', name: 'Alte conturi in afara bilantului' },
    { code: '8031', name: 'Imobilizari corporale primite cu chirie sau in baza altor contracte similare' },
    { code: '8032', name: 'Valori materiale primite spre prelucrare sau reparare' },
    { code: '8033', name: 'Valori materiale primite in pastrare sau custodie' },
    { code: '8034', name: 'Debitori scosi din activ, urmariti in continuare' },
    { code: '8035', name: 'Stocuri de natura obiectelor de inventar date in folosinta' },
    { code: '8036', name: 'Redevente, locatii de gestiune, chirii si alte datorii asimilate' },
    { code: '8037', name: 'Efecte scontate neajunse la scadenta' },
    { code: '8038', name: 'Bunuri primite in administrare, concesiune, cu chirie si alte bunuri similare' },
    { code: '8039', name: 'Alte valori in afara bilantului' },
    { code: '804', name: 'Certificate verzi' },
    { code: '805', name: 'Dobanzi aferente contractelor de leasing si altor contracte asimilate, neajunse la scadenta' },
    { code: '8051', name: 'Dobanzi de platit' },
    { code: '8052', name: 'Dobanzi de incasat' },
    { code: '806', name: 'Certificate de emisii de gaze cu efect de sera' },
    { code: '807', name: 'Active contingente' },
    { code: '808', name: 'Datorii contingente' },
    { code: '809', name: 'Creante preluate prin cesionare' },
    
    // 89. Bilant
    { code: '891', name: 'Bilant de deschidere' },
    { code: '892', name: 'Bilant de inchidere' },

    // Clasa 9 - Conturi de gestiune
    
    // 90. Decontari interne
    { code: '901', name: 'Decontari interne privind cheltuielile' },
    { code: '902', name: 'Decontari interne privind productia obtinuta' },
    { code: '903', name: 'Decontari interne privind diferentele de pret' },
    
    // 92. Conturi de calculatie
    { code: '921', name: 'Cheltuielile activitatii de baza' },
    { code: '922', name: 'Cheltuielile activitatilor auxiliare' },
    { code: '923', name: 'Cheltuieli indirecte de productie' },
    { code: '924', name: 'Cheltuieli generale de administratie' },
    { code: '925', name: 'Cheltuieli de desfacere' },
    
    // 93. Costul productiei
    { code: '931', name: 'Costul productiei obtinute' },
    { code: '933', name: 'Costul productiei in curs de executie' }
];

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
  
  const { data: suggestionsResp = { items: [], total: 0 }, isLoading: suggestionsLoading, error: suggestionsError, refetch: refetchSuggestions } = useGetReconciliationSuggestionsQuery({
    clientEin: clientCompanyEin,
    page: suggestionsPage,
    size: pageSize
  }, {
    skip: !clientCompanyEin
  });
  const { items: suggestionsItems, total: suggestionsTotal } = suggestionsResp as any;

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
    const base = Array.isArray(suggestionsData) ? suggestionsData : [];
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
      if (hasAccountFilterReady) {
        const isTransferAny = isTransferLike(s);
        if (isTransferAny) {
          const srcId = s.transfer?.sourceTransactionId;
          const dstId = s.transfer?.destinationTransactionId;
          const hasSides = Boolean(srcId || dstId);
          if (hasSides) {
            const srcMatch = srcId ? accountTransactionIdSet.has(String(srcId)) : false;
            const dstMatch = dstId ? accountTransactionIdSet.has(String(dstId)) : false;
            // Debug transfer with sides
            try {
              console.log('[UI][filter][TRANSFER][sides]', {
                sid: s.id,
                bankTransactionId: s?.bankTransaction?.id,
                srcId, dstId,
                srcMatch, dstMatch,
                selectedBankAccountId,
              });
            } catch {}
            if (!srcMatch && !dstMatch) {
              // Fall back to the suggestion's own bankTransaction when sides are not associated
              const selfTxnId = s.bankTransaction?.id;
              try {
                console.log('[UI][filter][TRANSFER][fallback-self]', {
                  sid: s.id,
                  selfTxnId,
                  inSet: selfTxnId ? accountTransactionIdSet.has(String(selfTxnId)) : false,
                  selectedBankAccountId,
                });
              } catch {}
              if (!selfTxnId || !accountTransactionIdSet.has(String(selfTxnId))) return false;
            }
          } else {
            const selfTxnId = s.bankTransaction?.id;
            if (!s?.transfer) {
              try {
                console.log('[UI][filter][TRANSFER][no-payload]', {
                  sid: s.id,
                  bankTransactionId: selfTxnId,
                  inSet: selfTxnId ? accountTransactionIdSet.has(String(selfTxnId)) : false,
                  selectedBankAccountId,
                });
              } catch {}
            }
            try {
              console.log('[UI][filter][TRANSFER][no-sides]', {
                sid: s.id,
                selfTxnId,
                inSet: selfTxnId ? accountTransactionIdSet.has(String(selfTxnId)) : false,
                selectedBankAccountId,
              });
            } catch {}
            if (!selfTxnId || !accountTransactionIdSet.has(String(selfTxnId))) return false;
          }
        } else {
          const txnId = s.bankTransaction?.id;
          if (s?.matchingCriteria?.type === 'TRANSFER') {
            try {
              console.log('[UI][filter][TRANSFER][unexpected-nontransfer-branch]', {
                sid: s.id,
                hasPayload: Boolean(s?.transfer),
                txnId,
              });
            } catch {}
          }
          if (txnId && !accountTransactionIdSet.has(String(txnId))) {
            try {
              console.log('[UI][filter][NONTRANSFER][account-mismatch]', {
                sid: s.id,
                txnId,
                inSet: false,
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
      // Expose for ad-hoc inspection
      (window as any).__finovaPrelim = prelim;
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

    const nonTransferKept = prelim.filter((s: any) => {
      // Keep all suggestions. Transfers are kept (type or payload), and non-transfers are no longer hidden
      // even if their transaction participates in a transfer.
      const isTransferAny = isTransferLike(s);
      if (isTransferAny) return true;
      return true;
    });

    const transfersCount = nonTransferKept.filter((s: any) => s?.matchingCriteria?.type === 'TRANSFER' && s?.transfer).length;
    if (!selectedBankAccountId) {
      console.log('[UI] displayedSuggestions (no account filter)', {
        base: base.length,
        removed: removedSuggestions.size,
        prelim: prelim.length,
        transfers: transfersCount,
        hiddenDueToTransfer: prelim.length - nonTransferKept.length,
        involvedTxnIds: Array.from(involvedTxnIds),
      });
    } else {
      console.log('[UI] displayedSuggestions (with account filter)', {
        base: base.length,
        removed: removedSuggestions.size,
        selectedBankAccountId,
        prelim: prelim.length,
        transfers: transfersCount,
        hiddenDueToTransfer: prelim.length - nonTransferKept.length,
        accountTransactionIdSetSize: accountTransactionIdSet.size,
        hasAccountFilterReady,
        involvedTxnIds: Array.from(involvedTxnIds),
      });
    }

    return nonTransferKept;
  }, [suggestionsData, removedSuggestions, selectedBankAccountId, accountTransactionIdSet]);

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
                  <p className="text-xl font-bold text-[var(--text1)]">{suggestionsData.length}</p>
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
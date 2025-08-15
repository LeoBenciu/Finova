import InitialClientCompanyModalSelect from '@/app/Components/InitialClientCompanyModalSelect';
import { useDeleteFileAndExtractedDataMutation, useGetFilesQuery, useInsertClientInvoiceMutation, useGetJobStatusQuery, useGetInvoicePaymentsQuery } from '@/redux/slices/apiSlice';

interface InvoicePaymentBadgeProps { file: any; language: string; }
const InvoicePaymentBadge: React.FC<InvoicePaymentBadgeProps> = ({ file, language }) => {
  const { data, error, isLoading } = useGetInvoicePaymentsQuery(file.id);
  
  console.log('InvoicePaymentBadge Debug:', {
    fileId: file.id,
    data,
    error,
    isLoading,
    fileType: file.type,
    extractedTotal: file?.processedData?.[0]?.extractedFields?.result?.total_amount
  });
  
  if (isLoading) return <span className="text-xs text-gray-500">Loading...</span>;
  if (error) {
    console.error('Invoice payments query error:', error);
    return null;
  }
  if (!data) return null;
  
  const paid = data.amountPaid || 0;
  
  console.log('Payment amounts:', { paid, originalData: data });
  
  const direction = file?.processedData?.[0]?.extractedFields?.result?.direction;
  const label = language === 'ro'
    ? direction === 'outgoing' ? 'Incasat' : 'Platit'
    : direction === 'outgoing' ? 'Cashed' : 'Paid';
    
  const formatCurrency = (v: number) => {
    if (isNaN(v)) {
      console.warn('Trying to format NaN as currency:', v);
      return '0,00 RON';
    }
    return Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(v);
  };
  
  // Calculate payment status and determine colors
  const totalAmount = file?.processedData?.[0]?.extractedFields?.result?.total_amount || 0;
  const paidAmount = paid || 0;
  const remainingAmount = totalAmount - paidAmount;
  
  // Determine badge styling based on payment status
  let badgeClasses = '';
  
  if (paidAmount === 0) {
    badgeClasses = 'text-red-700 bg-red-100 border border-red-200';
  } else if (Math.abs(remainingAmount) <= 0.01) {
    badgeClasses = 'text-green-700 bg-green-100 border border-green-200';
  } else if (remainingAmount < -0.01) {
    badgeClasses = 'text-purple-700 bg-purple-100 border border-purple-200';
  } else if (remainingAmount > 0.01) {
    badgeClasses = 'text-orange-700 bg-orange-100 border border-orange-200';
  }
  
  return (
    <span className={`font-medium text-sm px-2 py-1 rounded-lg ${badgeClasses}`}>
      {label}: {formatCurrency(paidAmount)}/{formatCurrency(totalAmount)}
    </span>
  );
};
import { 
  Bot, Eye, RefreshCw, Trash2, CheckSquare, Square, FileText, Receipt, 
  Calendar, Zap, X, CreditCard, FileSignature, BarChart3, Send, Download,
  Link
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import EditExtractedDataManagement from '../Components/EditExtractedDataManagement';
import { MyTooltip } from '../Components/MyTooltip';
import AreYouSureModalR from '../Components/AreYouSureModalR';
import FilesSearchFiltersComponent from '../Components/FilesSearchFiltersComponent';
import RelatedDocumentsModal from '../Components/RelatedDocumentsModal';
import { format, parse, compareAsc, addDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingComponent from '../Components/LoadingComponent';

type clientCompanyName = {
  clientCompany:{
    current:{
      name:string,
      ein:string
    }
  }
}

export type documentType = 'Invoice' | 'Receipt' | 'Bank Statement' | 'Contract' | 'Z Report' | 'Payment Order' | 'Collection Order';
type paymentStatusType = 'UNPAID' | 'PARTIALLY_PAID' | 'FULLY_PAID' | 'OVERPAID' | undefined;

const FileManagementPage = () => {

  const [isModalOpen,setIsModalOpen] = useState<boolean>(false);
  const [files, setFiles] = useState<Record<string,any>>({});
  const [filteredFiles, setFilteredFiles] = useState<Record<string,any>>({});
  const [currentFile, setCurrentFile] = useState<Record<string,any>>({});
  const [isSureModal, setIsSureModal] = useState<boolean>(false);
  const [processingDocId, setProcessingDocId] = useState<number | null>(null);
  const [statusPolling, setStatusPolling] = useState<NodeJS.Timeout | null>(null);
  const [pollingAttempts, setPollingAttempts] = useState<number>(0);
  const [maxPollingAttempts] = useState<number>(100);

  // Related Documents Modal
  const [showRelatedDocs, setShowRelatedDocs] = useState<boolean>(false);
  const [selectedDocForRelations, setSelectedDocForRelations] = useState<any>(null);

  // Bulk selection state
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState<boolean>(false);
  const [bulkAction, setBulkAction] = useState<'delete' | 'process' | null>(null);

  // Search and filter states
  const[nameSearch, setNameSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<documentType>();
  const [paymentStatus, setPaymentStatus] = useState<paymentStatusType>();
  const [intervalDateFilter, setIntervalDateFilter] = useState<{
    from: string|undefined,
    to:string|undefined
  }>({
    from: undefined,
    to:undefined,
  });

  if (false){
    console.log(pollingAttempts)
  }

  const docType ={
    "Invoice":"Factura",
    "Receipt":"Chitanta",
    "Bank Statement":"Extras De Cont",
    "Contract":"Contract",
    "Z Report":"Raport Z",
    "Payment Order":"Dispozitie De Plata",
    "Collection Order":"Dispozitie De Incasare"
  };

  const getDocumentDate = (file: any): string => {
    try {
      const extractedData = file.processedData?.[0]?.extractedFields?.result;
      
      if (!extractedData) {
        return format(file.createdAt, 'dd-MM-yyyy');
      }

      let documentDate = null;

      switch (file.type) {
        case 'Invoice':
        case 'Receipt':
          documentDate = extractedData.document_date;
          break;
        
        case 'Bank Statement':
          documentDate = extractedData.statement_period_start || extractedData.statement_period_end;
          break;
        
        case 'Contract':
          documentDate = extractedData.contract_date || extractedData.start_date;
          break;
        
        case 'Z Report':
          documentDate = extractedData.business_date;
          break;
        
        case 'Payment Order':
        case 'Collection Order':
          documentDate = extractedData.order_date;
          break;
        
        default:
          documentDate = extractedData.document_date || 
                        extractedData.date || 
                        extractedData.transaction_date;
          break;
      }

      if (documentDate) {
        const dateStr = String(documentDate);
        
        if (dateStr.match(/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/)) {
          const parts = dateStr.split(/[\/\-]/);
          const day = parts[0];
          const month = parts[1];
          const year = parts[2];
          return `${day}-${month}-${year}`;
        }
        
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
          const date = new Date(dateStr);
          return format(date, 'dd-MM-yyyy');
        }
        
        return dateStr;
      }

      return format(file.createdAt, 'dd-MM-yyyy');
      
    } catch (error) {
      console.error('Error extracting document date:', error);
      return format(file.createdAt, 'dd-MM-yyyy');
    }
  };

  useEffect(()=>{
    console.log('IntervalDateFitler:', filteredFiles);
  },[filteredFiles])

  useEffect(()=>{
    if(!files?.documents) return;
    
    let newFilteredFiles = files.documents;
    
    if(nameSearch.length>0){
       newFilteredFiles = newFilteredFiles.filter((file:any)=>(
        file.name.toLowerCase().includes(nameSearch.toLowerCase())
      ))
    };
    
    if(typeFilter){
      newFilteredFiles = newFilteredFiles.filter((file:any)=>(
        file.type===typeFilter
      ))
    };
    
    if(paymentStatus){
      newFilteredFiles = newFilteredFiles.filter((file:any)=>{
        const filePaymentStatus = file.paymentSummary?.paymentStatus;
        return filePaymentStatus === paymentStatus;
      });
    }
    
    if(intervalDateFilter.from !== undefined){
      const filterFromDate = parse(intervalDateFilter.from, 'dd-MM-yyyy', new Date());
      newFilteredFiles = newFilteredFiles.filter((file:any)=>{
        try {
          const documentDateStr = getDocumentDate(file);
          const documentDate = parse(documentDateStr, 'dd-MM-yyyy', new Date());
          return compareAsc(documentDate, filterFromDate) >= 0;
        } catch (error) {
          console.error('Error parsing document date for filtering:', error);
          return compareAsc(file.createdAt, filterFromDate) >= 0;
        }
      });
    }
    
    if(intervalDateFilter.to !== undefined){
      const filterToDate = parse(intervalDateFilter.to, 'dd-MM-yyyy', new Date());
      const filterToDateEnd = addDays(filterToDate, 1);
      newFilteredFiles = newFilteredFiles.filter((file:any)=>{
        try {
          const documentDateStr = getDocumentDate(file);
          const documentDate = parse(documentDateStr, 'dd-MM-yyyy', new Date());
          return compareAsc(documentDate, filterToDateEnd) < 0;
        } catch (error) {
          console.error('Error parsing document date for filtering:', error);
          return compareAsc(file.createdAt, filterToDateEnd) < 0;
        }
      });
    }

    setFilteredFiles({
      ...files,
      documents: newFilteredFiles
    })
  },[typeFilter, setTypeFilter, nameSearch, setNameSearch, intervalDateFilter, setIntervalDateFilter, paymentStatus, files]);

  const clientCompanyEin = useSelector((state:clientCompanyName)=>state.clientCompany.current.ein);
  const { data: filesData, isLoading: isFilesLoading, refetch: refetchFiles } = useGetFilesQuery(
    {company: clientCompanyEin},
    { skip: !clientCompanyEin }
  );
  const [ deleteFile ] = useDeleteFileAndExtractedDataMutation();
  

  const [ processAutomation ] = useInsertClientInvoiceMutation();
  const language = useSelector((state:{user:{language:string}})=>state.user.language);
  const clientCompanyName = useSelector((state:clientCompanyName)=>state.clientCompany.current.name);
  
  const { data: jobStatus, error: jobStatusError, refetch: refetchJobStatus } = useGetJobStatusQuery(
    processingDocId || 0, 
    { skip: !processingDocId }
  );

  const toggleFileSelection = (fileId: number) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const selectAllFiles = () => {
    if (filteredFiles?.documents) {
      const allIds = new Set<number>(filteredFiles.documents.map((file: any) => file.id));
      setSelectedFiles(allIds);
      setShowBulkActions(allIds.size > 0);
    }
  };

  const deselectAllFiles = () => {
    setSelectedFiles(new Set());
    setShowBulkActions(false);
  };

  const isAllSelected = filteredFiles?.documents && selectedFiles.size === filteredFiles?.documents?.length && filteredFiles?.documents?.length > 0;
  const isPartiallySelected = selectedFiles.size > 0 && selectedFiles.size < (filteredFiles?.documents?.length || 0);

  const handleBulkDelete = async () => {
    setBulkAction('delete');
    setIsSureModal(true);
  };

  const handleBulkProcess = async () => {
    const filesToProcess = Array.from(selectedFiles);
    
    for (const fileId of filesToProcess) {
      try {
        await handleProcessAutomation(fileId);
      } catch (error) {
        console.error(`Failed to process file ${fileId}:`, error);
      }
    }
    
    setSelectedFiles(new Set());
    setShowBulkActions(false);
  };

  const executeBulkDelete = async () => {
    const filesToDelete = Array.from(selectedFiles);
    
    for (const fileId of filesToDelete) {
      try {
        await handleDeleteFileButton(fileId);
      } catch (error) {
        console.error(`Failed to delete file ${fileId}:`, error);
      }
    }
    
    setSelectedFiles(new Set());
    setShowBulkActions(false);
    setBulkAction(null);
  };

  const updateDocumentStatus = (docId: number, status: string) => {
    const updateDocs = (docs: any[]) => {
      return docs.map((doc: any) => {
        if (doc.id === docId) {
          return {
            ...doc,
            rpa: [{ status: status }]
          };
        }
        return doc;
      });
    };

    if (files?.documents) {
      const updatedDocs = updateDocs(files.documents);
      setFiles(prev => ({...prev, documents: updatedDocs}));
      setFilteredFiles(prev => ({...prev, documents: updatedDocs}));
    }
  };

  const startStatusPolling = (docId: number) => {
    console.log(`[Frontend] Starting status polling for document ${docId}`);
    
    if (statusPolling) {
      clearInterval(statusPolling);
    }
    
    setProcessingDocId(docId);
    setPollingAttempts(0);
    
    setTimeout(() => {
      const interval = setInterval(() => {
        setPollingAttempts(prev => {
          const newAttempts = prev + 1;
          console.log(`[Frontend] Polling attempt ${newAttempts} for document ${docId}`);
          
          if (newAttempts >= maxPollingAttempts) {
            console.log(`[Frontend] Max polling attempts reached for document ${docId}`);
            clearInterval(interval);
            setStatusPolling(null);
            setProcessingDocId(null);
            
            updateDocumentStatus(docId, 'TIMEOUT');
            
            return newAttempts;
          }
          
          refetchJobStatus();
          return newAttempts;
        });
      }, 5000); 
      
      setStatusPolling(interval);
    }, 45000);
  };

  useEffect(() => {
    if (jobStatusError) {
      console.error(`[Frontend ERROR] Job status error:`, jobStatusError);
      
      if (statusPolling && processingDocId) {
        clearInterval(statusPolling);
        setStatusPolling(null);
        
        console.log(`[Frontend] Error checking job status, but continuing to poll`);
      }
    }
    
    if (jobStatus) {
      console.log(`[Frontend] Received job status:`, jobStatus);
      
      const currentStatus = jobStatus.status;
      
      if (currentStatus !== 'PENDING' && statusPolling) {
        console.log(`[Frontend] Job completed with status: ${currentStatus}`);
        clearInterval(statusPolling);
        setStatusPolling(null);
        
        if (processingDocId !== null) {
          updateDocumentStatus(processingDocId, currentStatus);
        }
        
        setProcessingDocId(null);
        setPollingAttempts(0);
      }
    }
  }, [jobStatus, jobStatusError, statusPolling, processingDocId]);

  useEffect(() => {
    return () => {
      if (statusPolling) {
        clearInterval(statusPolling);
      }
    };
  }, [statusPolling]);

  const handleDeleteFileButton = async(docId:number)=>{
    try {
      await deleteFile({clientCompanyEin,docId}).unwrap();
      if(files?.documents) {
        const updatedDocuments = files.documents.filter((file:any) => file.id !== docId);
        setFiles(prev => ({...prev, documents: updatedDocuments}));
        setFilteredFiles(prev => ({...prev, documents: updatedDocuments}));
      }
      setCurrentFile({});
    } catch (e) {
      console.error('Failed to delete the file and data from the database', e)
    }
  };

  const handleProcessAutomation = async(id: number) => {
    console.log(`[Frontend] Starting automation process for document ${id}`);
    
    try {
      updateDocumentStatus(id, 'PENDING');
      
      startStatusPolling(id);
      
      console.log(`[Frontend] Calling processAutomation API for document ${id}`);
      const result = await processAutomation({id, currentClientCompanyEin: clientCompanyEin}).unwrap();
      console.log(`[Frontend] UiPath automation API response:`, result);
      
    } catch (e) {
      console.error(`[Frontend ERROR] Failed to process automation for document ${id}:`, e);
      
      if (statusPolling) {
        clearInterval(statusPolling);
        setStatusPolling(null);
      }
      setProcessingDocId(null);
      setPollingAttempts(0);
      
      updateDocumentStatus(id, 'FAILED');
      
      console.log(`[Frontend] Process automation failed - user should be notified`);
    }
  };

  const handleCheckStatus = async(id: number) => {
    console.log(`[Frontend] Manual status check for document ${id}`);
    setProcessingDocId(id);
    
    try {
      const statusResult = await refetchJobStatus();
      console.log(`[Frontend] Manual status check result:`, statusResult);
      
      setTimeout(() => {
        if (processingDocId === id) {
          setProcessingDocId(null);
        }
      }, 2000);
      
    } catch (error) {
      console.error(`[Frontend ERROR] Manual status check failed:`, error);
      setProcessingDocId(null);
    }
  };

  const handleShowRelatedDocs = (file: any) => {
    setSelectedDocForRelations(file);
    setShowRelatedDocs(true);
  };

  const handleRefreshFiles = () => {
    refetchFiles();
  };

  useEffect(()=>{
    if(filesData) {
      setFiles(filesData);
      setFilteredFiles(filesData);
    }
  },[filesData, deleteFile])
  
  const handleTooLongString = useCallback((str: string): string => {
    if (str.length > 25) return str.slice(0, 25) + '..';
    return str;
  }, []);

  const getStatusDisplay = (file: any) => {
    if (file.id === processingDocId) {
      return language === 'ro' ? 'Se verifică...' : 'Checking...';
    }
    
    if (file.rpa && file.rpa.length > 0) {
      const status = file.rpa[0].status;
      switch (status) {
        case 'COMPLETED':
          return language === 'ro' ? 'Completat' : 'Completed';
        case 'FAILED':
          return language === 'ro' ? 'Eșuat' : 'Failed';
        case 'PENDING':
          return language === 'ro' ? 'În procesare' : 'Processing';
        case 'TIMEOUT':
          return language === 'ro' ? 'Timeout' : 'Timeout';
        default:
          return language === 'ro' ? 'Necunoscut' : 'Unknown';
      }
    }
    
    return language === 'ro' ? 'În așteptare' : 'Ready';
  };

  const getStatusColor = (file: any) => {
    if (file.id === processingDocId) {
      return 'text-blue-500';
    }
    
    if (file.rpa && file.rpa.length > 0) {
      const status = file.rpa[0].status;
      switch (status) {
        case 'COMPLETED':
          return 'text-emerald-500';
        case 'FAILED':
          return 'text-red-500';
        case 'PENDING':
          return 'text-yellow-500';
        case 'TIMEOUT':
          return 'text-orange-500';
        default:
          return 'text-gray-500';
      }
    }
    return 'text-gray-400';
  };

  const isBotButtonDisabled = (file: any) => {
    if (file.id === processingDocId) return true;
    if (file.rpa && file.rpa.length > 0) {
      const status = file.rpa[0].status;
      return status === 'COMPLETED' || status === 'PENDING';
    }
    return false;
  };

  const getBotButtonTooltip = (file: any) => {
    if (file.rpa && file.rpa.length > 0 && file.rpa[0].status === 'COMPLETED') {
      return language === 'ro' ? 'Deja procesat' : 'Already processed';
    }
    if (file.id === processingDocId || (file.rpa && file.rpa.length > 0 && file.rpa[0].status === 'PENDING')) {
      return language === 'ro' ? 'Se procesează...' : 'Processing...';
    }
    return language === 'ro' ? 'Procesează date' : 'Submit data';
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'Invoice':
        return FileText;
      case 'Receipt':
        return Receipt;
      case 'Bank Statement':
        return CreditCard;
      case 'Contract':
        return FileSignature;
      case 'Z Report':
        return BarChart3;
      case 'Payment Order':
        return Send;
      case 'Collection Order':
        return Download;
      default:
        return FileText;
    }
  };

  const getFileIconColor = (fileType: string) => {
    switch (fileType) {
      case 'Invoice':
        return {
          text: 'text-blue-500',
          bg: 'bg-blue-500/10',
          hover: 'hover:bg-blue-500/20'
        };
      case 'Receipt':
        return {
          text: 'text-orange-500',
          bg: 'bg-orange-500/10',
          hover: 'hover:bg-orange-500/20'
        };
      case 'Bank Statement':
        return {
          text: 'text-red-500',
          bg: 'bg-red-500/10',
          hover: 'hover:bg-red-500/20'
        };
      case 'Contract':
        return {
          text: 'text-teal-500',
          bg: 'bg-teal-500/10',
          hover: 'hover:bg-teal-500/20'
        };
      case 'Z Report':
        return {
          text: 'text-yellow-500',
          bg: 'bg-yellow-500/10',
          hover: 'hover:bg-yellow-500/20'
        };
      case 'Payment Order':
        return {
          text: 'text-purple-500',
          bg: 'bg-purple-500/10',
          hover: 'hover:bg-purple-500/20'
        };
      case 'Collection Order':
        return {
          text: 'text-green-500',
          bg: 'bg-green-500/10',
          hover: 'hover:bg-green-500/20'
        };
      default:
        return {
          text: 'text-gray-500',
          bg: 'bg-gray-500/10',
          hover: 'hover:bg-gray-500/20'
        };
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-gradient-to-br from-[var(--primary)] to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
            <FileText size={35} className="text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-[var(--text1)] mb-2 text-left">
              {language==='ro'?'Management Documente':'File Management'}
            </h1>
            <p className="text-[var(--text2)] text-lg text-left">
              {language === 'ro' ? 'Gestionează și procesează documentele tale cu tracking plăți' : 'Manage and process your documents with payment tracking'}
            </p>
          </div>
        </div>
      </div>

      <FilesSearchFiltersComponent 
        nameSearch={nameSearch}
        setNameSearch={setNameSearch}
        setTypeFilter={setTypeFilter}
        intervalDate={intervalDateFilter}
        setIntervalDate={setIntervalDateFilter}
        paymentStatus={paymentStatus}
        setPaymentStatus={setPaymentStatus}
      />

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
                  {selectedFiles.size} {language === 'ro' ? 'fișiere selectate' : 'files selected'}
                </span>
                <button
                  onClick={deselectAllFiles}
                  className="text-[var(--primary)] bg-[var(--primary)]/10 
                  hover:bg-[var(--primary)]/20 transition-colors text-sm"
                >
                  {language === 'ro' ? 'Deselectează toate' : 'Deselect all'}
                </button>
              </div>
              
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleBulkProcess}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-xl transition-colors"
                >
                  <Zap size={16} />
                  {language === 'ro' ? 'Procesează Toate' : 'Process All'}
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleBulkDelete}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors"
                >
                  <Trash2 size={16} />
                  {language === 'ro' ? 'Șterge Toate' : 'Delete All'}
                </motion.button>
                
                <button
                  onClick={() => setShowBulkActions(false)}
                  className="p-2 bg-[var(--background)] text-[var(--text3)] hover:text-red-500 hover:bg-red-500/20 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-[var(--foreground)] rounded-3xl border border-[var(--text4)] shadow-lg overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[var(--text4)] bg-gradient-to-r from-[var(--background)] to-[var(--foreground)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-[var(--text1)]">
                {language === 'ro' ? 'Fișierele Tale' : 'Your Files'}
              </h2>
              <span className="bg-[var(--primary)]/20 text-[var(--primary)] px-3 py-1 rounded-full text-sm font-semibold">
                {filteredFiles?.documents?.length || 0} {language==='ro'?'fișiere':'files'}
              </span>
            </div>
            
            {/* Select All Checkbox */}
            {filteredFiles?.documents?.length > 0 && (
              <button
                onClick={isAllSelected ? deselectAllFiles : selectAllFiles}
                className="flex items-center gap-2 text-[var(--text2)] hover:text-[var(--primary)] transition-colors
                bg-[var(--primary)]/20"
              >
                {isAllSelected ? (
                  <CheckSquare size={20} className="text-[var(--primary)]" />
                ) : isPartiallySelected ? (
                  <CheckSquare size={20} className="text-[var(--primary)] opacity-50" />
                ) : (
                  <Square size={20} />
                )}
                <span className="text-sm font-medium">
                  {language === 'ro' ? 'Selectează toate' : 'Select all'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Files List */}
        <div className="p-6">
          {filteredFiles?.documents?.length === 0 ? (
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto text-[var(--text3)] mb-4" />
              <p className="text-[var(--text2)] text-lg">
                {language === 'ro' ? 'Nu există fișiere' : 'No files found'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFiles?.documents?.map((file: any, index: number) => {
                const FileIcon = getFileIcon(file.type);
                const isSelected = selectedFiles.has(file.id);
                const iconColors = getFileIconColor(file.type);
                
                return (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`bg-[var(--background)] rounded-2xl px-1 py-1 border transition-all duration-200 mb-1 ${
                      isSelected 
                        ? 'border-[var(--primary)] shadow-md bg-[var(--primary)]/5' 
                        : 'border-[var(--text4)] hover:border-[var(--primary)]/50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => toggleFileSelection(file.id)}
                        className="p-1 hover:bg-[var(--text4)]/20 bg-transparent rounded-lg transition-colors"
                      >
                        {isSelected ? (
                          <CheckSquare size={20} className="text-[var(--primary)]" />
                        ) : (
                          <Square size={20} className="text-[var(--text3)]" />
                        )}
                      </button>
                      
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-12 h-12 ${iconColors.bg} ${iconColors.hover} rounded-xl flex items-center justify-center flex-shrink-0 transition-colors`}>
                          <FileIcon size={24} className={iconColors.text} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <MyTooltip content={file.name} trigger={
                            <a 
                              href={file.signedUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="font-semibold text-[var(--text1)] text-left hover:text-[var(--primary)] transition-colors truncate block text-lg"
                            >
                              {handleTooLongString(file.name)}
                            </a>
                          }/>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-[var(--text2)] font-medium">
                            {language === 'ro'
                              ? docType[String(file.type).replace(/^\w/, c => c.toUpperCase()) as keyof typeof docType] || 'Tip necunoscut'
                              : file.type || 'Unknown type'
                            }
                            </span>
                            <div className="flex items-center gap-1 text-[var(--text3)]">
                              <Calendar size={14} />
                              <span>{getDocumentDate(file)}</span>
                            </div>
                            {file.type === 'Invoice' && (
                                <InvoicePaymentBadge file={file} language={language} />
                             )}
                          </div>
                        </div>
                      </div>
                            
                      {/* Status */}
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${getStatusColor(file)}`}>
                          {getStatusDisplay(file)}
                        </span>
                        {file.id === processingDocId && (
                          <RefreshCw size={16} className="animate-spin text-blue-500" />
                        )}
                        {file.rpa && file.rpa.length > 0 && file.rpa[0].status === 'PENDING' && file.id !== processingDocId && (
                          <MyTooltip content={language === 'ro' ? 'Verifică status' : 'Check status'} trigger={
                            <RefreshCw 
                              size={16} 
                              className="cursor-pointer text-blue-500 hover:text-blue-700 transition-colors" 
                              onClick={() => handleCheckStatus(file.id)}
                            />
                          }/>
                        )}
                        {file.rpa && file.rpa.length > 0 && file.rpa[0].status === 'FAILED' && (
                          <button 
                            className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-lg hover:bg-red-200 transition-colors"
                            onClick={() => handleProcessAutomation(file.id)}
                          >
                            {language === 'ro' ? 'Reîncearcă' : 'Retry'}
                          </button>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <MyTooltip content={language==='ro'?'Vezi date':'View data'} trigger={
                          <button
                            onClick={() => {
                              setIsModalOpen(true);
                              setCurrentFile(file);
                            }}
                            className="p-2 text-[var(--primary)] bg-[var(--primary)]/20 hover:text-white hover:bg-[var(--primary)] rounded-lg transition-colors"
                          >
                            <Eye size={18} />
                          </button>
                        }/>

                        <MyTooltip content={language==='ro'?'Documente asociate':'Related documents'} trigger={
                          <button
                            onClick={() => handleShowRelatedDocs(file)}
                            className="p-2 text-purple-600 bg-purple-600/20 hover:text-white hover:bg-purple-600 rounded-lg transition-colors"
                          >
                            <Link size={18} />
                          </button>
                        }/>
                        
                        <MyTooltip content={getBotButtonTooltip(file)} trigger={
                          <button
                            onClick={() => {
                              if (!isBotButtonDisabled(file)) {
                                handleProcessAutomation(file.id);
                              }
                            }}
                            disabled={isBotButtonDisabled(file)}
                            className={`p-2 rounded-lg transition-colors ${
                              isBotButtonDisabled(file) 
                                ? 'text-gray-400 cursor-not-allowed bg-white' 
                                : 'text-emerald-600 hover:bg-emerald-500 bg-emerald-200 hover:text-white'
                            }`}
                          >
                            <Bot size={18} />
                          </button>
                        }/>
                        
                        <MyTooltip content={language==='ro'?'Șterge':'Delete'} trigger={
                          <button
                            onClick={() => {
                              setIsSureModal(true);
                              setCurrentFile(file);
                            }}
                            className="p-2 text-red-500 bg-red-500/20 hover:text-white hover:bg-red-500 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        }/>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {isModalOpen&&(<EditExtractedDataManagement
        setIsModalOpen={setIsModalOpen}
        isOpen={isModalOpen}
        processedFiles={files}
        setProcessedFiles={setFilteredFiles}
        currentFile={currentFile}
        setCurrentFile={setCurrentFile}
      />)}

      {showRelatedDocs && selectedDocForRelations && (
        <RelatedDocumentsModal
          isOpen={showRelatedDocs}
          onClose={() => {
            setShowRelatedDocs(false);
            setSelectedDocForRelations(null);
          }}
          document={selectedDocForRelations}
          onRefresh={handleRefreshFiles}
        />
      )}

      {isSureModal&&(
        <AreYouSureModalR 
          setIsSureModal={setIsSureModal} 
          setAction={bulkAction === 'delete' ? executeBulkDelete : () => handleDeleteFileButton(currentFile?.processedData?.[0]?.documentId || currentFile?.id)} 
          confirmButton={language==='ro'?'Șterge':'Delete'}
          text={
            bulkAction === 'delete' 
              ? (language==='ro'?`Ești sigur/ă că vrei să ȘTERGI permanent ${selectedFiles.size} fișiere și datele aferente?`:`Are you sure you want to permanently DELETE ${selectedFiles.size} files and their data?`)
              : (language==='ro'?"Ești sigur/ă că vrei să ȘTERGI permanent fișierul și datele aferente acestuia?":"Are you sure you want to permanently DELETE the file and its data?")
          }
        />
      )}

      {clientCompanyName===''&&(<InitialClientCompanyModalSelect/>)}

      {isFilesLoading&&(
        <div className='fixed inset-0 z-50 flex items-center justify-center
         w-full h-full bg-[var(--background)]/60 backdrop-blur-sm'>
          <div className="bg-[var(--foreground)] rounded-3xl p-8 shadow-2xl border border-[var(--text4)]">
            <LoadingComponent/>
          </div>
        </div>
        )}
    </div>
  )
}

export default FileManagementPage
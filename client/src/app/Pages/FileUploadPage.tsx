import { useSelector } from "react-redux";
import MyDropzone from "@/components/Dropzone";
import { lazy, Suspense, useState, useCallback, useEffect, useRef } from "react";
import { useExtractDataMutation, useGetDuplicateAlertsQuery } from "@/redux/slices/apiSlice";
import { Plus, Trash, Upload, FileText, Eye, X, CheckCircle, Clock, AlertCircle, RotateCcw, Edit, Pause, Play, LoaderCircle, AlertTriangle, Shield, RefreshCw, ArrowDown, ArrowUp, Package } from "lucide-react";
import { TooltipDemo } from '../Components/Tooltip';
import LoadingComponent from "../Components/LoadingComponent";
import InitialClientCompanyModalSelect from '@/app/Components/InitialClientCompanyModalSelect';
import DuplicateAlertsComponent from '../Components/DuplicateAlertsComponent';
import computer from '@/assets/undraw_computer-files_7dj6.svg';
import { motion, AnimatePresence } from "framer-motion";

const ExtractedDataEdit = lazy(() => import('../Components/EditExtractedData/EditExtractedDataComponent'));

type clientCompany= {
  clientCompany:{
    current:{
      name:string,
      ein:string
    }
  }
}

type DocumentState = 'uploaded' | 'queued' | 'categorizing' | 'categorized' | 'processing' | 'processed' | 'saved' | 'error' | 'retry';

interface DocumentStatus {
  state: DocumentState;
  data?: any;
  error?: string;
  position?: number;
  retryCount?: number;
  lastAttempt?: number;
  category?: string;
  direction?: 'incoming' | 'outgoing' | 'unknown';
  processingPhase?: number;
}

interface ProcessingPhase {
  id: number;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  filter: (doc: File, status: DocumentStatus) => boolean;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
const PROCESSING_TIMEOUT = 300000; 

const FileUploadPage = () => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [documents, setDocuments] = useState<File[]>([]);
  const [documentStates, setDocumentStates] = useState<Record<string, DocumentStatus>>({});
  const [editFile, setEditFile] = useState<{ result: Record<string, any> } | undefined>(undefined);
  const [currentProcessingFile, setCurrentProcessingFile] = useState<File | null>(null);
  const [dropzoneVisible, setDropzoneVisible] = useState<boolean>(false);
  const [processingQueue, setProcessingQueue] = useState<string[]>([]);
  const [isProcessingPaused, setIsProcessingPaused] = useState<boolean>(false);
  const [currentlyProcessing, setCurrentlyProcessing] = useState<string | null>(null);
  const [showDuplicateAlerts, setShowDuplicateAlerts] = useState<boolean>(false);
  const [queueErrors, setQueueErrors] = useState<number>(0);
  const [currentPhase, setCurrentPhase] = useState<number>(0);

  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const currentAbortController = useRef<AbortController | null>(null);

  const clientCompanyName = useSelector((state:clientCompany)=>state.clientCompany.current.name)
  const clientCompanyEin = useSelector((state:clientCompany)=>state.clientCompany.current.ein)
  const language = useSelector((state: {user:{language:string}}) => state.user.language);
  const [process] = useExtractDataMutation();

  const processingPhases: ProcessingPhase[] = [
    {
      id: 0,
      name: language === 'ro' ? 'Categorizare' : 'Categorization',
      description: language === 'ro' ? 'Identifică tipul documentelor' : 'Identify document types',
      icon: <FileText size={16} />,
      color: 'blue',
      filter: (_doc: File, status: DocumentStatus) => 
        Boolean(status.state === 'queued' && !status.category)
    },
    {
      id: 1,
      name: language === 'ro' ? 'Facturi Primite' : 'Incoming Invoices',
      description: language === 'ro' ? 'Procesează facturi unde suntem cumpărători' : 'Process invoices where we are buyers',
      icon: <ArrowDown size={16} />,
      color: 'green',
      filter: (_doc: File, status: DocumentStatus) => 
        Boolean(status.category === 'Invoice' && status.direction === 'incoming' && status.state === 'categorized')
    },
    {
      id: 2,
      name: language === 'ro' ? 'Facturi Emise' : 'Outgoing Invoices',
      description: language === 'ro' ? 'Procesează facturi unde suntem vânzători' : 'Process invoices where we are sellers',
      icon: <ArrowUp size={16} />,
      color: 'orange',
      filter: (_doc: File, status: DocumentStatus) => 
        Boolean(status.category === 'Invoice' && status.direction === 'outgoing' && status.state === 'categorized')
    },
    {
      id: 3,
      name: language === 'ro' ? 'Alte Documente' : 'Other Documents',
      description: language === 'ro' ? 'Procesează chitanțe, extrase bancare, etc.' : 'Process receipts, bank statements, etc.',
      icon: <Package size={16} />,
      color: 'purple',
      filter: (_doc: File, status: DocumentStatus) => 
        Boolean(status.category && status.category !== 'Invoice' && status.state === 'categorized')
    }
  ];

  useEffect(()=>{
    console.log('Documents', documents)
    console.log('Document States', documentStates)
    console.log('Processing Queue', processingQueue)
    console.log('Current Phase', currentPhase)
    console.log('Queue Errors', queueErrors)
  },[documents, documentStates, processingQueue, currentPhase, queueErrors])
  
  const { data: duplicateAlerts = [] } = useGetDuplicateAlertsQuery(
    { company: clientCompanyEin },
    { skip: !clientCompanyEin }
  );

  useEffect(() => {
    if (processingQueue.length === 0 && !currentlyProcessing) {
      setQueueErrors(0);
    }
  }, [processingQueue.length, currentlyProcessing]);

  useEffect(() => {
    const retryFailedDocuments = () => {
      const failedDocs = Object.entries(documentStates)
        .filter(([, status]) => 
          status.state === 'error' && 
          (status.retryCount || 0) < MAX_RETRIES &&
          Date.now() - (status.lastAttempt || 0) > RETRY_DELAY * Math.pow(2, status.retryCount || 0)
        )
        .map(([name]) => name);

      if (failedDocs.length > 0 && !isProcessingPaused && queueErrors < 10) {
        console.log(`Auto-retrying ${failedDocs.length} failed documents`);
        
        failedDocs.forEach(docName => {
          setDocumentStates(prev => ({
            ...prev,
            [docName]: {
              ...prev[docName],
              state: 'retry',
              retryCount: (prev[docName].retryCount || 0) + 1,
              lastAttempt: Date.now()
            }
          }));
        });

        setProcessingQueue(prev => [...prev, ...failedDocs]);
      }
    };

    const retryInterval = setInterval(retryFailedDocuments, 5000);
    return () => clearInterval(retryInterval);
  }, [documentStates, isProcessingPaused, queueErrors]);

  useEffect(() => {
    const newDocuments = documents.filter(doc => !documentStates[doc.name]);
    
    if (newDocuments.length > 0) {
      const newStates: Record<string, DocumentStatus> = {};
      const newQueueItems: string[] = [];
      
      newDocuments.forEach((doc, index) => {
        newStates[doc.name] = { 
          state: 'queued',
          position: processingQueue.length + index + 1,
          retryCount: 0,
          lastAttempt: 0,
          processingPhase: 0 
        };
        newQueueItems.push(doc.name);
      });
      
      setDocumentStates(prev => ({ ...prev, ...newStates }));
      setProcessingQueue(prev => [...prev, ...newQueueItems]);
    }
  }, [documents, documentStates, processingQueue.length]);

  useEffect(() => {
    if (processingQueue.length > 0 && !isProcessingRef.current && !isProcessingPaused) {
      processNextInQueue();
    }
  }, [processingQueue, isProcessingPaused, currentPhase]);

  const determineDocumentDirection = useCallback((extractedData: any): 'incoming' | 'outgoing' | 'unknown' => {
    const buyerEin = extractedData.buyer_ein?.replace(/^RO/i, '');
    const vendorEin = extractedData.vendor_ein?.replace(/^RO/i, '');
    const cleanClientEin = clientCompanyEin.replace(/^RO/i, '');

    if (buyerEin === cleanClientEin) return 'incoming';
    if (vendorEin === cleanClientEin) return 'outgoing';
    return 'unknown';
  }, [clientCompanyEin]);

  const organizeProcessingQueue = useCallback(() => {
    console.log('Organizing processing queue by phases...');
    
    const currentPhaseObj = processingPhases[currentPhase];
    if (!currentPhaseObj) return;

    const docsForCurrentPhase = documents.filter(doc => {
      const status = documentStates[doc.name];
      return status && currentPhaseObj.filter(doc, status);
    });

    const newQueue = docsForCurrentPhase.map(doc => doc.name);
    
    if (newQueue.length > 0) {
      console.log(`Phase ${currentPhase} (${currentPhaseObj.name}): ${newQueue.length} documents ready`);
      setProcessingQueue(newQueue);
      
      setDocumentStates(prev => {
        const updated = { ...prev };
        newQueue.forEach((name, index) => {
          if (updated[name]) {
            updated[name] = {
              ...updated[name],
              position: index + 1,
              processingPhase: currentPhase
            };
          }
        });
        return updated;
      });
    } else {
      console.log(`Phase ${currentPhase} (${currentPhaseObj.name}): No documents ready, moving to next phase`);
      advanceToNextPhase();
    }
  }, [currentPhase, documents, documentStates]);

  const advanceToNextPhase = useCallback(() => {
    if (currentPhase < processingPhases.length - 1) {
      console.log(`Advancing from phase ${currentPhase} to ${currentPhase + 1}`);
      setCurrentPhase(prev => prev + 1);
    } else {
      console.log('All phases completed');
      setProcessingQueue([]);
    }
  }, [currentPhase]);

  const validateProcessedData = useCallback((data: any): boolean => {
    if (!data || typeof data !== 'object') {
      console.warn('Invalid data structure received');
      return false;
    }

    const result = data.result || data;
    
    if (!result.document_type) {
      console.warn('Missing document_type in processed data');
      return false;
    }

    return true;
  }, []);

  const processNextInQueue = useCallback(async () => {
    if (isProcessingRef.current || processingQueue.length === 0 || isProcessingPaused) {
      return;
    }

    isProcessingRef.current = true;
    const nextDocumentName = processingQueue[0];
    const document = documents.find(doc => doc.name === nextDocumentName);
    
    if (!document) {
      setProcessingQueue(prev => prev.slice(1));
      isProcessingRef.current = false;
      organizeProcessingQueue();
      return;
    }

    currentAbortController.current = new AbortController();
    const abortSignal = currentAbortController.current.signal;

    setCurrentlyProcessing(nextDocumentName);
    
    const currentPhaseObj = processingPhases[currentPhase];
    const isCategorizationPhase = currentPhase === 0;
    
    setDocumentStates(prev => ({
      ...prev,
      [nextDocumentName]: { 
        ...prev[nextDocumentName],
        state: isCategorizationPhase ? 'categorizing' : 'processing',
        lastAttempt: Date.now(),
        processingPhase: currentPhase
      }
    }));

    const timeoutId = setTimeout(() => {
      if (currentAbortController.current) {
        currentAbortController.current.abort();
      }
    }, PROCESSING_TIMEOUT);

    try {
      console.log(`Processing document: ${nextDocumentName} in phase ${currentPhase} (${currentPhaseObj.name}) (attempt ${(documentStates[nextDocumentName]?.retryCount || 0) + 1})`);
      
      // Note: You may need to update your API slice to accept processingPhase parameter:
      // In your apiSlice.ts, update the extractData mutation to include processingPhase
      const processedFile = await process({ 
        file: document, 
        clientCompanyEin,
        processingPhase: currentPhase 
      }).unwrap();
      
      clearTimeout(timeoutId);
      
      if (!validateProcessedData(processedFile)) {
        throw new Error('Received incomplete or invalid data from processing service');
      }
      
      const extractedData = processedFile.data || processedFile;
      
      if (isCategorizationPhase) {
        const docType = extractedData.document_type;
        const direction = docType === 'Invoice' ? determineDocumentDirection(extractedData) : 'unknown';
        
        setDocumentStates(prev => ({
          ...prev,
          [nextDocumentName]: { 
            ...prev[nextDocumentName],
            state: 'categorized',
            category: docType,
            direction: direction,
            data: extractedData,
            retryCount: prev[nextDocumentName]?.retryCount || 0,
            lastAttempt: Date.now()
          }
        }));
        
        console.log(`Document categorized: ${nextDocumentName} as ${docType} (${direction})`);
      } else {
        setDocumentStates(prev => ({
          ...prev,
          [nextDocumentName]: { 
            state: 'processed', 
            data: extractedData,
            category: prev[nextDocumentName]?.category,
            direction: prev[nextDocumentName]?.direction,
            retryCount: prev[nextDocumentName]?.retryCount || 0,
            lastAttempt: Date.now(),
            processingPhase: currentPhase
          }
        }));
        
        console.log(`Successfully processed: ${nextDocumentName} in phase ${currentPhase}`);
      }
      
      setQueueErrors(0);
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      let errorMessage = 'Processing failed';
      let shouldRetry = true;
      
      if (abortSignal.aborted) {
        errorMessage = 'Processing timeout - document took too long to process';
      } else if (error instanceof Error) {
        errorMessage = error.message;
        
        if (error.message.includes('file too large') || 
            error.message.includes('invalid file format') ||
            error.message.includes('authentication')) {
          shouldRetry = false;
        }
      }
      
      console.error(`Failed to process ${nextDocumentName}:`, error);
      
      const currentRetryCount = documentStates[nextDocumentName]?.retryCount || 0;
      const willRetry = shouldRetry && currentRetryCount < MAX_RETRIES;
      
      setDocumentStates(prev => ({
        ...prev,
        [nextDocumentName]: { 
          state: willRetry ? 'error' : 'error',
          error: errorMessage,
          retryCount: currentRetryCount + 1,
          lastAttempt: Date.now(),
          category: prev[nextDocumentName]?.category,
          direction: prev[nextDocumentName]?.direction,
          processingPhase: currentPhase
        }
      }));
      
      setQueueErrors(prev => prev + 1);
      
      if (queueErrors >= 5) {
        console.warn('Too many consecutive errors, pausing queue processing');
        setIsProcessingPaused(true);
      }
      
    } finally {
      currentAbortController.current = null;
      
      setProcessingQueue(prev => {
        const newQueue = prev.slice(1);
        
        if (newQueue.length === 0) {
          setTimeout(organizeProcessingQueue, 100);
        } else {
          setDocumentStates(prevStates => {
            const updated = { ...prevStates };
            newQueue.forEach((name, index) => {
              if (updated[name] && (updated[name].state === 'queued' || updated[name].state === 'categorized')) {
                updated[name] = {
                  ...updated[name],
                  position: index + 1
                };
              }
            });
            return updated;
          });
        }
        
        return newQueue;
      });
      
      setCurrentlyProcessing(null);
      isProcessingRef.current = false;
      
      if (!isProcessingPaused && queueErrors < 10) { 
        processingTimeoutRef.current = setTimeout(() => {
          if (!isProcessingPaused && queueErrors < 10) {
            processNextInQueue();
          }
        }, queueErrors > 0 ? 3000 : 1000); 
      }
    }
  }, [processingQueue, documents, process, clientCompanyEin, isProcessingPaused, documentStates, queueErrors, validateProcessedData, currentPhase, organizeProcessingQueue, determineDocumentDirection]);

  const clearQueue = useCallback(() => {
    if (currentAbortController.current) {
      currentAbortController.current.abort();
    }
    
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    
    setProcessingQueue([]);
    setCurrentlyProcessing(null);
    setIsProcessingPaused(false);
    setQueueErrors(0);
    setCurrentPhase(0);
    isProcessingRef.current = false;
    
    setDocumentStates(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(docName => {
        if (['queued', 'categorizing', 'categorized', 'processing', 'error', 'retry'].includes(updated[docName].state)) {
          updated[docName] = {
            state: 'uploaded',
            retryCount: 0,
            lastAttempt: 0,
            processingPhase: 0
          };
        }
      });
      return updated;
    });
    
    console.log('Queue cleared and reset to initial state');
  }, []);

  const toggleProcessing = useCallback(() => {
    setIsProcessingPaused(prev => {
      const newPaused = !prev;
      if (!newPaused && processingQueue.length > 0 && !isProcessingRef.current) {
        setTimeout(processNextInQueue, 100);
      } else if (!newPaused && processingQueue.length === 0) {
        setTimeout(organizeProcessingQueue, 100);
      }
      return newPaused;
    });
  }, [processingQueue.length, processNextInQueue, organizeProcessingQueue]);

  const handleTooLongString = useCallback((str: string): string => {
    if (str.length > 25) return str.slice(0, 25) + '..';
    return str;
  }, []);

  const handleReviewDocument = useCallback((file: File) => {
    const documentState = documentStates[file.name];
    if (documentState?.data) {
      setEditFile(documentState.data);
      setCurrentProcessingFile(file);
      setIsModalOpen(true);
    }
  }, [documentStates]);

  const handleRetryProcessing = useCallback((file: File) => {
    const currentStatus = documentStates[file.name];
    
    setDocumentStates(prev => ({
      ...prev,
      [file.name]: {
        state: currentStatus?.category ? 'categorized' : 'queued',
        position: processingQueue.length + 1,
        retryCount: 0,
        lastAttempt: 0,
        category: currentStatus?.category,
        direction: currentStatus?.direction,
        processingPhase: currentStatus?.category ? 
          (currentStatus.category === 'Invoice' ? 
            (currentStatus.direction === 'incoming' ? 1 : 2) : 3) : 0
      }
    }));
    
    setQueueErrors(0);
    
    setTimeout(organizeProcessingQueue, 100);
  }, [processingQueue.length, documentStates, organizeProcessingQueue]);

  const handleManualEdit = useCallback((file: File) => {
    const basicData = {
      result: {
        document_type: '',
        document_date: '',
        line_items: []
      }
    };
    
    setEditFile(basicData);
    setCurrentProcessingFile(file);
    setIsModalOpen(true);
  }, []);

  const handleDeleteDocument = useCallback((name: string): void => {
    if (currentlyProcessing === name && currentAbortController.current) {
      currentAbortController.current.abort();
    }
    
    setDocuments(prev => prev.filter(document => document.name !== name));
    
    setProcessingQueue(prev => prev.filter(docName => docName !== name));
    
    if (documentStates[name]) {
      const newDocumentStates = { ...documentStates };
      delete newDocumentStates[name];
      setDocumentStates(newDocumentStates);
    }
    
    if (currentlyProcessing === name) {
      setCurrentlyProcessing(null);
      isProcessingRef.current = false;
    }
  }, [documentStates, currentlyProcessing]);

  const handleDocumentSaved = useCallback((fileName: string) => {
    setDocumentStates(prev => ({
      ...prev,
      [fileName]: {
        ...prev[fileName],
        state: 'saved'
      }
    }));
  }, []);

  const getStatusIcon = (doc: File) => {
    const state = documentStates[doc.name]?.state;
    const data = documentStates[doc.name]?.data;
    const retryCount = documentStates[doc.name]?.retryCount || 0;
    
    const hasDuplicateAlert = data?.result?.duplicate_detection?.is_duplicate;
    const hasComplianceIssue = data?.result?.compliance_validation?.compliance_status === 'NON_COMPLIANT' ||
                              data?.result?.compliance_validation?.compliance_status === 'WARNING';
    
    const baseIcon = (() => {
      switch (state) {
        case 'queued':
          return <Clock size={16} className="text-blue-400" />;
        case 'categorizing':
          return <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <FileText size={16} className="text-purple-500" />
          </motion.div>;
        case 'categorized':
          return <CheckCircle size={16} className="text-purple-500" />;
        case 'retry':
          return (
            <div className="flex items-center gap-1">
              <RotateCcw size={14} className="text-orange-500" />
              <span className="text-xs text-orange-600">{retryCount}</span>
            </div>
          );
        case 'processing':
          return <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <LoaderCircle size={16} className="text-blue-500" />
          </motion.div>;
        case 'processed':
        case 'saved':
          return <CheckCircle size={16} className="text-green-500" />;
        case 'error':
          return (
            <div className="flex items-center gap-1">
              <AlertCircle size={14} className="text-red-500" />
              {retryCount > 0 && <span className="text-xs text-red-600">{retryCount}</span>}
            </div>
          );
        default:
          return <Clock size={16} className="text-gray-400" />;
      }
    })();

    if (hasDuplicateAlert || hasComplianceIssue) {
      return (
        <div className="flex items-center gap-1">
          {baseIcon}
          {hasDuplicateAlert && <AlertTriangle size={12} className="text-orange-500" />}
          {hasComplianceIssue && <Shield size={12} className="text-red-500" />}
        </div>
      );
    }

    return baseIcon;
  };

  const getStatusColor = (doc: File) => {
    const state = documentStates[doc.name]?.state;
    const data = documentStates[doc.name]?.data;
    
    const hasDuplicateAlert = data?.result?.duplicate_detection?.is_duplicate;
    const hasComplianceIssue = data?.result?.compliance_validation?.compliance_status === 'NON_COMPLIANT';
    
    if (hasComplianceIssue) {
      return 'text-red-600 bg-red-50 border-red-200';
    }
    
    if (hasDuplicateAlert) {
      return 'text-orange-600 bg-orange-50 border-orange-200';
    }
    
    switch (state) {
      case 'queued':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'categorizing':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'categorized':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'retry':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'processing':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'processed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'saved':
        return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const docType ={
    "Invoice":"Factura",
    "Receipt":"Chitanta",
    "Bank Statement":"Extras De Cont",
    "Contract":"Contract",
    "Z Report":"Raport Z",
    "Payment Order":"Dispozitie De Plata",
    "Collection Order":"Dispozitie De Incasare"
  };

  const getStatusText = (doc: File) => {
    const state = documentStates[doc.name]?.state;
    const position = documentStates[doc.name]?.position;
    const data = documentStates[doc.name]?.data;
    const retryCount = documentStates[doc.name]?.retryCount || 0;
    const category = documentStates[doc.name]?.category;
    const direction = documentStates[doc.name]?.direction;
    const phase = documentStates[doc.name]?.processingPhase || 0;
    
    const hasComplianceIssue = data?.result?.compliance_validation?.compliance_status === 'NON_COMPLIANT';
    const hasDuplicateAlert = data?.result?.duplicate_detection?.is_duplicate;
    
    if (hasComplianceIssue) {
      return language === 'ro' ? 'Neconform' : 'Non-Compliant';
    }
    
    if (hasDuplicateAlert && (state === 'processed' || state === 'saved')) {
      return language === 'ro' ? 'Posibil Duplicat' : 'Possible Duplicate';
    }
    
    switch (state) {
      case 'queued':
        const phaseInfo = processingPhases[phase];
        return language === 'ro' ? 
          `Faza ${phase + 1}: ${phaseInfo?.name} (${position})` : 
          `Phase ${phase + 1}: ${phaseInfo?.name} (${position})`;
      case 'categorizing':
        return language === 'ro' ? 'Se categorizează...' : 'Categorizing...';
      case 'categorized':
        const directionText = direction === 'incoming' ? 
          (language === 'ro' ? 'Primită' : 'Incoming') : 
          direction === 'outgoing' ? 
          (language === 'ro' ? 'Emisă' : 'Outgoing') : '';
        return `${category}${directionText ? ` (${directionText})` : ''}`;
      case 'retry':
        return language === 'ro' ? `Reîncercare ${retryCount}` : `Retry ${retryCount}`;
      case 'processing':
        return language === 'ro' ? 
          `Se procesează în faza ${phase + 1}...` : 
          `Processing in phase ${phase + 1}...`;
      case 'processed':
        return language === 'ro' ? 'Procesat' : 'Processed';
      case 'saved':
        return language === 'ro' ? 'Salvat' : 'Saved';
      case 'error':
        const willRetry = retryCount < MAX_RETRIES;
        return willRetry 
          ? (language === 'ro' ? `Eroare (va reîncerca)` : `Error (will retry)`)
          : (language === 'ro' ? 'Eroare permanentă' : 'Permanent error');
      default:
        return language === 'ro' ? 'Încărcat' : 'Uploaded';
    }
  };

  const renderActionButtons = (doc: File) => {
    const state = documentStates[doc.name]?.state;

    switch (state) {
      case 'queued':
      case 'categorizing':
      case 'categorized':
      case 'retry':
        return (
          <div className="flex items-center gap-2">
            <div className="p-2 text-blue-400 bg-blue-100 rounded-lg">
              <Clock size={18} />
            </div>
          </div>
        );

      case 'processing':
        return (
          <div className="flex items-center gap-2">
          </div>
        );

      case 'processed':
      case 'saved':
        return (
          <div className="flex items-center gap-2">
            <TooltipDemo
              trigger={
                <button
                  onClick={() => handleReviewDocument(doc)}
                  className="p-2 text-emerald-500 bg-emerald-500/20 hover:text-white
                   hover:bg-emerald-500 rounded-lg transition-colors"
                >
                  <Eye size={18} />
                </button>
              }
              tip={state === 'saved' ? (language==='ro'?'Vezi date':'View data') : (language==='ro'?'Revizuiește':'Review')}
            />
            
            <TooltipDemo
              trigger={
                <button
                  onClick={() => handleRetryProcessing(doc)}
                  className="p-2 text-blue-500 bg-blue-500/20 hover:text-white
                   hover:bg-blue-500 rounded-lg transition-colors"
                >
                  <RotateCcw size={18} />
                </button>
              }
              tip={language==='ro'?'Reprocessează':'Reprocess'}
            />
          </div>
        );

      case 'error':
        return (
          <div className="flex items-center gap-2">
            <TooltipDemo
              trigger={
                <button
                  onClick={() => handleRetryProcessing(doc)}
                  className="p-2 text-blue-500 bg-blue-500/20 hover:text-white
                   hover:bg-blue-500 rounded-lg transition-colors"
                >
                  <RotateCcw size={18} />
                </button>
              }
              tip={language==='ro'?'Reîncearcă':'Retry'}
            />
            <TooltipDemo
              trigger={
                <button
                  onClick={() => handleManualEdit(doc)}
                  className="p-2 text-orange-500 bg-orange-500/20 hover:text-white
                   hover:bg-orange-500 rounded-lg transition-colors"
                >
                  <Edit size={18} />
                </button>
              }
              tip={language==='ro'?'Editare manuală':'Manual edit'}
            />
          </div>
        );

      default:
        return (
          <div className="p-2 text-gray-400 bg-gray-100 rounded-lg">
            <Clock size={18} />
          </div>
        );
    }
  };

  const getCurrentPhaseStats = () => {
    const totalDocs = documents.length;
    const uploadedDocs = documents.filter(doc => documentStates[doc.name]?.state === 'uploaded').length;
    const categorizedDocs = documents.filter(doc => documentStates[doc.name]?.category).length;
    const processedDocs = documents.filter(doc => ['processed', 'saved'].includes(documentStates[doc.name]?.state || '')).length;
    
    return {
      total: totalDocs,
      uploaded: uploadedDocs,
      categorized: categorizedDocs,
      processed: processedDocs,
      remaining: totalDocs - processedDocs
    };
  };

  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
      if (currentAbortController.current) {
        currentAbortController.current.abort();
      }
    };
  }, []);

  const stats = getCurrentPhaseStats();

  return (
    <div className="min-h-screen p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gradient-to-br from-[var(--primary)] to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Upload size={35} className="text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-[var(--text1)] mb-2 text-left">
                {language==='ro'?'Încarcă Documente':'File Upload'}
              </h1>
              <p className="text-[var(--text2)] text-lg text-left">
                {language === 'ro' 
                  ? 'Procesare inteligentă în fazele: Categorizare → Facturi Primite → Facturi Emise → Alte Documente' 
                  : 'Smart processing in phases: Categorization → Incoming Invoices → Outgoing Invoices → Other Documents'
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {documents.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-[var(--foreground)] rounded-2xl border border-[var(--text4)]">
                <span className="text-sm font-medium text-[var(--text2)]">
                  {language === 'ro' ? 'Faza' : 'Phase'} {currentPhase + 1}/{processingPhases.length}
                </span>
                <div className={`p-1 rounded-lg bg-${processingPhases[currentPhase]?.color}-500/20 text-${processingPhases[currentPhase]?.color}-600`}>
                  {processingPhases[currentPhase]?.icon}
                </div>
              </div>
            )}

            {duplicateAlerts.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowDuplicateAlerts(true)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-2xl 
                font-medium shadow-sm hover:bg-orange-600 transition-all duration-300"
              >
                <AlertTriangle size={18} />
                {duplicateAlerts.length} {language === 'ro' ? 'Duplicate' : 'Duplicates'}
              </motion.button>
            )}

            {queueErrors > 3 && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={clearQueue}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-2xl 
                font-medium shadow-sm hover:bg-red-600 transition-all duration-300"
              >
                <RefreshCw size={18} />
                {language === 'ro' ? 'Resetează' : 'Reset'}
              </motion.button>
            )}

            {processingQueue.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleProcessing}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-medium shadow-sm transition-all duration-300 ${
                  isProcessingPaused 
                    ? 'bg-green-500 text-white hover:bg-green-600' 
                    : 'bg-yellow-500 text-white hover:bg-yellow-600'
                }`}
              >
                {isProcessingPaused ? <Play size={18} /> : <Pause size={18} />}
                {isProcessingPaused 
                  ? (language === 'ro' ? 'Continuă' : 'Resume')
                  : (language === 'ro' ? 'Pauză' : 'Pause')
                }
              </motion.button>
            )}

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setDropzoneVisible(!dropzoneVisible)}
              className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-[var(--primary)] to-blue-500 
              text-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold"
            >
              {dropzoneVisible ? <X size={20} /> : <Plus size={20} />}
              {dropzoneVisible 
                ? (language==='ro' ? 'Închide' : 'Close')
                : (language==='ro' ? 'Încarcă Fișiere' : 'Upload Files')
              }
            </motion.button>
          </div>
        </div>

        {documents.length > 0 && (
          <div className="mt-6 grid grid-cols-4 gap-4">
            {processingPhases.map((phase, index) => {
              const isCurrentPhase = index === currentPhase;
              const isCompletedPhase = index < currentPhase;
              const docsInPhase = documents.filter(doc => {
                const status = documentStates[doc.name];
                return status && phase.filter(doc, status);
              }).length;
              
              return (
                <div 
                  key={phase.id}
                  className={`p-4 rounded-xl border ${
                    isCurrentPhase 
                      ? `border-${phase.color}-300 bg-${phase.color}-50` 
                      : isCompletedPhase 
                      ? 'border-green-300 bg-green-50' 
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-1 rounded-lg ${
                      isCurrentPhase 
                        ? `bg-${phase.color}-500 text-white` 
                        : isCompletedPhase 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-400 text-white'
                    }`}>
                      {phase.icon}
                    </div>
                    <span className="font-medium text-sm">{phase.name}</span>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{phase.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {docsInPhase} {language === 'ro' ? 'documente' : 'documents'}
                    </span>
                    {isCurrentPhase && (
                      <span className="text-xs font-medium text-blue-600">
                        {language === 'ro' ? 'Activ' : 'Active'}
                      </span>
                    )}
                    {isCompletedPhase && (
                      <CheckCircle size={12} className="text-green-500" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {processingQueue.length > 0 && (
          <div className={`mt-4 p-4 rounded-2xl border ${queueErrors > 3 ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock size={20} className={queueErrors > 3 ? 'text-red-600' : 'text-blue-600'} />
                <span className={`font-medium ${queueErrors > 3 ? 'text-red-800' : 'text-blue-800'}`}>
                  {language === 'ro' 
                    ? `${processingQueue.length} documente în coadă pentru faza ${currentPhase + 1} (${processingPhases[currentPhase]?.name})`
                    : `${processingQueue.length} documents queued for phase ${currentPhase + 1} (${processingPhases[currentPhase]?.name})`
                  }
                  {queueErrors > 0 && (
                    <span className="ml-2 text-red-600">
                      ({queueErrors} {language === 'ro' ? 'erori' : 'errors'})
                    </span>
                  )}
                </span>
              </div>
              {currentlyProcessing && (
                <span className={`text-sm ${queueErrors > 3 ? 'text-red-600' : 'text-blue-600'}`}>
                  {language === 'ro' ? 'Se procesează: ' : 'Processing: '}
                  {handleTooLongString(currentlyProcessing)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {dropzoneVisible && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-8"
          >
            <div className="bg-gradient-to-br from-[var(--primary)]/5 to-blue-500/5 rounded-3xl p-6 border-2 border-dashed border-[var(--primary)]/30">
              <div className="bg-[var(--foreground)] rounded-2xl p-8 border border-[var(--text4)]">
                <MyDropzone setDocuments={setDocuments} documents={documents} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!dropzoneVisible && documents.length === 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20"
        >
          <div className="max-w-md mx-auto">
            <img src={computer} className="w-full h-auto mb-8 opacity-80" alt="Upload files" />
            <h3 className="text-2xl font-bold text-[var(--text1)] mb-4">
              {language === 'ro' ? 'Niciun fișier încărcat' : 'No files uploaded'}
            </h3>
            <p className="text-[var(--text2)] mb-6">
              {language === 'ro' 
                ? 'Documentele vor fi procesate inteligent în fazele: Categorizare → Facturi Primite → Facturi Emise → Alte Documente' 
                : 'Documents will be processed intelligently in phases: Categorization → Incoming Invoices → Outgoing Invoices → Other Documents'
              }
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setDropzoneVisible(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--primary)] to-blue-500 
              text-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold"
            >
              <Upload size={20} />
              {language === 'ro' ? 'Începe să încarci' : 'Start uploading'}
            </motion.button>
          </div>
        </motion.div>
      )}

      {documents && documents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--foreground)] rounded-3xl border border-[var(--text4)] shadow-lg overflow-hidden"
        >
          <div className="p-6 border-b border-[var(--text4)] bg-gradient-to-r from-[var(--background)] to-[var(--foreground)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-[var(--text1)]">
                  {language === 'ro' ? 'Fișierele Tale' : 'Your Files'}
                </h2>
                <span className="bg-[var(--primary)]/20 text-[var(--primary)] px-3 py-1 rounded-full text-sm font-semibold">
                  {documents.length} {language==='ro'?'fișiere':'files'}
                </span>
                {stats.processed > 0 && (
                  <span className="bg-green-500/20 text-green-600 px-3 py-1 rounded-full text-sm font-semibold">
                    {stats.processed} {language==='ro'?'procesate':'processed'}
                  </span>
                )}
              </div>
              
              {(processingQueue.length > 0 || queueErrors > 0) && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={clearQueue}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-2xl 
                  font-medium shadow-sm hover:bg-gray-600 transition-all duration-300"
                >
                  <RefreshCw size={16} />
                  {language === 'ro' ? 'Resetează' : 'Reset'}
                </motion.button>
              )}
            </div>
            <p className="text-[var(--text2)] mt-2">
              {language === 'ro' 
                ? `Procesare inteligentă în fazele: Faza ${currentPhase + 1}/${processingPhases.length} - ${processingPhases[currentPhase]?.name}` 
                : `Smart phased processing: Phase ${currentPhase + 1}/${processingPhases.length} - ${processingPhases[currentPhase]?.name}`
              }
            </p>
          </div>

          <div className="p-6">
            <div className="space-y-3">
              {documents.map((doc, index: number) => (
                <motion.div
                  key={doc.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-[var(--background)] rounded-2xl px-4 py-0 mb-1 
                  border border-[var(--text4)] hover:border-[var(--primary)]/50 transition-all duration-200"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-[var(--primary)]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FileText size={24} className="text-[var(--primary)]" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[var(--text1)] text-lg truncate text-left" title={doc.name}>
                          {handleTooLongString(doc.name)}
                        </h3>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-[var(--text2)] font-medium">
                            {language === 'ro'
                              ? docType[String(documentStates[doc.name]?.data?.result?.document_type || documentStates[doc.name]?.category) as keyof typeof docType] || documentStates[doc.name]?.category || 'Tip necunoscut'
                              : documentStates[doc.name]?.data?.result?.document_type || documentStates[doc.name]?.category || 'Unknown type'
                            }
                          </span>
                          <span className="text-[var(--text3)] text-sm">
                            {documentStates[doc.name]?.data?.result?.document_date || documentStates[doc.name]?.data?.result?.statement_period_start || '-'}
                          </span>
                          {documentStates[doc.name]?.error && (
                            <span className="text-red-500 text-xs truncate max-w-48" title={documentStates[doc.name]?.error}>
                              {documentStates[doc.name]?.error}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium border ${getStatusColor(doc)}`}>
                        {getStatusIcon(doc)}
                        {getStatusText(doc)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {renderActionButtons(doc)}

                      <TooltipDemo
                        trigger={
                          <button
                            onClick={() => handleDeleteDocument(doc.name)}
                            className="p-2 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
                            disabled={currentlyProcessing === doc.name}
                          >
                            <Trash size={18} />
                          </button>
                        }
                        tip={language==='ro'?'Șterge':'Delete'}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {showDuplicateAlerts && (
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
              className="bg-[var(--foreground)] rounded-3xl border border-[var(--text4)] shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
            >
              <div className="p-6 overflow-y-auto max-h-[80vh]">
                <DuplicateAlertsComponent 
                  clientCompanyEin={clientCompanyEin}
                  onClose={() => setShowDuplicateAlerts(false)}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Suspense fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-[var(--foreground)] rounded-3xl p-8 shadow-2xl">
            <LoadingComponent />
          </div>
        </div>
      }>
        <ExtractedDataEdit
          isLoading={false}
          editFile={editFile}
          setEditFile={setEditFile}
          setIsModalOpen={setIsModalOpen}
          isOpen={isModalOpen}
          currentFile={currentProcessingFile}
          setCurrentProcessingFile={setCurrentProcessingFile}
          onDocumentSaved={handleDocumentSaved}
        />
      </Suspense>

      {clientCompanyName===''&&(<InitialClientCompanyModalSelect/>)}
    </div>
  );
};

export default FileUploadPage;
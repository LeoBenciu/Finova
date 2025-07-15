import { useSelector } from "react-redux";
import MyDropzone from "@/components/Dropzone";
import { lazy, Suspense, useState, useCallback, useEffect, useRef } from "react";
import { useExtractDataMutation, useGetDuplicateAlertsQuery } from "@/redux/slices/apiSlice";
import { Plus, Trash, Upload, FileText, Eye, X, CheckCircle, Clock, AlertCircle, RotateCcw, Edit, Pause, Play, LoaderCircle, AlertTriangle, Shield } from "lucide-react";
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

type DocumentState = 'uploaded' | 'queued' | 'processing' | 'processed' | 'saved' | 'error';

interface DocumentStatus {
  state: DocumentState;
  data?: any;
  error?: string;
  position?: number;
}

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

  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  useEffect(()=>{
    console.log('Documents', documents)
    console.log('Document States', documentStates)
    console.log('Processing Queue', processingQueue)
  },[documents, documentStates, processingQueue])
  
  const clientCompanyName = useSelector((state:clientCompany)=>state.clientCompany.current.name)
  const clientCompanyEin = useSelector((state:clientCompany)=>state.clientCompany.current.ein)
  const language = useSelector((state: {user:{language:string}}) => state.user.language);
  const [process] = useExtractDataMutation();

  const { data: duplicateAlerts = [] } = useGetDuplicateAlertsQuery(
    { company: clientCompanyEin },
    { skip: !clientCompanyEin }
  );

  useEffect(() => {
    const newDocuments = documents.filter(doc => !documentStates[doc.name]);
    
    if (newDocuments.length > 0) {
      const newStates: Record<string, DocumentStatus> = {};
      const newQueueItems: string[] = [];
      
      newDocuments.forEach((doc, index) => {
        newStates[doc.name] = { 
          state: 'queued',
          position: processingQueue.length + index + 1
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
  }, [processingQueue, isProcessingPaused]);

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
      return;
    }

    setCurrentlyProcessing(nextDocumentName);
    
    setDocumentStates(prev => ({
      ...prev,
      [nextDocumentName]: { state: 'processing' }
    }));

    try {
      console.log(`Processing document: ${nextDocumentName}`);
      const processedFile = await process({ file: document, clientCompanyEin }).unwrap();
      
      setDocumentStates(prev => ({
        ...prev,
        [nextDocumentName]: { 
          state: 'processed', 
          data: processedFile 
        }
      }));
      
      console.log(`Successfully processed: ${nextDocumentName}`);
      
    } catch (error) {
      console.error(`Failed to process ${nextDocumentName}:`, error);
      
      setDocumentStates(prev => ({
        ...prev,
        [nextDocumentName]: { 
          state: 'error', 
          error: error instanceof Error ? error.message : 'Processing failed'
        }
      }));
    } finally {
      setProcessingQueue(prev => {
        const newQueue = prev.slice(1);
        setDocumentStates(prevStates => {
          const updated = { ...prevStates };
          newQueue.forEach((name, index) => {
            if (updated[name]) {
              updated[name] = {
                ...updated[name],
                position: index + 1
              };
            }
          });
          return updated;
        });
        return newQueue;
      });
      
      setCurrentlyProcessing(null);
      isProcessingRef.current = false;
      
      if (processingQueue.length > 1) { 
        processingTimeoutRef.current = setTimeout(() => {
          if (!isProcessingPaused) {
            processNextInQueue();
          }
        }, 2000);
      }
    }
  }, [processingQueue, documents, process, clientCompanyEin, isProcessingPaused]);

  const toggleProcessing = useCallback(() => {
    setIsProcessingPaused(prev => {
      const newPaused = !prev;
      if (!newPaused && processingQueue.length > 0 && !isProcessingRef.current) {
        setTimeout(processNextInQueue, 100);
      }
      return newPaused;
    });
  }, [processingQueue.length, processNextInQueue]);

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
    setProcessingQueue(prev => {
      const filtered = prev.filter(name => name !== file.name);
      return [...filtered, file.name];
    });
    
    setDocumentStates(prev => ({
      ...prev,
      [file.name]: { 
        state: 'queued',
        position: processingQueue.length + 1
      }
    }));
  }, [processingQueue.length]);

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
    
    const hasDuplicateAlert = data?.result?.duplicate_detection?.is_duplicate;
    const hasComplianceIssue = data?.result?.compliance_validation?.compliance_status === 'NON_COMPLIANT' ||
                              data?.result?.compliance_validation?.compliance_status === 'WARNING';
    
    const baseIcon = (() => {
      switch (state) {
        case 'queued':
          return <Clock size={16} className="text-blue-400" />;
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
          return <AlertCircle size={16} className="text-red-500" />;
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
    
    // Check for priority alerts
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
        return language === 'ro' ? `În coadă: ${position}` : `Queued: ${position}`;
      case 'processing':
        return language === 'ro' ? 'Se procesează...' : 'Processing...';
      case 'processed':
        return language === 'ro' ? 'Procesat' : 'Processed';
      case 'saved':
        return language === 'ro' ? 'Salvat' : 'Saved';
      case 'error':
        return language === 'ro' ? 'Eroare' : 'Error';
      default:
        return language === 'ro' ? 'Încărcat' : 'Uploaded';
    }
  };

  const renderActionButtons = (doc: File) => {
    const state = documentStates[doc.name]?.state;

    switch (state) {
      case 'queued':
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

  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen p-8">
      {/* Header Section */}
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
                  ? 'Încarcă și procesează documentele tale financiare secvențial' 
                  : 'Upload and process your financial documents sequentially'
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Alert Buttons */}
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

            {/* Processing Controls */}
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

        {/* Queue Status */}
        {processingQueue.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock size={20} className="text-blue-600" />
                <span className="font-medium text-blue-800">
                  {language === 'ro' 
                    ? `${processingQueue.length} documente în coadă de procesare`
                    : `${processingQueue.length} documents in processing queue`
                  }
                </span>
              </div>
              {currentlyProcessing && (
                <span className="text-blue-600 text-sm">
                  {language === 'ro' ? 'Se procesează: ' : 'Processing: '}
                  {handleTooLongString(currentlyProcessing)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Upload Zone */}
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

      {/* Empty State */}
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
                ? 'Documentele vor fi procesate secvențial pentru a evita supraîncărcarea memoriei' 
                : 'Documents will be processed sequentially to prevent memory overload'
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

      {/* Files List */}
      {documents && documents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--foreground)] rounded-3xl border border-[var(--text4)] shadow-lg overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-[var(--text4)] bg-gradient-to-r from-[var(--background)] to-[var(--foreground)]">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-[var(--text1)]">
                {language === 'ro' ? 'Fișierele Tale' : 'Your Files'}
              </h2>
              <span className="bg-[var(--primary)]/20 text-[var(--primary)] px-3 py-1 rounded-full text-sm font-semibold">
                {documents.length} {language==='ro'?'fișiere':'files'} {processingQueue.length>0? `- ${processingQueue.length} ${language==='ro'?'în coadă':'queued'}`: '' }
              </span>
            </div>
            <p className="text-[var(--text2)] mt-2">
              {language === 'ro' ? 'Documentele se procesează unul câte unul pentru optimizarea memoriei' : 'Documents are processed one by one for memory optimization'}
            </p>
          </div>

          {/* Files Grid */}
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
                    {/* File Icon & Info */}
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
                              ? docType[String(documentStates[doc.name]?.data?.result?.document_type) as keyof typeof docType] || 'Tip necunoscut'
                              : documentStates[doc.name]?.data?.result?.document_type || 'Unknown type'
                            }
                          </span>
                          <span className="text-[var(--text3)] text-sm">
                            {documentStates[doc.name]?.data?.result?.document_date || documentStates[doc.name]?.data?.result?.statement_period_start || '-'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium border ${getStatusColor(doc)}`}>
                        {getStatusIcon(doc)}
                        {getStatusText(doc)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {/* Action Buttons */}
                      {renderActionButtons(doc)}

                      {/* Delete Button */}
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

      {/* Alert Modals */}
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

      {/* Modal */}
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
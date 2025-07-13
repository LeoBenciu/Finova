import { useSelector } from "react-redux";
import MyDropzone from "@/components/Dropzone";
import { lazy, Suspense, useState, useCallback, useEffect } from "react";
import { useExtractDataMutation } from "@/redux/slices/apiSlice";
import { Plus, Trash, Upload, FileText, Eye, X, CheckCircle, Clock, AlertCircle, RotateCcw, Edit } from "lucide-react";
import { TooltipDemo } from '../Components/Tooltip';
import LoadingComponent from "../Components/LoadingComponent";
import InitialClientCompanyModalSelect from '@/app/Components/InitialClientCompanyModalSelect';
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

type DocumentState = 'uploaded' | 'processing' | 'processed' | 'saved' | 'error';

interface DocumentStatus {
  state: DocumentState;
  data?: any;
  error?: string;
}

const FileUploadPage = () => {
  // State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [documents, setDocuments] = useState<File[]>([]);
  const [documentStates, setDocumentStates] = useState<Record<string, DocumentStatus>>({});
  const [editFile, setEditFile] = useState<{ result: Record<string, any> } | undefined>(undefined);
  const [currentProcessingFile, setCurrentProcessingFile] = useState<File | null>(null);
  const [dropzoneVisible, setDropzoneVisible] = useState<boolean>(false);

  useEffect(()=>{
    console.log('Documents', documents)
    console.log('Document States', documentStates)
  },[documents, documentStates])
  
  const clientCompanyName = useSelector((state:clientCompany)=>state.clientCompany.current.name)
  const clientCompanyEin = useSelector((state:clientCompany)=>state.clientCompany.current.ein)
  const language = useSelector((state: {user:{language:string}}) => state.user.language);
  const [process] = useExtractDataMutation();

  useEffect(() => {
    const newDocuments = documents.filter(doc => !documentStates[doc.name]);
    
    if (newDocuments.length > 0) {
      const newStates: Record<string, DocumentStatus> = {};
      newDocuments.forEach(doc => {
        newStates[doc.name] = { state: 'uploaded' };
      });
      
      setDocumentStates(prev => ({ ...prev, ...newStates }));
      
      newDocuments.forEach(doc => {
        processDocument(doc);
      });
    }
  }, [documents, clientCompanyEin]);

  const processDocument = useCallback(async (file: File) => {
    setDocumentStates(prev => ({
      ...prev,
      [file.name]: { state: 'processing' }
    }));

    try {
      const processedFile = await process({ file, clientCompanyEin }).unwrap();
      console.log("PROCESSED FILE:", processedFile);
      
      setDocumentStates(prev => ({
        ...prev,
        [file.name]: { 
          state: 'processed', 
          data: processedFile 
        }
      }));
    } catch (error) {
      console.error('Failed to process the document:', error);
      
      setDocumentStates(prev => ({
        ...prev,
        [file.name]: { 
          state: 'error', 
          error: error instanceof Error ? error.message : 'Processing failed'
        }
      }));
    }
  }, [process, clientCompanyEin]);

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
    processDocument(file);
  }, [processDocument]);

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
    
    if (documentStates[name]) {
      const newDocumentStates = { ...documentStates };
      delete newDocumentStates[name];
      setDocumentStates(newDocumentStates);
    }
  }, [documentStates]);

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
    switch (state) {
      case 'processing':
        return <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Clock size={16} className="text-blue-500" />
        </motion.div>;
      case 'processed':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'saved':
        return <CheckCircle size={16} className="text-emerald-600" />;
      case 'error':
        return <AlertCircle size={16} className="text-red-500" />;
      default:
        return <Clock size={16} className="text-gray-400" />;
    }
  };

  const getStatusColor = (doc: File) => {
    const state = documentStates[doc.name]?.state;
    switch (state) {
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

  const getStatusText = (doc: File) => {
    const state = documentStates[doc.name]?.state;
    switch (state) {
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
      case 'processing':
        return (
          <div className="flex items-center gap-2">
            <div className="p-2 text-blue-500 bg-blue-500/20 rounded-lg">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Clock size={18} />
              </motion.div>
            </div>
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
                  ? 'Încarcă și procesează documentele tale financiare' 
                  : 'Upload and process your financial documents'
                }
              </p>
            </div>
          </div>

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
                ? 'Începe prin a încărca documentele tale financiare pentru procesare automată' 
                : 'Start by uploading your financial documents for automatic processing'
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
                {documents.length} {language==='ro'?'fișiere':'files'}
              </span>
            </div>
            <p className="text-[var(--text2)] mt-2">
              {language === 'ro' ? 'Documentele se procesează automat după încărcare' : 'Documents are automatically processed after upload'}
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
                            {documentStates[doc.name]?.data?.result?.document_type || (language === 'ro' ? 'Tip necunoscut' : 'Unknown type')}
                          </span>
                          <span className="text-[var(--text3)] text-sm">
                            {documentStates[doc.name]?.data?.result?.document_date || '-'}
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
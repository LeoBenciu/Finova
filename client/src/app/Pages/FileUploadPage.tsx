import { useSelector } from "react-redux";
import MyDropzone from "@/components/Dropzone";
import { lazy, Suspense, useState, useCallback, useEffect } from "react";
import { useExtractDataMutation } from "@/redux/slices/apiSlice";
import { Cpu, Plus, Trash, Upload, FileText, Eye, X, CheckCircle, Clock, AlertCircle } from "lucide-react";
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

const FileUploadPage = () => {
  // State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [documents, setDocuments] = useState<File[]>([]);
  const [processedFiles, setProcessedFiles] = useState<Record<string, any>>({});
  const [editFile, setEditFile] = useState<{ result: Record<string, any> } | undefined>(undefined);
  const [currentProcessingFile, setCurrentProcessingFile] = useState<File | null>(null);
  const [dropzoneVisible, setDropzoneVisible] = useState<boolean>(false);

  useEffect(()=>{
    console.log('Documents', documents)
  },[documents])
  
  const clientCompanyName = useSelector((state:clientCompany)=>state.clientCompany.current.name)
  const clientCompanyEin = useSelector((state:clientCompany)=>state.clientCompany.current.ein)
  const language = useSelector((state: {user:{language:string}}) => state.user.language);
  const [process, {isLoading}] = useExtractDataMutation();

  const handleTooLongString = useCallback((str: string): string => {
    if (str.length > 25) return str.slice(0, 25) + '..';
    return str;
  }, []);

  const handleProcessFile = useCallback(async (file: File) => {
    setCurrentProcessingFile(file);
    
    try {
      setIsModalOpen(true);
      
      if (processedFiles[file.name]) {
        setEditFile(processedFiles[file.name]);
        return;
      }
      
      const processedFile = await process({file,clientCompanyEin}).unwrap();
      console.log("PROCESSED FILE:", processedFile);
      setEditFile(processedFile);
      
      setProcessedFiles(prev => ({
        ...prev,
        [file.name]: processedFile
      }));
    } catch (e) {
      console.error('Failed to process the document:', e);
    } 
  }, [process, processedFiles]);

  const handleDeleteDocument = useCallback((name: string): void => {
    setDocuments(prev => prev.filter(document => document.name !== name));
    
    if (processedFiles[name]) {
      const newProcessedFiles = { ...processedFiles };
      delete newProcessedFiles[name];
      setProcessedFiles(newProcessedFiles);
    }
  }, [processedFiles]);

  const getStatusIcon = (doc: any) => {
    if (processedFiles[doc.name]?.saved) {
      return <CheckCircle size={16} className="text-green-500" />;
    } else if (processedFiles[doc.name]) {
      return <AlertCircle size={16} className="text-yellow-500" />;
    } else {
      return <Clock size={16} className="text-gray-400" />;
    }
  };

  const getStatusColor = (doc: any) => {
    if (processedFiles[doc.name]?.saved) {
      return 'text-green-600 bg-green-50 border-green-200';
    } else if (processedFiles[doc.name]) {
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    } else {
      return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusText = (doc: any) => {
    if (processedFiles[doc.name]?.saved) {
      return language === 'ro' ? 'Salvat' : 'Saved';
    } else if (processedFiles[doc.name]) {
      return language === 'ro' ? 'Procesat' : 'Processed';
    } else {
      return language === 'ro' ? 'Încărcat' : 'Uploaded';
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
              {language === 'ro' ? 'Aici poți vedea fișierele încărcate și statusul lor' : 'Here you can see your uploaded files and their status'}
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
                            {processedFiles[doc.name]?.result.document_type || (language === 'ro' ? 'Tip necunoscut' : 'Unknown type')}
                          </span>
                          <span className="text-[var(--text3)] text-sm">
                            {processedFiles[doc.name]?.result.document_date || '-'}
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
                      {/* View/Process Button */}
                      {processedFiles[doc.name] ? (
                        <TooltipDemo
                          trigger={
                            <button
                              onClick={() => handleProcessFile(doc)}
                              className="p-2 text-emerald-500 bg-emerald-500/20 hover:text-white
                               hover:bg-emerald-500 rounded-lg transition-colors"
                            >
                              <Eye size={18} />
                            </button>
                          }
                          tip={language==='ro'?'Vezi date':'View data'}
                        />
                      ) : (
                        <TooltipDemo
                          trigger={
                            <button
                              onClick={() => handleProcessFile(doc)}
                              className={`p-2 rounded-lg transition-colors ${
                                currentProcessingFile?.name === doc.name && isLoading
                                  ? 'text-[var(--primary)] bg-[var(--primary)]/20 hover:bg-[var(--primary)] hover:text-white animate-pulse'
                                  : 'text-[var(--primary)] bg-[var(--primary)]/20 hover:bg-[var(--primary)] hover:text-white'
                              }`}
                              disabled={currentProcessingFile?.name === doc.name && isLoading}
                            >
                              <Cpu size={18} />
                            </button>
                          }
                          tip={language==='ro'?'Procesează':'Process'}
                        />
                      )}

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
          isLoading={isLoading && isModalOpen}
          editFile={editFile}
          setEditFile={setEditFile}
          setIsModalOpen={setIsModalOpen}
          isOpen={isModalOpen}
          currentFile={currentProcessingFile}
          setCurrentProcessingFile={setCurrentProcessingFile}
          processedFiles={processedFiles}
          setProcessedFiles={setProcessedFiles}
        />
      </Suspense>

      {clientCompanyName===''&&(<InitialClientCompanyModalSelect/>)}
    </div>
  );
};

export default FileUploadPage;
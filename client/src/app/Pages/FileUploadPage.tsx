import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { useSelector } from "react-redux";
import MyDropzone from "@/components/Dropzone";
import { useProcessBatchMutation, useGetDuplicateAlertsQuery } from "@/redux/slices/apiSlice";
import { 
    Plus, Trash, Upload, FileText, Eye, X, CheckCircle, Clock, 
    AlertCircle, LoaderCircle, AlertTriangle, 
    Shield, Package 
} from "lucide-react";
import { TooltipDemo } from '../Components/Tooltip';
import LoadingComponent from "../Components/LoadingComponent";
import InitialClientCompanyModalSelect from '@/app/Components/InitialClientCompanyModalSelect';
import DuplicateAlertsComponent from '../Components/DuplicateAlertsComponent';
import computer from '@/assets/undraw_computer-files_7dj6.svg';
import { motion, AnimatePresence } from "framer-motion";

const ExtractedDataEdit = lazy(() => import('../Components/EditExtractedData/EditExtractedDataComponent'));

type BatchPhase = 'idle' | 'uploading' | 'categorizing' | 'processing_incoming' | 'processing_outgoing' | 'processing_others' | 'complete' | 'error';

interface BatchProcessingStatus {
    phase: BatchPhase;
    progress: {
        current: number;
        total: number;
        percentage: number;
    };
    stats?: {
        total: number;
        categorized: number;
        incomingProcessed: number;
        outgoingProcessed: number;
        othersProcessed: number;
        errors: number;
    };
    error?: string;
}

interface DocumentResult {
    file: File;
    index: number;
    result?: any;
    error?: string;
    documentType?: string;
    direction?: string;
    saved?: boolean;
}

const FileUploadPageBatch = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [documents, setDocuments] = useState<File[]>([]);
    const [dropzoneVisible, setDropzoneVisible] = useState(false);
    const [showDuplicateAlerts, setShowDuplicateAlerts] = useState(false);
    const [editFile, setEditFile] = useState<{ result: Record<string, any> } | undefined>(undefined);
    const [currentProcessingFile, setCurrentProcessingFile] = useState<File | null>(null);
    
    const [batchStatus, setBatchStatus] = useState<BatchProcessingStatus>({
        phase: 'idle',
        progress: { current: 0, total: 0, percentage: 0 }
    });
    const [documentResults, setDocumentResults] = useState<DocumentResult[]>([]);
    
    const clientCompanyName = useSelector((state: any) => state.clientCompany.current.name);
    const clientCompanyEin = useSelector((state: any) => state.clientCompany.current.ein);
    const language = useSelector((state: any) => state.user.language);
    
    const [processBatch, { isLoading: isProcessing }] = useProcessBatchMutation();
    const { data: duplicateAlerts = [] } = useGetDuplicateAlertsQuery(
        { company: clientCompanyEin },
        { skip: !clientCompanyEin }
    );

    useEffect(() => {
        if (documents.length > 0 && documentResults.length === 0) {
            setDocumentResults(
                documents.map((file, index) => ({
                    file,
                    index,
                    saved: false
                }))
            );
        }
    }, [documents, documentResults.length]);

    const handleBatchProcess = useCallback(async () => {
        if (documents.length === 0 || !clientCompanyEin) return;

        setBatchStatus({
            phase: 'uploading',
            progress: { current: 0, total: documents.length, percentage: 0 }
        });

        try {
            const response = await processBatch({
                files: documents,
                clientCompanyEin
            }).unwrap();

            setBatchStatus({
                phase: 'categorizing',
                progress: { 
                    current: response.categorizedResults.length, 
                    total: documents.length, 
                    percentage: (response.categorizedResults.length / documents.length) * 100 
                },
                stats: response.processingStats
            });

            const updatedResults: DocumentResult[] = documents.map((file, fileIndex) => {
                const catResult = response.categorizedResults.find((r: { index: number }) => r.index === fileIndex);
                const incomingResult = response.incomingInvoices.find((r: { index: number }) => r.index === fileIndex);
                const outgoingResult = response.outgoingInvoices.find((r: { index: number }) => r.index === fileIndex);
                const otherResult = response.otherDocuments.find((r: { index: number }) => r.index === fileIndex);

                let finalResult = incomingResult || outgoingResult || otherResult;
                
                return {
                    file,
                    index: fileIndex,
                    documentType: catResult?.documentType,
                    direction: catResult?.direction,
                    result: finalResult?.result,
                    error: finalResult?.error || catResult?.error,
                    saved: false
                };
            });

            setDocumentResults(updatedResults);
            
            setBatchStatus({
                phase: 'complete',
                progress: { 
                    current: documents.length, 
                    total: documents.length, 
                    percentage: 100 
                },
                stats: response.processingStats
            });

        } catch (error: any) {
            console.error('Batch processing failed:', error);
            setBatchStatus({
                phase: 'error',
                progress: { current: 0, total: documents.length, percentage: 0 },
                error: error.message || 'Batch processing failed'
            });
        }
    }, [documents, clientCompanyEin, processBatch]);

    const handleDeleteDocument = useCallback((index: number) => {
        setDocuments(prev => prev.filter((_, i) => i !== index));
        setDocumentResults(prev => prev.filter((_, i) => i !== index));
        
        if (documents.length <= 1) {
            setBatchStatus({
                phase: 'idle',
                progress: { current: 0, total: 0, percentage: 0 }
            });
        }
    }, [documents.length]);

    const handleReviewDocument = useCallback((result: DocumentResult) => {
        if (result.result) {
            setEditFile({ result: result.result });
            setCurrentProcessingFile(result.file);
            setIsModalOpen(true);
        }
    }, []);

    const handleDocumentSaved = useCallback((fileName: string) => {
        setDocumentResults(prev => 
            prev.map(doc => 
                doc.file.name === fileName 
                    ? { ...doc, saved: true }
                    : doc
            )
        );
    }, []);

    const handleTooLongString = useCallback((str: string): string => {
        if (str.length > 25) return str.slice(0, 25) + '..';
        return str;
    }, []);

    const getPhaseText = () => {
        switch (batchStatus.phase) {
            case 'uploading':
                return language === 'ro' ? 'Se încarcă fișierele...' : 'Uploading files...';
            case 'categorizing':
                return language === 'ro' ? 'Se categorizează documentele...' : 'Categorizing documents...';
            case 'processing_incoming':
                return language === 'ro' ? 'Se procesează facturile primite...' : 'Processing incoming invoices...';
            case 'processing_outgoing':
                return language === 'ro' ? 'Se procesează facturile emise...' : 'Processing outgoing invoices...';
            case 'processing_others':
                return language === 'ro' ? 'Se procesează alte documente...' : 'Processing other documents...';
            case 'complete':
                return language === 'ro' ? 'Procesare completă!' : 'Processing complete!';
            case 'error':
                return language === 'ro' ? 'Eroare la procesare' : 'Processing error';
            default:
                return '';
        }
    };

    const getDocumentStatus = (doc: DocumentResult) => {
        if (doc.saved) {
            return { 
                icon: <CheckCircle size={16} className="text-emerald-500" />, 
                text: language === 'ro' ? 'Salvat' : 'Saved',
                color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
            };
        }
        
        if (doc.error) {
            return { 
                icon: <AlertCircle size={16} className="text-red-500" />, 
                text: language === 'ro' ? 'Eroare' : 'Error',
                color: 'text-red-600 bg-red-50 border-red-200'
            };
        }
        
        if (doc.result) {
            const hasDuplicate = doc.result.duplicate_detection?.is_duplicate;
            const hasCompliance = doc.result.compliance_validation?.compliance_status === 'NON_COMPLIANT';
            
            if (hasCompliance) {
                return { 
                    icon: <Shield size={16} className="text-red-500" />, 
                    text: language === 'ro' ? 'Neconform' : 'Non-Compliant',
                    color: 'text-red-600 bg-red-50 border-red-200'
                };
            }
            
            if (hasDuplicate) {
                return { 
                    icon: <AlertTriangle size={16} className="text-orange-500" />, 
                    text: language === 'ro' ? 'Posibil Duplicat' : 'Possible Duplicate',
                    color: 'text-orange-600 bg-orange-50 border-orange-200'
                };
            }
            
            return { 
                icon: <CheckCircle size={16} className="text-green-500" />, 
                text: language === 'ro' ? 'Procesat' : 'Processed',
                color: 'text-green-600 bg-green-50 border-green-200'
            };
        }
        
        return { 
            icon: <Clock size={16} className="text-gray-400" />, 
            text: language === 'ro' ? 'În așteptare' : 'Pending',
            color: 'text-gray-600 bg-gray-50 border-gray-200'
        };
    };

    const docType = {
        "Invoice": "Factura",
        "Receipt": "Chitanta",
        "Bank Statement": "Extras De Cont",
        "Contract": "Contract",
        "Z Report": "Raport Z",
        "Payment Order": "Dispozitie De Plata",
        "Collection Order": "Dispozitie De Incasare"
    };

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
                                {language === 'ro' ? 'Procesare în Lot' : 'Batch Processing'}
                            </h1>
                            <p className="text-[var(--text2)] text-lg text-left">
                                {language === 'ro' 
                                    ? 'Încarcă și procesează mai multe documente simultan' 
                                    : 'Upload and process multiple documents at once'
                                }
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
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

                        {documents.length > 0 && batchStatus.phase === 'idle' && (
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleBatchProcess}
                                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 
                                text-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold"
                            >
                                <Package size={20} />
                                {language === 'ro' ? 'Procesează Tot' : 'Process All'}
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
                                ? (language === 'ro' ? 'Închide' : 'Close')
                                : (language === 'ro' ? 'Încarcă Fișiere' : 'Upload Files')
                            }
                        </motion.button>
                    </div>
                </div>

                {batchStatus.phase !== 'idle' && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`mt-4 p-4 rounded-2xl border ${
                            batchStatus.phase === 'error' 
                                ? 'bg-red-50 border-red-200' 
                                : batchStatus.phase === 'complete'
                                ? 'bg-green-50 border-green-200'
                                : 'bg-blue-50 border-blue-200'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                {isProcessing && (
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    >
                                        <LoaderCircle size={20} className="text-blue-600" />
                                    </motion.div>
                                )}
                                <span className={`font-medium ${
                                    batchStatus.phase === 'error' ? 'text-red-800' : 
                                    batchStatus.phase === 'complete' ? 'text-green-800' : 'text-blue-800'
                                }`}>
                                    {getPhaseText()}
                                </span>
                            </div>
                            {batchStatus.stats && (
                                <div className="text-sm text-gray-600">
                                    {language === 'ro' 
                                        ? `${batchStatus.stats.categorized}/${batchStatus.stats.total} categorized | ${batchStatus.stats.errors} erori`
                                        : `${batchStatus.stats.categorized}/${batchStatus.stats.total} categorized | ${batchStatus.stats.errors} errors`
                                    }
                                </div>
                            )}
                        </div>
                        
                        {batchStatus.phase !== 'error' && batchStatus.progress.total > 0 && (
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${batchStatus.progress.percentage}%` }}
                                    className="bg-blue-600 h-2 rounded-full"
                                    transition={{ duration: 0.5 }}
                                />
                            </div>
                        )}

                        {batchStatus.error && (
                            <p className="text-red-600 text-sm mt-2">{batchStatus.error}</p>
                        )}
                    </motion.div>
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
                                ? 'Încarcă documentele și procesează-le toate odată' 
                                : 'Upload documents and process them all at once'
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

            {documents.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[var(--foreground)] rounded-3xl border border-[var(--text4)] shadow-lg overflow-hidden"
                >
                    <div className="p-6 border-b border-[var(--text4)] bg-gradient-to-r from-[var(--background)] to-[var(--foreground)]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl font-bold text-[var(--text1)]">
                                    {language === 'ro' ? 'Documentele Tale' : 'Your Documents'}
                                </h2>
                                <span className="bg-[var(--primary)]/20 text-[var(--primary)] px-3 py-1 rounded-full text-sm font-semibold">
                                    {documents.length} {language === 'ro' ? 'fișiere' : 'files'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="space-y-3">
                            {documentResults.map((doc) => {
                                const status = getDocumentStatus(doc);
                                return (
                                    <motion.div
                                        key={doc.index}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: doc.index * 0.05 }}
                                        className="bg-[var(--background)] rounded-2xl px-4 py-0 mb-1 
                                        border border-[var(--text4)] hover:border-[var(--primary)]/50 transition-all duration-200"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="w-12 h-12 bg-[var(--primary)]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                                    <FileText size={24} className="text-[var(--primary)]" />
                                                </div>
                                                
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-semibold text-[var(--text1)] text-lg truncate text-left" title={doc.file.name}>
                                                        {handleTooLongString(doc.file.name)}
                                                    </h3>
                                                    <div className="flex items-center gap-4 mt-1">
                                                        <span className="text-[var(--text2)] font-medium">
                                                            {language === 'ro'
                                                                ? docType[doc.documentType as keyof typeof docType] || doc.documentType || 'Necategorizat'
                                                                : doc.documentType || 'Uncategorized'
                                                            }
                                                        </span>
                                                        {doc.direction && (
                                                            <span className="text-[var(--text3)] text-sm">
                                                                {language === 'ro' 
                                                                    ? (doc.direction === 'incoming' ? 'Primită' : 'Emisă')
                                                                    : doc.direction
                                                                }
                                                            </span>
                                                        )}
                                                        {doc.result?.document_date && (
                                                            <span className="text-[var(--text3)] text-sm">
                                                                {doc.result.document_date}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium border ${status.color}`}>
                                                    {status.icon}
                                                    {status.text}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {doc.result && (
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
                                                        tip={doc.saved ? (language === 'ro' ? 'Vezi date' : 'View data') : (language === 'ro' ? 'Revizuiește' : 'Review')}
                                                    />
                                                )}

                                                <TooltipDemo
                                                    trigger={
                                                        <button
                                                            onClick={() => handleDeleteDocument(doc.index)}
                                                            className="p-2 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
                                                            disabled={isProcessing}
                                                        >
                                                            <Trash size={18} />
                                                        </button>
                                                    }
                                                    tip={language === 'ro' ? 'Șterge' : 'Delete'}
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
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

            {clientCompanyName === '' && <InitialClientCompanyModalSelect />}
        </div>
    );
};

export default FileUploadPageBatch;
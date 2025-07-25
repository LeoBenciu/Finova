import  { useState, useCallback, lazy, Suspense } from "react";
import { useSelector } from "react-redux";
import MyDropzone from "@/components/Dropzone";
import { useExtractDataMutation, useGetDuplicateAlertsQuery } from "@/redux/slices/apiSlice";
import { 
    Plus, Trash, Upload, FileText, Eye, X, CheckCircle, Clock, 
    AlertCircle, LoaderCircle, AlertTriangle, Package
} from "lucide-react";
import { TooltipDemo } from '../Components/Tooltip';
import LoadingComponent from "../Components/LoadingComponent";
import InitialClientCompanyModalSelect from '@/app/Components/InitialClientCompanyModalSelect';
import DuplicateAlertsComponent from '../Components/DuplicateAlertsComponent';
import computer from '@/assets/undraw_computer-files_7dj6.svg';
import { motion, AnimatePresence } from "framer-motion";

const ExtractedDataEdit = lazy(() => import('../Components/EditExtractedData/EditExtractedDataComponent'));

type ProcessingPhase = 'idle' | 'categorizing' | 'extracting' | 'complete';
type DocumentState = 'pending' | 'categorizing' | 'categorized' | 'extracting' | 'extracted' | 'error' | 'saved';

interface DocumentInfo {
    file: File;
    state: DocumentState;
    documentType?: string;
    direction?: string;
    categorization?: any;
    extractedData?: any;
    error?: string;
}

const FileUploadPage = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [documents, setDocuments] = useState<DocumentInfo[]>([]);
    const [dropzoneVisible, setDropzoneVisible] = useState(false);
    const [showDuplicateAlerts, setShowDuplicateAlerts] = useState(false);
    const [editFile, setEditFile] = useState<{ result: Record<string, any> } | undefined>(undefined);
    const [currentProcessingFile, setCurrentProcessingFile] = useState<File | null>(null);
    
    const [processingPhase, setProcessingPhase] = useState<ProcessingPhase>('idle');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [shouldStop, setShouldStop] = useState(false);
    
    const clientCompanyName = useSelector((state: any) => state.clientCompany.current.name);
    const clientCompanyEin = useSelector((state: any) => state.clientCompany.current.ein);
    const language = useSelector((state: any) => state.user.language);
    
    const [extractData] = useExtractDataMutation();
    const { data: duplicateAlerts = [] } = useGetDuplicateAlertsQuery(
        { company: clientCompanyEin },
        { skip: !clientCompanyEin }
    );

    // Add files to document list
    const handleFilesAdded = useCallback((newFiles: File[]) => {
        const newDocs: DocumentInfo[] = newFiles.map(file => ({
            file,
            state: 'pending' as DocumentState
        }));
        setDocuments(prev => [...prev, ...newDocs]);
    }, []);

    // Start processing
    const startProcessing = useCallback(async () => {
        if (documents.length === 0 || !clientCompanyEin) return;
        
        setShouldStop(false);
        setProcessingPhase('categorizing');
        setCurrentIndex(0);
        
        // Phase 1: Categorize all documents one by one
        for (let i = 0; i < documents.length; i++) {
            if (shouldStop) break;
            
            setCurrentIndex(i);
            const updatedDocs = [...documents];
            
            try {
                // Update state to categorizing
                updatedDocs[i].state = 'categorizing';
                setDocuments(updatedDocs);
                
                console.log(`Categorizing ${documents[i].file.name}...`);
                
                const result = await extractData({
                    file: documents[i].file,
                    clientCompanyEin,
                    phase: 0
                }).unwrap();
                
                // Update with categorization results
                updatedDocs[i] = {
                    ...updatedDocs[i],
                    state: 'categorized',
                    documentType: result.result.document_type,
                    direction: result.result.direction,
                    categorization: result.result
                };
                
                console.log(`✓ Categorized as ${result.result.document_type} ${result.result.direction || ''}`);
                
            } catch (error: any) {
                console.error(`✗ Failed to categorize ${documents[i].file.name}:`, error);
                updatedDocs[i] = {
                    ...updatedDocs[i],
                    state: 'error',
                    error: error.message || 'Categorization failed'
                };
            }
            
            setDocuments(updatedDocs);
        }
        
        if (shouldStop) {
            setProcessingPhase('idle');
            return;
        }
        
        // Phase 2: Extract data in order
        setProcessingPhase('extracting');
        await extractInOrder();
        
        setProcessingPhase('complete');
        
    }, [documents, clientCompanyEin, extractData, shouldStop]);

    // Extract data in the correct order
    const extractInOrder = useCallback(async () => {
        const categorizedDocs = [...documents];
        
        // Group documents by type
        const incomingInvoices = categorizedDocs
            .map((doc, index) => ({ doc, index }))
            .filter(({ doc }) => 
                doc.state === 'categorized' && 
                doc.documentType?.toLowerCase() === 'invoice' && 
                doc.direction === 'incoming'
            );
            
        const outgoingInvoices = categorizedDocs
            .map((doc, index) => ({ doc, index }))
            .filter(({ doc }) => 
                doc.state === 'categorized' && 
                doc.documentType?.toLowerCase() === 'invoice' && 
                doc.direction === 'outgoing'
            );
            
        const otherDocuments = categorizedDocs
            .map((doc, index) => ({ doc, index }))
            .filter(({ doc }) => 
                doc.state === 'categorized' && 
                (!doc.documentType?.toLowerCase().includes('invoice') || 
                 (doc.documentType?.toLowerCase() === 'invoice' && !doc.direction))
            );
        
        // Process incoming invoices
        for (const { doc, index } of incomingInvoices) {
            if (shouldStop) break;
            
            const updatedDocs = [...documents];
            updatedDocs[index].state = 'extracting';
            setDocuments(updatedDocs);
            setCurrentIndex(index);
            
            try {
                console.log(`Extracting data from incoming invoice ${doc.file.name}...`);
                
                const result = await extractData({
                    file: doc.file,
                    clientCompanyEin,
                    phase: 1
                }).unwrap();
                
                updatedDocs[index] = {
                    ...updatedDocs[index],
                    state: 'extracted',
                    extractedData: result.result
                };
                
                console.log(`✓ Extracted incoming invoice data`);
                
            } catch (error: any) {
                console.error(`✗ Failed to extract incoming invoice:`, error);
                updatedDocs[index].error = error.message || 'Extraction failed';
            }
            
            setDocuments(updatedDocs);
        }
        
        // Process outgoing invoices
        for (const { doc, index } of outgoingInvoices) {
            if (shouldStop) break;
            
            const updatedDocs = [...documents];
            updatedDocs[index].state = 'extracting';
            setDocuments(updatedDocs);
            setCurrentIndex(index);
            
            try {
                console.log(`Extracting data from outgoing invoice ${doc.file.name}...`);
                
                const result = await extractData({
                    file: doc.file,
                    clientCompanyEin,
                    phase: 2
                }).unwrap();
                
                updatedDocs[index] = {
                    ...updatedDocs[index],
                    state: 'extracted',
                    extractedData: result.result
                };
                
                console.log(`✓ Extracted outgoing invoice data`);
                
            } catch (error: any) {
                console.error(`✗ Failed to extract outgoing invoice:`, error);
                updatedDocs[index].error = error.message || 'Extraction failed';
            }
            
            setDocuments(updatedDocs);
        }
        
        // Process other documents
        for (const { doc, index } of otherDocuments) {
            if (shouldStop) break;
            
            const updatedDocs = [...documents];
            updatedDocs[index].state = 'extracting';
            setDocuments(updatedDocs);
            setCurrentIndex(index);
            
            try {
                console.log(`Extracting data from ${doc.documentType} ${doc.file.name}...`);
                
                const result = await extractData({
                    file: doc.file,
                    clientCompanyEin,
                    phase: 3
                }).unwrap();
                
                updatedDocs[index] = {
                    ...updatedDocs[index],
                    state: 'extracted',
                    extractedData: result.result
                };
                
                console.log(`✓ Extracted ${doc.documentType} data`);
                
            } catch (error: any) {
                console.error(`✗ Failed to extract ${doc.documentType}:`, error);
                updatedDocs[index].error = error.message || 'Extraction failed';
            }
            
            setDocuments(updatedDocs);
        }
    }, [documents, clientCompanyEin, extractData, shouldStop]);

    // Stop processing
    const stopProcessing = useCallback(() => {
        setShouldStop(true);
        setProcessingPhase('idle');
    }, []);

    // Delete document
    const handleDeleteDocument = useCallback((index: number) => {
        setDocuments(prev => prev.filter((_, i) => i !== index));
    }, []);

    // Review document
    const handleReviewDocument = useCallback((doc: DocumentInfo) => {
        const result = doc.extractedData || doc.categorization;
        if (result) {
            setEditFile({ result });
            setCurrentProcessingFile(doc.file);
            setIsModalOpen(true);
        }
    }, []);

    // Mark document as saved
    const handleDocumentSaved = useCallback((fileName: string) => {
        setDocuments(prev => 
            prev.map(doc => 
                doc.file.name === fileName 
                    ? { ...doc, state: 'saved' as DocumentState }
                    : doc
            )
        );
    }, []);

    // Get document status display
    const getDocumentStatus = (doc: DocumentInfo) => {
        switch (doc.state) {
            case 'pending':
                return {
                    icon: <Clock size={16} className="text-gray-400" />,
                    text: language === 'ro' ? 'În așteptare' : 'Pending',
                    color: 'text-gray-600 bg-gray-50 border-gray-200'
                };
            case 'categorizing':
                return {
                    icon: <LoaderCircle size={16} className="text-blue-500 animate-spin" />,
                    text: language === 'ro' ? 'Se categorizează...' : 'Categorizing...',
                    color: 'text-blue-600 bg-blue-50 border-blue-200'
                };
            case 'categorized':
                return {
                    icon: <CheckCircle size={16} className="text-blue-500" />,
                    text: language === 'ro' ? 'Categorizat' : 'Categorized',
                    color: 'text-blue-600 bg-blue-50 border-blue-200'
                };
            case 'extracting':
                return {
                    icon: <LoaderCircle size={16} className="text-green-500 animate-spin" />,
                    text: language === 'ro' ? 'Se extrag date...' : 'Extracting data...',
                    color: 'text-green-600 bg-green-50 border-green-200'
                };
            case 'extracted':
                return {
                    icon: <CheckCircle size={16} className="text-green-500" />,
                    text: language === 'ro' ? 'Procesat' : 'Processed',
                    color: 'text-green-600 bg-green-50 border-green-200'
                };
            case 'saved':
                return {
                    icon: <CheckCircle size={16} className="text-emerald-500" />,
                    text: language === 'ro' ? 'Salvat' : 'Saved',
                    color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
                };
            case 'error':
                return {
                    icon: <AlertCircle size={16} className="text-red-500" />,
                    text: language === 'ro' ? 'Eroare' : 'Error',
                    color: 'text-red-600 bg-red-50 border-red-200'
                };
            default:
                return {
                    icon: <Clock size={16} className="text-gray-400" />,
                    text: '',
                    color: 'text-gray-600 bg-gray-50 border-gray-200'
                };
        }
    };

    // Get processing stats
    const getProcessingStats = () => {
        const total = documents.length;
        const categorized = documents.filter(d => 
            ['categorized', 'extracting', 'extracted', 'saved'].includes(d.state)
        ).length;
        const extracted = documents.filter(d => 
            ['extracted', 'saved'].includes(d.state)
        ).length;
        const errors = documents.filter(d => d.state === 'error').length;
        
        return { total, categorized, extracted, errors };
    };

    const stats = getProcessingStats();
    
    const getPhaseText = () => {
        if (processingPhase === 'categorizing') {
            return language === 'ro' 
                ? `Se categorizează documentele... (${currentIndex + 1}/${documents.length})`
                : `Categorizing documents... (${currentIndex + 1}/${documents.length})`;
        } else if (processingPhase === 'extracting') {
            return language === 'ro' 
                ? `Se extrag datele...`
                : `Extracting data...`;
        } else if (processingPhase === 'complete') {
            return language === 'ro' ? 'Procesare completă!' : 'Processing complete!';
        }
        return '';
    };

    const handleTooLongString = useCallback((str: string): string => {
        if (str.length > 25) return str.slice(0, 25) + '..';
        return str;
    }, []);

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
            {/* Header Section */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-20 h-20 bg-gradient-to-br from-[var(--primary)] to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
                            <Upload size={35} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold text-[var(--text1)] mb-2 text-left">
                                {language === 'ro' ? 'Procesare Secvențială' : 'Sequential Processing'}
                            </h1>
                            <p className="text-[var(--text2)] text-lg text-left">
                                {language === 'ro' 
                                    ? 'Categorizează toate documentele, apoi extrage datele în ordine' 
                                    : 'Categorize all documents, then extract data in order'
                                }
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Stats */}
                        {documents.length > 0 && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-2xl">
                                <span className="text-sm text-gray-600">
                                    {language === 'ro' 
                                        ? `${stats.categorized}/${stats.total} categorized | ${stats.extracted} extracted`
                                        : `${stats.categorized}/${stats.total} categorized | ${stats.extracted} extracted`
                                    }
                                </span>
                            </div>
                        )}

                        {/* Duplicate Alerts */}
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

                        {/* Process Button */}
                        {documents.length > 0 && processingPhase === 'idle' && (
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={startProcessing}
                                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 
                                text-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold"
                            >
                                <Package size={20} />
                                {language === 'ro' ? 'Începe Procesarea' : 'Start Processing'}
                            </motion.button>
                        )}

                        {/* Stop Button */}
                        {(processingPhase === 'categorizing' || processingPhase === 'extracting') && (
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={stopProcessing}
                                className="flex items-center gap-2 px-6 py-3 bg-red-500 
                                text-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold"
                            >
                                <X size={20} />
                                {language === 'ro' ? 'Oprește' : 'Stop'}
                            </motion.button>
                        )}

                        {/* Upload Button */}
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setDropzoneVisible(!dropzoneVisible)}
                            disabled={processingPhase !== 'idle'}
                            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-[var(--primary)] to-blue-500 
                            text-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold
                            disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {dropzoneVisible ? <X size={20} /> : <Plus size={20} />}
                            {dropzoneVisible 
                                ? (language === 'ro' ? 'Închide' : 'Close')
                                : (language === 'ro' ? 'Încarcă Fișiere' : 'Upload Files')
                            }
                        </motion.button>
                    </div>
                </div>

                {/* Processing Status */}
                {processingPhase !== 'idle' && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`mt-4 p-4 rounded-2xl border ${
                            processingPhase === 'complete'
                                ? 'bg-green-50 border-green-200'
                                : 'bg-blue-50 border-blue-200'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            {(processingPhase === 'categorizing' || processingPhase === 'extracting') && (
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                >
                                    <LoaderCircle size={20} className="text-blue-600" />
                                </motion.div>
                            )}
                            {processingPhase === 'complete' && (
                                <CheckCircle size={20} className="text-green-600" />
                            )}
                            <span className={`font-medium ${
                                processingPhase === 'complete' ? 'text-green-800' : 'text-blue-800'
                            }`}>
                                {getPhaseText()}
                            </span>
                        </div>
                    </motion.div>
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
                                <MyDropzone 
                                    setDocuments={(files) => handleFilesAdded(files)} 
                                    documents={documents.map(d => d.file)} 
                                />
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
                                ? 'Încarcă documentele pentru procesare secvențială' 
                                : 'Upload documents for sequential processing'
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

            {/* Document List */}
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
                            {documents.map((doc, index) => {
                                const status = getDocumentStatus(doc);
                                const result = doc.extractedData || doc.categorization;
                                
                                return (
                                    <motion.div
                                        key={index}
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
                                                    <h3 className="font-semibold text-[var(--text1)] text-lg truncate text-left" title={doc.file.name}>
                                                        {handleTooLongString(doc.file.name)}
                                                    </h3>
                                                    <div className="flex items-center gap-4 mt-1">
                                                        <span className="text-[var(--text2)] font-medium">
                                                            {doc.documentType && (
                                                                language === 'ro'
                                                                    ? docType[doc.documentType as keyof typeof docType] || doc.documentType
                                                                    : doc.documentType
                                                            )}
                                                        </span>
                                                        {doc.direction && (
                                                            <span className="text-[var(--text3)] text-sm">
                                                                {language === 'ro' 
                                                                    ? (doc.direction === 'incoming' ? 'Primită' : 'Emisă')
                                                                    : doc.direction
                                                                }
                                                            </span>
                                                        )}
                                                        {result?.document_date && (
                                                            <span className="text-[var(--text3)] text-sm">
                                                                {result.document_date}
                                                            </span>
                                                        )}
                                                        {doc.error && (
                                                            <span className="text-red-500 text-sm" title={doc.error}>
                                                                {doc.error}
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
                                                {result && (
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
                                                        tip={doc.state === 'saved' ? (language === 'ro' ? 'Vezi date' : 'View data') : (language === 'ro' ? 'Revizuiește' : 'Review')}
                                                    />
                                                )}

                                                <TooltipDemo
                                                    trigger={
                                                        <button
                                                            onClick={() => handleDeleteDocument(index)}
                                                            className="p-2 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
                                                            disabled={processingPhase !== 'idle'}
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

            {/* Modals */}
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

export default FileUploadPage;
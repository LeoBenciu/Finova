import React, { useState, useEffect } from 'react';
import { useGetFilesQuery, useUpdateDocumentReferencesMutation, useGetSomeFilesMutation } from '@/redux/slices/apiSlice';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Link, FileText, Receipt, CreditCard, FileSignature, 
  BarChart3, Send, Download, Calendar, ExternalLink, RefreshCw, Search, Filter
} from 'lucide-react';
import { useSelector } from 'react-redux';

interface RelatedDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: any;
  onRefresh: () => void;
}

type DocumentType = 'Invoice' | 'Receipt' | 'Bank Statement' | 'Contract' | 'Z Report' | 'Payment Order' | 'Collection Order';

const RelatedDocumentsModal: React.FC<RelatedDocumentsModalProps> = ({
  isOpen,
  onClose,
  document,
  onRefresh
}) => {
  const [manualMode, setManualMode] = useState(false);
  const [selectedReferences, setSelectedReferences] = useState<number[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'success'|'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const clientEin = useSelector((state: any) => state.auth?.user?.clientEin || state.user?.clientEin || null);
  const language = useSelector((state: any) => state.user?.language || state.auth?.user?.language || 'en');

  const docId = document?.id;

  const { data: allDocsData = [], isLoading: allDocsLoading } = useGetFilesQuery(clientEin);
  const [updateReferences, { isLoading: isSaving }] = useUpdateDocumentReferencesMutation();
  const [relatedDocuments, setRelatedDocuments] = useState<any[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<DocumentType | ''>('');
  const [filteredDocs, setFilteredDocs] = useState<any[]>([]);

  const docTypeTranslations = {
    "Invoice": "Factura",
    "Receipt": "Chitanta", 
    "Bank Statement": "Extras De Cont",
    "Contract": "Contract",
    "Z Report": "Raport Z",
    "Payment Order": "Dispozitie De Plata",
    "Collection Order": "Dispozitie De Incasare"
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'Invoice': return FileText;
      case 'Receipt': return Receipt;
      case 'Bank Statement': return CreditCard;
      case 'Contract': return FileSignature;
      case 'Z Report': return BarChart3;
      case 'Payment Order': return Send;
      case 'Collection Order': return Download;
      default: return FileText;
    }
  };

  const getFileIconColor = (fileType: string) => {
    switch (fileType) {
      case 'Invoice': return { text: 'text-blue-500', bg: 'bg-blue-500/10' };
      case 'Receipt': return { text: 'text-orange-500', bg: 'bg-orange-500/10' };
      case 'Bank Statement': return { text: 'text-red-500', bg: 'bg-red-500/10' };
      case 'Contract': return { text: 'text-teal-500', bg: 'bg-teal-500/10' };
      case 'Z Report': return { text: 'text-yellow-500', bg: 'bg-yellow-500/10' };
      case 'Payment Order': return { text: 'text-purple-500', bg: 'bg-purple-500/10' };
      case 'Collection Order': return { text: 'text-green-500', bg: 'bg-green-500/10' };
      default: return { text: 'text-gray-500', bg: 'bg-gray-500/10' };
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      return dateString;
    }
  };

  const getDocumentDate = (file: any): string => {
    try {
      const extractedData = file.processedData?.[0]?.extractedFields?.result;
      
      if (!extractedData) {
        return formatDate(file.createdAt);
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
          documentDate = extractedData.document_date || extractedData.date || extractedData.transaction_date;
          break;
      }

      if (documentDate) {
        const dateStr = String(documentDate);
        if (dateStr.match(/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/)) {
          const parts = dateStr.split(/[\/\-]/);
          return `${parts[0]}-${parts[1]}-${parts[2]}`;
        }
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
          return formatDate(dateStr);
        }
        return dateStr;
      }

      return formatDate(file.createdAt);
    } catch (error) {
      console.error('Error extracting document date:', error);
      return formatDate(file.createdAt);
    }
  };

  const [getSomeFiles, { data: relatedDocsData = [], isLoading: relatedDocsLoading }] = useGetSomeFilesMutation();

  useEffect(() => {
    if (isOpen && document) {
      const refIds: number[] = Array.isArray(document.references) ? document.references : [];
      const ein = clientEin;
      if (refIds.length && ein) {
        getSomeFiles({ docIds: refIds, clientEin: ein });
      } else {
        setRelatedDocuments([]);
        setSelectedReferences([]);
      }
    }
  }, [isOpen, document, clientEin, getSomeFiles]);

  useEffect(() => {
    setRelatedDocuments(relatedDocsData || []);
    setSelectedReferences((relatedDocsData || []).map((doc: any) => doc.id));
    setManualMode(false);
    setSaveStatus('idle');
    setSaveError(null);
  }, [relatedDocsData]);

  useEffect(() => {
    let filtered = relatedDocuments;

    if (searchTerm) {
      filtered = filtered.filter(doc => 
        doc.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedType) {
      filtered = filtered.filter(doc => doc.type === selectedType);
    }

    setFilteredDocs(filtered);
  }, [relatedDocuments, searchTerm, selectedType]);

  const handleTooLongString = (str: string): string => {
    if (!str) return '';
    if (str.length > 30) return str.slice(0, 30) + '...'; 
    return str;
  };

  if (!isOpen) return null;

  const handleToggleReference = (docId: number) => {
    setSelectedReferences((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleSaveReferences = async () => {
    if (!document?.id) return;
    setSaveStatus('saving');
    setSaveError(null);
    try {
      await updateReferences({ docId: document.id, references: selectedReferences }).unwrap();
      setSaveStatus('success');
      onRefresh();
      setManualMode(false);
    } catch (e: any) {
      setSaveStatus('error');
      setSaveError(e?.data?.message || 'Failed to update references');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-[var(--foreground)] rounded-3xl shadow-2xl border border-[var(--text4)] w-full max-w-4xl max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 border-b border-[var(--text4)] bg-gradient-to-r from-[var(--primary)]/10 to-blue-500/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[var(--primary)] rounded-xl flex items-center justify-center">
                  <Link size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[var(--text1)]">
                    {language === 'ro' ? 'Documente Asociate' : 'Related Documents'}
                  </h2>
                  <p className="text-[var(--text2)] text-sm">
                    {language === 'ro' ? 'Pentru' : 'For'}: {handleTooLongString(document?.name || '')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={onRefresh}
                  className="p-2 text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)] hover:text-white rounded-lg transition-colors"
                  disabled={relatedDocsLoading}
                >
                  <RefreshCw size={18} className={relatedDocsLoading ? 'animate-spin' : ''} />
                </button>
                
                <button
                  onClick={onClose}
                  className="p-2 text-red-500 bg-red-200 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 border-b border-[var(--text4)] bg-[var(--background)]">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--text3)]" />
                <input
                  type="text"
                  placeholder={language === 'ro' ? 'Caută documente...' : 'Search documents...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[var(--foreground)] border border-[var(--text4)] rounded-xl text-[var(--text1)] placeholder-[var(--text3)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                />
              </div>
              
              <div className="relative">
                <Filter size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--text3)]" />
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as DocumentType | '')}
                  className="pl-10 pr-8 py-2 bg-[var(--foreground)] border border-[var(--text4)] rounded-xl text-[var(--text1)] focus:outline-none focus:border-[var(--primary)] transition-colors appearance-none cursor-pointer"
                >
                  <option value="">{language === 'ro' ? 'Toate tipurile' : 'All types'}</option>
                  {Object.entries(docTypeTranslations).map(([key, value]) => (
                    <option key={key} value={key}>
                      {language === 'ro' ? value : key}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="p-6 max-h-[60vh] overflow-y-auto">
            <div className="mb-4 flex items-center gap-4">
              <button
                className={`px-4 py-2 rounded-lg border font-medium transition-colors ${manualMode ? 'bg-[var(--primary)] text-white' : 'bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20'}`}
                onClick={() => setManualMode((m) => !m)}
                disabled={relatedDocsLoading || allDocsLoading}
              >
                {manualMode
                  ? language === 'ro' ? 'Anulează editarea' : 'Cancel Edit'
                  : language === 'ro' ? 'Editează referințele manual' : 'Edit References Manually'}
              </button>
              {manualMode && (
                <span className="text-[var(--text3)] text-sm">
                  {language === 'ro'
                    ? 'Selectează manual documentele asociate. Modificările vor fi salvate doar după apăsarea butonului Salvează.'
                    : 'Manually select related documents. Changes are saved only after pressing Save.'}
                </span>
              )}
            </div>
            {manualMode ? (
              <div>
                {allDocsLoading ? (
                  <div className="flex items-center gap-2 text-[var(--text2)]"><RefreshCw className="animate-spin" /> {language === 'ro' ? 'Se încarcă lista...' : 'Loading list...'}</div>
                ) : (
                  <>
                    <div className="mb-3">
                      <span className="font-medium text-[var(--text2)]">{language === 'ro' ? 'Documente disponibile:' : 'Available documents:'}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                      {(allDocsData?.documents || []).filter((doc: any) => doc.id !== docId).map((doc: any) => {
                        const FileIcon = getFileIcon(doc.type);
                        const iconColors = getFileIconColor(doc.type);
                        return (
                          <label key={doc.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedReferences.includes(doc.id) ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-[var(--text4)] bg-[var(--background)] hover:border-[var(--primary)]/40'}`}>
                            <input
                              type="checkbox"
                              checked={selectedReferences.includes(doc.id)}
                              onChange={() => handleToggleReference(doc.id)}
                              className="accent-[var(--primary)] w-5 h-5"
                            />
                            <div className={`w-10 h-10 ${iconColors.bg} rounded-lg flex items-center justify-center`}><FileIcon size={18} className={iconColors.text} /></div>
                            <div className="flex-1 min-w-0">
                              <span className="block font-medium text-[var(--text1)] truncate">{doc.name}</span>
                              <span className="block text-xs text-[var(--text2)]">{doc.type}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex gap-3 items-center">
                      <button
                        className="px-6 py-2 rounded-xl bg-[var(--primary)] text-white font-medium hover:bg-[var(--primary)]/90 transition-colors"
                        onClick={handleSaveReferences}
                        disabled={isSaving || saveStatus === 'success'}
                      >
                        {isSaving ? (language === 'ro' ? 'Se salvează...' : 'Saving...') : (language === 'ro' ? 'Salvează referințele' : 'Save References')}
                      </button>
                      {saveStatus === 'success' && <span className="text-green-600 font-medium">{language === 'ro' ? 'Salvat!' : 'Saved!'}</span>}
                      {saveStatus === 'error' && <span className="text-red-500 font-medium">{saveError}</span>}
                    </div>
                  </>
                )}
              </div>
            ) : relatedDocsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3 text-[var(--text2)]">
                  <RefreshCw size={20} className="animate-spin" />
                  <span>{language === 'ro' ? 'Se încarcă documentele...' : 'Loading documents...'}</span>
                </div>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="text-center py-12">
                <FileText size={48} className="mx-auto text-[var(--text3)] mb-4" />
                <p className="text-[var(--text2)] text-lg mb-2">
                  {language === 'ro' ? 'Nu s-au găsit documente asociate' : 'No related documents found'}
                </p>
                <p className="text-[var(--text3)] text-sm">
                  {language === 'ro' 
                    ? 'Documentele asociate se bazează pe date comune sau relații identificate automat.'
                    : 'Related documents are based on common data or automatically identified relationships.'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDocs.map((relatedDoc, index) => {
                  const FileIcon = getFileIcon(relatedDoc.type);
                  const iconColors = getFileIconColor(relatedDoc.type);
                  
                  return (
                    <motion.div
                      key={relatedDoc.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-[var(--background)] rounded-xl p-4 border border-[var(--text4)] hover:border-[var(--primary)]/50 transition-all duration-200"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 ${iconColors.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                          <FileIcon size={24} className={iconColors.text} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-[var(--text1)] text-lg truncate text-left">
                            {relatedDoc.name}
                          </h3>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-[var(--text2)] font-medium">
                              {language === 'ro'
                                ? docTypeTranslations[relatedDoc.type as keyof typeof docTypeTranslations] || 'Tip necunoscut'
                                : relatedDoc.type || 'Unknown type'
                              }
                            </span>
                            <div className="flex items-center gap-1 text-[var(--text3)]">
                              <Calendar size={14} />
                              <span>{getDocumentDate(relatedDoc)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => window.open(relatedDoc.signedUrl, '_blank')}
                            className="p-2 text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)] hover:text-white rounded-lg transition-colors"
                            title={language === 'ro' ? 'Deschide document' : 'Open document'}
                          >
                            <ExternalLink size={16} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-6 border-t border-[var(--text4)] bg-[var(--background)]">
            <div className="flex items-center justify-between">
              <p className="text-[var(--text3)] text-sm">
                {language === 'ro' 
                  ? `${filteredDocs.length} documente găsite`
                  : `${filteredDocs.length} documents found`
                }
              </p>
              
              <button
                onClick={onClose}
                className="px-6 py-2 bg-[var(--primary)] text-white rounded-xl hover:bg-[var(--primary)]/90 transition-colors font-medium"
              >
                {language === 'ro' ? 'Închide' : 'Close'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RelatedDocumentsModal;
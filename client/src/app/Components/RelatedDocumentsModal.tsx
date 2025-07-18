import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Link, FileText, Receipt, CreditCard, FileSignature, 
  BarChart3, Send, Download, Calendar, ExternalLink,
  Search, Filter, RefreshCw
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
  const [relatedDocuments, setRelatedDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<DocumentType | ''>('');
  const [filteredDocs, setFilteredDocs] = useState<any[]>([]);

  const language = useSelector((state: {user: {language: string}}) => state.user.language);

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

  // Mock function to fetch related documents - replace with actual API call
  const fetchRelatedDocuments = async () => {
    setLoading(true);
    try {
      // This is a mock implementation
      // Replace with actual API call like:
      // const response = await getRelatedDocuments({ documentId: document.id, clientCompanyEin });
      
      // Mock data for demonstration
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockRelatedDocs = [
        {
          id: 2,
          name: "Receipt_001.pdf",
          type: "Receipt",
          createdAt: "2024-01-15T10:00:00Z",
          signedUrl: "#",
          processedData: [{
            extractedFields: {
              result: {
                document_date: "15-01-2024",
                total_amount: 500
              }
            }
          }]
        },
        {
          id: 3,
          name: "Bank_Statement_Jan.pdf", 
          type: "Bank Statement",
          createdAt: "2024-01-20T14:30:00Z",
          signedUrl: "#",
          processedData: [{
            extractedFields: {
              result: {
                statement_period_start: "01-01-2024"
              }
            }
          }]
        },
        {
          id: 4,
          name: "Contract_Service_2024.pdf",
          type: "Contract",
          createdAt: "2024-01-25T09:15:00Z",
          signedUrl: "#",
          processedData: [{
            extractedFields: {
              result: {
                contract_date: "25-01-2024",
                total_amount: 15000
              }
            }
          }]
        }
      ];
      
      setRelatedDocuments(mockRelatedDocs);
    } catch (error) {
      console.error('Failed to fetch related documents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = relatedDocuments;

    if (searchTerm) {
      filtered = filtered.filter(doc => 
        doc.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedType) {
      filtered = filtered.filter(doc => doc.type === selectedType);
    }

    setFilteredDocs(filtered);
  }, [relatedDocuments, searchTerm, selectedType]);

  useEffect(() => {
    if (isOpen) {
      fetchRelatedDocuments();
    }
  }, [isOpen, document.id]);

  const handleTooLongString = (str: string): string => {
    if (str.length > 30) return str.slice(0, 30) + '...';
    return str;
  };

  if (!isOpen) return null;

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
          {/* Header */}
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
                    {language === 'ro' ? 'Pentru' : 'For'}: {handleTooLongString(document.name)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    fetchRelatedDocuments();
                    onRefresh();
                  }}
                  className="p-2 text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)] hover:text-white rounded-lg transition-colors"
                  disabled={loading}
                >
                  <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
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

          {/* Search and Filters */}
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

          {/* Content */}
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {loading ? (
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

          {/* Footer */}
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
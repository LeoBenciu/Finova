import { useEffect, useState, useCallback, memo } from 'react';
import LoadingComponent from '../LoadingComponent';
import { ArrowUp, CirclePlus, Save, Trash2, AlertTriangle, CheckCircle, Brain } from 'lucide-react';
import { SelectDocType } from '../SelectDocType';
import { useSaveFileAndExtractedDataMutation } from '@/redux/slices/apiSlice';
import LineItems from './LineItems';
import { AnimatePresence, motion } from 'framer-motion';
import AreYouSureModal from '../AreYouSureModal';
import DocumentViewer from './DocumentViewer';
import { useSelector } from 'react-redux';
import DocumentTypeFields from './Fields/DocumentTypeFields';

interface EditExtractedDataProps {
  isLoading: boolean;
  editFile?: {
    result: Record<string, any>;
  };
  setEditFile: (value: any) => void;
  setIsModalOpen: (val: boolean) => void;
  isOpen: boolean;
  currentFile: File | null;
  setCurrentProcessingFile: (t: any) => void;
  onDocumentSaved: (fileName: string) => void;
}

type Item = {
  description: string;
  quantity: number;
  unit_price: number;
  vat_amount: number;
  total: number;
};

const modalVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } }
};

const containerVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { 
      duration: 0.3,
      when: "beforeChildren",
      staggerChildren: 0.1
    }
  }
};

const EditExtractedDataComponent = ({ 
  isLoading, 
  editFile, 
  setEditFile, 
  setIsModalOpen, 
  isOpen, 
  currentFile, 
  setCurrentProcessingFile,
  onDocumentSaved
}: EditExtractedDataProps) => {
  
  const [saveFileAndData, {isLoading: isSaving}] = useSaveFileAndExtractedDataMutation();
  const [lineItems, setLineItems] = useState<boolean>(false);
  const [closeModal, setCloseModal] = useState<boolean>(false);
  const [internalLoading, setInternalLoading] = useState(isLoading);
  const [contentVisible, setContentVisible] = useState(false);
  const [einValidation, setEinValidation] = useState<{isValid: boolean, message: string} | null>(null);
  const [userCorrections, setUserCorrections] = useState<any[]>([]);
  const [originalData, setOriginalData] = useState<any>(null);

  const currentClientCompanyEin = useSelector((state: {clientCompany: {current: {name: string, ein: string}}}) => state.clientCompany.current.ein);
  const language = useSelector((state: {user: {language: string}}) => state.user.language);

  useEffect(() => {
    if (editFile?.result && !originalData) {
      setOriginalData(JSON.parse(JSON.stringify(editFile.result)));
    }
  }, [editFile, originalData]);

  const trackChanges = useCallback((field: string, originalValue: any, newValue: any) => {
    if (JSON.stringify(originalValue) !== JSON.stringify(newValue)) {
      const correction = {
        field,
        originalValue,
        newValue,
        timestamp: Date.now()
      };
      
      setUserCorrections(prev => {
        const filtered = prev.filter(c => c.field !== field);
        return [...filtered, correction];
      });
    } else {
      setUserCorrections(prev => prev.filter(c => c.field !== field));
    }
  }, []);

  const updateEditFile = useCallback((newData: any) => {
    if (originalData) {
      const original = originalData;
      const updated = newData.result || newData;

      if (original.document_type !== updated.document_type) {
        trackChanges('document_type', original.document_type, updated.document_type);
      }

      if (original.direction !== updated.direction) {
        trackChanges('direction', original.direction, updated.direction);
      }

      if (original.vendor !== updated.vendor || original.vendor_ein !== updated.vendor_ein) {
        trackChanges('vendor_information', 
          { vendor: original.vendor, vendor_ein: original.vendor_ein },
          { vendor: updated.vendor, vendor_ein: updated.vendor_ein }
        );
      }

      if (original.buyer !== updated.buyer || original.buyer_ein !== updated.buyer_ein) {
        trackChanges('buyer_information',
          { buyer: original.buyer, buyer_ein: original.buyer_ein },
          { buyer: updated.buyer, buyer_ein: updated.buyer_ein }
        );
      }

      if (original.total_amount !== updated.total_amount || original.vat_amount !== updated.vat_amount) {
        trackChanges('amounts',
          { total_amount: original.total_amount, vat_amount: original.vat_amount },
          { total_amount: updated.total_amount, vat_amount: updated.vat_amount }
        );
      }

      if (original.document_date !== updated.document_date || original.due_date !== updated.due_date) {
        trackChanges('dates',
          { document_date: original.document_date, due_date: original.due_date },
          { document_date: updated.document_date, due_date: updated.due_date }
        );
      }

      if (JSON.stringify(original.line_items || []) !== JSON.stringify(updated.line_items || [])) {
        trackChanges('line_items', original.line_items || [], updated.line_items || []);
      }
    }

    setEditFile(newData);
  }, [originalData, trackChanges, setEditFile]);

  useEffect(() => {
    if (editFile?.result) {
      validateDocumentEIN();
    }
  }, [editFile, currentClientCompanyEin]);

  const validateDocumentEIN = useCallback(() => {
    if (!editFile?.result || !currentClientCompanyEin) return;

    const documentType = editFile.result.document_type?.toLowerCase();
    const buyerEin = editFile.result.buyer_ein?.toString().replace(/^RO/i, '');
    const vendorEin = editFile.result.vendor_ein?.toString().replace(/^RO/i, '');
    const companyEin = editFile.result.company_ein?.toString().replace(/^RO/i, '');
    const cleanClientEin = currentClientCompanyEin.replace(/^RO/i, '');

    if (documentType === 'invoice' || documentType === 'receipt') {
      const isBuyer = buyerEin === cleanClientEin;
      const isVendor = vendorEin === cleanClientEin;
      
      if (!isBuyer && !isVendor) {
        setEinValidation({
          isValid: false,
          message: language === 'ro' 
            ? 'Atenție: Acest document nu pare să aparțină companiei selectate. Nici cumpărătorul, nici vânzătorul nu se potrivesc cu EIN-ul companiei.'
            : 'Warning: This document does not appear to belong to the selected company. Neither buyer nor vendor EIN matches the company EIN.'
        });
        return;
      }

      if (isBuyer && isVendor) {
        setEinValidation({
          isValid: false,
          message: language === 'ro'
            ? 'Eroare: EIN-ul companiei apare atât ca cumpărător, cât și ca vânzător. Verificați documentul.'
            : 'Error: Company EIN appears as both buyer and vendor. Please check the document.'
        });
        return;
      }

      setEinValidation({
        isValid: true,
        message: language === 'ro'
          ? `Document valid: Compania este ${isBuyer ? 'cumpărătorul' : 'vânzătorul'}`
          : `Valid document: Company is the ${isBuyer ? 'buyer' : 'vendor'}`
      });
    }
    
    else if (companyEin) {
      const isCompanyDocument = companyEin === cleanClientEin;
      
      if (!isCompanyDocument) {
        setEinValidation({
          isValid: false,
          message: language === 'ro'
            ? 'Atenție: EIN-ul din acest document nu se potrivește cu compania selectată.'
            : 'Warning: The EIN in this document does not match the selected company.'
        });
        return;
      }

      setEinValidation({
        isValid: true,
        message: language === 'ro' ? 'Document valid pentru compania selectată' : 'Valid document for selected company'
      });
    } else {
      setEinValidation(null);
    }
  }, [editFile, currentClientCompanyEin, language]);

  useEffect(() => {
    if (isLoading) {
      setInternalLoading(true);
      setContentVisible(false);
    } else {
      const timer = setTimeout(() => {
        setInternalLoading(false);
        setContentVisible(true);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const handleSaveButton = useCallback(async () => {
    if (!currentFile) return;
    
    try {
        const dataToSave = {
            ...editFile,
            userCorrections: userCorrections.length > 0 ? userCorrections : undefined
        };

        console.log('=== SAVE DEBUG INFO ===');
        console.log('Current file:', currentFile.name);
        console.log('Client Company EIN:', currentClientCompanyEin);
        console.log('Data to save:', JSON.stringify(dataToSave, null, 2));
        console.log('User corrections count:', userCorrections.length);
        console.log('Has compliance validation:', !!dataToSave.result?.compliance_validation);
        console.log('Has duplicate detection:', !!dataToSave.result?.duplicate_detection);
        console.log('======================');

        if (!dataToSave.result) {
            throw new Error('No result data to save');
        }

        if (!dataToSave.result.document_type) {
            throw new Error('Document type is required');
        }

        if (!currentClientCompanyEin) {
            throw new Error('Client company EIN is required');
        }

        const fileSaved = await saveFileAndData({ 
            clientCompanyEin: currentClientCompanyEin, 
            processedData: dataToSave,
            file: currentFile
        }).unwrap();
        
        console.log('✅ File saved successfully:', fileSaved);
        
        onDocumentSaved(currentFile.name);
        setIsModalOpen(false);
        setCurrentProcessingFile(null);

    } catch (e) {
        console.error('❌ Failed to save document:', e);
        
        if (typeof e === 'object' && e !== null && 'data' in e && typeof (e as any).data?.message === 'string') {
            alert(`Save failed: ${(e as any).data.message}`);
        } else {
            alert('Failed to save the document. Please try again.');
        }
    }
}, [saveFileAndData, currentClientCompanyEin, editFile, currentFile, onDocumentSaved, setIsModalOpen, setCurrentProcessingFile, userCorrections]);

  const toggleLineItems = useCallback(() => {
    setLineItems((prev) => !prev);
  }, []);

  const handleCloseModal = useCallback(() => {
    setCloseModal(true);
    setCurrentProcessingFile(null);
  }, [setCurrentProcessingFile]);

  const handleDeleteLineItems = useCallback(() => {
    const newData = {
      ...editFile,
      result: {
        ...editFile?.result,
        line_items: []
      },
    };
    updateEditFile(newData);
  }, [editFile, updateEditFile]);

  const handleCreateNewLineItem = useCallback(() => {
    const newData = {
      ...editFile,
      result: {
        ...editFile?.result,
        line_items: [
          ...editFile?.result.line_items,
          {
            description: '',
            quantity: '-',
            unit_price: '-',
            vat_amount: '-',
            total: '-'
          }
        ]
      }
    };
    updateEditFile(newData);
  }, [editFile, updateEditFile]);

  const handleCurrencyChange = useCallback((currency: string) => {
    const newData = {
      ...editFile,
      result: {
        ...editFile?.result,
        currency: currency
      }
    };
    updateEditFile(newData);
  }, [editFile, updateEditFile]);

  const hasLineItems = editFile?.result?.document_type?.toLowerCase() === 'invoice' && editFile?.result?.line_items;
  
  const supportsCurrency = ['invoice', 'receipt', 'contract'].includes(editFile?.result?.document_type?.toLowerCase());

  if (!isOpen) return null;

  return (
    <motion.div 
      className="fixed inset-0 z-50"
      variants={modalVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
    >
      <div className="bg-black/80 fixed inset-0 min-w-vw min-h-vh flex justify-center items-center p-4">
        <motion.div 
          className="bg-[var(--foreground)] max-w-[75rem] min-h-[90vh] min-w-[75rem] max-h-[90vh] rounded-3xl flex 
          border-[1px] border-[var(--text4)] shadow-2xl overflow-hidden"
          variants={containerVariants}
        >
          <DocumentViewer onClose={handleCloseModal} currentFile={currentFile}/>

          <div className="flex-1 relative bg-[var(--background)]">
            {internalLoading && (
              <div className="absolute inset-0 flex justify-center items-center bg-[var(--background)] z-10">
                <div className="w-[200px] bg-[var(--foreground)] rounded-3xl py-8 px-6 shadow-lg border border-[var(--text4)]">
                  <LoadingComponent />
                </div>
              </div>
            )}

            <div className={`h-full overflow-auto transition-opacity duration-300 ${contentVisible ? 'opacity-100' : 'opacity-0'}`}>
              {/* Header Section */}
              <div className="bg-[var(--foreground)] border-b border-[var(--text4)] p-6">
                <div className="flex flex-row justify-between items-center">
                  <div>
                    <h3 className="text-left font-bold text-2xl text-[var(--text1)] mb-1">
                      {language === 'ro' ? 'Date extrase' : 'Extracted data'}
                    </h3>
                    <p className="text-[var(--text2)] text-sm">
                      {language === 'ro' ? 'Revizuiește și salvează datele extrase' : 'Review and save the extracted data'}
                    </p>
                  </div>
                  
                  {!isSaving && (
                    <button
                      className={`px-6 py-2.5 rounded-2xl flex items-center gap-2 
                      transition-all duration-200 font-medium shadow-sm ${
                        einValidation?.isValid === false 
                          ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                          : 'bg-[var(--primary)] text-white hover:bg-[var(--primary)]/80'
                      }`}
                      onClick={handleSaveButton}
                      disabled={einValidation?.isValid === false}
                    >
                      <Save size={16} />
                      {language === 'ro' ? 'Salvează' : 'Save'}
                    </button>
                  )}
                  
                  {isSaving && (
                    <div className='fixed inset-0 bg-black/50 flex justify-center items-center z-50'>
                      <div className='bg-[var(--foreground)] p-8 rounded-3xl shadow-2xl border border-[var(--text4)]'>
                        <div className="text-center">
                          <LoadingComponent />
                          <p className="mt-4 text-[var(--text2)]">
                            {language === 'ro' ? 'Se salvează...' : 'Saving...'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* EIN Validation Alert */}
              {einValidation && (
                <motion.div 
                  className={`mx-6 mt-4 p-4 rounded-2xl border ${
                    einValidation.isValid 
                      ? 'bg-green-50 border-green-200 text-green-800' 
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center gap-3">
                    {einValidation.isValid ? (
                      <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
                    ) : (
                      <AlertTriangle size={20} className="text-red-600 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium">
                      {einValidation.message}
                    </span>
                  </div>
                </motion.div>
              )}

              {/* User Corrections Alert */}
              {userCorrections.length > 0 && (
                <motion.div 
                  className="mx-6 mt-4 p-4 rounded-2xl border bg-blue-50 border-blue-200 text-blue-800"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center gap-3">
                    <Brain size={20} className="text-blue-600 flex-shrink-0" />
                    <div>
                      <span className="text-sm font-medium">
                        {language === 'ro' 
                          ? `${userCorrections.length} corecții detectate - AI-ul va învăța din aceste modificări`
                          : `${userCorrections.length} corrections detected - AI will learn from these changes`
                        }
                      </span>
                      <div className="text-xs mt-1 opacity-75">
                        {language === 'ro' 
                          ? 'Corecțiile vor îmbunătăți acuratețea pentru documentele viitoare'
                          : 'Corrections will improve accuracy for future documents'
                        }
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Alert Sections for Duplicate and Compliance */}
              {editFile?.result?.duplicate_detection?.is_duplicate && (
                <motion.div 
                  className="mx-6 mt-4 p-4 rounded-2xl border bg-orange-50 border-orange-200 text-orange-800"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={20} className="text-orange-600 flex-shrink-0" />
                    <div>
                      <span className="text-sm font-medium">
                        {language === 'ro' ? 'Possible Duplicate Detected' : 'Possible Duplicate Detected'}
                      </span>
                      <div className="text-xs mt-1">
                        {language === 'ro' 
                          ? `${editFile.result.duplicate_detection.duplicate_matches?.length || 0} documente similare găsite`
                          : `${editFile.result.duplicate_detection.duplicate_matches?.length || 0} similar documents found`
                        }
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}


              {(editFile?.result?.compliance_validation?.compliance_status === 'NON_COMPLIANT' || 
                editFile?.result?.compliance_validation?.compliance_status === 'WARNING') && (
                <motion.div 
                  className={`mx-6 mt-4 p-4 rounded-2xl border ${
                    editFile.result.compliance_validation.compliance_status === 'NON_COMPLIANT'
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : 'bg-orange-50 border-orange-200 text-orange-800'
                  }`}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle 
                      size={20} 
                      className={`flex-shrink-0 mt-0.5 ${
                        editFile.result.compliance_validation.compliance_status === 'NON_COMPLIANT'
                          ? 'text-red-600'
                          : 'text-orange-600'
                      }`} 
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold">
                          {editFile.result.compliance_validation.compliance_status === 'NON_COMPLIANT'
                            ? (language === 'ro' ? 'Probleme de Conformitate' : 'Compliance Issues')
                            : (language === 'ro' ? 'Avertismente de Conformitate' : 'Compliance Warnings')
                          }
                        </span>
                        {editFile.result.compliance_validation.overall_score && (
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            editFile.result.compliance_validation.compliance_status === 'NON_COMPLIANT'
                              ? 'bg-red-200 text-red-800'
                              : 'bg-orange-200 text-orange-800'
                          }`}>
                            {language === 'ro' ? 'Scor: ' : 'Score: '}
                            {Math.round(editFile.result.compliance_validation.overall_score * 100)}%
                          </span>
                        )}
                      </div>
                      
                      {editFile.result.compliance_validation.errors && (
                        (() => {
                          let errorMessages = [];
                          if (editFile.result.compliance_validation.errors[language]) {
                            errorMessages = editFile.result.compliance_validation.errors[language];
                          } else if (Array.isArray(editFile.result.compliance_validation.errors)) {
                            errorMessages = editFile.result.compliance_validation.errors;
                          }

                          return errorMessages.length > 0 && (
                            <div className="mb-3">
                              <h4 className="text-xs font-semibold mb-2 text-red-700 uppercase tracking-wide">
                                {language === 'ro' ? 'Erori găsite:' : 'Issues Found:'}
                              </h4>
                              <ul className="space-y-2">
                                {errorMessages.map((error: string, index: number) => (
                                  <li key={index} className="text-sm flex items-start gap-3">
                                    <span className="text-red-500 mt-1 flex-shrink-0">•</span>
                                    <span className="text-red-700 leading-relaxed">{error}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })()
                      )}

                      {editFile.result.compliance_validation.warnings && (
                        (() => {
                          let warningMessages = [];
                          if (editFile.result.compliance_validation.warnings[language]) {
                            warningMessages = editFile.result.compliance_validation.warnings[language];
                          } else if (Array.isArray(editFile.result.compliance_validation.warnings)) {
                            warningMessages = editFile.result.compliance_validation.warnings;
                          }

                          return warningMessages.length > 0 && (
                            <div className="mb-3">
                              <h4 className="text-xs font-semibold mb-2 text-orange-700 uppercase tracking-wide">
                                {language === 'ro' ? 'Avertismente:' : 'Warnings:'}
                              </h4>
                              <ul className="space-y-2">
                                {warningMessages.map((warning: string, index: number) => (
                                  <li key={index} className="text-sm flex items-start gap-3">
                                    <span className="text-orange-500 mt-1 flex-shrink-0">⚠</span>
                                    <span className="text-orange-700 leading-relaxed">{warning}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })()
                      )}

                      {editFile.result.compliance_validation.validation_rules && (
                        (() => {
                          let ruleMessages = [];
                          if (editFile.result.compliance_validation.validation_rules[language]) {
                            ruleMessages = editFile.result.compliance_validation.validation_rules[language];
                          } else if (Array.isArray(editFile.result.compliance_validation.validation_rules)) {
                            ruleMessages = editFile.result.compliance_validation.validation_rules;
                          }

                          return ruleMessages.length > 0 && (
                            <details className="mt-3">
                              <summary className="text-xs font-medium cursor-pointer hover:underline text-gray-600 select-none">
                                {language === 'ro' ? 'Vezi regulile de validare' : 'View validation rules'} 
                                <span className="ml-1 opacity-70">({ruleMessages.length})</span>
                              </summary>
                              <div className="mt-2 pl-4 border-l-2 border-gray-300">
                                <ul className="space-y-1">
                                  {ruleMessages.map((rule: string, index: number) => (
                                    <li key={index} className="text-xs text-gray-600 flex items-start gap-2">
                                      <span className="text-gray-400 mt-0.5 flex-shrink-0">→</span>
                                      <span className="leading-relaxed">{rule}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </details>
                          );
                        })()
                      )}

                      <div className={`text-xs mt-4 pt-3 border-t border-current/20 font-medium ${
                        editFile.result.compliance_validation.compliance_status === 'NON_COMPLIANT'
                          ? 'text-red-700'
                          : 'text-orange-700'
                      }`}>
                        {editFile.result.compliance_validation.compliance_status === 'NON_COMPLIANT'
                          ? (language === 'ro' 
                              ? '⚠️ Documentul necesită corecții pentru a respecta standardele ANAF'
                              : '⚠️ Document requires corrections to meet ANAF standards')
                          : (language === 'ro'
                              ? '⚠️ Documentul are probleme minore care ar trebui verificate'
                              : '⚠️ Document has minor issues that should be reviewed')
                        }
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Content Section */}
              <div className="p-6">
                {editFile && (
                  <div className="bg-[var(--foreground)] rounded-3xl border border-[var(--text4)] shadow-sm">
                    {/* Document Type & Currency Section */}
                    <div className="border-b border-[var(--text4)] p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <label className="text-base font-semibold text-[var(--text1)] mb-2 block">
                            {language === 'ro' ? "Tipul Documentului" : 'Document Type'}
                          </label>
                        </div>
                        <div className="min-w-40 max-w-40">
                          <SelectDocType 
                            value={editFile?.result.document_type} 
                            editFile={editFile} 
                            setEditFile={updateEditFile}
                          />
                        </div>
                      </div>

                      {/* Currency Section */}
                      {supportsCurrency && (
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="text-base font-semibold text-[var(--text1)] mb-2 block">
                              {language === 'ro' ? "Moneda" : 'Currency'}
                            </label>
                          </div>
                          <div className="min-w-40 max-w-40">
                            <select
                              value={editFile?.result.currency || 'RON'}
                              onChange={(e) => handleCurrencyChange(e.target.value)}
                              className="w-full px-3 py-2 border border-[var(--text4)] rounded-xl 
                              bg-[var(--background)] text-[var(--text1)] focus:outline-none 
                              focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                              transition-all duration-200"
                            >
                              <option value="RON">RON - Leu românesc</option>
                              <option value="EUR">EUR - Euro</option>
                              <option value="USD">USD - US Dollar</option>
                              <option value="GBP">GBP - British Pound</option>
                              <option value="CHF">CHF - Swiss Franc</option>
                              <option value="JPY">JPY - Japanese Yen</option>
                              <option value="CAD">CAD - Canadian Dollar</option>
                              <option value="AUD">AUD - Australian Dollar</option>
                              <option value="SEK">SEK - Swedish Krona</option>
                              <option value="NOK">NOK - Norwegian Krone</option>
                              <option value="DKK">DKK - Danish Krone</option>
                              <option value="PLN">PLN - Polish Złoty</option>
                              <option value="CZK">CZK - Czech Koruna</option>
                              <option value="HUF">HUF - Hungarian Forint</option>
                              <option value="BGN">BGN - Bulgarian Lev</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Currency Category Info */}
                      {supportsCurrency && editFile?.result.currency && editFile.result.currency !== 'RON' && (
                        <motion.div 
                          className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></div>
                            <span className="text-sm text-blue-800 font-medium">
                              {language === 'ro' 
                                ? `Document în valută (${editFile.result.currency}) - va fi salvat în categoria "Valută"`
                                : `Foreign currency document (${editFile.result.currency}) - will be saved in "Foreign Currency" category`
                              }
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* Dynamic Document Fields */}
                    <div className="p-6">
                      <DocumentTypeFields 
                        editFile={editFile} 
                        setEditFile={updateEditFile} 
                      />
                    </div>
                  </div>
                )}

                {/* Line Items Section - Only for invoices */}
                {hasLineItems && (
                  <div className="mt-6">
                    <motion.button
                      className="bg-[var(--primary)] text-white rounded-2xl flex items-center gap-3 px-6 py-3 
                      hover:bg-[var(--primary)]/80 transition-all duration-200 font-medium shadow-sm"
                      onClick={toggleLineItems}
                      whileTap={{ y: 2 }}
                    >
                      <ArrowUp
                        size={18}
                        className={`transition-transform duration-200 ${lineItems ? 'rotate-180' : 'rotate-90'}`}
                      />
                      {language === 'ro' ? ((lineItems ? 'Ascunde ' : 'Arată ')) : ((lineItems ? 'Hide ' : 'Show '))}
                      {language === 'ro' ? 'articole' : 'line items'}
                      <span className="bg-white/20 text-xs px-2 py-1 rounded-full">
                        {editFile?.result.line_items?.length || 0}
                      </span>
                    </motion.button>

                    <AnimatePresence>
                      {lineItems && editFile?.result.line_items && (
                        <motion.div 
                          className="mt-4"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          {/* Line Items Controls */}
                          <div className='flex justify-center gap-4 items-center mb-6 bg-[var(--foreground)] 
                          p-4 rounded-2xl border border-[var(--text4)]'>
                            <button 
                              className='bg-[var(--primary)]/10 hover:bg-[var(--primary)] 
                              hover:text-white text-[var(--primary)] px-4 py-2.5 rounded-2xl
                              flex items-center gap-2 transition-all duration-200 font-medium'
                              onClick={handleCreateNewLineItem}
                            >
                              <CirclePlus size={18} />
                              {language === 'ro' ? 'Creează articol' : 'New item'}
                            </button>

                            <button 
                              className='bg-red-500/10 hover:bg-red-500 
                              hover:text-white text-red-500 px-4 py-2.5 rounded-2xl
                              flex items-center gap-2 transition-all duration-200 font-medium'
                              onClick={() => {handleDeleteLineItems(); toggleLineItems()}}
                            >
                              <Trash2 size={18} />
                              {language === 'ro' ? 'Șterge articole' : 'Delete items'}
                            </button>
                          </div>

                          {/* Line Items List */}
                          <div className="space-y-4">
                            {editFile.result.line_items.map((item: Item, index: number) => (
                              <LineItems
                                key={`line-item-${index}`}
                                setEditFile={updateEditFile}
                                editFile={editFile}
                                item={item}
                                index={index}
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {closeModal && (
          <AreYouSureModal setCloseModal={setCloseModal} setIsModalOpen={setIsModalOpen} />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default memo(EditExtractedDataComponent);
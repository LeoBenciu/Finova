import { AnimatePresence, motion } from "framer-motion";
import DocumentViewer from "./EditExtractedData/DocumentViewer";
import { ArrowUp, CirclePlus, FilePenLine, Save, Trash2, AlertTriangle, CheckCircle, Brain } from "lucide-react";
import LineItems from "./EditExtractedData/LineItems";
import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react";
import { SelectDocType } from "./SelectDocType";
import { useSelector } from "react-redux";
import { useUpdateFileAndExtractedDataMutation } from "@/redux/slices/apiSlice";
import LoadingComponent from "./LoadingComponent";
import DocumentTypeFields from "./EditExtractedData/Fields/DocumentTypeFields";

interface EditExtractedDataManagementProps{
      setIsModalOpen: (val: boolean) => void;
      isOpen: boolean;
      currentFile: Record<string,any>;
      setProcessedFiles:Dispatch<SetStateAction<Record<string, any>>>;
      processedFiles: Record<string, any>;
      setCurrentFile: Dispatch<SetStateAction<Record<string, any>>>;
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

const EditExtractedDataManagement = ({ setProcessedFiles, processedFiles, setIsModalOpen, isOpen, currentFile, setCurrentFile }: EditExtractedDataManagementProps) => {

    const [lineItems, setLineItems] = useState<boolean>(false);
    const [savedUpdates, setSavedUpdates] = useState<boolean>(false);
    const [isUpdating, setIsUpdating] = useState<boolean>(false);
    const [einValidation, setEinValidation] = useState<{isValid: boolean, message: string} | null>(null);
    const [userCorrections, setUserCorrections] = useState<any[]>([]);
    const [originalData, setOriginalData] = useState<any>(null);

    useEffect(()=>{
        console.log('CCC',currentFile);
        console.log('PP',processedFiles)
    },[currentFile])
    
    const currentClientCompanyEin = useSelector((state:{clientCompany:{current:{name:string,ein:string}}})=>state.clientCompany.current.ein);
    const [updateFile] = useUpdateFileAndExtractedDataMutation();
    const language = useSelector((state:{user:{language:string}})=>state.user.language);

    useEffect(() => {
      if (currentFile?.processedData?.[0]?.extractedFields?.result && !originalData) {
        setOriginalData(JSON.parse(JSON.stringify(currentFile.processedData[0].extractedFields.result)));
      }
    }, [currentFile, originalData]);

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

    const updateCurrentFile = useCallback((newData: any) => {
      if (originalData) {
        const original = originalData;
        const updated = newData.result || newData.processedData?.[0]?.extractedFields?.result || newData;

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

      setCurrentFile(newData);
    }, [originalData, trackChanges, setCurrentFile]);

    useEffect(() => {
      if (currentFile?.processedData?.[0]?.extractedFields?.result) {
        validateDocumentEIN();
      }
    }, [currentFile, currentClientCompanyEin]);

    const validateDocumentEIN = useCallback(() => {
      if (!currentFile?.processedData?.[0]?.extractedFields?.result || !currentClientCompanyEin) return;

      const result = currentFile.processedData[0].extractedFields.result;
      const documentType = result.document_type?.toLowerCase();
      const buyerEin = result.buyer_ein?.toString().replace(/^RO/i, '');
      const vendorEin = result.vendor_ein?.toString().replace(/^RO/i, '');
      const companyEin = result.company_ein?.toString().replace(/^RO/i, '');
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
    }, [currentFile, currentClientCompanyEin, language]);

    const handleUpdateButton = useCallback(async () => {
      try {
        setIsUpdating(true);
        
        const dataToUpdate = {
          ...currentFile.processedData[0].extractedFields,
          userCorrections: userCorrections.length > 0 ? userCorrections : undefined
        };

        const updatedFile = await updateFile({ 
          clientCompanyEin: currentClientCompanyEin, 
          processedData: dataToUpdate,
          docId: currentFile.id 
        }).unwrap();
        
        console.log('Updated File', updatedFile);
        
        setProcessedFiles(prevFiles => {
          if (!prevFiles || !prevFiles.documents) {
            return prevFiles;
          }
          
          return {
            ...prevFiles,
            documents: prevFiles.documents.map((file:any) => {
              if (file.id === currentFile.id) {
                return {
                  ...file,
                  processedData: [{
                    ...file.processedData[0],
                    extractedFields: updatedFile.updatedProcessedData.extractedFields
                  }, ...file.processedData.slice(1)]
                };
              }
              return file;
            })
          };
        });
        
        setSavedUpdates(true);
        setTimeout(() => {
          setSavedUpdates(false);
        }, 2000);
      } catch (e) {
        console.error('Failed to update the document and the data:', e);
        
        if (typeof e === 'object' && e !== null && 'data' in e && typeof (e as any).data?.message === 'string') {
          alert(`Update failed: ${(e as any).data.message}`);
        } else {
          alert('Failed to update the document. Please try again.');
        }
      } finally {
        setIsUpdating(false);
      }
    }, [updateFile, currentClientCompanyEin, currentFile, userCorrections]);

    const toggleLineItems = useCallback(() => {
      setLineItems((prev) => !prev);
    }, []);

    const handleCloseModal = useCallback(() => {
      setIsModalOpen(false)
    }, []);
    
    const handleDeleteLineItems = useCallback(()=>{
        updateCurrentFile({
            ...currentFile,
            processedData: [
              {
                ...currentFile.processedData[0],
                extractedFields: {
                  ...currentFile.processedData[0].extractedFields,
                  result: {
                    ...currentFile.processedData[0].extractedFields.result,
                    line_items: []
                  }
                }
              },
              ...currentFile.processedData.slice(1)
            ]
          });
    },[currentFile, updateCurrentFile]);

    const handleCreateNewLineItem = useCallback(()=>{
        updateCurrentFile({
            ...currentFile,
            processedData: [
              {
                ...currentFile.processedData[0],
                extractedFields: {
                  ...currentFile.processedData[0].extractedFields,
                  result: {
                    ...currentFile.processedData[0].extractedFields.result,
                    line_items: [
                      ...currentFile.processedData[0].extractedFields.result.line_items,
                      {
                        description: '',
                        quantity: '-',
                        unit_price: '-',
                        vat_amount: '-',
                        total: '-'
                      }
                    ]
                  }
                }
              },
              ...currentFile.processedData.slice(1)
            ]
          });
    },[currentFile, updateCurrentFile]);

    const handleCurrencyChange = useCallback((currency: string) => {
      const newData = {
        ...currentFile,
        processedData: [
          {
            ...currentFile.processedData[0],
            extractedFields: {
              ...currentFile.processedData[0].extractedFields,
              result: {
                ...currentFile.processedData[0].extractedFields.result,
                currency: currency
              }
            }
          },
          ...currentFile.processedData.slice(1)
        ]
      };
      updateCurrentFile(newData);
    }, [currentFile, updateCurrentFile]);

    const getEditFileFormat = useCallback(() => {
      if (!currentFile?.processedData?.[0]?.extractedFields?.result) return null;
      return {
        result: currentFile.processedData[0].extractedFields.result
      };
    }, [currentFile]);

    const setEditFileFormat = useCallback((updatedEditFile: any) => {
      updateCurrentFile({
        ...currentFile,
        processedData: [
          {
            ...currentFile.processedData[0],
            extractedFields: updatedEditFile
          },
          ...currentFile.processedData.slice(1)
        ]
      });
    }, [currentFile, updateCurrentFile]);

    const hasLineItems = currentFile?.processedData?.[0]?.extractedFields?.result?.document_type?.toLowerCase() === 'invoice' && 
                        currentFile?.processedData?.[0]?.extractedFields?.result?.line_items;
    
    const supportsCurrency = ['invoice', 'receipt', 'contract'].includes(
      currentFile?.processedData?.[0]?.extractedFields?.result?.document_type?.toLowerCase()
    );

    const editFile = getEditFileFormat();

    if(!isOpen || !editFile) return null;

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
              <DocumentViewer onClose={handleCloseModal} signedUrl={currentFile.signedUrl} />

              <div className="flex-1 relative bg-[var(--background)]">
                {isUpdating && (
                  <div className="absolute inset-0 flex justify-center items-center bg-[var(--background)] z-10">
                    <div className="w-[200px] bg-[var(--foreground)] rounded-3xl py-8 px-6 shadow-lg border border-[var(--text4)]">
                      <LoadingComponent />
                    </div>
                  </div>
                )}

                <div className="h-full overflow-auto transition-opacity duration-300 opacity-100">
                  {/* Header Section */}
                  <div className="bg-[var(--foreground)] border-b border-[var(--text4)] p-6">
                    <div className="flex flex-row justify-between items-center">
                      <div>
                        <h3 className="text-left font-bold text-2xl text-[var(--text1)] mb-1">
                          {language === 'ro' ? 'Date extrase' : 'Extracted data'}
                        </h3>
                        <p className="text-[var(--text2)] text-sm">
                          {language === 'ro' ? 'Revizuiește și actualizează datele extrase' : 'Review and update the extracted data'}
                        </p>
                      </div>
                      
                      {!savedUpdates && !isUpdating && (
                        <button
                          className={`px-6 py-2.5 rounded-2xl flex items-center gap-2 
                          transition-all duration-200 font-medium shadow-sm ${
                            einValidation?.isValid === false 
                              ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                              : 'bg-[var(--primary)] text-white hover:bg-[var(--primary)]/80'
                          }`}
                          onClick={handleUpdateButton}
                          disabled={einValidation?.isValid === false}
                        >
                          <FilePenLine size={16} />
                          {language==='ro'?'Actualizează':'Update'}
                        </button>
                      )}
                      
                      {savedUpdates && (
                        <div className="text-green-600 flex items-center gap-2 font-semibold">
                          <Save size={20}/>
                          {language==='ro'?'Salvat':'Saved'}
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
                          
                          {/* Errors Section */}
                          {editFile.result.compliance_validation.errors && 
                           editFile.result.compliance_validation.errors.length > 0 && (
                            <div className="mb-3">
                              <h4 className="text-xs font-semibold mb-2 text-red-700 uppercase tracking-wide">
                                {language === 'ro' ? 'Erori găsite:' : 'Issues Found:'}
                              </h4>
                              <ul className="space-y-2">
                                {editFile.result.compliance_validation.errors.map((error: string, index: number) => (
                                  <li key={index} className="text-sm flex items-start gap-3">
                                    <span className="text-red-500 mt-1 flex-shrink-0">•</span>
                                    <span className="text-red-700 leading-relaxed">{error}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Warnings Section */}
                          {editFile.result.compliance_validation.warnings && 
                           editFile.result.compliance_validation.warnings.length > 0 && (
                            <div className="mb-3">
                              <h4 className="text-xs font-semibold mb-2 text-orange-700 uppercase tracking-wide">
                                {language === 'ro' ? 'Avertismente:' : 'Warnings:'}
                              </h4>
                              <ul className="space-y-2">
                                {editFile.result.compliance_validation.warnings.map((warning: string, index: number) => (
                                  <li key={index} className="text-sm flex items-start gap-3">
                                    <span className="text-orange-500 mt-1 flex-shrink-0">⚠</span>
                                    <span className="text-orange-700 leading-relaxed">{warning}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
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
                                setEditFile={setEditFileFormat}
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
                            setEditFile={setEditFileFormat} 
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
                                    setEditFile={setEditFileFormat}
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
        </motion.div>
    )
}

export default EditExtractedDataManagement
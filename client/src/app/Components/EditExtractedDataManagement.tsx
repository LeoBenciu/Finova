import { AnimatePresence, motion } from "framer-motion";
import DocumentViewer from "./EditExtractedData/DocumentViewer";
import { ArrowUp, CirclePlus, FilePenLine, Save, Trash2 } from "lucide-react";
import EditableField from "./EditExtractedData/EditableField";
import LineItems from "./EditExtractedData/LineItems";
import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react";
import { SelectDocType } from "./SelectDocType";
import { useSelector } from "react-redux";
import { useUpdateFileAndExtractedDataMutation } from "@/redux/slices/apiSlice";
import LoadingComponent from "./LoadingComponent";

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

    useEffect(()=>{
        console.log('CCC',currentFile);
        console.log('PP',processedFiles)
    },[currentFile])
    
    const currentClientCompanyEin = useSelector((state:{clientCompany:{current:{name:string,ein:string}}})=>state.clientCompany.current.ein);
    const [updateFile] = useUpdateFileAndExtractedDataMutation();
    const language = useSelector((state:{user:{language:string}})=>state.user.language);

    const handleUpdateButton = useCallback(async () => {
      try {
        setIsUpdating(true);
        const updatedFile = await updateFile({ 
          clientCompanyEin: currentClientCompanyEin, 
          processedData: currentFile.processedData[0].extractedFields,
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
      } finally {
        setIsUpdating(false);
      }
    }, [updateFile, currentClientCompanyEin, currentFile]);

    const toggleLineItems = useCallback(() => {
      setLineItems((prev) => !prev);
    }, []);

    const handleCloseModal = useCallback(() => {
      setIsModalOpen(false)
    }, []);
    
    const handleDeleteLineItems = useCallback(()=>{
        setCurrentFile({
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
    },[]);

    const handleCreateNewLineItem = useCallback(()=>{
        setCurrentFile({
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
    },[currentFile, setCurrentFile]);

    if(!isOpen) return null;

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
                          {language==='ro'?'Date extrase':'Extracted data'}
                        </h3>
                      </div>
                      
                      {!savedUpdates && !isUpdating && (
                        <button
                          className="bg-[var(--primary)] text-white px-6 py-2.5 rounded-2xl flex items-center gap-2 
                          hover:bg-[var(--primary)]/80 transition-all duration-200 font-medium shadow-sm"
                          onClick={handleUpdateButton}
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

                  {/* Content Section */}
                  <div className="p-6">
                    {currentFile && (
                      <div className="bg-[var(--foreground)] rounded-3xl border border-[var(--text4)] shadow-sm">
                        {/* Document Type Section */}
                        <div className="border-b border-[var(--text4)] p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="text-base font-semibold text-[var(--text1)] mb-2 block">
                                {language==='ro'?"Tipul Documentului":'Document Type'}
                              </label>
                            </div>
                            <div className="min-w-40 max-w-40">
                              <SelectDocType 
                                value={currentFile.processedData[0].extractedFields.result.document_type} 
                                editFile={{
                                  result: currentFile.processedData[0].extractedFields.result
                                }}
                                setEditFile={(updatedFields) => {
                                  setCurrentFile({
                                    ...currentFile,
                                    processedData: [
                                      {
                                        ...currentFile.processedData[0],
                                        extractedFields: updatedFields
                                      },
                                      ...currentFile.processedData.slice(1)
                                    ]
                                  });
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Form Fields Grid */}
                        <div className="p-6">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {currentFile.processedData[0].extractedFields.result.receipt_of && (
                              <div className="lg:col-span-2">
                                <EditableField
                                  label={language==='ro'?"Chitanță pentru factura nr.":"Receipt for Invoice No."}
                                  fieldName="receipt_of"
                                  editFile={{
                                    result: currentFile.processedData[0].extractedFields.result
                                  }}
                                  setEditFile={(updatedFile) => {
                                    setCurrentFile({
                                      ...currentFile,
                                      processedData: [
                                        {
                                          ...currentFile.processedData[0],
                                          extractedFields: {
                                            ...currentFile.processedData[0].extractedFields,
                                            result: updatedFile.result
                                          }
                                        },
                                        ...currentFile.processedData.slice(1)
                                      ]
                                    });
                                  }}
                                />
                              </div>
                            )}

                            <EditableField
                              label={language==='ro'?'Numărul documentului':'Document number'}
                              fieldName="document_number"
                              editFile={{
                                result: currentFile.processedData[0].extractedFields.result
                              }}
                              setEditFile={(updatedFile) => {
                                setCurrentFile({
                                  ...currentFile,
                                  processedData: [
                                    {
                                      ...currentFile.processedData[0],
                                      extractedFields: {
                                        ...currentFile.processedData[0].extractedFields,
                                        result: updatedFile.result
                                      }
                                    },
                                    ...currentFile.processedData.slice(1)
                                  ]
                                });
                              }}
                            />

                            <EditableField
                              label={language==='ro'?'Data':'Date'}
                              fieldName="document_date"
                              editFile={{
                                result: currentFile.processedData[0].extractedFields.result
                              }}
                              setEditFile={(updatedFile) => {
                                setCurrentFile({
                                  ...currentFile,
                                  processedData: [
                                    {
                                      ...currentFile.processedData[0],
                                      extractedFields: {
                                        ...currentFile.processedData[0].extractedFields,
                                        result: updatedFile.result
                                      }
                                    },
                                    ...currentFile.processedData.slice(1)
                                  ]
                                });
                              }}
                            />

                            <EditableField
                              label={language==='ro'?'Data scadenței':'Due date'}
                              fieldName="due_date"
                              editFile={{
                                result: currentFile.processedData[0].extractedFields.result
                              }}
                              setEditFile={(updatedFile) => {
                                setCurrentFile({
                                  ...currentFile,
                                  processedData: [
                                    {
                                      ...currentFile.processedData[0],
                                      extractedFields: {
                                        ...currentFile.processedData[0].extractedFields,
                                        result: updatedFile.result
                                      }
                                    },
                                    ...currentFile.processedData.slice(1)
                                  ]
                                });
                              }}
                            />

                            <EditableField
                              label={language==='ro'?'Cumpărător':'Buyer'}
                              fieldName="buyer"
                              editFile={{
                                result: currentFile.processedData[0].extractedFields.result
                              }}
                              setEditFile={(updatedFile) => {
                                setCurrentFile({
                                  ...currentFile,
                                  processedData: [
                                    {
                                      ...currentFile.processedData[0],
                                      extractedFields: {
                                        ...currentFile.processedData[0].extractedFields,
                                        result: updatedFile.result
                                      }
                                    },
                                    ...currentFile.processedData.slice(1)
                                  ]
                                });
                              }}
                            />

                            <EditableField
                              label={language==='ro'?'CUI Cumpărător':'Buyer EIN'}
                              fieldName="buyer_ein"
                              editFile={{
                                result: currentFile.processedData[0].extractedFields.result
                              }}
                              setEditFile={(updatedFile) => {
                                setCurrentFile({
                                  ...currentFile,
                                  processedData: [
                                    {
                                      ...currentFile.processedData[0],
                                      extractedFields: {
                                        ...currentFile.processedData[0].extractedFields,
                                        result: updatedFile.result
                                      }
                                    },
                                    ...currentFile.processedData.slice(1)
                                  ]
                                });
                              }}
                            />

                            <EditableField
                              label={language==='ro'?'Vânzător':'Vendor'}
                              fieldName="vendor"
                              editFile={{
                                result: currentFile.processedData[0].extractedFields.result
                              }}
                              setEditFile={(updatedFile) => {
                                setCurrentFile({
                                  ...currentFile,
                                  processedData: [
                                    {
                                      ...currentFile.processedData[0],
                                      extractedFields: {
                                        ...currentFile.processedData[0].extractedFields,
                                        result: updatedFile.result
                                      }
                                    },
                                    ...currentFile.processedData.slice(1)
                                  ]
                                });
                              }}
                            />

                            <EditableField
                              label={language==='ro'?'CUI Vânzător':'Vendor EIN'}
                              fieldName="vendor_ein"
                              editFile={{
                                result: currentFile.processedData[0].extractedFields.result
                              }}
                              setEditFile={(updatedFile) => {
                                setCurrentFile({
                                  ...currentFile,
                                  processedData: [
                                    {
                                      ...currentFile.processedData[0],
                                      extractedFields: {
                                        ...currentFile.processedData[0].extractedFields,
                                        result: updatedFile.result
                                      }
                                    },
                                    ...currentFile.processedData.slice(1)
                                  ]
                                });
                              }}
                            />

                            <EditableField
                              label={language==='ro'?'Suma totală':'Total amount'}
                              fieldName="total_amount"
                              editFile={{
                                result: currentFile.processedData[0].extractedFields.result
                              }}
                              setEditFile={(updatedFile) => {
                                setCurrentFile({
                                  ...currentFile,
                                  processedData: [
                                    {
                                      ...currentFile.processedData[0],
                                      extractedFields: {
                                        ...currentFile.processedData[0].extractedFields,
                                        result: updatedFile.result
                                      }
                                    },
                                    ...currentFile.processedData.slice(1)
                                  ]
                                });
                              }}
                            />

                            <EditableField
                              label={language==='ro'?'Total TVA':'VAT amount'}
                              fieldName="vat_amount"
                              editFile={{
                                result: currentFile.processedData[0].extractedFields.result
                              }}
                              setEditFile={(updatedFile) => {
                                setCurrentFile({
                                  ...currentFile,
                                  processedData: [
                                    {
                                      ...currentFile.processedData[0],
                                      extractedFields: {
                                        ...currentFile.processedData[0].extractedFields,
                                        result: updatedFile.result
                                      }
                                    },
                                    ...currentFile.processedData.slice(1)
                                  ]
                                });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Line Items Section */}
                    {currentFile.processedData[0].extractedFields.result.line_items && (
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
                          {language==='ro'?((lineItems ?'Ascunde ':'Arată ')):((lineItems ? 'Hide ' : 'Show '))}
                          {language==='ro'?'articole':'line items'}
                          <span className="bg-white/20 text-xs px-2 py-1 rounded-full">
                            {currentFile.processedData[0].extractedFields.result.line_items?.length || 0}
                          </span>
                        </motion.button>

                        <AnimatePresence>
                          {lineItems && currentFile.processedData[0].extractedFields.result.line_items && (
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
                                  {language==='ro'?'Creează articol':'New item'}
                                </button>

                                <button 
                                  className='bg-red-500/10 hover:bg-red-500 
                                  hover:text-white text-red-500 px-4 py-2.5 rounded-2xl
                                  flex items-center gap-2 transition-all duration-200 font-medium'
                                  onClick={() => {handleDeleteLineItems(); toggleLineItems()}}
                                >
                                  <Trash2 size={18} />
                                  {language==='ro'?'Șterge articole':'Delete items'}
                                </button>
                              </div>

                              {/* Line Items List */}
                              <div className="space-y-4">
                                {currentFile.processedData[0].extractedFields.result.line_items.map((item: Item, index: number) => (
                                  <LineItems
                                    key={`line-item-${index}`}
                                    setEditFile={(newValue) => {
                                      setCurrentFile({
                                        ...currentFile,
                                        processedData: [
                                          {
                                            ...currentFile.processedData[0],
                                            extractedFields: newValue
                                          },
                                          ...currentFile.processedData.slice(1)
                                        ]
                                      });
                                    }}
                                    editFile={{
                                      result: currentFile.processedData[0].extractedFields.result
                                    }}
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
import { AnimatePresence, motion } from "framer-motion";
import DocumentViewer from "./EditExtractedData/DocumentViewer";
import { ArrowUp, CirclePlus, FilePenLine, Save, Trash2 } from "lucide-react";
import EditableField from "./EditExtractedData/EditableField";
import LineItems from "./EditExtractedData/LineItems";
import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react";
import { SelectDocType } from "./SelectDocType";
import { useSelector } from "react-redux";
import { useUpdateFileAndExtractedDataMutation } from "@/redux/slices/apiSlice";

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

const EditExtractedDataManagement = ({ setProcessedFiles,processedFiles, setIsModalOpen, isOpen, currentFile,setCurrentFile }: EditExtractedDataManagementProps) => {

    const [lineItems, setLineItems] = useState<boolean>(false);
    const [savedUpdates, setSavedUpdates] = useState<boolean>(false);

    useEffect(()=>{
        console.log('CCC',currentFile);

        console.log('PP',processedFiles)
    },[currentFile])
    
    const currentClientCompanyEin =  useSelector((state:{clientCompany:{current:{name:string,ein:string}}})=>state.clientCompany.current.ein);
    const [updateFile] = useUpdateFileAndExtractedDataMutation();
    const language = useSelector((state:{user:{language:string}})=>state.user.language);

    const handleUpdateButton = useCallback(async () => {
      try {
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
        <div className="bg-black/80 fixed inset-0 min-w-vw min-h-vh flex justify-center items-center">
        <motion.div 
          className="bg-[var(--foreground)] max-w-[70rem] min-h-[95vh] min-w-[70rem] max-h-[95vh] rounded-3xl flex"
          variants={containerVariants}
        >

        <DocumentViewer onClose={handleCloseModal} signedUrl={currentFile.signedUrl}>
        </DocumentViewer>

          <div className="flex-1 relative">

            <div className={`h-full overflow-auto transition-opacity duration-300 opacity-100`}>
              <div className="flex flex-row justify-between items-center p-5 pb-0">
                <h3 className="text-left font-bold text-3xl
                text-[var(--text1)]">{language==='ro'?'Date extrase':'Extracted data'}</h3>
                {!savedUpdates&&(
                <button
                  className="bg-[var(--primary)] max-h-8 p-2 px-2 flex justify-center items-center gap-1 hover:text-[var(--primary)] hover:bg-[var(--primary)]/20"
                  onClick={handleUpdateButton}
                >
                  <FilePenLine size={15} />
                  {language==='ro'?'Actualizeaza':'Update'}
                </button>)}
                {savedUpdates&&(
                <div className="text-xl font-bold text-green-600 flex
                items-center gap-3">
                {language==='ro'?'Salvat':'Saved'}
                <Save size={20}/>
                </div>
                )}
              </div>

              <div className="p-4 flex justify-center items-center min-h-[790px] flex-col">
    
                  <div className="bg-[var(--background)] rounded-3xl min-h-[790px] flex-1 grid grid-cols-2">
                    <div className="p-4 flex justify-center items-center
                    text-[var(--text1)] font-bold">{language==='ro'?'Tipul documentului':'Document type'}</div>

                
                    <div className="p-4 flex justify-center items-center">
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

                    {currentFile.processedData[0].extractedFields.result.receipt_of && (
                    <EditableField
                        label={language==='ro'?"Chitanta pentru factura nr.":"Receipt for Invoice No."}
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
                    )}

                    <EditableField
                      label={language==='ro'?'Numarul documentului':'Document number'}
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
                      label={language==='ro'?'Data scadentei':'Due date'}
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
                      label={language==='ro'?'Cumparator':'Buyer'}
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
                      label={language==='ro'?'CUI Cumparator':'Buyer EIN'}
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
                      label={language==='ro'?'Vanzator':'Vendor'}
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
                      label={language==='ro'?'CUI Vanzator':'Vendor EIN'}
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
                      label={language==='ro'?'Suma totala':'Total amount'}
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
                      label={language==='ro'?'Total TVA':'Vat amount'}
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

                {currentFile.processedData[0].extractedFields.result.line_items && (
                  <motion.button
                    className="bg-[var(--primary)] mt-10 rounded-2xl flex flex-row items-center gap-5 p-2 px-4"
                    onClick={toggleLineItems}
                    whileTap={{ y: 2 }}
                  >
                   {language==='ro'?((lineItems ?'Ascunde ':'Arata ')):((lineItems ? 'Hide ' : 'Show '))}
                   {language==='ro'?'articole':'line items'}
                    <ArrowUp
                      size={20}
                      className={lineItems ? 'rotate-180' : 'rotate-90'}
                    />
                  </motion.button>
                )}
                
                <AnimatePresence>
                  {lineItems &&(
                    <div className="w-full">
                      <div className='flex justify-center gap-4 items-center mt-10 bg-[var(--background)] p-5
                      rounded-2xl'>
                        <button className='hover:bg-[var(--primary)] bg-[var(--primary)]/30
                         hover:text-white text-[var(--primary)] p-2 rounded-2xl
                        flex items-center justify-center gap-3'
                        onClick={handleCreateNewLineItem}>
                          <CirclePlus size={20}></CirclePlus>
                          {language==='ro'?'Creeaza articol':'New item'}
                        </button>

                        <button className='hover:bg-red-500 bg-red-500/30
                         hover:text-white text-red-500 p-2 rounded-2xl
                         flex items-center justify-center gap-3'
                         onClick={()=>{handleDeleteLineItems(); toggleLineItems()}}>
                          <Trash2 size={20}></Trash2>
                          {language==='ro'?'Sterge articole':'Delete items'}
                        </button>
                      </div>
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
                  )}
                </AnimatePresence> 
                </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

export default EditExtractedDataManagement

import { useEffect, useState, useCallback, memo, SetStateAction, Dispatch } from 'react';
import LoadingComponent from '../LoadingComponent';
import { ArrowUp, CirclePlus, Save, Trash2 } from 'lucide-react';
import { SelectDocType } from '../SelectDocType';
import { useSaveFileAndExtractedDataMutation } from '@/redux/slices/apiSlice';
import EditableField from './EditableField';
import LineItems from './LineItems';
import { AnimatePresence, motion } from 'framer-motion';
import AreYouSureModal from '../AreYouSureModal';
import DocumentViewer from './DocumentViewer';
import { useSelector } from 'react-redux';

interface EditExtractedDataProps {
  isLoading: boolean;
  editFile?: {
    result: Record<string, any>;
  };
  setEditFile: (value: any) => void;
  setIsModalOpen: (val: boolean) => void;
  isOpen: boolean;
  currentFile: File | null;
  setCurrentProcessingFile:(t:any)=>void;
  setProcessedFiles:Dispatch<SetStateAction<Record<string, any>>>;
  processedFiles: Record<string, any>;
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

const EditExtractedDataComponent = ({ isLoading, setProcessedFiles,processedFiles, editFile, setEditFile, setIsModalOpen, isOpen, currentFile, setCurrentProcessingFile }: EditExtractedDataProps) => {
  
  const [saveFileAndData, {isLoading:isSaving}] = useSaveFileAndExtractedDataMutation();
  const [lineItems, setLineItems] = useState<boolean>(false);
  const [closeModal, setCloseModal] = useState<boolean>(false);
  const [internalLoading, setInternalLoading] = useState(isLoading);
  const [contentVisible, setContentVisible] = useState(false);

  console.log('editFile:',editFile);

  const currentClientCompanyEin =  useSelector((state:{clientCompany:{current:{name:string,ein:string}}})=>state.clientCompany.current.ein);
  const language =useSelector((state:{user:{language:string}})=>state.user.language);

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
    try {
      const fileSaved = await saveFileAndData({ 
        clientCompanyEin: currentClientCompanyEin, 
        processedData: editFile ,
        file: currentFile
      }).unwrap();
      console.log('Saved File', fileSaved);
      setProcessedFiles({...processedFiles, [currentFile?.name || '']: currentFile?.name ? {...processedFiles[currentFile.name], saved:true} : null})
      setIsModalOpen(false);
      setCurrentProcessingFile(null);

    } catch (e) {
      console.error('Failed to save the document and the data:', e);
    }
  }, [saveFileAndData, currentClientCompanyEin,editFile,currentFile]);

  const toggleLineItems = useCallback(() => {
    setLineItems((prev) => !prev);
  }, []);

  const handleCloseModal = useCallback(() => {
    setCloseModal(true);
    setCurrentProcessingFile(null);
  }, []);

  const handleDeleteLineItems = useCallback(()=>{
    setEditFile({
      ...editFile,
      result: {
        ...editFile?.result,
        line_items: []
      },
    });
  },[editFile,setEditFile]);

  const handleCreateNewLineItem = useCallback(()=>{
    setEditFile({
      ...editFile,
      result:{
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
    })
  },[editFile,setEditFile]);

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
                      {language==='ro'?'Date extrase':'Extracted data'}
                    </h3>
                    <p className="text-sm text-[var(--text3)]">
                      {language==='ro'?'Verifică și editează informațiile extrase':'Review and edit extracted information'}
                    </p>
                  </div>
                  
                  {!isSaving && (
                    <button
                      className="bg-[var(--primary)] text-white px-6 py-2.5 rounded-2xl flex items-center gap-2 
                      hover:bg-[var(--primary)]/80 transition-all duration-200 font-medium shadow-sm"
                      onClick={handleSaveButton}
                    >
                      <Save size={16} />
                      {language==='ro'?'Salvează':'Save'}
                    </button>
                  )}
                  
                  {isSaving && (
                    <div className='fixed inset-0 bg-black/50 flex justify-center items-center z-50'>
                      <div className='bg-[var(--foreground)] p-8 rounded-3xl shadow-2xl border border-[var(--text4)]'>
                        <LoadingComponent />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Content Section */}
              <div className="p-6">
                {editFile && (
                  <div className="bg-[var(--foreground)] rounded-3xl border border-[var(--text4)] shadow-sm">
                    {/* Document Type Section */}
                    <div className="border-b border-[var(--text4)] p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-semibold text-[var(--text1)] mb-2 block">
                            {language==='ro'?"Tipul Documentului":'Document Type'}
                          </label>
                          <p className="text-xs text-[var(--text3)]">
                            {language==='ro'?'Selectează tipul documentului':'Select the document type'}
                          </p>
                        </div>
                        <div className="min-w-48">
                          <SelectDocType value={editFile?.result.document_type} 
                          editFile={editFile} setEditFile={setEditFile}/>
                        </div>
                      </div>
                    </div>

                    {/* Form Fields Grid */}
                    <div className="p-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {editFile?.result.receipt_of && (
                          <div className="lg:col-span-2">
                            <EditableField
                              label={language==='ro'?"Chitanta pentru factura nr.":"Receipt for Invoice No."}
                              fieldName="receipt_of"
                              editFile={editFile}
                              setEditFile={setEditFile}
                            />
                          </div>
                        )}

                        <EditableField
                          label={language==='ro'?'Numarul documentului':'Document number'}
                          fieldName="document_number"
                          editFile={editFile}
                          setEditFile={setEditFile}
                        />

                        <EditableField
                          label={language==='ro'?'Data':'Date'}
                          fieldName="document_date"
                          editFile={editFile}
                          setEditFile={setEditFile}
                        />

                        <EditableField
                          label={language==='ro'?'Data scadentei':'Due date'}
                          fieldName="due_date"
                          editFile={editFile}
                          setEditFile={setEditFile}
                        />

                        <EditableField
                          label={language==='ro'?'Cumparator':'Buyer'}
                          fieldName="buyer"
                          editFile={editFile}
                          setEditFile={setEditFile}
                        />

                        <EditableField
                          label={language==='ro'?'CUI Cumparator':'Buyer EIN'}
                          fieldName="buyer_ein"
                          editFile={editFile}
                          setEditFile={setEditFile}
                        />

                        <EditableField
                          label={language==='ro'?'Vanzator':'Vendor'}
                          fieldName="vendor"
                          editFile={editFile}
                          setEditFile={setEditFile}
                        />

                        <EditableField
                          label={language==='ro'?'CUI Vanzator':'Vendor EIN'}
                          fieldName="vendor_ein"
                          editFile={editFile}
                          setEditFile={setEditFile}
                        />

                        <EditableField
                          label={language==='ro'?'Suma totala':'Total amount'}
                          fieldName="total_amount"
                          editFile={editFile}
                          setEditFile={setEditFile}
                        />

                        <EditableField
                          label={language==='ro'?'Total TVA':'Vat amount'}
                          fieldName="vat_amount"
                          editFile={editFile}
                          setEditFile={setEditFile}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Line Items Section */}
                {editFile?.result.line_items && (
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
                            {editFile.result.line_items.map((item: Item, index: number) => (
                              <LineItems
                                key={`line-item-${index}`}
                                setEditFile={setEditFile}
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
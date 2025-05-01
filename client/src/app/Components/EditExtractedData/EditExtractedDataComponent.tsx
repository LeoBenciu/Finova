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
  
  const [saveFileAndData] = useSaveFileAndExtractedDataMutation();
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
      <div className="bg-black/80 fixed inset-0 min-w-vw min-h-vh flex justify-center items-center">
        <motion.div 
          className="bg-[var(--foreground)] max-w-[70rem] min-h-[95vh] min-w-[70rem] max-h-[95vh] rounded-3xl flex"
          variants={containerVariants}
        >
          <DocumentViewer onClose={handleCloseModal} currentFile={currentFile}/>

          <div className="flex-1 relative">
            {internalLoading && (
              <div className="absolute inset-0 flex justify-center items-center bg-[var(--foreground)] rounded-tr-3xl rounded-br-3xl z-10">
                <div className="w-[150px] bg-[var(--background)] rounded-4xl py-6 px-5">
                  <LoadingComponent />
                </div>
              </div>
            )}

            <div className={`h-full overflow-auto transition-opacity duration-300 ${contentVisible ? 'opacity-100' : 'opacity-0'}`}>
              <div className="flex flex-row justify-between items-center p-5 pb-0">
                <h3 className="text-left font-bold text-3xl
                text-[var(--text1)]">{language==='ro'?'Date extrase':'Extracted data'}</h3>
                <button
                  className="bg-[var(--primary)] max-h-8 p-2 px-4 flex justify-center items-center gap-2 hover:text-[var(--primary)] hover:bg-[var(--primary)]/20"
                  onClick={handleSaveButton}
                >
                  <Save size={15} />
                  Save
                </button>
              </div>

              <div className="p-4 flex justify-center items-center min-h-[790px] flex-col">
                {editFile && (
                  <div className="bg-[var(--background)] rounded-3xl min-h-[790px] flex-1 grid grid-cols-2">
                    <div className="p-4 flex justify-center items-center
                    text-[var(--text2)] font-bold">{language==='ro'?"Tipul Documentului":'Document Type'}</div>
                    <div className="p-4 flex justify-center items-center">
                      <SelectDocType value={editFile?.result.document_type} 
                      editFile={editFile} setEditFile={setEditFile}/>
                    </div>

                    {editFile?.result.receipt_of && (
                      <EditableField
                        label={language==='ro'?"Chitanta pentru factura nr.":"Receipt for Invoice No."}
                        fieldName="receipt_of"
                        editFile={editFile}
                        setEditFile={setEditFile}
                      />
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
                )}

                {editFile?.result.line_items && (
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
                  {lineItems && editFile?.result.line_items && (
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
                  )}
                </AnimatePresence>
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
import InitialClientCompanyModalSelect from '@/app/Components/InitialClientCompanyModalSelect';
import { useDeleteFileAndExtractedDataMutation, useGetFilesQuery, useInsertClientInvoiceMutation, useGetJobStatusQuery } from '@/redux/slices/apiSlice';
import { Bot, Eye, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import EditExtractedDataManagement from '../Components/EditExtractedDataManagement';
import { Trash2 } from 'lucide-react';
import { MyTooltip } from '../Components/MyTooltip';
import AreYouSureModalR from '../Components/AreYouSureModalR';
import FilesSearchFiltersComponent from '../Components/FilesSearchFiltersComponent';
import {format, parse, compareAsc, addDays} from 'date-fns'

type clientCompanyName = {
  clientCompany:{
    current:{
      name:string,
      ein:string
    }
  }
}

export type documentType = 'Invoice' | 'Receipt';

const FileManagementPage = () => {

  const [isModalOpen,setIsModalOpen] = useState<boolean>(false);
  const [files, setFiles] = useState<Record<string,any>>({});
  const [filteredFiles, setFilteredFiles] = useState<Record<string,any>>({});
  const [currentFile, setCurrentFile] = useState<Record<string,any>>({});
  const [isSureModal, setIsSureModal] = useState<boolean>(false);
  const [processingDocId, setProcessingDocId] = useState<number | null>(null);
  const [statusPolling, setStatusPolling] = useState<NodeJS.Timeout | null>(null);
  const [pollingAttempts, setPollingAttempts] = useState<number>(0);
  const [maxPollingAttempts] = useState<number>(100);
  if (false){
    console.log(pollingAttempts)
  }

  const[nameSearch, setNameSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<documentType>();
  const [intervalDateFilter, setIntervalDateFilter] = useState<{
    from: string|undefined,
    to:string|undefined
  }>({
    from: undefined,
    to:undefined,
  });

  useEffect(()=>{
    console.log('files:',files);
  },[files])

  useEffect(()=>{
    console.log('IntervalDateFitler:', filteredFiles);
  },[filteredFiles])

  useEffect(()=>{
    if(!files?.documents) return;
    
    let newFilteredFiles = files.documents;
    if(nameSearch.length>0){
       newFilteredFiles = newFilteredFiles.filter((file:any)=>(
        file.name.toLowerCase().includes(nameSearch.toLowerCase())
      ))
    };
    if(typeFilter){
      newFilteredFiles = newFilteredFiles.filter((file:any)=>(
        file.type===typeFilter
      ))
    };
    if(intervalDateFilter.from !== undefined){
      const date1 = parse(intervalDateFilter.from, 'dd-MM-yyyy', new Date());
      newFilteredFiles = newFilteredFiles.filter((file:any)=>(
        compareAsc(file.createdAt, date1) >=0
      ))
    }
    if(intervalDateFilter.to !== undefined){
      const date2 = parse(intervalDateFilter.to, 'dd-MM-yyyy', new Date());
      const date2End = addDays(date2,1);
      newFilteredFiles = newFilteredFiles.filter((file:any)=>(
        compareAsc(file.createdAt, date2End) <0
      ))
    }

    setFilteredFiles({
      ...files,
      documents: newFilteredFiles
    })
  },[typeFilter, setTypeFilter,nameSearch, 
    setNameSearch,intervalDateFilter,setIntervalDateFilter, files]);

  const clientCompanyEin = useSelector((state:clientCompanyName)=>state.clientCompany.current.ein);
  const { data: filesData } = useGetFilesQuery({company:clientCompanyEin});
  const [ deleteFile ] = useDeleteFileAndExtractedDataMutation();
  const [ processAutomation ] = useInsertClientInvoiceMutation();
  const language = useSelector((state:{user:{language:string}})=>state.user.language);
  const clientCompanyName = useSelector((state:clientCompanyName)=>state.clientCompany.current.name);
  
  const { data: jobStatus, error: jobStatusError, refetch: refetchJobStatus } = useGetJobStatusQuery(
    processingDocId || 0, 
    { skip: !processingDocId }
  );

  const updateDocumentStatus = (docId: number, status: string) => {
    const updateDocs = (docs: any[]) => {
      return docs.map((doc: any) => {
        if (doc.id === docId) {
          return {
            ...doc,
            rpa: [{ status: status }]
          };
        }
        return doc;
      });
    };

    if (files?.documents) {
      const updatedDocs = updateDocs(files.documents);
      setFiles(prev => ({...prev, documents: updatedDocs}));
      setFilteredFiles(prev => ({...prev, documents: updatedDocs}));
    }
  };

  const startStatusPolling = (docId: number) => {
    console.log(`[Frontend] Starting status polling for document ${docId}`);
    
    if (statusPolling) {
      clearInterval(statusPolling);
    }
    
    setProcessingDocId(docId);
    setPollingAttempts(0);
    
    setTimeout(() => {
      const interval = setInterval(() => {
        setPollingAttempts(prev => {
          const newAttempts = prev + 1;
          console.log(`[Frontend] Polling attempt ${newAttempts} for document ${docId}`);
          
          if (newAttempts >= maxPollingAttempts) {
            console.log(`[Frontend] Max polling attempts reached for document ${docId}`);
            clearInterval(interval);
            setStatusPolling(null);
            setProcessingDocId(null);
            
            updateDocumentStatus(docId, 'TIMEOUT');
            
            return newAttempts;
          }
          
          refetchJobStatus();
          return newAttempts;
        });
      }, 5000); 
      
      setStatusPolling(interval);
    }, 45000);
  };

  useEffect(() => {
    if (jobStatusError) {
      console.error(`[Frontend ERROR] Job status error:`, jobStatusError);
      
      if (statusPolling && processingDocId) {
        clearInterval(statusPolling);
        setStatusPolling(null);
        
        console.log(`[Frontend] Error checking job status, but continuing to poll`);
      }
    }
    
    if (jobStatus) {
      console.log(`[Frontend] Received job status:`, jobStatus);
      
      const currentStatus = jobStatus.status;
      
      if (currentStatus !== 'PENDING' && statusPolling) {
        console.log(`[Frontend] Job completed with status: ${currentStatus}`);
        clearInterval(statusPolling);
        setStatusPolling(null);
        
        if (processingDocId !== null) {
          updateDocumentStatus(processingDocId, currentStatus);
        }
        
        setProcessingDocId(null);
        setPollingAttempts(0);
      }
    }
  }, [jobStatus, jobStatusError, statusPolling, processingDocId]);

  useEffect(() => {
    return () => {
      if (statusPolling) {
        clearInterval(statusPolling);
      }
    };
  }, [statusPolling]);

  const handleDeleteFileButton = async(docId:number)=>{
    try {
      await deleteFile({clientCompanyEin,docId}).unwrap();
      if(files?.documents) {
        const updatedDocuments = files.documents.filter((file:any) => file.id !== docId);
        setFiles(prev => ({...prev, documents: updatedDocuments}));
        setFilteredFiles(prev => ({...prev, documents: updatedDocuments}));
      }
      setCurrentFile({});
    } catch (e) {
      console.error('Failed to delete the file and data from the database', e)
    }
  };

  const handleProcessAutomation = async(id: number) => {
    console.log(`[Frontend] Starting automation process for document ${id}`);
    
    try {
      updateDocumentStatus(id, 'PENDING');
      
      startStatusPolling(id);
      
      console.log(`[Frontend] Calling processAutomation API for document ${id}`);
      const result = await processAutomation({id, currentClientCompanyEin: clientCompanyEin}).unwrap();
      console.log(`[Frontend] UiPath automation API response:`, result);
      
    } catch (e) {
      console.error(`[Frontend ERROR] Failed to process automation for document ${id}:`, e);
      
      if (statusPolling) {
        clearInterval(statusPolling);
        setStatusPolling(null);
      }
      setProcessingDocId(null);
      setPollingAttempts(0);
      
      updateDocumentStatus(id, 'FAILED');
      
      console.log(`[Frontend] Process automation failed - user should be notified`);
    }
  };

  const handleCheckStatus = async(id: number) => {
    console.log(`[Frontend] Manual status check for document ${id}`);
    setProcessingDocId(id);
    
    try {
      const statusResult = await refetchJobStatus();
      console.log(`[Frontend] Manual status check result:`, statusResult);
      
      setTimeout(() => {
        if (processingDocId === id) {
          setProcessingDocId(null);
        }
      }, 2000);
      
    } catch (error) {
      console.error(`[Frontend ERROR] Manual status check failed:`, error);
      setProcessingDocId(null);
    }
  };

  useEffect(()=>{
    if(filesData) {
      setFiles(filesData);
      setFilteredFiles(filesData);
    }
  },[filesData, deleteFile])
  
  const handleTooLongString = useCallback((str: string): string => {
    if (str.length > 18) return str.slice(0, 18) + '..';
    return str;
  }, []);

  const getStatusDisplay = (file: any) => {
    if (file.id === processingDocId) {
      return language === 'ro' ? 'Se verifică...' : 'Checking...';
    }
    
    if (file.rpa && file.rpa.length > 0) {
      const status = file.rpa[0].status;
      switch (status) {
        case 'COMPLETED':
          return language === 'ro' ? 'Completat' : 'Completed';
        case 'FAILED':
          return language === 'ro' ? 'Eșuat' : 'Failed';
        case 'PENDING':
          return language === 'ro' ? 'În procesare' : 'Processing';
        case 'TIMEOUT':
          return language === 'ro' ? 'Timeout' : 'Timeout';
        default:
          return language === 'ro' ? 'Necunoscut' : 'Unknown';
      }
    }
    
    return language === 'ro' ? 'În așteptare' : 'Ready';
  };

  const getStatusColor = (file: any) => {
    if (file.id === processingDocId) {
      return 'text-blue-500';
    }
    
    if (file.rpa && file.rpa.length > 0) {
      const status = file.rpa[0].status;
      switch (status) {
        case 'COMPLETED':
          return 'text-green-500';
        case 'FAILED':
          return 'text-red-500';
        case 'PENDING':
          return 'text-yellow-500';
        case 'TIMEOUT':
          return 'text-orange-500';
        default:
          return 'text-gray-500';
      }
    }
    return 'text-gray-400';
  };

  const isBotButtonDisabled = (file: any) => {
    if (file.id === processingDocId) return true;
    if (file.rpa && file.rpa.length > 0) {
      const status = file.rpa[0].status;
      return status === 'COMPLETED' || status === 'PENDING';
    }
    return false;
  };

  const getBotButtonTooltip = (file: any) => {
    if (file.rpa && file.rpa.length > 0 && file.rpa[0].status === 'COMPLETED') {
      return language === 'ro' ? 'Deja procesat' : 'Already processed';
    }
    if (file.id === processingDocId || (file.rpa && file.rpa.length > 0 && file.rpa[0].status === 'PENDING')) {
      return language === 'ro' ? 'Se procesează...' : 'Processing...';
    }
    return language === 'ro' ? 'Procesează date' : 'Submit data';
  };

  return (
    <div>
      <div>
        <h1 className="mb-10 text-4xl font-bold text-left
        text-[var(--text1)]">{language==='ro'?'Management Documente':'File Management'}</h1>
      </div>

      <FilesSearchFiltersComponent 
      nameSearch={nameSearch}
      setNameSearch={setNameSearch}
      setTypeFilter={setTypeFilter}
      intervalDate={intervalDateFilter}
      setIntervalDate={setIntervalDateFilter}/>

      <div className="bg-[var(--foreground)] min-w-full  
      min-h-max max-h-[1000px] rounded-2xl my-auto p-5">
        
        <div className='border-[1px] rounded-2xl min-h-52
        border-[var(--card)] '>
          <div className='min-w-full min-h-10 max-h-10
           rounded-t-2xl bg-[var(--text1)] grid
           grid-cols-6 border-[1px] border-[var(--text1)]'>
              <div className='flex items-center justify-center '>
                <p>{language==='ro'?'Nume':'Name'}</p>
              </div>

              <div className='flex items-center justify-center'>
                <p>{language==='ro'?'Tipul':'Type'}</p>
              </div>

              <div className='flex items-center justify-center'>
                <p>{language==='ro'?'Creat la data':'Created at'}</p> 
              </div>

              <div className='flex items-center justify-center'>
                <p>{language==='ro'?'Date extrase':'Extracted data'}</p>
              </div>

              <div className='flex items-center justify-center'>
                <p>Status</p> 
              </div>

              <div className='flex items-center justify-center '>
                <p>{language==='ro'?'Actiuni':'Actions'}</p>
              </div>
          </div>

          {filteredFiles?.documents?.map((file:any)=>{
            return (
             <div key={file.name} className='min-w-full min-h-12 max-h-12 grid
             grid-cols-6'>
                 <div className='flex items-center justify-center '>
                 <MyTooltip content={file.name} trigger={
                   <a href={file.signedUrl} target="_blank" rel="noopener noreferrer"
                   className='cursor-pointer'>
                    { handleTooLongString(file.name)}
                   </a>
                 }/>
                 </div>

                 <div className='flex items-center justify-center'>
                     <p className='text-[var(--text1)]'>{language==='ro'?(file.type==='Invoice'?'Factura':'Chitanta'):file.type}</p>
                 </div>

                 <div className='flex items-center justify-center'>
                     <p className='text-[var(--text1)]'>{format(file.createdAt,'dd-MM-yyyy')}</p> 
                 </div>

                 <div className='flex items-center justify-center
                 text-[var(--primary)] hover:cursor-pointer gap-1
                 hover:text-[var(--primary)]/70 font-bold' onClick={()=>{
                   setIsModalOpen(true);
                   setCurrentFile(file)
                 }}>
                   <Eye  size={20} 
                   className='cursor-pointer'/>
                   {language==='ro'?'Vezi':'View'}
                 </div>

                 <div className='flex items-center justify-center'>
                    <p className={`${getStatusColor(file)} font-medium`}>
                      {getStatusDisplay(file)}
                    </p>
                    {file.id === processingDocId && (
                      <RefreshCw size={16} className="ml-2 animate-spin text-blue-500" />
                    )}
                    {file.rpa && file.rpa.length > 0 && file.rpa[0].status === 'PENDING' && file.id !== processingDocId && (
                      <MyTooltip content={language === 'ro' ? 'Verifică status' : 'Check status'} trigger={
                        <RefreshCw 
                          size={16} 
                          className="ml-2 cursor-pointer text-blue-500 hover:text-blue-700 transition-colors" 
                          onClick={() => handleCheckStatus(file.id)}
                        />
                      }/>
                    )}
                    {file.rpa && file.rpa.length > 0 && file.rpa[0].status === 'FAILED' && (
                      <span 
                        className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded cursor-pointer hover:bg-red-200 transition-colors"
                        onClick={() => handleProcessAutomation(file.id)}
                        title={language === 'ro' ? 'Încearcă din nou' : 'Retry'}
                      >
                        {language === 'ro' ? 'Retry' : 'Retry'}
                      </span>
                    )}
                  </div>

                 <div className='flex items-center justify-center gap-5'>
                   <MyTooltip content={getBotButtonTooltip(file)} trigger={
                     <Bot 
                       size={24} 
                       className={`${
                         isBotButtonDisabled(file) 
                           ? 'text-gray-400 cursor-not-allowed' 
                           : 'hover:text-[var(--primary)]/70 text-[var(--primary)] cursor-pointer'
                       }`}
                       onClick={() => {
                         if (!isBotButtonDisabled(file)) {
                           handleProcessAutomation(file.id);
                         }
                       }}
                     />
                   }/>
                   
                   <MyTooltip content={language==='ro'?'Șterge Fișiere și date':'Delete File and Data'} trigger={
                     <Trash2 
                       size={20} 
                       className="text-red-500 cursor-pointer hover:text-red-700 transition-colors" 
                       onClick={()=>{
                         setIsSureModal(true);
                         setCurrentFile(file);
                       }}
                     />
                   }/>
                 </div>
             </div>
          )})}
        </div>

      </div>  

      {isModalOpen&&(<EditExtractedDataManagement
      setIsModalOpen={setIsModalOpen}
      isOpen={isModalOpen}
      processedFiles={files}
      setProcessedFiles={setFilteredFiles}
      currentFile ={currentFile}
      setCurrentFile={setCurrentFile}
      />)}

      {isSureModal&&(
        <AreYouSureModalR setIsSureModal={setIsSureModal} setAction={()=>handleDeleteFileButton(currentFile?.processedData?.[0]?.documentId || currentFile?.id)} confirmButton={language==='ro'?'Șterge':'Delete'}
        text={language==='ro'?"Ești sigur/ă că vrei să ȘTERGI permanent fișierul și datele aferente acestuia?":"Are you sure you want to permanently DELETE the file and it's data?"}/>
      )}

      {clientCompanyName===''&&(<InitialClientCompanyModalSelect/>)}
    </div>
  )
}

export default FileManagementPage
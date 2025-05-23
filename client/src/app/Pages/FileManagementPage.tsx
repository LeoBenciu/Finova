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
  },[])

  useEffect(()=>{
    console.log('IntervalDateFitler:', filteredFiles);
  },[filteredFiles])

  useEffect(()=>{
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
    setNameSearch,intervalDateFilter,setIntervalDateFilter]);

  const clientCompanyEin = useSelector((state:clientCompanyName)=>state.clientCompany.current.ein);
  const { data: filesData } = useGetFilesQuery({company:clientCompanyEin});
  const [ deleteFile ] = useDeleteFileAndExtractedDataMutation();
  const [ processAutomation ] = useInsertClientInvoiceMutation();
  const language = useSelector((state:{user:{language:string}})=>state.user.language);
  const clientCompanyName = useSelector((state:clientCompanyName)=>state.clientCompany.current.name);
  
  const { data: jobStatus, refetch: refetchJobStatus } = useGetJobStatusQuery(
    processingDocId || 0, 
    { skip: !processingDocId }
  );

  const startStatusPolling = (docId: number) => {
    if (statusPolling) {
      clearInterval(statusPolling);
    }
    
    setProcessingDocId(docId);
    
    const interval = setInterval(() => {
      refetchJobStatus();
    }, 3000); 
    
    setStatusPolling(interval);
  };

  useEffect(() => {
    if (jobStatus && jobStatus.status !== 'PENDING' && statusPolling) {
      clearInterval(statusPolling);
      setStatusPolling(null);
      
      if (files.documents) {
        interface Document {
          id: number;
          rpa?: Array<{ status: string }>;
          [key: string]: any;
        }

        interface JobStatus {
          status: string;
          [key: string]: any; 
        }

        const updatedDocs: Document[] = files.documents.map((doc: Document) => {
          if (doc.id === processingDocId) {
            return {
              ...doc,
              rpa: [{ status: (jobStatus as JobStatus).status }]
            };
          }
          return doc;
        });
        
        setFiles(prev => ({...prev, documents: updatedDocs}));
        setFilteredFiles(prev => ({...prev, documents: updatedDocs}));
      }
      
      setProcessingDocId(null);
    }
  }, [jobStatus, statusPolling]);

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
      const updatedDocuments = files.documents.filter((file:any) => file.id !== docId);
      setFilteredFiles({...files, documents: updatedDocuments});
      setCurrentFile({});
    } catch (e) {
      console.error('Failed to delete the file and data from the database', e)
    }
  };

  const handleProcessAutomation = async(id:number)=>{
    try {
      const updatedDocs = files.documents.map((doc: { id: number; rpa?: Array<{ status: string }>; [key: string]: any }) => {
        if (doc.id === id) {
          return {
            ...doc,
            rpa: [{ status: 'PENDING' }]
          };
        }
        return doc;
      });
      
      setFiles(prev => ({...prev, documents: updatedDocs}));
      setFilteredFiles(prev => ({...prev, documents: updatedDocs}));
      
      startStatusPolling(id);
      
      const result = await processAutomation({id, currentClientCompanyEin: clientCompanyEin}).unwrap();
      console.log('UiPath automation started:', result);
      
      
    } catch (e) {
      console.error('Failed to process the automation in the accounting software', e);
      
      const updatedDocs = files.documents.map((doc: { id: number; rpa?: Array<{ status: string }>; [key: string]: any }) => {
        if (doc.id === id) {
          return {
            ...doc,
            rpa: [{ status: 'FAILED' }]
          };
        }
        return doc;
      });
      
      setFiles(prev => ({...prev, documents: updatedDocs}));
      setFilteredFiles(prev => ({...prev, documents: updatedDocs}));
      
      if (statusPolling) {
        clearInterval(statusPolling);
        setStatusPolling(null);
      }
      setProcessingDocId(null);
    }
  };

  const handleCheckStatus = async(id:number) => {
    setProcessingDocId(id);
    await refetchJobStatus();
  };

  useEffect(()=>{
    setFiles(filesData);
    setFilteredFiles(filesData);
  },[filesData, deleteFile])
  
  const handleTooLongString = useCallback((str: string): string => {
    if (str.length > 18) return str.slice(0, 18) + '..';
    return str;
  }, []);

  const getStatusDisplay = (file: any) => {
    if (file.id === processingDocId) {
      return language === 'ro' ? 'Se procesează...' : 'Processing...';
    }
    
    if (file.rpa && file.rpa.length > 0) {
      const status = file.rpa[0].status;
      if (status === 'COMPLETED') {
        return language === 'ro' ? 'Completat' : 'Completed';
      } else if (status === 'FAILED') {
        return language === 'ro' ? 'Eșuat' : 'Failed';
      } else if (status === 'PENDING') {
        return language === 'ro' ? 'În așteptare' : 'Pending';
      }
    }
    
    return language === 'ro' ? 'În așteptare' : 'Pending';
  };

  const getStatusColor = (file: any) => {
    if (file.id === processingDocId) {
      return 'text-blue-500';
    }
    
    if (file.rpa && file.rpa.length > 0) {
      const status = file.rpa[0].status;
      if (status === 'COMPLETED') return 'text-green-500';
      if (status === 'FAILED') return 'text-red-500';
      if (status === 'PENDING') return 'text-yellow-500';
    }
    return 'text-yellow-500';
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
                    <p className={`${getStatusColor(file)}`}>
                      {getStatusDisplay(file)}
                    </p>
                    {file.id === processingDocId && (
                      <RefreshCw size={16} className="ml-2 animate-spin text-blue-500" />
                    )}
                    {file.rpa && file.rpa.length > 0 && file.rpa[0].status === 'PENDING' && file.id !== processingDocId && (
                      <RefreshCw 
                        size={16} 
                        className="ml-2 cursor-pointer text-blue-500 hover:text-blue-700" 
                        onClick={() => handleCheckStatus(file.id)}
                      />
                    )}
                  </div>

                 <div className='flex items-center justify-center gap-5'>
                   <MyTooltip content={language==='ro'?'Procesează date':'Submit data'} trigger={
                   <Bot size={24} 
                     className={`${file.rpa && file.rpa.length > 0 && file.rpa[0].status === 'COMPLETED' ? 'text-gray-400 cursor-not-allowed' : 'hover:text-[var(--primary)]/70 text-[var(--primary)] cursor-pointer'}`}
                     onClick={() => {
                       if (!(file.rpa && file.rpa.length > 0 && file.rpa[0].status === 'COMPLETED')) {
                         handleProcessAutomation(file.id);
                       }
                     }}
                   />
                   }/>
                   <MyTooltip content={language==='ro'?'Șterge Fișiere și date':'Delete File and Data'} trigger={
                   <Trash2 size={20} className="text-red-500
                   cursor-pointer" onClick={()=>{setIsSureModal(true);
                     setCurrentFile(file);
                   }}></Trash2>
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
        <AreYouSureModalR setIsSureModal={setIsSureModal} setAction={()=>handleDeleteFileButton(currentFile?.processedData[0].documentId)} confirmButton={language==='ro'?'Șterge':'Delete'}
        text={language==='ro'?"Ești sigur/ă că vrei să ȘTERGI permanent fișierul și datele aferente acestuia?":"Are you sure you want to permanently DELETE the file and it's data?"}/>
      )}

      {clientCompanyName===''&&(<InitialClientCompanyModalSelect/>)}
    </div>
  )
}

export default FileManagementPage
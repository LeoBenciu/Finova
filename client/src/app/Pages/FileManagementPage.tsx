import InitialClientCompanyModalSelect from '@/app/Components/InitialClientCompanyModalSelect';
import { useDeleteFileAndExtractedDataMutation, useGetFilesQuery, useInsertClientInvoiceMutation } from '@/redux/slices/apiSlice';
import { Bot, Eye } from 'lucide-react';
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

  //State for filters
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
      const result = await processAutomation({id, currentClientCompanyEin: clientCompanyEin}).unwrap();
      console.log('UiPath automation',result);
    } catch (e) {
      console.error('Failed to process the automation in the accounting software', e)
    }
  }


  useEffect(()=>{
    setFiles(filesData);
    setFilteredFiles(filesData);
  },[filesData, deleteFile])
  
  const handleTooLongString = useCallback((str: string): string => {
    if (str.length > 18) return str.slice(0, 18) + '..';
    return str;
  }, []);


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
            console.log(file);
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
                      <p className='text-[var(--text1)]'>{
                    file.rpa.length===0?(language==='ro'?'In asteptare':'Pending'):''}</p> 
                  </div>

                 <div className='flex items-center justify-center gap-5'>
                   <MyTooltip content={language==='ro'?'Proceseaza date':'Submit data'} trigger={
                   <Bot size={24} className='hover:text-[var(--primary)]/70
                   text-[var(--primary)]
                   cursor-pointer' onClick={()=>handleProcessAutomation(file.id)}></Bot>
                   }/>
                   <MyTooltip content={language==='ro'?'Sterge Fisiere si date':'Delete File and Data'} trigger={
                   <Trash2 size={20} className='text-red-500
                   cursor-pointer' onClick={()=>{setIsSureModal(true);
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
        <AreYouSureModalR setIsSureModal={setIsSureModal} setAction={()=>handleDeleteFileButton(currentFile?.processedData[0].documentId)} confirmButton={language==='ro'?'Sterge':'Delete'}
        text={language==='ro'?"Esti sigur/a ca vrei sa STERGI permanent fisierul si datele aferente acestuia?":"Are you sure you want to permanently DELETE the file and it's data?"}/>
      )}

      {clientCompanyName===''&&(<InitialClientCompanyModalSelect/>)}
    </div>
  )
}

export default FileManagementPage

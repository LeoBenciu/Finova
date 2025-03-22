import InitialClientCompanyModalSelect from '@/app/Components/InitialClientCompanyModalSelect';
import { useDeleteFileAndExtractedDataMutation, useGetFilesQuery } from '@/redux/slices/apiSlice';
import { Bot, Eye } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import EditExtractedDataManagement from '../Components/EditExtractedDataManagement';
import { Trash2 } from 'lucide-react';
import { MyTooltip } from '../Components/MyTooltip';
import AreYouSureModalR from '../Components/AreYouSureModalR';
import FilesSearchFiltersComponent from '../Components/FilesSearchFiltersComponent';

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
  const [createdAtFilter, setCreatedAtFilter] = useState<string>('');

  useEffect(()=>{
    let newFilteredFiles = files.documents;
    if(nameSearch.length>0){
       newFilteredFiles = newFilteredFiles.filter((file:any)=>(
        file.name.includes(nameSearch)
      ))
    };
    if(typeFilter){
      console.log(files)
      newFilteredFiles = newFilteredFiles.filter((file:any)=>(
        file.type===typeFilter
      ))
    };
    if(createdAtFilter.length>0){
      newFilteredFiles = newFilteredFiles.filter((file:any)=>(
        file.createdAt>=createdAtFilter
      ))
    };

    setFilteredFiles({
      ...files,
      documents: newFilteredFiles
    })
  },[typeFilter, setTypeFilter,nameSearch, 
    setNameSearch,createdAtFilter,setCreatedAtFilter]);

  const clientCompanyEin = useSelector((state:clientCompanyName)=>state.clientCompany.current.ein);
  const { data: filesData } = useGetFilesQuery({company:clientCompanyEin});
  const [ deleteFile ] = useDeleteFileAndExtractedDataMutation();
  const language = useSelector((state:{user:{language:string}})=>state.user.language);
  const clientCompanyName = useSelector((state:clientCompanyName)=>state.clientCompany.current.name);

  const handleDeleteFileButton = async(docId:number)=>{
    try {
      await deleteFile({clientCompanyEin,docId}).unwrap();
      const updatedDocuments = files.documents.filter((file:any) => file.id !== docId);
      setFiles({...files, documents: updatedDocuments});
      setCurrentFile({});
    } catch (e) {
      console.error('Failed to delete the file and data from the database', e)
    }
  };


  useEffect(()=>{
    setFiles(filesData);
    setFilteredFiles(filesData);
  },[filesData, deleteFile])
  
  const handleTooLongString = useCallback((str: string): string => {
    if (str.length > 18) return str.slice(0, 18) + '..';
    return str;
  }, []);


  const formatData = useCallback((str:string):string=>{
    return str.slice(0,10).split('-').reverse().join('-');
  },[]);


  return (
    <div>
      <div>
        <h1 className="mb-10 text-4xl font-bold text-left
        text-[var(--text1)]">File Management</h1>
      </div>

      <FilesSearchFiltersComponent 
      nameSearch={nameSearch}
      setNameSearch={setNameSearch}
      setTypeFilter={setTypeFilter}
      createdAtFilter={createdAtFilter}
      setCreatedAtFilter={setCreatedAtFilter}/>

      <div className="bg-[var(--foreground)] min-w-full  
      min-h-max max-h-[1000px] rounded-2xl my-auto p-5">
        
        <div className='border-[1px] rounded-2xl min-h-52
        border-[var(--card)] '>
          <div className='min-w-full min-h-10 max-h-10
           rounded-t-2xl bg-[var(--text1)] grid
           grid-cols-5 border-[1px] border-[var(--text1)]'>
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

              <div className='flex items-center justify-center '>
                <p>{language==='ro'?'Actiuni':'Actions'}</p>
              </div>
          </div>

          {!filteredFiles&&files?.documents?.map((file:any)=>(
              <div key={file.name} className='min-w-full min-h-12 max-h-12 grid
              grid-cols-5'>
                  <div className='flex items-center justify-center '>
                  <MyTooltip content={file.name} trigger={
                    <a href={file.signedUrl} target="_blank" rel="noopener noreferrer"
                    className='cursor-pointer'>
                     { handleTooLongString(file.name)}
                    </a>
                  }/>
                  </div>


                  <div className='flex items-center justify-center text-[var(--text1)]'>
                      <p className='text-[var(--text1)]'>{file.type}</p>
                  </div>

                  <div className='flex items-center justify-center'>
                      <p>{formatData(file.createdAt)}</p> 
                  </div>

                  <div className='flex items-center justify-center
                  text-[var(--primary)] hover:text-[var(--primary)]/70 hover:cursor-pointer gap-1
                  font-bold' onClick={()=>{
                    setIsModalOpen(true);
                    setCurrentFile(file)
                  }}>
                    <Eye  size={20} 
                    className='cursor-pointer'/>
                    View
                  </div>

                  <div className='flex items-center justify-center gap-5'>
                    <MyTooltip content='Submit data' trigger={
                    <Bot size={24} className='hover:text-[var(--primary)]
                    cursor-pointer'></Bot>
                    }/>
                    <MyTooltip content='Delete File and Data' trigger={
                    <Trash2 size={20} className='text-red-500
                    cursor-pointer' onClick={()=>{setIsSureModal(true);
                      setCurrentFile(file);
                    }}></Trash2>
                  }/>
                  </div>
              </div>
          )
          )}

          {filteredFiles?.documents?.map((file:any)=>(
             <div key={file.name} className='min-w-full min-h-12 max-h-12 grid
             grid-cols-5'>
                 <div className='flex items-center justify-center '>
                 <MyTooltip content={file.name} trigger={
                   <a href={file.signedUrl} target="_blank" rel="noopener noreferrer"
                   className='cursor-pointer'>
                    { handleTooLongString(file.name)}
                   </a>
                 }/>
                 </div>


                 <div className='flex items-center justify-center'>
                     <p className='text-[var(--text1)]'>{file.type}</p>
                 </div>

                 <div className='flex items-center justify-center'>
                     <p className='text-[var(--text1)]'>{formatData(file.createdAt)}</p> 
                 </div>

                 <div className='flex items-center justify-center
                 text-[var(--primary)] hover:cursor-pointer gap-1
                 hover:text-[var(--primary)]/70 font-bold' onClick={()=>{
                   setIsModalOpen(true);
                   setCurrentFile(file)
                 }}>
                   <Eye  size={20} 
                   className='cursor-pointer'/>
                   View
                 </div>

                 <div className='flex items-center justify-center gap-5'>
                   <MyTooltip content='Submit data' trigger={
                   <Bot size={24} className='hover:text-[var(--primary)]/70
                   text-[var(--primary)]
                   cursor-pointer'></Bot>
                   }/>
                   <MyTooltip content='Delete File and Data' trigger={
                   <Trash2 size={20} className='text-red-500
                   cursor-pointer' onClick={()=>{setIsSureModal(true);
                     setCurrentFile(file);
                   }}></Trash2>
                 }/>
                 </div>
             </div>
          ))}
        </div>




      </div>  

      {isModalOpen&&(<EditExtractedDataManagement
      setIsModalOpen={setIsModalOpen}
      isOpen={isModalOpen}
      processedFiles={files}
      setProcessedFiles={setFiles}
      currentFile ={currentFile}
      setCurrentFile={setCurrentFile}
      />)}

      {isSureModal&&(
        <AreYouSureModalR setIsSureModal={setIsSureModal} setAction={()=>handleDeleteFileButton(currentFile?.processedData[0].documentId)} confirmButton='Confirm'
        text="Are you sure you want to permanently DELETE the file and it's data?"/>
      )}

      {clientCompanyName===''&&(<InitialClientCompanyModalSelect/>)}
    </div>
  )
}

export default FileManagementPage

import { useSelector } from "react-redux"
import MyDropzone from "@/components/Dropzone";
import { lazy, Suspense, useEffect, useState } from "react";
import { useExtractDataMutation } from "@/redux/slices/apiSlice";
import { Cpu, Trash } from "lucide-react";
import { TooltipDemo } from '../Components/Tooltip';
import LoadingComponent from "../Components/LoadingComponent";

const FileUploadPage = () => {

  const ExtractedDataEdit = lazy(()=> import('../Components/EditExtractedDataComponent'))

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [documents, setDocuments] = useState<File[]>();
  const [processedFiles, setProcessedFiles] = useState<Record<string, any>>({});
  const [process, {isLoading}] = useExtractDataMutation();
  const [editFile, setEditFile] = useState<Record<string,any>>();

  const language = useSelector((state: {user:{language:string}}) => state.user.language);

  const handleTooLongString =(str: string): string=>{
    if(str.length>15) return str.slice(0,15)+'..';
    return str;
  }

  const handleProcessFile = async(file: File) =>{
    try
    {
      const processedFile = await process(file).unwrap();
      setEditFile(processedFile);
      setProcessedFiles({
        ...processedFiles,
        [file.name]: processedFile
      })
    }
    catch(e)
    {
      console.error('Failed to process the document:', e)
    }
  } 

  const handleDeleteDocument = (name:string):void=>{
    setDocuments(documents?.filter(document=>document.name != name))
  }


  return (
    <div className="min-w-full min-h-screen" >
      <div className="bg-[var(--foreground)] min-h-[19rem] max-h-[19rem] min-w-[30rem] max-w-[30rem] rounded-4xl mb-28 px-3 pb-10 pt-8 flex-col flex gap-3 mx-auto">
        <div className="flex items-center mb-4 px-10 justify-between">
        <h2 className="text-2xl text-center font-bold">{language==='ro'?'Incarca documente':'Document upload'}</h2>
        </div>
        <div className="flex flex-1 px-10 items-center">
          <div className="border-5 border-dashed border-[var(--card)] rounded-4xl py-5 flex justify-center items-center
          flex-col flex-1 min-h-47 max-h-47" >
            <MyDropzone setDocuments={ setDocuments } documents={documents}/>
          </div>
        </div>
      </div>


      {documents&&(<div className="bg-[var(--foreground)] min-h-fit h-fit max-h-[50rem] min-w-full rounded-3xl p-5 flex flex-col">

        <p className="text-left text-2xl font-bold mb-3">{language==='ro'?'Status Fisiere':'Status files'}</p>

        <div className="min-w-full max-w-full border-2 border-[var(--card)] rounded-2xl flex- max-h-fit">
         <div className="bg-[var(--card)] min-w-full max-w-full min-h-[40px] max-h-[40px] rounded-t-xl grid grid-cols-5">
            <div className="flex items-center justify-center">
              <p className="font-bold">{language==='ro'?'Nume fisier':'File name'}</p>
            </div>
            <div className="flex items-center justify-center">
              <p className="font-bold">{language==='ro'?'Tip fisier':'Type'}</p>
            </div>
            <div className="flex items-center justify-center">
              <p className="font-bold">{language==='ro'?'Data incarcarii':'Upload Date'}</p>
            </div>
            <div className="flex items-center justify-center">
              <p className="font-bold">Status</p>
            </div>
            <div className="flex items-center justify-center">
              <p className="font-bold">{language==='ro'?'Actiuni':'Actions'}</p>  
            </div>
         </div>
         

        {documents?.map((doc)=>(
          <div className="min-w-full max-w-full min-h-[40px] max-h-[40px] grid grid-cols-5" key={doc.name}>
             <div className="flex items-center justify-center">
               <p className="font-normal">{handleTooLongString(doc.name)}</p>
             </div>
             <div className="flex items-center justify-center">
               <p className="font-normal">{processedFiles[doc.name]? processedFiles[doc.name].result.document_type:'-'}</p>
             </div>
             <div className="flex items-center justify-center">
               <p className="font-normal">{processedFiles[doc.name]? processedFiles[doc.name].result.document_type:'-'}</p>
             </div>
             <div className="flex items-center justify-center">
               <p className="font-normal">{processedFiles[doc.name]? (language==='ro'?'Procesat':'Processed'):(language==='ro'?'Incarcat (Nu este salvat)':'Uploaded (Not saved)')}</p>
             </div>
             <div className="flex items-center justify-center gap-5">

              <TooltipDemo 
              trigger={
                <Cpu size={18} className="cursor-pointer hover:text-[var(--primary)]"
                  onClick={()=>{
                  setIsModalOpen(true);
                  handleProcessFile(doc);
                  }}>
                </Cpu>
              }
              tip={'Process'}></TooltipDemo>

              <TooltipDemo 
              trigger={
              <Trash size={18} className="cursor-pointer hover:text-red-500" onClick={()=>handleDeleteDocument(doc.name)}></Trash>
              }
              tip={'Delete'}></TooltipDemo>

             </div>
          </div>
        ))}
        </div>

      </div>)}

      {isModalOpen&&(
      <Suspense fallback={<LoadingComponent/>}>
        <ExtractedDataEdit 
        isLoading={isLoading} 
        editFile={editFile} 
        setEditFile={setEditFile}
        setIsModalOpen={setIsModalOpen}
        />
      </Suspense>)}
    </div>
  )
}

export default FileUploadPage

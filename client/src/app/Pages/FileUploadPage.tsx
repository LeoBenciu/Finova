import { useSelector } from "react-redux"
import MyDropzone from "@/components/Dropzone";
import { useEffect, useState } from "react";
import { useExtractDataMutation } from "@/redux/slices/apiSlice";

const FileUploadPage = () => {

  const [documents, setDocuments] = useState<File[]>();
  const [processedFiles, setProcessedFiles] = useState<Record<string, any>>({});
  const [process, {isLoading}] = useExtractDataMutation();

  useEffect(()=>{
    console.log(documents);
  },[documents])

  const language = useSelector((state: {user:{language:string}}) => state.user.language);

  const handleTooLongString =(str: string): string=>{
    if(str.length>15) return str.slice(0,15)+'..';
    return str;
  }

  const handleProcessFile = async(file: File) =>{
    try
    {
      const processedFile = await process(file).unwrap();
      console.log(processedFile)
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


  return (
    <div className="min-w-full min-h-screen" >
      <div className="bg-[var(--foreground)] min-h-[18rem] max-w-[34rem] rounded-4xl mb-28 px-3 pb-10 pt-8 flex-col flex gap-3">
        <div className="flex items-center mb-4 px-10 justify-between">
        <h2 className="text-2xl text-left font-bold">{language==='ro'?'Incarca documente':'Document upload'}</h2>
        <button className="bg-[var(--primary)] hover:bg-[var(--primary)]/90 rounded-2xl font-bold py-1 px-3">{language==='ro'?"Proceseaza documente":"Process documents"}</button>
        </div>
        <div className="flex flex-1 px-10 items-center">
          <div className="border-5 border-dashed border-[var(--card)] rounded-4xl py-5 flex justify-center items-center
          flex-col flex-1 min-h-52 max-h-52" >
            <MyDropzone setDocuments={ setDocuments } documents={documents}/>
          </div>
        </div>
      </div>
      <div className="bg-[var(--foreground)] min-h-[5rem] h-[50rem] max-h-[50rem] min-w-full rounded-3xl p-5 flex flex-col">

        <p className="text-left text-2xl font-bold mb-3">{language==='ro'?'Status Fisiere':'Status files'}</p>

        <div className="min-w-full max-w-full border-2 border-[var(--card)] rounded-2xl flex-1">
         <div className="bg-[var(--card)] min-w-full max-w-full min-h-[40px] max-h-[40px] rounded-t-xl grid grid-cols-6">
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
              <p className="font-bold">{language==='ro'?'Data procesarii':'Processed Date'}</p>
            </div>
            <div className="flex items-center justify-center">
              <p className="font-bold">Status</p>
            </div>
            <div className="flex items-center justify-center">
              <p className="font-bold">{language==='ro'?'Actiuni':'Actions'}</p>  
            </div>
         </div>

        {documents?.map((doc)=>(
          <div className="min-w-full max-w-full min-h-[40px] max-h-[40px] grid grid-cols-6" key={doc.name}>
             <div className="flex items-center justify-center">
               <p className="font-bold">{handleTooLongString(doc.name)}</p>
             </div>
             <div className="flex items-center justify-center">
               <p className="font-bold">{processedFiles[doc.name]? processedFiles[doc.name].result.document_type:''}</p>
             </div>
             <div className="flex items-center justify-center">
               <p className="font-bold">{language==='ro'?'Data incarcarii':'Upload Date'}</p>
             </div>
             <div className="flex items-center justify-center">
               <p className="font-bold">{language==='ro'?'Data procesarii':'Processed Date'}</p>
             </div>
             <div className="flex items-center justify-center">
               <p className="font-bold">Status</p>
             </div>
             <div className="flex items-center justify-center">
               <button className="py-1 px-4" onClick={()=>handleProcessFile(doc)}>{isLoading?'Loading':'Process File'}</button> 
             </div>
          </div>
        ))}
        </div>

      </div>
    </div>
  )
}

export default FileUploadPage

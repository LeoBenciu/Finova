import { useSelector } from "react-redux";
import MyDropzone from "@/components/Dropzone";
import { lazy, Suspense, useState, useCallback, useEffect } from "react";
import { useExtractDataMutation } from "@/redux/slices/apiSlice";
import { Cpu, Plus, Trash } from "lucide-react";
import { TooltipDemo } from '../Components/Tooltip';
import LoadingComponent from "../Components/LoadingComponent";
import InitialClientCompanyModalSelect from '@/app/Components/InitialClientCompanyModalSelect';
import computer from '@/assets/undraw_computer-files_7dj6.svg'

const ExtractedDataEdit = lazy(() => import('../Components/EditExtractedData/EditExtractedDataComponent'));

type clientCompany= {
  clientCompany:{
    current:{
      name:string,
      ein:string
    }
  }
}

const FileUploadPage = () => {
  // State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [documents, setDocuments] = useState<File[]>([]);
  const [processedFiles, setProcessedFiles] = useState<Record<string, any>>({});
  const [editFile, setEditFile] = useState<{ result: Record<string, any> } | undefined>(undefined);
  const [currentProcessingFile, setCurrentProcessingFile] = useState<File | null>(null);
  const [dropzoneVisible, setDropzoneVisible] = useState<boolean>(false);

  useEffect(()=>{
    console.log('Documents', documents)
  },[documents])
  
  const clientCompanyName = useSelector((state:clientCompany)=>state.clientCompany.current.name)
  const clientCompanyEin = useSelector((state:clientCompany)=>state.clientCompany.current.ein)
  const language = useSelector((state: {user:{language:string}}) => state.user.language);
  const [process, {isLoading}] = useExtractDataMutation();

  const handleTooLongString = useCallback((str: string): string => {
    if (str.length > 15) return str.slice(0, 15) + '..';
    return str;
  }, []);

  const handleProcessFile = useCallback(async (file: File) => {
    setCurrentProcessingFile(file);
    
    try {
      setIsModalOpen(true);
      
      if (processedFiles[file.name]) {
        setEditFile(processedFiles[file.name]);
        return;
      }
      
      const processedFile = await process({file,clientCompanyEin}).unwrap();
      console.log("PROCESSED FILE:", processedFile);
      setEditFile(processedFile);
      
      setProcessedFiles(prev => ({
        ...prev,
        [file.name]: processedFile
      }));
    } catch (e) {
      console.error('Failed to process the document:', e);
    } 
  }, [process, processedFiles]);

  const handleDeleteDocument = useCallback((name: string): void => {
    setDocuments(prev => prev.filter(document => document.name !== name));
    
    if (processedFiles[name]) {
      const newProcessedFiles = { ...processedFiles };
      delete newProcessedFiles[name];
      setProcessedFiles(newProcessedFiles);
    }
  }, [processedFiles]);

  return (
    <div className="min-w-[1000px] min-h-screen">
      <div className="flex flex-row justify-between items-center mb-5">
        <h1 className="text-4xl font-bold text-left text-[var(--text1)]">{language==='ro'?'Incarca Documente':'File Upload'}</h1>
        <button className="text-white bg-[var(--primary)] rounded-3xl flex flex-row gap-1 hover:bg-[var(--primary)]/70
        items-center justify-center"
        onClick={()=>setDropzoneVisible(true)}><Plus size={18}></Plus> {language==='ro'?'Incarca':'Upload'}</button>
      </div>

      <div className="min-h-[1px] max-h-[1px] border-[0.5px] border-neutral-300 my-8 min-w-full max-w-full"></div>

      {dropzoneVisible&&(
        <div className="bg-[var(--primary)]/50 min-h-[200px] max-h-[200px] min-w-full max-w-full p-1 rounded-3xl mb-22">
        <div className="bg-[var(--foreground)] min-h-[12rem] max-h-[12rem] min-w-full rounded-3xl px-3 flex-col flex gap-3
        border-2 border-[var(--primary)]">
        <div className="flex flex-1 px-2 items-center py-1">
          <div className="rounded-2xl py-5 flex justify-center items-center
          flex-col flex-1 min-h-[12rem] max-h-47">
            <MyDropzone setDocuments={setDocuments} documents={documents} />
          </div>
        </div>
      </div>
      </div>)}

      {!dropzoneVisible&&(
        <div className="mx-auto my-auto min-h-96 min-w-96 max-h-96 max-w-96 mt-36">
          <img src={computer} className="min-w-full min-h-full max-h-full max-w-full"></img>
        </div>
      )}

      {documents && documents.length > 0 && (
        <div className="bg-[var(--foreground)] min-h-fit h-fit max-h-[50rem] min-w-[850px] rounded-3xl pt-5 flex flex-col
        border-[1px] border-[var(--text4)] shadow-md mb-[50px]">
          <div className="flex flex-row items-center gap-2 mb-2">
            <p className="text-left text-2xl font-bold text-[var(--text1)] px-5">
              {language === 'ro' ? 'Status Fisiere' : 'Status files'}
            </p>
            <p className="text-[var(--primary)] bg-[var(--primary)]/30
            text-base font-bold rounded-2xl px-2 py-1">{documents.length} {language==='ro'?'Fisiere':'Files'}</p>
          </div>

          <p className="text-left text-base text-[var(--text2)] mb-5 px-5">{language === 'ro' ? 'Aici poti vedea fisierele incarcate' : 'Here you can see your uploaded files'}</p>

          <div className="min-w-full max-w-full flex- max-h-fit">
            <div className="min-w-full max-w-full min-h-[50px] max-h-[50px] grid grid-cols-5 border-t-[1px] border-b-[1px] border-[var(--text3)]
            shadow-sm">
              <div className="flex items-center justify-center">
                <p className="font-bold text-[var(--text1)]">{language === 'ro' ? 'Nume fisier' : 'File name'}</p>
              </div>
              <div className="flex items-center justify-center">
                <p className="font-bold text-[var(--text1)]">{language === 'ro' ? 'Tip fisier' : 'Type'}</p>
              </div>
              <div className="flex items-center justify-center">
                <p className="font-bold text-[var(--text1)]">{language === 'ro' ? 'Data documentului' : 'Document Date'}</p>
              </div>
              <div className="flex items-center justify-center">
                <p className="font-bold text-[var(--text1)]">Status</p>
              </div>
              <div className="flex items-center justify-center">
                <p className="font-bold text-[var(--text1)]">{language === 'ro' ? 'Actiuni' : 'Actions'}</p>
              </div>
            </div>

            {documents.map((doc) => (
              <div className="min-w-full max-w-full min-h-[40px] max-h-[40px] grid grid-cols-5 border-b-[1px] border-[var(--text4)]" key={doc.name}>
                <div className="flex items-center justify-center">
                  <p className="font-normal text-[var(--text1)] ">{handleTooLongString(doc.name)}</p>
                </div>
                <div className="flex items-center justify-center">
                  <p className="font-normal text-[var(--text1)]">{processedFiles[doc.name]?.result.document_type || '-'}</p>
                </div>
                <div className="flex items-center justify-center">
                  <p className="font-normal text-[var(--text1)]">{processedFiles[doc.name]?.result.document_date || '-'}</p>
                </div>
                <div className="flex items-center justify-center">
                  <p className="font-normal text-[var(--text1)]">
                    {processedFiles[doc.name]?.saved ? (language === 'ro' ? 'Salvat' : 'Saved'):processedFiles[doc.name]
                      ? (language === 'ro' ? 'Procesat' : 'Processed')
                      : (language === 'ro' ? 'Incarcat (Nu este salvat)' : 'Uploaded (Not saved)')}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-5">

                  {!processedFiles[doc.name]?.saved&&(<TooltipDemo
                    trigger={
                      <div className="relative">
                        <Cpu
                          size={18}
                          className={`cursor-pointer ${
                            currentProcessingFile?.name === doc.name && isLoading
                              ? 'text-[var(--primary)] animate-pulse'
                              : 'text-[var(--primary)]'
                          }`}
                          onClick={() => handleProcessFile(doc)}
                        />
                      </div>
                    }
                    tip={language==='ro'?'Proceseaza':'Process'}
                  />)}

                  <TooltipDemo
                    trigger={
                      <Trash
                        size={18}
                        className="cursor-pointer text-red-500"
                        onClick={() => handleDeleteDocument(doc.name)}
                      />
                    }
                    tip={language==='ro'?'Sterge':'Delete'}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-black/50">
        <LoadingComponent />
      </div>}>
        <ExtractedDataEdit
          isLoading={isLoading && isModalOpen}
          editFile={editFile}
          setEditFile={setEditFile}
          setIsModalOpen={setIsModalOpen}
          isOpen={isModalOpen}
          currentFile={currentProcessingFile}
          setCurrentProcessingFile={setCurrentProcessingFile}
          processedFiles={processedFiles}
          setProcessedFiles={setProcessedFiles}
        />
      </Suspense>

      {clientCompanyName===''&&(<InitialClientCompanyModalSelect/>)}
    </div>
  );
};

export default FileUploadPage;
import { useSelector } from "react-redux"
import MyDropzone from "@/components/Dropzone";

const FileUploadPage = () => {

  const language = useSelector((state: {user:{language:string}}) => state.user.language);


  return (
    <div className="min-w-full min-h-screen" >
      <div className="bg-[var(--foreground)] min-h-[18rem] max-w-96 rounded-4xl mb-28 px-3 pb-10 pt-8 flex-col flex gap-3">
        <h2 className="text-2xl text-left font-bold ml-10">{language==='ro'?'Incarca documente':'Document upload'}</h2>
        <div className="flex flex-1 px-10 items-center">
          <div className="border-5 border-dashed border-[var(--card)] rounded-4xl py-5 flex justify-center items-center
          flex-col flex-1 min-h-52 max-h-52" >
            <MyDropzone/>
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
        </div>
      </div>
    </div>
  )
}

export default FileUploadPage

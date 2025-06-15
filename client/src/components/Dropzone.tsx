import {useCallback} from 'react'
import {useDropzone} from 'react-dropzone'
import { useSelector } from 'react-redux';
import { CloudUpload } from 'lucide-react';

interface MyDropzoneProps{
  setDocuments: (files: File[])=>void;
  documents: File[] | undefined;
}

function MyDropzone({setDocuments, documents}: MyDropzoneProps) {
  const onDrop = useCallback((acceptedFiles :File[]) => {
    setDocuments(documents ? [...documents, ...acceptedFiles] : acceptedFiles);
    console.log('Accepted files:', acceptedFiles)
  }, [documents])
  const {getRootProps, getInputProps, isDragActive} = useDropzone({onDrop});
  const language = useSelector((state: {user:{language:string}})=>state.user.language)

  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      {
        isDragActive ?
            < div className="flex flex-col justify-center items-center">
                <p className="text-lg font-semibold mb-2 text-[var(--text1)]">
                    {language==='ro'?'Trage AICI fisier(e) pentru a le incarca':'Drag HERE the file(s) to upload'}
                </p>
            </div> :
            <div className="flex flex-col justify-center items-center" >
                <CloudUpload size={40} className="text-[var(--primary)] mb-2 bg-[var(--primary)]/30 rounded-full p-1"/>
                <p className="text-lg font-semibold mb-2 text-[var(--text1)]">
                    {language==='ro'?'Trage fisier(e) pentru a le incarca':'Drag file(s) to upload'}
                </p>
                <p className="text-sm mb-2 text-[var(--text1)]">{language==='ro'?'sau':'or'}</p>
                <button className="bg-transparent hover:bg-[var(--primary)] hover:text-white
                text-[var(--primary)] py-1 px-2 rounded-2xl font-semibold">{language==='ro'?'Cauta fisiere':'Browse files'}</button>
            </div>        
      }
    </div>
  )
}

export default MyDropzone
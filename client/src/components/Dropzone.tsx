import {useCallback} from 'react'
import {useDropzone} from 'react-dropzone'
import { useSelector } from 'react-redux';
import { CloudUpload } from 'lucide-react';

function MyDropzone() {
  const onDrop = useCallback((acceptedFiles :File[]) => {
    console.log(acceptedFiles);
  }, [])
  const {getRootProps, getInputProps, isDragActive} = useDropzone({onDrop});
  const language = useSelector((state: {user:{language:string}})=>state.user.language)

  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      {
        isDragActive ?
            < div className="flex flex-col justify-center items-center">
                <p className="text-lg font-semibold mb-2">
                    {language==='ro'?'Trage AICI fisier(e) pentru a le incarca':'Drag HERE the file(s) to upload'}
                </p>
            </div> :
            <div className="flex flex-col justify-center items-center" >
                <CloudUpload size={60} className="text-[var(--primary)] mb-2"/>
                <p className="text-lg font-semibold mb-2">
                    {language==='ro'?'Trage fisier(e) pentru a le incarca':'Drag file(s) to upload'}
                </p>
                <p className="text-sm mb-2">{language==='ro'?'sau':'or'}</p>
                <button className="border-2 border-[var(--primary)] bg-transparent hover:bg-[var(--primary)] hover:text-white
                text-[var(--primary)] py-1 px-2 rounded-2xl font-semibold">{language==='ro'?'Cauta fisiere':'Browse files'}</button>
            </div>        
      }
    </div>
  )
}

export default MyDropzone
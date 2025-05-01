import { X } from "lucide-react";
import React, { useEffect, useState } from "react";

interface DocumentViewerProps{
    onClose:()=>void;
    currentFile?: File | null;
    signedUrl?: string;
}

const DocumentViewer = React.memo(({ onClose, currentFile, signedUrl }: DocumentViewerProps) => {
    const [fileUrl, setFileUrl] = useState<string | undefined>();

    useEffect(()=>{
        if(currentFile){
            const url = URL.createObjectURL(currentFile);
            setFileUrl(url);
            console.log('URL',url)

            return()=>{
                URL.revokeObjectURL(url);
            };
        }
    },[currentFile])

    return (
      <div className="flex-2 border-r-2 bg-[var(--background)] rounded-tl-3xl rounded-bl-3xl">
        <div className="flex items-center px-5">
          <X size={30} className="text-red-500 cursor-pointer" onClick={onClose} />
          <h3 className="text-left font-bold text-3xl mt-5 ml-5 mb-5
          text-[var(--text1)]">Document</h3>
        </div>
        <iframe
          src={signedUrl||fileUrl}
          className="min-w-[96%] max-w-[96%] mx-auto min-h-[90%] max-h-[90%] flex-1 rounded-xl"
          width="100%"
          height="100%"
        />
      </div>
    );
  });
  
  export default DocumentViewer;

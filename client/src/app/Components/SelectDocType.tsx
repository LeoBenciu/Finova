
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useEffect, useState } from "react";
import { useSelector } from "react-redux"

interface SelectDocTypeProps{
    value: string,
    setEditFile:(value: any) => void;
    editFile: {
      result: Record<string, any>;
    } | undefined;
}

export function SelectDocType({value, setEditFile, editFile}: SelectDocTypeProps) {

    const language = useSelector((state: {user:{language:string}}) => state.user.language);

    const documentTypes =[
        "Invoice",
        "Receipt"
    ]

    const [selectorValue, setSelectorValue] = useState<string>('');

    useEffect(()=>{
        setSelectorValue(value);
    },[])

  return (
    <Select value={selectorValue} onValueChange={(e)=>{setSelectorValue(e);
      setEditFile({
        ...editFile,
        result: {
          ...editFile?.result,
          document_type:e
        }
      });
    }}>
      <SelectTrigger className="min-w-35 max-w-35 py-3 rounded-2xl bg-[var(--card)]">
        <SelectValue placeholder={language==='ro'?'Tipul documentului':"Document Type"} />
      </SelectTrigger>
      <SelectContent className="bg-[var(--card)] cursor-pointer">
        <SelectGroup>
          {documentTypes.map((document)=>(
            <SelectItem value={document} 
            className="cursor-pointer">
                {language==='ro'?(document==="Invoice"?'Factura':'Chitanta'):document}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

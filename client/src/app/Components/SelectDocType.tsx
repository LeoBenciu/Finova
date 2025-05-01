
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
    value?: string,
    setEditFile:(value: any) => void;
    editFile?: {
      result: Record<string, any>;
    } | undefined;
    shadow?:boolean
}

export function SelectDocType({value, setEditFile, editFile,shadow}: SelectDocTypeProps) {

    const language = useSelector((state: {user:{language:string}}) => state.user.language);

    const documentTypes =[
        "Invoice",
        "Receipt"
    ]

    const [selectorValue, setSelectorValue] = useState<string>('');

    if(value){
      useEffect(()=>{
          setSelectorValue(value);
      },[])
    };

    const handleSelect = (e:string)=>{
      setSelectorValue(e);
      setEditFile({
        ...editFile,
        result: {
          ...editFile?.result,
          document_type:e
        }
      });
    }

    const handleSelect2 =(val:string)=>{
      if(val==='Invoice')
      { 
        setEditFile('Invoice');
        setSelectorValue('Invoice');
      }else {
        setEditFile('Receipt');
        setSelectorValue('Receipt');
      };
    }

  return (
    <Select value={selectorValue} onValueChange={(e)=>{value?handleSelect(e):handleSelect2(e)}}>
      <SelectTrigger className={`min-w-35 max-w-35 py-3 rounded-2xl bg-[var(--foreground)]
      text-[var(--text1)] focus:ring-[var(--primary)] ${shadow?'shadow-[0_0_15px_rgba(0,0,0,0.3)]':''}`}>
        <SelectValue placeholder={language==='ro'?'Tipul documentului':"Document Type"} />
      </SelectTrigger>
      <SelectContent className="bg-[var(--foreground)] cursor-pointer">
        <SelectGroup>
          {documentTypes.map((document,index)=>(
            <SelectItem value={document} key={index}
            className="cursor-pointer text-[var(--text1)]">
                {language==='ro'?(document==="Invoice"?'Factura':'Chitanta'):document}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

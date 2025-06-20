
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

export function SelectDocType({value, setEditFile, editFile}: SelectDocTypeProps) {

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
    <SelectTrigger className="bg-[var(--background)] min-h-11 rounded-2xl w-full px-4 py-2
    border-[1px] border-[var(--text4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
    text-[var(--text1)] transition-all duration-200 hover:border-[var(--primary)]/50
    data-[placeholder]:text-[var(--text3)]">
      <SelectValue placeholder={language==='ro'?'Tipul documentului':"Document Type"} />
    </SelectTrigger>
    <SelectContent className="bg-[var(--foreground)] border border-[var(--text4)] rounded-2xl shadow-lg
    max-h-60 overflow-y-auto">
      <SelectGroup>
        {documentTypes.map((document,index)=>(
          <SelectItem 
            value={document} 
            key={index}
            className="cursor-pointer text-[var(--text1)] hover:bg-[var(--primary)]/10 
            focus:bg-[var(--primary)]/10 rounded-lg mx-1 my-0.5 px-3 py-2
            transition-colors duration-200"
          >
            {language==='ro'?(document==="Invoice"?'Factura':'Chitanta'):document}
          </SelectItem>
        ))}
      </SelectGroup>
    </SelectContent>
  </Select>
  )
}

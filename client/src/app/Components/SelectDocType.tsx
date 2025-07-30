
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
    shadow?:boolean;
    full?:boolean
}

export function SelectDocType({value, setEditFile, editFile,full}: SelectDocTypeProps) {

    const language = useSelector((state: {user:{language:string}}) => state.user.language);

    const documentTypes ={
      "invoice": "Factura",
      "Invoice": "Factura", 
      "receipt": "Chitanta",
      "Receipt": "Chitanta",
      "bank statement": "Extras De Cont",
      "Bank Statement": "Extras De Cont",
      "contract": "Contract",
      "Contract": "Contract",
      "z report": "Raport Z",
      "Z Report": "Raport Z",
      "payment order": "Dispozitie De Plata",
      "Payment Order": "Dispozitie De Plata",
      "collection order": "Dispozitie De Incasare",
      "Collection Order": "Dispozitie De Incasare"
    };

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
        setEditFile(val);
        setSelectorValue(val);
    }

  return (
<Select value={selectorValue} onValueChange={(e)=>{value?handleSelect(e):handleSelect2(e)}}>
  <SelectTrigger className={`bg-[var(--background)] min-h-11 rounded-2xl px-4 py-2 w-fit ${full?'min-w-full max-w-full':'min-w-40 max-w-40'}
  border-[1px] border-[var(--text4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
  text-[var(--text1)] transition-all duration-200 hover:border-[var(--primary)]/50
  data-[placeholder]:text-[var(--text3)]`}>
    <SelectValue placeholder={language==='ro'?'Tipul documentului':"Document Type"} />
  </SelectTrigger>
  <SelectContent className="bg-[var(--foreground)] border border-[var(--text4)] rounded-2xl shadow-lg
  max-h-60 overflow-y-auto">
    <SelectGroup>
      {Object.keys(documentTypes).map((document, index) => (
        <SelectItem 
          value={document} 
          key={index}
          className="cursor-pointer text-[var(--text1)] hover:bg-[var(--primary)]/10 
          focus:bg-[var(--primary)]/10 rounded-lg mx-1 my-0.5 px-3 py-2
          transition-colors duration-200"
        >
          {language === 'ro' ? documentTypes[document as keyof typeof documentTypes] : document}
        </SelectItem>
      ))}
    </SelectGroup>
  </SelectContent>
</Select>
  )
}

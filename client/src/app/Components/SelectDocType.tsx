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
      "Invoice": "Factura", 
      "Receipt": "Chitanta",
      "Bank Statement": "Extras De Cont",
      "Contract": "Contract",
      "Z Report": "Raport Z",
      "Payment Order": "Dispozitie De Plata",
      "Collection Order": "Dispozitie De Incasare"
    };

    // Normalization function to handle lowercase/variant inputs
    const normalizeDocumentType = (input: string): string => {
      const normalizations: Record<string, string> = {
        // Lowercase variants
        "invoice": "Invoice",
        "receipt": "Receipt", 
        "bank statement": "Bank Statement",
        "contract": "Contract",
        "z report": "Z Report",
        "payment order": "Payment Order",
        "collection order": "Collection Order",
        
        // Other possible variants
        "factura": "Invoice",
        "chitanta": "Receipt",
        "extras de cont": "Bank Statement",
        "raport z": "Z Report",
        "dispozitie de plata": "Payment Order",
        "dispozitie de incasare": "Collection Order",
        
        // Handle exact matches (return as-is if already correct)
        "Invoice": "Invoice",
        "Receipt": "Receipt",
        "Bank Statement": "Bank Statement", 
        "Contract": "Contract",
        "Z Report": "Z Report",
        "Payment Order": "Payment Order",
        "Collection Order": "Collection Order"
      };

      // Convert to lowercase for lookup, then return normalized version
      const normalized = normalizations[input.toLowerCase()];
      return normalized || input; // Return original if no match found
    };

    const [selectorValue, setSelectorValue] = useState<string>('');

    useEffect(() => {
      if(value) {
        // Normalize the incoming value before setting it
        const normalizedValue = normalizeDocumentType(value);
        setSelectorValue(normalizedValue);
      }
    }, [value]);

    const handleSelect = (e:string)=>{
      setSelectorValue(e);
      setEditFile({
        ...editFile,
        result: {
          ...editFile?.result,
          document_type: e // Store the normalized (proper case) version
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
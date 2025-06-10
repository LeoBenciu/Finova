import { useGetRpaDataQuery, useModifyRpaCredentialsMutation } from "@/redux/slices/apiSlice";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

const RPA = () => {
      const language = useSelector((state:{user:{language:string}})=>state.user.language);
      const [updateRpaCredentials, {isError: isErrorUpdatingRpaCredentials}] = useModifyRpaCredentialsMutation();
      const { data: rpaData } = useGetRpaDataQuery({});
      

      const [rpaCredentialsChanged, setRpaCredentialsChanged] = useState<boolean>(false);
      const [folderName, setFolderName] = useState<string>();
      const [clientInvoiceRk, setClientInvoiceRk] = useState<string>();
      const [supplierInvoiceRk, setSupplierInvoiceRk] = useState<string>();
      const [clientReceiptRk, setClientReceiptRk] = useState<string>();
      const [supplierReceiptRk, setSupplierReceiptRk] = useState<string>();
      
        useEffect(()=>{
          setClientInvoiceRk(rpaData?.clientInvoiceRk);
          setSupplierInvoiceRk(rpaData?.supplierInvoiceRk);
          setClientReceiptRk(rpaData?.clientReceiptRk);
          setSupplierReceiptRk(rpaData?.supplierReceiptRk);
          setFolderName(rpaData?.uipathSubfolder);
        },[rpaData])
      

      const handleUpdateRpaCredentials = async() => {
        try {
          const result = await updateRpaCredentials({uipathSubfolder:folderName, clientInvoiceRk,
            supplierInvoiceRk, clientReceiptRk, supplierReceiptRk}).unwrap();
          console.log(result);
          setRpaCredentialsChanged(true);
          setTimeout(()=>{
            setRpaCredentialsChanged(false);
          },2500)
        } catch (e) {
          console.error(language==='ro'?'Schimbarea credentialelor RPA a esuat!':'Failed to change RPA credentials!')
        }
      }
    
  return (
    <div id='User' 
    className="mt-10 mx-10 min-w-96 
    min-h-96 px-10 grid grid-cols-2 items-start col-start-1">
      
      <div className="flex flex-col items-center">
      <h2 className="font-bold text-4xl text-left text-[var(--text1)]">{language==='ro'?'Credentiale RPA':'RPA Credentials'}</h2>
      {isErrorUpdatingRpaCredentials&&(<p className="text-red-500 mt-3 text-left">{language==='ro'?'Schimbarea credentialelor RPA a esuat! Va rugam reincercati mai tarziu!':'Failed to change the RPA credentials! Please try again later!'}</p>)}

      <label htmlFor="clientInvoiceInput" className="mt-10 text-left text-[var(--text1)]
      min-w-96 px-5">{language==='ro'?'Cheie facturi clienti':'Client invoices key'}</label>
      <input id='clientInvoiceInput' 
      className="bg-[var(--foreground)] mt-3 max-w-96 min-h-11 rounded-2xl p-2
      focus:outline-none focus:ring-1 ring-[var(--primary)]
      shadow-[0_0_10px_rgba(0,0,0,0.3)] text-[var(--text1)] min-w-96"
      value={clientInvoiceRk} onChange={(e)=>setClientInvoiceRk(e.target.value)}
      type="text"></input>

      <label htmlFor="supplierInvoiceInput" className="mt-10 text-left text-[var(--text1)]
      min-w-96 px-5">{language==='ro'?'Cheie facturi furnizori':'Supplier invoices key'}</label>
      <input id='supplierInvoiceInput' 
      className="bg-[var(--foreground)] mt-3 max-w-96 min-h-11 rounded-2xl p-2
      focus:outline-none focus:ring-1 ring-[var(--primary)]
      shadow-[0_0_10px_rgba(0,0,0,0.3)] text-[var(--text1)] min-w-96"
      value={supplierInvoiceRk} onChange={(e)=>setSupplierInvoiceRk(e.target.value)}
      type="text"></input>

      <label htmlFor="clientReceiptInput" className="mt-10 text-left text-[var(--text1)]
      min-w-96 px-5">{language==='ro'?'Cheie chitante clienti':'Client receipts key'}</label>
      <input id='clientReceiptInput' 
      className="bg-[var(--foreground)] mt-3 max-w-96 min-h-11 rounded-2xl p-2
      focus:outline-none focus:ring-1 ring-[var(--primary)]
      shadow-[0_0_10px_rgba(0,0,0,0.3)] text-[var(--text1)] min-w-96"
      value={clientReceiptRk} onChange={(e)=>setClientReceiptRk(e.target.value)}
      type="text"></input>

      <label htmlFor="supplierReceiptInput" className="mt-10 text-left text-[var(--text1)]
      min-w-96 px-5">{language==='ro'?'Cheie chitante furnizori':'Supplier receipts key'}</label>
      <input id='supplierReceiptInput' 
      className="bg-[var(--foreground)] mt-3 max-w-96 min-h-11 rounded-2xl p-2
      focus:outline-none focus:ring-1 ring-[var(--primary)]
      shadow-[0_0_10px_rgba(0,0,0,0.3)] text-[var(--text1)] min-w-96"
      value={supplierReceiptRk} onChange={(e)=>setSupplierReceiptRk(e.target.value)}
      type="text"></input>

      <label htmlFor="rpaFolder" className="mt-10 text-left text-[var(--text1)]
      min-w-96 px-5">{language==='ro'?'Nume folder RPA':'RPA folder name'}</label>
      <input id='rpaFolder' 
      className="bg-[var(--foreground)] mt-3 max-w-96 min-h-11 rounded-2xl p-2
      focus:outline-none focus:ring-1 ring-[var(--primary)]
      shadow-[0_0_10px_rgba(0,0,0,0.3)] text-[var(--text1)] min-w-96"
      value={folderName} onChange={(e)=>setFolderName(e.target.value)}
      type="text"></input>

      <button 
      className={`max-w-96 ${rpaCredentialsChanged?'bg-transparent':'bg-[var(--primary)]'} rounded-2xl font-bold text-md mt-15
      hover:bg-[var(--primary)]/30 hover:text-[var(--primary)] flex justify-center
      items-center gap-3 min-w-96`}
      onClick={handleUpdateRpaCredentials}>
        {rpaCredentialsChanged?(language==='ro'?'Credentiale RPA schimbate cu succes':'RPA Credentials Changed Succesfully'):(language==='ro'?'Salveaza Noile Credentiale':'Save New Credentials')}
        {rpaCredentialsChanged&&(<Check size={20}></Check>)}
      </button>
      </div>
      

      <div className="flex flex-col items-center">

      </div>

    </div>
  )
}

export default RPA

import { useGetRpaDataQuery, useModifyRpaCredentialsMutation } from "@/redux/slices/apiSlice";
import { Check, Bot, Key, FolderOpen, FileText, Receipt, CreditCard, Save, Shield, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { motion } from "framer-motion";

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
    <div className="min-h-screen p-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-[var(--primary)] to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Bot size={35} className="text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-[var(--text1)] mb-2 text-left">
              {language==='ro'?'Configurare RPA':'RPA Configuration'}
            </h1>
            <p className="text-[var(--text2)] text-lg text-left">
              {language === 'ro' 
                ? 'Gestionează credențialele și setările pentru automatizarea proceselor' 
                : 'Manage credentials and settings for process automation'
              }
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-[var(--foreground)] rounded-3xl border border-[var(--text4)] shadow-lg overflow-hidden"
        >
          {/* Card Header */}
          <div className="p-6 border-b border-[var(--text4)] bg-gradient-to-r from-[var(--background)] to-[var(--foreground)]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-[var(--primary)]/20 to-blue-500/20 rounded-xl flex items-center justify-center">
                <Key size={24} className="text-[var(--primary)]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[var(--text1)]">
                  {language==='ro'?'Credențiale RPA':'RPA Credentials'}
                </h2>
                <p className="text-[var(--text2)] text-sm">
                  {language==='ro'?'Configurează cheile de acces pentru sistemul RPA':'Configure access keys for the RPA system'}
                </p>
              </div>
            </div>
          </div>

          {/* Card Content */}
          <div className="p-6">
            {/* Error Message */}
            {isErrorUpdatingRpaCredentials && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-500" />
                  <p className="text-red-600 text-sm font-medium">
                    {language==='ro'?'Schimbarea credentialelor RPA a eșuat! Vă rugăm reîncercați mai târziu!':'Failed to change the RPA credentials! Please try again later!'}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Security Notice */}
            <div className="mb-8 p-4 bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-2xl">
              <div className="flex items-start gap-3">
                <Shield size={20} className="text-[var(--primary)] mt-0.5" />
                <div>
                  <h4 className="font-semibold text-[var(--text1)] mb-1">
                    {language==='ro'?'Informații de securitate':'Security Information'}
                  </h4>
                  <p className="text-sm text-[var(--text2)]">
                    {language==='ro'?'Aceste credențiale sunt utilizate pentru integrarea cu sistemul RPA. Păstrează-le în siguranță.':'These credentials are used for RPA system integration. Keep them secure.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Credentials Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Client Invoice Key */}
              <div className="space-y-2">
                <label htmlFor="clientInvoiceInput" className="flex items-center gap-2 text-sm font-semibold text-[var(--text1)]">
                  <FileText size={16} className="text-blue-500" />
                  {language==='ro'?'Cheie facturi clienți':'Client invoices key'}
                </label>
                <input 
                  id='clientInvoiceInput'
                  type="text"
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--text4)] rounded-2xl 
                  focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                  text-[var(--text1)] transition-all duration-300 shadow-sm hover:shadow-md font-mono text-sm"
                  value={clientInvoiceRk || ''} 
                  onChange={(e)=>setClientInvoiceRk(e.target.value)}
                  placeholder={language==='ro'?'Introduceți cheia pentru facturi clienți':'Enter client invoices key'}
                />
              </div>

              {/* Supplier Invoice Key */}
              <div className="space-y-2">
                <label htmlFor="supplierInvoiceInput" className="flex items-center gap-2 text-sm font-semibold text-[var(--text1)]">
                  <FileText size={16} className="text-green-500" />
                  {language==='ro'?'Cheie facturi furnizori':'Supplier invoices key'}
                </label>
                <input 
                  id='supplierInvoiceInput'
                  type="text"
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--text4)] rounded-2xl 
                  focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                  text-[var(--text1)] transition-all duration-300 shadow-sm hover:shadow-md font-mono text-sm"
                  value={supplierInvoiceRk || ''} 
                  onChange={(e)=>setSupplierInvoiceRk(e.target.value)}
                  placeholder={language==='ro'?'Introduceți cheia pentru facturi furnizori':'Enter supplier invoices key'}
                />
              </div>

              {/* Client Receipt Key */}
              <div className="space-y-2">
                <label htmlFor="clientReceiptInput" className="flex items-center gap-2 text-sm font-semibold text-[var(--text1)]">
                  <Receipt size={16} className="text-purple-500" />
                  {language==='ro'?'Cheie chitanțe clienți':'Client receipts key'}
                </label>
                <input 
                  id='clientReceiptInput'
                  type="text"
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--text4)] rounded-2xl 
                  focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                  text-[var(--text1)] transition-all duration-300 shadow-sm hover:shadow-md font-mono text-sm"
                  value={clientReceiptRk || ''} 
                  onChange={(e)=>setClientReceiptRk(e.target.value)}
                  placeholder={language==='ro'?'Introduceți cheia pentru chitanțe clienți':'Enter client receipts key'}
                />
              </div>

              {/* Supplier Receipt Key */}
              <div className="space-y-2">
                <label htmlFor="supplierReceiptInput" className="flex items-center gap-2 text-sm font-semibold text-[var(--text1)]">
                  <CreditCard size={16} className="text-orange-500" />
                  {language==='ro'?'Cheie chitanțe furnizori':'Supplier receipts key'}
                </label>
                <input 
                  id='supplierReceiptInput'
                  type="text"
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--text4)] rounded-2xl 
                  focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                  text-[var(--text1)] transition-all duration-300 shadow-sm hover:shadow-md font-mono text-sm"
                  value={supplierReceiptRk || ''} 
                  onChange={(e)=>setSupplierReceiptRk(e.target.value)}
                  placeholder={language==='ro'?'Introduceți cheia pentru chitanțe furnizori':'Enter supplier receipts key'}
                />
              </div>
            </div>

            {/* Folder Configuration */}
            <div className="mb-8">
              <div className="space-y-2">
                <label htmlFor="rpaFolder" className="flex items-center gap-2 text-sm font-semibold text-[var(--text1)]">
                  <FolderOpen size={16} className="text-[var(--primary)]" />
                  {language==='ro'?'Nume folder RPA':'RPA folder name'}
                </label>
                <input 
                  id='rpaFolder'
                  type="text"
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--text4)] rounded-2xl 
                  focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                  text-[var(--text1)] transition-all duration-300 shadow-sm hover:shadow-md"
                  value={folderName || ''} 
                  onChange={(e)=>setFolderName(e.target.value)}
                  placeholder={language==='ro'?'Introduceți numele folderului RPA':'Enter RPA folder name'}
                />
                <p className="text-xs text-[var(--text3)] mt-1">
                  {language==='ro'?'Numele folderului în care vor fi procesate documentele':'The folder name where documents will be processed'}
                </p>
              </div>
            </div>

            {/* Save Button */}
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full py-4 rounded-2xl font-semibold text-lg transition-all duration-300 shadow-lg hover:shadow-xl
                flex items-center justify-center gap-3 ${
                rpaCredentialsChanged
                  ? 'bg-green-50 border-2 border-green-200 text-green-700'
                  : 'bg-gradient-to-r from-[var(--primary)] to-blue-500 text-white hover:from-[var(--primary)]/90 hover:to-blue-400'
              }`}
              onClick={handleUpdateRpaCredentials}
              disabled={rpaCredentialsChanged}
            >
              {rpaCredentialsChanged ? (
                <>
                  <Check size={20} />
                  {language==='ro'?'Credențiale RPA schimbate cu succes':'RPA Credentials Changed Successfully'}
                </>
              ) : (
                <>
                  <Save size={20} />
                  {language==='ro'?'Salvează Noile Credențiale':'Save New Credentials'}
                </>
              )}
            </motion.button>

            {/* Integration Status */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-semibold text-green-700">
                    {language==='ro'?'Status Integrare':'Integration Status'}
                  </span>
                </div>
                <p className="text-sm text-green-600">
                  {language==='ro'?'Conexiune activă cu sistemul RPA':'Active connection with RPA system'}
                </p>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <Bot size={16} className="text-blue-500" />
                  <span className="text-sm font-semibold text-blue-700">
                    {language==='ro'?'Ultima Sincronizare':'Last Sync'}
                  </span>
                </div>
                <p className="text-sm text-blue-600">
                  {language==='ro'?'2 minute în urmă':'2 minutes ago'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default RPA
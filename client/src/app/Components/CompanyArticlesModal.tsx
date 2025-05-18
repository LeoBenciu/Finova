import { useDeleteManagementMutation, useGetArticlesQuery, useGetManagementQuery, useSaveNewManagementMutation } from "@/redux/slices/apiSlice";
import { Check, X } from "lucide-react";
import { Management } from "./EditExtractedData/LineItems";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface CompanyArticlesParams {
    isArticleSelected: boolean;
    setIsArticleSelected: React.Dispatch<React.SetStateAction<boolean>>;
    setIsCompanyAccountingDetailsModal: React.Dispatch<React.SetStateAction<boolean>>;
    currentClientCompanyEin: string;
};

interface Article {
    id: number,
    code: number,
    name: string,           
    vat: string,           
    unitOfMeasure: string,   
    type: string    
}

const CompanyArticlesModal = ({isArticleSelected, setIsArticleSelected, setIsCompanyAccountingDetailsModal, currentClientCompanyEin}:CompanyArticlesParams) => {

    const ein = currentClientCompanyEin;

    //Articles
    const {data: articleList} = useGetArticlesQuery(ein);

    //Management
      const [ deleteManagement ] = useDeleteManagementMutation();
      const { data: managementList, refetch: refetchManagementList } = useGetManagementQuery(ein);
      const [ isNewManagement,setIsNewManagement ] = useState<boolean>(false);
      const [ saveNewManagement] = useSaveNewManagementMutation();

      const getBiggestCodeNumber = async() =>{
        const lis:any[] = await managementList;
        let biggest: number = Number.NEGATIVE_INFINITY;

        for(let i=0; i<=lis?.length; i++){
            if(lis?.[i]?.code !== null && lis?.[i]?.code > biggest) biggest = lis[i].code;
        }

        return biggest+1;
      }
      
      const [ managementCode, setManagementCode ] = useState<number>(0);

      useEffect(() => {
        getBiggestCodeNumber().then(code => setManagementCode(code));
      }, [managementList]);
      const [ managementName, setManagementName ] = useState<string>('');
      const [ managementType, setManagementType ] = useState<string>('CANTITATIV_VALORIC');
      const [ manager, setManager ] = useState<string>('');
      const [ isSellingPrice, setIsSellingPrice ] = useState<boolean>(false);
      const [ vatRate, setVatRate ] = useState<string>('ZERO');

      const handleSaveNewManagement = async() =>{
        const response = await saveNewManagement({
            managementCode,
            managementName,
            managementType,
            manager,
            isSellingPrice,
            vatRate,
            currentClientCompanyEin}).unwrap();
        console.log('New management:',response);
        setIsNewManagement(false);
        setManagementCode(managementCode+1);
        setManagementName('');
        setManagementType('CANTITATIV_VALORIC');
        setManager('');
        setIsSellingPrice(false);
        setVatRate('ZERO');
        refetchManagementList();
      };
    
    const handleDeleteManagement = async(managementId:number) =>{
        const response = await deleteManagement({managementId}).unwrap();
        console.log('Deleted management:', response);
        refetchManagementList();
    };

  return (
      <div className="fixed inset-0 bg-black/70
            flex justify-center items-center">
                <div className="bg-[var(--foreground)] min-w-[800px] max-w-max min-h-max pb-10 
                rounded-xl flex flex-col">
                    <div className="min-h-15 min-w-full flex items-center px-2 gap-1 justify-between">
                        <div className="flex items-center">
                        <button className={`px-10 font-bold
                        ${isArticleSelected?'bg-transparent text-black/50':'bg-black/10 text-[var(--primary)]'}`}
                        onClick={()=>setIsArticleSelected(true)}>Articole</button>

                        <button className={`px-10 font-bold
                        ${!isArticleSelected?'bg-transparent text-black/50':'bg-black/10 text-[var(--primary)]'}`}
                        onClick={()=>setIsArticleSelected(false)}>Gestiuni</button>
                        </div>
                        
                        <X size={25} className="text-red-500 mr-5
                        cursor-pointer" onClick={()=>setIsCompanyAccountingDetailsModal(false)}></X>
                    </div>

                    {isArticleSelected&&(
                    
                    <div className="min-w-full min-h-max overflow-y-scroll px-10">
                        <div className="min-w-full bg-black/10 min-h-14 mt-3 rounded-xl grid
                        grid-cols-5 items-center">
                            <h3 className="text-black font-bold">Cod</h3>
                            <h3 className="text-black font-bold">Nume</h3>
                            <h3 className="text-black font-bold">TVA</h3>
                            <h3 className="text-black font-bold">UM</h3>
                            <h3 className="text-black font-bold">Tip</h3>
                        </div>

                            {articleList?.map((article: Article)=>(
                                <div className=" min-h-14 mt-3 rounded-xl grid grid-cols-5 items-center">
                                    <h3 className="text-black">{article.code}</h3>
                                    <h3 className="text-black">{article.name}</h3>
                                    <h3 className="text-black">{article.vat ==="NINETEEN"? '19':
                                        article.vat ==="NINE"? '9': article.vat === "FIVE"? '5': '0'}</h3>
                                    <h3 className="text-black">{article.unitOfMeasure}</h3>
                                    <h3 className="text-black">{article.type}</h3>
                                </div>
                            ))}
                    </div>)}

                    {!isArticleSelected&&(
                    <div className="min-w-full min-h-max overflow-y-scroll px-10">
                        <div className="min-w-full bg-black/10 min-h-14 mt-3 rounded-xl grid
                        grid-cols-7 items-center">
                            <h3 className="text-black font-bold">Cod</h3>
                            <h3 className="text-black font-bold">Nume</h3>
                            <h3 className="text-black font-bold">Tip</h3>
                            <h3 className="text-black font-bold">Gestionar</h3>
                            <h3 className="text-black font-bold">La pret de vanzare</h3>
                            <h3 className="text-black font-bold">TVA</h3>
                        </div>

                        {managementList?.map((management: Management)=>(
                            <div className="min-h-14 mt-3 rounded-xl grid grid-cols-7 items-center">
                                    <h3 className="text-black">{management.code}</h3>
                                    <h3 className="text-black">{management.name}</h3>
                                    <h3 className="text-black">{management.type}</h3>
                                    <h3 className="text-black">{management.manager}</h3>
                                    <div className="min-h-8 max-h-8 min-w-8 max-w-8 border-2 rounded-lg mx-auto
                                    border-black">
                                        {management.isSellingPrice ? <Check size={28} className="text-green-400" /> : <X size={28} className="text-red-400" />}
                                    </div>
                                    <h3 className="text-black">{management.vatRate === 'NINETEEN'? '19':
                                        management.vatRate === 'NINE' ? '9' : management.vatRate === 'FIVE' ? '5':'0'}</h3>
                                    <X size={15} className="text-red-500 hover:text-black" onClick={()=>handleDeleteManagement(management.id||0)}></X>
                            </div>
                            ))}

                            {isNewManagement&&(
                            <div className="min-h-14 mt-3 rounded-xl grid grid-cols-6 items-center">
                                    <input className="min-h-[80%] text-black text-center border-2 border-r-0
                                    focus:outline-none focus:shadow-none border-black/20 rounded-l-lg" 
                                    value={managementCode} readOnly></input>
                                    <input className="min-h-[80%] text-black text-center border-2 border-r-0
                                    focus:outline-none focus:shadow-none border-black/20"
                                    value={managementName} onChange={(e)=>{setManagementName(e.target.value)}}></input>
                                    <select className="min-h-[80%] text-black text-center border-2 border-r-0
                                    focus:outline-none focus:shadow-none border-black/20" defaultValue={managementType}
                                    onChange={(e)=>setManagementType(e.target.value)}>
                                        <option value='GLOBAL_VALORIC'>Global Valoric</option>
                                        <option value='CANTITATIV_VALORIC'>Cantitativ Valoric</option>
                                    </select>
                                    <input className="min-h-[80%] text-black text-center border-2 border-r-0
                                    focus:outline-none focus:shadow-none border-black/20"
                                    onChange={(e)=>setManager(e.target.value)} value={manager}></input>
                                    <select className="min-h-[80%] text-black text-center border-2 border-r-0
                                    // focus:outline-none focus:shadow-none border-black/20" defaultValue=''
                                    onChange={(e)=>setIsSellingPrice(Boolean(e.target.value))}
                                    >
                                        <option value='true'>Da</option>
                                        <option value=''>Nu</option>
                                    </select>
                                    <select className="min-h-[80%] text-black text-center border-2 
                                    focus:outline-none focus:shadow-none border-black/20 rounded-r-lg" defaultValue={vatRate}
                                    onChange={(e)=>setVatRate(e.target.value)}>
                                        <option value='ZERO'>0</option>
                                        <option value='FIVE'>5</option>
                                        <option value='NINE'>9</option>
                                        <option value='NINETEEN'>19</option>
                                    </select>
                            
                            </div>)}

                        {!isNewManagement&&(<motion.button className="bg-[var(--primary)] mt-6 hover mb-5"
                        whileHover={{scale: 1.1}} whileTap={{scale: 1}}
                        onClick={()=>setIsNewManagement(true)}>Adauga o noua gestiune</motion.button>)}

                        
                        {isNewManagement&&(<motion.button className="bg-green-500 mt-6 hover mb-5 font-bold
                        disabled:bg-gray-400 disabled:cursor-not-allowed"
                        whileHover={{scale: 1.1}} whileTap={{scale: 1}}
                        onClick={()=>handleSaveNewManagement()} disabled={managementName.length === 0}>Salveaza noua gestiune</motion.button>)}
                        

                    </div>)}

                </div>
            </div>
  )
}

export default CompanyArticlesModal

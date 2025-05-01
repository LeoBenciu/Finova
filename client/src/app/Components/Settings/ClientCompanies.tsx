import { Search, Trash2 } from "lucide-react";
import { motion } from 'framer-motion';
import { useEffect, useState } from "react";
import { useCreateClientCompanyMutation, useDeleteClientCompanyMutation, useGetClientCompaniesMutation } from "@/redux/slices/apiSlice";
import LoadingComponent from "../LoadingComponent";
import { useSelector } from "react-redux";
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import CompanyArticlesModal from "../CompanyArticlesModal";

    type Company = {
        name:string,
        ein:string
    };

const ClientCompanies = () => {
    const [einNewCompany,setEinNewCompany] = useState<string>('');
    const [currentClientCompanyEin, setCurrentClientCompanyEin] = useState<string>('');
    const [companies, setCompanies] = useState<Company[]>();
    const [filteredCompanies, setFilteredCompanies] = useState<Company[]>();
    const[isCompanyAccountingDetailsModal, setIsCompanyAccountingDetailsModal] = useState<boolean>(false);
    const [IsCreatingNewCompanyComplete, setIsCreatingNewCompanyComplete] = useState<boolean>(false);
    const [articles, setArticles] = useState<File>();
    const [management, setManagement] = useState<File>();
    const [isArticleSelected, setIsArticleSelected] = useState<boolean>(true);

    const[getCompanies,{isLoading:isClientCompaniesLoading}] = useGetClientCompaniesMutation();
    const[createNewCompany,{isLoading:IsCreatingNewCompany}] = useCreateClientCompanyMutation();
    const [deleteCompany] = useDeleteClientCompanyMutation();
    const language = useSelector((state:{user:{language:string}})=>state.user.language);

    useEffect(()=>{
        if(articles && management && einNewCompany.length>1){
            setIsCreatingNewCompanyComplete(true);
        }else{
            setIsCreatingNewCompanyComplete(false);
        }
    },[articles,setArticles, management, setManagement,einNewCompany, setEinNewCompany]);

    useEffect(()=>{
        const handleFetchClientCompanies = async()=>{
            const response:Company[] = await getCompanies({}).unwrap();
            setCompanies(response);
            setFilteredCompanies(response);
            console.log('Client Response',response);
        };
        
        handleFetchClientCompanies();
    },[getCompanies])

    const handleSaveNewCompany = async () => {
        try {
          console.log(articles, management);
          const result = await createNewCompany({
            ein:einNewCompany,
            articles,
            management}).unwrap();
        
          console.log("Result of creating a new company", result);
      
          if (companies) {
            setFilteredCompanies([...companies, result.company]);
            setCompanies([...companies, result.company]);
            console.log("filtered", filteredCompanies);
          } else {
            setFilteredCompanies([result]);
            setCompanies([result]);
          }
      
          setEinNewCompany("");
          setArticles(undefined);
          setManagement(undefined);
          const articlesInput = document.getElementById("articole") as HTMLInputElement;
          const gestiuniInput = document.getElementById("gestiuni") as HTMLInputElement;
          if (articlesInput) articlesInput.value = "";
          if (gestiuniInput) gestiuniInput.value = "";
        } catch (error) {
          console.error(error);
        }
      };

    const deleteClientCompany = async(einToDelete:string)=>{
        try {
            const deleted = await deleteCompany(einToDelete).unwrap();
            console.log(deleted);
            setCompanies(companies?.filter(company=>company.ein!==deleted.ein));
            setFilteredCompanies(companies?.filter(company=>company.ein!==deleted.ein));
        } catch (e) {
            console.error(e);
        }
    };

    const handleFilterCompanies = (str:string) =>{
        const ne = companies?.filter((company)=>(
            company.name.toLowerCase().includes(str.toLowerCase())|| company.ein.includes(str)
        ));
        setFilteredCompanies(ne);
    };

  return (
    <div id='Client Companies' 
    className="mt-10 mx-10 min-w-96 
    min-h-96 px-10 grid grid-cols-1 md:grid-cols-2 items-start col-start-1">
      
      <div className="flex flex-col">
      <h2 className="font-bold text-4xl text-left text-[var(--text1)]">{language==='ro'?'Companii Clienti':'Client Companies'}</h2>

      <div className="mt-10
      min-h-96 max-h-[35rem] min-w-96 p-5 rounded-2xl
      bg-[var(--foreground)] shadow-[0_0_10px_rgba(0,0,0,0.3)]">
        <div className="min-w-full flex items-center bg-white rounded-lg min-h-8
        ring-1 ring-[var(--text1)]">
            <input className="bg-white text-black
            rounded-lg px-2 flex-1 min-h-full focus:outline-none focus:shadow-none"
            placeholder={language==='ro'?"Cauta dupa nume sau cui":"Search by name or ein"}
            onChange={(e)=>handleFilterCompanies(e.target.value)}></input>
            <Search className="text-black mr-3"></Search>
        </div>
        <div className="
        grid grid-cols-5 items-center p-3
        rounded-xl mt-5 bg-[var(--background)]">
            <p className='col-span-2 text-lg font-extrabold
            text-[var(--text1)]'>{language==='ro'?'Nume':'Name'}</p>
            <p className='col-span-2 text-lg font-extrabold
            text-[var(--text1)]'>{language==='ro'?'CUI':'EIN'}</p>
        </div>
        {isClientCompaniesLoading&&(
            <div className="mt-10 max-w-[150px] mx-auto">
            <LoadingComponent></LoadingComponent>
            </div>
        )}
        <div className="min-w-full max-w-full max-h-[400px] min-h-[200px] overflow-y-scroll
        scrollbar-custom mt-5">
        {!isClientCompaniesLoading&&(filteredCompanies?.map((company:Company)=>(
            <div key={company.ein} className="
            grid grid-cols-5 items-center p-3 hover:bg-black/10 cursor-pointer
            rounded-xl" onClick={()=>{setCurrentClientCompanyEin(company.ein);
              setIsCompanyAccountingDetailsModal(true)
            }}>
                <div className="col-span-2 flex items-center justify-center">
                <p className="text-center text-[var(--text2)]">{company.name}</p>
                </div>

                <div className="col-span-2">
                <p className="text-[var(--text2)]">{company.ein}</p>
                </div>

                <div className="flex items-center
                justify-center">
                    <Trash2 size={20} 
                    className="text-red-500 hover:text-red-300 cursor-pointer"
                    onClick={()=>deleteClientCompany(company.ein)}></Trash2>
                </div>
            </div>
        )))}
        </div>
      </div>

    </div>

    <div className="flex flex-col justify-center min-w-full px-10">
        <button className="max-w-max mx-auto max-h-40 py-[0.45rem]
        flex items-center gap-3
        bg-[var(--foreground)] cursor-default ">
            Create new company</button>
        <div className="bg-[var(--foreground)] mt-10
         min-w-96 p-5 rounded-2xl  shadow-[0_0_10px_rgba(0,0,0,0.3)]">
            <h3 className="text-2xl font-bold mb-5
            text-[var(--text1)]">{language==='ro'?'Creaza Companie Noua':'Create New Company'}</h3>

            <label htmlFor="Company ein" className="
            mt-10 text-[var(--text2)]">{language==='ro'?'CUI':'EIN'}</label>
            <input className="bg-white min-w-full rounded-lg min-h-8 mt-2
            text-black px-3 focus:outline-none ring-1 ring-[var(--text1)]
            focus:ring-[var(--primary)] focus:ring-1" type='text'
            id='Company ein' onChange={(e)=>setEinNewCompany(e.target.value)}
                value={einNewCompany}></input>

            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="articole" className="text-black
              mt-5">Articole (Fisier CSV)</Label>
              <Input id="articole" type="file"  className="text-black flex
              flex-row justify-center items-center px-5 pt-[7px] mt-2 focus:shadow-[var(--primary)]"
              onChange={(e)=>setArticles(e.target.files?.[0])}/>
            </div>

            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="gestiuni" className="text-black
              mt-5">Gestiuni (Fisier CSV)</Label>
              <Input id="gestiuni" type="file"  className="text-black flex
              flex-row justify-center items-center px-5 pt-[7px] mt-2 focus:shadow-[var(--primary)]"
              onChange={(e)=>setManagement(e.target.files?.[0])}/>
            </div>

            <motion.button className="max-w-max mx-auto max-h-40 py-[0.45rem] mt-8 bg-[var(--primary)]
            disabled:bg-[var(--primary)]/30
            " whileHover={{ scale: 1.1 }} whileTap={{scale: 0.9}}
            disabled={IsCreatingNewCompany?true:false || !IsCreatingNewCompanyComplete}
            onClick={handleSaveNewCompany}>
                {IsCreatingNewCompany?(language==='ro'?'Se creeaza...':'Creating...'):(language==='ro'?'Creeaza':'Create')}
            </motion.button>

            {isCompanyAccountingDetailsModal&&(<CompanyArticlesModal isArticleSelected={isArticleSelected} 
            setIsArticleSelected={setIsArticleSelected} setIsCompanyAccountingDetailsModal={setIsCompanyAccountingDetailsModal}
            currentClientCompanyEin={currentClientCompanyEin}/>)}

        </div>
    </div>
    </div>
  )
}

export default ClientCompanies;

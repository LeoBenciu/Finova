import { Search } from "lucide-react"
import LoadingComponent from "./LoadingComponent"
import { useEffect, useState } from "react";
import { useGetClientCompaniesMutation } from "@/redux/slices/apiSlice";
import { useDispatch, useSelector } from "react-redux";
import { setCurrentCompany } from '@/redux/slices/clientCompanySlice';
import Logo from '@/assets/2solLqZ3AFncSar4MubKNQ4TreZ.svg'
import { useNavigate } from "react-router";

type Company = {
    name:string,
    ein:string
};


const InitialClientCompanyModalSelect = () => {

        const dispatch = useDispatch();
        const navigate = useNavigate();
        const language = useSelector((state:{user:{language:string}})=>state.user.language);

        const [companies, setCompanies] = useState<Company[]>();
        const [filteredCompanies, setFilteredCompanies] = useState<Company[]>();
    
        const[getCompanies,{isLoading:isClientCompaniesLoading}] = useGetClientCompaniesMutation();
    
        useEffect(()=>{
            const handleFetchClientCompanies = async()=>{
                const response:Company[] = await getCompanies({}).unwrap();
                setCompanies(response);
                setFilteredCompanies(response);
                console.log('Client Response',response);
            };
            
            handleFetchClientCompanies();
        },[getCompanies])

    const handleFilterCompanies = (str:string) =>{
        const ne = companies?.filter((company)=>(
            company.name.toLowerCase().includes(str.toLowerCase())|| company.ein.includes(str)
        ));
        setFilteredCompanies(ne);
    };

  return (
    <div className="absolute inset-0 bg-[var(--background)] min-w-vw min-h-vh flex 
    flex-col justify-center items-center">
      <img src={Logo} alt="Finova logo" className='h-24'/>
      <h2 className="font-bold text-3xl mt-6 text-[var(--text1)]"
       onClick={()=>console.log(localStorage.getItem('ClientCompanyName'))}>
        {language==='ro'?'Selecteaza un client':'Select a starting client company'}
      </h2>
      <div className="bg-[var(--foreground)] min-w-[30rem] min-h-72 max-h-[38rem] rounded-2xl mt-10
      p-10 max-w-[30rem]">

        <div className="min-w-full flex items-center bg-white rounded-lg min-h-8
        ring-1 ring-[var(--text1)]">
            <input className="bg-white text-black
            rounded-lg px-2 flex-1 min-h-full focus:outline-none focus:shadow-none"
            placeholder={language==='ro'?'Cauta dupa nume sau cui':"Search by name or ein"}
            onChange={(e)=>handleFilterCompanies(e.target.value)}></input>
            <Search className="text-black mr-3"></Search>
        </div>
        <div className="
        grid grid-cols-2 items-center p-3 bg-[var(--text1)] 
        rounded-xl mt-5">
            <p className='text-lg font-extrabold'>{language==='ro'?'Nume':'Name'}</p>
            <p className='text-lg font-extrabold'>{language==='ro'?'CUI':'EIN'}</p>
        </div>
        {isClientCompaniesLoading&&(
            <div className="mt-10 max-w-[150px] mx-auto">
            <LoadingComponent></LoadingComponent>
            </div>
        )}
        <div className="min-w-full max-w-full max-h-[400px] min-h-[200px] overflow-y-scroll
        scrollbar-custom mt-6">
        {!isClientCompaniesLoading&&(filteredCompanies?.map((company:Company)=>(
            <div key={company.ein} className="
            grid grid-cols-2 items-center p-3 hover:bg-[var(--primary)]
            rounded-xl cursor-pointer group"
            onClick={()=>{dispatch(setCurrentCompany({name:company.name,ein:company.ein}))}}>
                <div className="flex items-center justify-center">
                <p className="text-center font-bold text-[var(--text1)]
                group-hover:text-[var(--primaryText)]">{company.name}</p>
                </div>

                <div>
                <p className="text-center font-bold text-[var(--text1)]
                group-hover:text-[var(--primaryText)]">{company.ein}</p>
                </div>
            </div>
        )))}
        {filteredCompanies?.length===0||!filteredCompanies&&(
            <div className="flex mt-10 flex-col items-center
            justify-center">
            <p className="font-bold text-black">{language==='ro'?'Nu sunt companii asociate acestui cont':`There are no 
                client companies associated with this account!
                Please `}<span className="text-[var(--primary)]
                cursor-pointer" onClick={()=>{
                    navigate('/settings');
                }}>
                    Create New Company
                </span></p>
            </div>
        )}
        </div>

      </div>
    </div>
  )
}

export default InitialClientCompanyModalSelect

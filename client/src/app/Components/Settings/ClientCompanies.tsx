import { Search, Trash2 } from "lucide-react";
import { motion } from 'framer-motion';
import { useEffect, useState } from "react";
import { useCreateClientCompanyMutation, useDeleteClientCompanyMutation, useGetClientCompaniesMutation } from "@/redux/slices/apiSlice";
import LoadingComponent from "../LoadingComponent";

    type Company = {
        name:string,
        ein:string
    };

const ClientCompanies = () => {
    const [einNewCompany,setEinNewCompany] = useState<string>('');
    const [companies, setCompanies] = useState<Company[]>();
    const [filteredCompanies, setFilteredCompanies] = useState<Company[]>();

    const[getCompanies,{isLoading:isClientCompaniesLoading}] = useGetClientCompaniesMutation();
    const[createNewCompany,{isLoading:IsCreatingNewCompany}] = useCreateClientCompanyMutation();
    const [deleteCompany] = useDeleteClientCompanyMutation();

    useEffect(()=>{
        const handleFetchClientCompanies = async()=>{
            const response:Company[] = await getCompanies({}).unwrap();
            setCompanies(response);
            setFilteredCompanies(response);
            console.log('Client Response',response);
        };
        
        handleFetchClientCompanies();
    },[getCompanies])

    const handleSaveNewCompany = async() =>{
        try { 
            const result = await createNewCompany(einNewCompany).unwrap();
            console.log('Result of creating a new company',result);
            
            if(companies){
                setFilteredCompanies([
                    ...companies,
                    result.company
                ])
                setCompanies([
                    ...companies,
                    result.company
                ])
                console.log('filtered', filteredCompanies);
            }else{
                setFilteredCompanies([
                    result
                ]);
                setCompanies([
                    result
                ]);
            };
            
            setEinNewCompany('');
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
      <h2 className="font-bold text-4xl text-left">Client Companies</h2>

      <div className="bg-[var(--card)] mt-10
      min-h-96 max-h-[35rem] min-w-96 p-5 rounded-2xl">
        <div className="min-w-full flex items-center bg-white rounded-lg min-h-8">
            <input className="bg-white text-black
            rounded-lg px-2 flex-1 min-h-full focus:outline-none focus:shadow-none"
            placeholder="Search by name or ein"
            onChange={(e)=>handleFilterCompanies(e.target.value)}></input>
            <Search className="text-black mr-3"></Search>
        </div>
        <div className="
        grid grid-cols-5 items-center p-3 bg-[#2c2a2f] 
        rounded-xl mt-5">
            <p className='col-span-2 text-lg font-extrabold'>Name</p>
            <p className='col-span-2 text-lg font-extrabold'>EIN</p>
        </div>
        {isClientCompaniesLoading&&(
            <div className="mt-10 max-w-[150px] mx-auto">
            <LoadingComponent></LoadingComponent>
            </div>
        )}
        <div className="min-w-full max-w-full max-h-[400px] min-h-[200px] overflow-y-scroll
        scrollbar-custom">
        {!isClientCompaniesLoading&&(filteredCompanies?.map((company:Company)=>(
            <div key={company.ein} className="
            grid grid-cols-5 items-center p-3">
                <div className="col-span-2 flex items-center justify-center">
                <p className="text-center">{company.name}</p>
                </div>

                <div className="col-span-2">
                <p >{company.ein}</p>
                </div>

                <div className="flex items-center
                justify-center">
                    <Trash2 size={20} 
                    className="hover:text-red-500 cursor-pointer"
                    onClick={()=>deleteClientCompany(company.ein)}></Trash2>
                </div>
            </div>
        )))}
        </div>
      </div>

    </div>

    <div className="flex flex-col justify-center min-w-full px-10">
        <button className="max-w-max mx-auto max-h-40 py-[0.45rem]
        flex items-center gap-3 text-[var(--foreground)]
        bg-[var(--foreground)] cursor-default">
            Create new company</button>
        <div className="bg-[var(--card)] mt-10
         min-w-96 p-5 rounded-2xl">
            <h3 className="text-2xl font-bold mb-5">Create New Company</h3>

            <label htmlFor="Company ein" className="
            mt-10">EIN</label>
            <input className="bg-white min-w-full rounded-lg min-h-8 mt-2
            text-black px-3 focus:outline-none" type='text'
            id='Company ein' onChange={(e)=>setEinNewCompany(e.target.value)}
                value={einNewCompany}></input>

            <motion.button className="max-w-max mx-auto max-h-40 py-[0.45rem] mt-8 bg-[var(--primary)]
            disabled:bg-[var(--primary)]/30
            " whileHover={{ scale: 1.1 }} whileTap={{scale: 0.9}}
            disabled={IsCreatingNewCompany?true:false}
            onClick={handleSaveNewCompany}>
                {IsCreatingNewCompany?'Creating...':'Create'}
            </motion.button>

        </div>
    </div>
    </div>
  )
}

export default ClientCompanies;

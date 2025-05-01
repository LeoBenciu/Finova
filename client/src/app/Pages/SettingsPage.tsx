import { useState } from "react"
import User from "../Components/Settings/User";
import ClientCompanies from "../Components/Settings/ClientCompanies";
import Company from "../Components/Settings/Company";
import { useSelector } from "react-redux";

enum Section{
  USER,
  COMPANY,
  CLIENTCOMPANIES
}

const SettingsPage = () => {

  const [section, setSection] = useState<Section>(Section.USER);
  const language = useSelector((state:{user:{language:string}})=>state.user.language);

  return (
    <div className="bg-[var(--foreground)] min-w-full min-h-[850px] rounded-3xl">
      <div className="grid grid-cols-4 min-w-full rounded-t-3xl min-h-15">
        <button className={`${section===Section.USER?'bg-transparent text-[var(--primary)] font-bold':'text-[var(--text3)] hover:bg-[var(--background)]'} 
        text-lg m-2 mr-0 rounded-xl bg-[var(--background)]`}
        onClick={()=>setSection(Section.USER)}>
          {language==='ro'?'Utilizator':'User'}
        </button>

        {false&&(<button className={`${section===Section.COMPANY?'bg-transparent text-[var(--primary)] font-bold':'text-neutral-400 hover:bg-[var(--background)]'} 
        text-lg m-2 mr-0 rounded-xl`}
         onClick={()=>setSection(Section.COMPANY)}>
          {language==='ro'?'Companie':'Company'}
        </button>)}

        <button className={`${section===Section.CLIENTCOMPANIES?'bg-transparent text-[var(--primary)] font-bold':'text-[var(--text3)] hover:bg-[var(--background)]'} 
        text-lg m-2 rounded-xl bg-[var(--background)]`}
         onClick={()=>setSection(Section.CLIENTCOMPANIES)}>
          {language==='ro'?'Clienti':'Client Companies'}
        </button>
      </div>

      {section===Section.USER&&(
      <User/>
      )}

      {section===Section.CLIENTCOMPANIES&&(
         <ClientCompanies/>
      )}

      {section===Section.CLIENTCOMPANIES&&(
      <Company/>
      )}
    </div>
  )
}

export default SettingsPage

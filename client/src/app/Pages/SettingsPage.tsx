import { useState } from "react"
import User from "../Components/Settings/User";
import ClientCompanies from "../Components/Settings/ClientCompanies";
import Company from "../Components/Settings/Company";

enum Section{
  USER,
  COMPANY,
  CLIENTCOMPANIES
}

const SettingsPage = () => {

  const [section, setSection] = useState<Section>(Section.USER);

  return (
    <div className="bg-[var(--foreground)] min-w-[1000px] min-h-[850px] rounded-3xl">
      <div className="grid grid-cols-4 min-w-full rounded-t-3xl min-h-15">
        <button className={`${section===Section.USER?'bg-transparent text-[var(--primary)] font-bold':'text-neutral-400 hover:bg-[var(--background)]'} 
        text-lg m-2 mr-0 rounded-xl`}
        onClick={()=>setSection(Section.USER)}>
          User
        </button>

        {false&&(<button className={`${section===Section.COMPANY?'bg-transparent text-[var(--primary)] font-bold':'text-neutral-400 hover:bg-[var(--background)]'} 
        text-lg m-2 mr-0 rounded-xl`}
         onClick={()=>setSection(Section.COMPANY)}>
          Company
        </button>)}

        <button className={`${section===Section.CLIENTCOMPANIES?'bg-transparent text-[var(--primary)] font-bold':'text-neutral-400 hover:bg-[var(--background)]'} 
        text-lg m-2 rounded-xl`}
         onClick={()=>setSection(Section.CLIENTCOMPANIES)}>
          Client Companies
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

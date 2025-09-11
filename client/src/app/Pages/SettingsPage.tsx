import { useState } from "react"
import User from "../Components/Settings/User";
import Company from "../Components/Settings/Company";
import Privacy from "../Components/Settings/Privacy";
import RPA from '../Components/Settings/RPA';
import LedgerViewer from './SettingsPage/LedgerViewer';
import { useSelector } from "react-redux";

enum Section{
  USER,
  COMPANY,
  CLIENTCOMPANIES,
  PRIVACY,
  RPA,
  LEDGER
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

        <button className={`${section===Section.PRIVACY?'bg-transparent text-[var(--primary)] font-bold':'text-[var(--text3)] hover:bg-[var(--background)]'} 
        text-lg m-2 rounded-xl bg-[var(--background)]`}
         onClick={()=>setSection(Section.PRIVACY)}>
          {language==='ro'?'Confidentialitate':'Privacy'}
        </button>

        <button className={`${section===Section.RPA?'bg-transparent text-[var(--primary)] font-bold':'text-[var(--text3)] hover:bg-[var(--background)]'} 
        text-lg m-2 rounded-xl bg-[var(--background)]`}
         onClick={()=>setSection(Section.RPA)}>
          {language==='ro'?'RPA':'RPA'}
        </button>

        <button className={`${section===Section.LEDGER?'bg-transparent text-[var(--primary)] font-bold':'text-[var(--text3)] hover:bg-[var(--background)]'} 
        text-lg m-2 rounded-xl bg-[var(--background)]`}
         onClick={()=>setSection(Section.LEDGER)}>
          {language==='ro'?'Registru':'Ledger'}
        </button>
        
      </div>

      {section===Section.USER&&(
      <User/>
      )}

      {section===Section.CLIENTCOMPANIES&&(
      <Company/>
      )}

      {section===Section.PRIVACY&&(
        <Privacy/>
      )}

      {section===Section.RPA&&(
        <RPA/>
      )}

      {section===Section.LEDGER&&(
        <LedgerViewer/>
      )}
    </div>
  )
}

export default SettingsPage

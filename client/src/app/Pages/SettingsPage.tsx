import { useEffect, useState } from "react"
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
  const [email, setEmail] = useState<string>();
  const [name, setName] = useState<string>();
  const [password, setPassword] = useState<string>();
  const [phoneNumber, setPhoneNumber] = useState<string>();

  useEffect(()=>{
    setEmail('');
    setPhoneNumber('');
    setName('');
  },[])

  return (
    <div className="bg-[var(--foreground)] min-w-[1000px] min-h-[850px] rounded-3xl">
      <div className="grid grid-cols-4 min-w-full rounded-t-3xl min-h-15">
        <button className={`${section===Section.USER?'bg-transparent text-[var(--primary)] font-bold':'text-neutral-400 hover:bg-[var(--background)]'} 
        text-lg m-2 mr-0 rounded-xl`}
        onClick={()=>setSection(Section.USER)}>
          User
        </button>

        <button className={`${section===Section.COMPANY?'bg-transparent text-[var(--primary)] font-bold':'text-neutral-400 hover:bg-[var(--background)]'} 
        text-lg m-2 mr-0 rounded-xl`}
         onClick={()=>setSection(Section.COMPANY)}>
          Company
        </button>

        <button className={`${section===Section.CLIENTCOMPANIES?'bg-transparent text-[var(--primary)] font-bold':'text-neutral-400 hover:bg-[var(--background)]'} 
        text-lg m-2 rounded-xl`}
         onClick={()=>setSection(Section.CLIENTCOMPANIES)}>
          Client Companies
        </button>
      </div>

      {section===Section.USER&&(
      <User 
        email={email}
        password={password}
        name={name}
        phoneNumber={phoneNumber}
        setEmail={setEmail}
        setPassword={setPassword}
        setName={setName}
        setPhoneNumber={setPhoneNumber}
      />
      )}

      {section===Section.CLIENTCOMPANIES&&(
         <ClientCompanies/>
      )}

      {section===Section.CLIENTCOMPANIES&&(
      <Company/>
      )}

      {/*
      //Client Companies: Change name, Add Companies, Delete Company/ies(by accountingClient relashionships)
      //Accounting Company: Name, users */}
    </div>
  )
}

export default SettingsPage

"use client";
import { useSelector } from "react-redux"
import InitialClientCompanyModalSelect from "../Components/InitialClientCompanyModalSelect"
import { cn } from "@/lib/utils";

type clientCompanyName = {
  clientCompany:{
    current:{
      name:string,
      ein:string
    }
  }
}


function ReportsPage() {

  const clientCompanyName = useSelector((state:clientCompanyName)=>state.clientCompany.current.name);
  const language = useSelector((state:{user:{language:string}})=>state.user.language);

  return (
    <div className="h-[40rem] w-full rounded-4xl flex md:items-center md:justify-center bg-white/[0.96] antialiased bg-grid-white/[0.02] relative ">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 [background-size:40px_40px] select-none rounded-4xl",
          "[background-image:linear-gradient(to_right,var(--background)_1px,transparent_1px),linear-gradient(to_bottom,var(--background)_1px,transparent_1px)]",
        )}
      />
      <div className=" p-4 max-w-7xl  mx-auto relative z-10  w-full pt-20 md:pt-0 px-10">
        <h1 className="text-4xl md:text-7xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-b from-neutral-900 to-neutral-400 bg-opacity-50">
        {language==='ro'?'':
        `Making things better for you`}
        <br/>
        {language==='ro'?'Creăm cea mai bună experiență pentru tine.':'one step at a time!'}
        </h1>
        <p className="mt-4 font-normal text-base text-neutral-800 max-w-lg text-center mx-auto">
         {language==='ro'?'Iti multumim pentru rabdare ~ Echipa Finova':'We thank you for your patience ~ Finova Team'}
        </p>
      </div>
      {clientCompanyName===''&&(<InitialClientCompanyModalSelect/>)}
    </div>
  );
}

export default ReportsPage

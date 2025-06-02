import { Shield, File, CircleCheckBig, Share } from "lucide-react"

const Privacy = () => {
    return (
      <div className="bg-red-500 mt-10 mx-10 min-w-96 
    min-h-96 px-10 grid grid-cols-2 items-start col-start-1">
        <h3><Shield size={25}></Shield> Confidențialitate și Date Personale</h3>
        <h4>Gestionați-vă datele personale și drepturile de confidențialitate</h4>

        <div className="bg-white rounded-xl shadow-md border-[1px] border-neutral-600
        mx-[15px] my-[15px] p-[15px]">
            <div className="flex flex-row gap-1 text-black">
                <File size={20}></File> 
                <p>Acorduri Legale</p>
            </div>
            <p className="text-neutral-600">Vedeți și gestionați acordurile legale acceptate</p>

            <div className="my-[15px] min-w-full min-h-16 max-h-16 flex flex-row justify-between">
                <div className="flex flex-row gap-1">
                    <CircleCheckBig size={20}/>
                    <p>Termeni si Conditii</p>
                    <div className="rounded-md"><p>Acceptat</p></div>
                </div>

                <div className="flex flex-row gap-1">
                    <p className="text-neutral-600">17/10/1090</p>
                    <div className="p-[2px] rounded-md borderd-[1px] border-neutral-600 shadow-sm">
                        <Share size={10}></Share>
                        <p className="font-bold text-black text-base">Vezi Documentul</p>
                    </div>
                </div>
            </div>
        </div>
      </div>
    )
  }
  
  export default Privacy
  
import { Shield, File, CircleCheckBig, Share, Clock } from "lucide-react"

const Privacy = () => {
    return (
      <div className="bg-white rounded-md border-[1px] border-neutral-400 mt-10 mx-10 min-w-96 
    min-h-96 px-10 flex flex-col items-start col-start-1 p-[15px]">
        <div className="flex flex-row gap-1">
            <Shield size={25}></Shield>
            <h3>Confidențialitate și Date Personale</h3>
        </div>
        <h4>Gestionați-vă datele personale și drepturile de confidențialitate</h4>

            <div className="my-[15px] min-w-full min-h-16 max-h-16 flex flex-row justify-between
            bg-white rounded-md border-neutral-400 shadow-sm">
                <div className="flex flex-row gap-1">
                    <CircleCheckBig size={20} className="text-green-500"/>
                    <p className="text-black">Termeni si Conditii</p>
                    <div className="rounded-md bg-black"><p>Acceptat</p></div>
                </div>

                <div className="flex flex-row gap-1">
                    <p className="text-neutral-600">17/10/1090</p>
                    <div className="p-[2px] rounded-md borderd-[1px] border-neutral-600 shadow-sm">
                        <Share size={10}></Share>
                        <p className="font-bold text-black text-base">Vezi Documentul</p>
                    </div>
                </div>
            </div>

            <div className="my-[15px] min-w-full min-h-16 max-h-16 flex flex-row justify-between
            bg-white rounded-md border-neutral-400 shadow-sm">
                <div className="flex flex-row gap-1">
                    <CircleCheckBig size={20} className="text-green-500"/>
                    <p className="text-black">Politica de confidentialitate</p>
                    <div className="rounded-md bg-black"><p>Acceptat</p></div>
                </div>

                <div className="flex flex-row gap-1">
                    <p className="text-neutral-600">17/10/1090</p>
                    <div className="p-[2px] rounded-md borderd-[1px] border-neutral-600 shadow-sm">
                        <Share size={10}></Share>
                        <p className="font-bold text-black text-base">Vezi Documentul</p>
                    </div>
                </div>
            </div>

            <div className="my-[15px] min-w-full min-h-16 max-h-16 flex flex-row justify-between
            bg-white rounded-md border-neutral-400 shadow-sm">
                <div className="flex flex-row gap-1">
                    <CircleCheckBig size={20} className="text-green-500"/>
                    <p className="text-black">Acord Prelucrare Date</p>
                    <div className="rounded-md bg-black"><p>Acceptat</p></div>
                </div>

                <div className="flex flex-row gap-1">
                    <p className="text-neutral-600">17/10/1090</p>
                    <div className="p-[2px] rounded-md borderd-[1px] border-neutral-600 shadow-sm">
                        <Share size={10}></Share>
                        <p className="font-bold text-black text-base">Vezi Documentul</p>
                    </div>
                </div>
            </div>

            <div className="my-[15px] min-w-full min-h-16 max-h-16 flex flex-row justify-between
            bg-white rounded-md border-neutral-400 shadow-sm">
                <div className="flex flex-row gap-1">
                    <CircleCheckBig size={20} className="text-green-500"/>
                    <p className="text-black">Politica de Cookie-uri</p>
                    <div className="rounded-md bg-black"><p>Acceptat</p></div>
                </div>

                <div className="flex flex-row gap-1">
                    <p className="text-neutral-600">17/10/1090</p>
                    <div className="p-[2px] rounded-md borderd-[1px] border-neutral-600 shadow-sm">
                        <Share size={10}></Share>
                        <p className="font-bold text-black text-base">Vezi Documentul</p>
                    </div>
                </div>
            </div>

            <div className="my-[15px] min-w-full min-h-16 max-h-16 flex flex-row justify-between
            bg-white rounded-md border-neutral-400 shadow-sm">
                <div className="flex flex-row gap-1">
                    <Clock size={20} className="text-neutral-500"/>
                    <p className="text-black">Comunicări Marketing</p>
                    <div className="rounded-md bg-neutral-300 text-black"><p>Refuzat</p></div>
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
    )
  }
  
  export default Privacy
  
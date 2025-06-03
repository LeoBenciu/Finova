import { Shield, CircleCheckBig, Share, Clock } from "lucide-react"

const Privacy = () => {
    return (
      <div className="bg-white rounded-lg border-[1px] border-neutral-200 mt-10 mx-10 min-w-96 
    min-h-96 px-10 flex flex-col items-start col-start-1 p-[15px] shadow-md">
        <div className="flex flex-row gap-1">
            <Shield size={25} className="text-[var(--primary)]"></Shield>
            <h3 className="text-black">Confidențialitate și Date Personale</h3>
        </div>
        <h4 className="text-neutral-700 text-sm">Gestionați-vă datele personale și drepturile de confidențialitate</h4>

            <div className="my-[15px] min-w-full min-h-16 max-h-16 flex flex-row justify-between
            bg-white rounded-md border-neutral-400 shadow-sm px-[10px]">
                <div className="flex flex-row gap-2 items-center">
                    <CircleCheckBig size={20} className="text-green-500"/>
                    <p className="text-black">Termeni si Conditii</p>
                    <div className="rounded-md bg-black flex flex-row items-center shadow-sm max-h-max p-[5px]
                    justify-center font-bold text-sm"><p>Acceptat</p></div>
                </div>

                <div className="flex flex-row gap-2 items-center">
                    <p className="text-neutral-600">17/10/1090</p>
                    <div className="flex flex-row items-center rounded-md borderd-[1px] justify-center
                     border-neutral-600 shadow-sm p-[5px] max-h-max cursor-pointer hover:bg-neutral-300
                     gap-1">
                        <Share size={15} className="text-black"></Share>
                        <p className="font-bold text-black text-base">Vezi Documentul</p>
                    </div>
                </div>
            </div>

            <div className="my-[15px] min-w-full min-h-16 max-h-16 flex flex-row justify-between
            bg-white rounded-md border-neutral-400 shadow-sm px-[10px]">
                <div className="flex flex-row gap-2 items-center">
                    <CircleCheckBig size={20} className="text-green-500"/>
                    <p className="text-black">Politica de confidentialitate</p>
                    <div className="rounded-md bg-black flex flex-row items-center shadow-sm max-h-max p-[5px]
                    justify-center font-bold text-sm"><p>Acceptat</p></div>
                </div>

                <div className="flex flex-row gap-2 items-center">
                    <p className="text-neutral-600">17/10/1090</p>
                    <div className="flex flex-row items-center rounded-md borderd-[1px] justify-center
                     border-neutral-600 shadow-sm p-[5px] max-h-max cursor-pointer hover:bg-neutral-300
                     gap-1">
                        <Share size={15} className="text-black"></Share>
                        <p className="font-bold text-black text-base">Vezi Documentul</p>
                    </div>
                </div>
            </div>

            <div className="my-[15px] min-w-full min-h-16 max-h-16 flex flex-row justify-between
            bg-white rounded-md border-neutral-400 shadow-sm px-[10px]">
                <div className="flex flex-row gap-2 items-center">
                    <CircleCheckBig size={20} className="text-green-500"/>
                    <p className="text-black">Acord Prelucrare Date</p>
                    <div className="rounded-md bg-black flex flex-row items-center shadow-sm max-h-max p-[5px]
                    justify-center font-bold text-sm"><p>Acceptat</p></div>
                </div>

                <div className="flex flex-row gap-2 items-center">
                    <p className="text-neutral-600">17/10/1090</p>
                    <div className="flex flex-row items-center rounded-md borderd-[1px] justify-center
                     border-neutral-600 shadow-sm p-[5px] max-h-max cursor-pointer hover:bg-neutral-300
                     gap-1">
                        <Share size={15} className="text-black"></Share>
                        <p className="font-bold text-black text-base">Vezi Documentul</p>
                    </div>
                </div>
            </div>

            <div className="my-[15px] min-w-full min-h-16 max-h-16 flex flex-row justify-between
            bg-white rounded-md border-neutral-400 shadow-sm px-[10px]">
                <div className="flex flex-row gap-2 items-center">
                    <CircleCheckBig size={20} className="text-green-500"/>
                    <p className="text-black">Politica de Cookie-uri</p>
                    <div className="rounded-md bg-black flex flex-row items-center shadow-sm max-h-max p-[5px]
                    justify-center font-bold text-sm"><p>Acceptat</p></div>
                </div>

                <div className="flex flex-row gap-2 items-center">
                    <p className="text-neutral-600">17/10/1090</p>
                    <div className="flex flex-row items-center rounded-md borderd-[1px] justify-center
                     border-neutral-600 shadow-sm p-[5px] max-h-max cursor-pointer hover:bg-neutral-300
                     gap-1">
                        <Share size={15} className="text-black"></Share>
                        <p className="font-bold text-black text-base">Vezi Documentul</p>
                    </div>
                </div>
            </div>

            <div className="my-[15px] min-w-full min-h-16 max-h-16 flex flex-row justify-between
            bg-white rounded-md border-neutral-400 shadow-sm px-[10px]">
                <div className="flex flex-row gap-2 items-center">
                    <Clock size={20} className="text-neutral-500 "/>
                    <p className="text-black">Comunicări Marketing</p>
                    <div className="rounded-md flex flex-row items-center shadow-sm max-h-max p-[5px]
                    justify-center bg-neutral-300 text-black font-bold text-sm"><p>Refuzat</p></div>
                </div>

                <div className="flex flex-row gap-2 items-center">
                    <p className="text-neutral-600">17/10/1090</p>
                    <div className="flex flex-row items-center rounded-md borderd-[1px] justify-center
                     border-neutral-600 shadow-sm p-[5px] max-h-max cursor-pointer hover:bg-neutral-300
                     gap-1">
                        <Share size={15} className="text-black"></Share>
                        <p className="font-bold text-black text-base">Vezi Documentul</p>
                    </div>
                </div>
            </div>

        
      </div>
    )
  }
  
  export default Privacy
  
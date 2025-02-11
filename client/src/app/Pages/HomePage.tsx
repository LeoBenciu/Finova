import { useSelector } from "react-redux"
import { ChartDashboard } from "../Components/ChartDashboard";

const HomePage = () => {

  const language = useSelector((state: {user:{language:string}}) => state.user.language);
  console.log(language);

  return (
    <div className=' mx-auto min-h-full max-h-full md:min-w-[768px] lg:min-w-[1024px] max-w-[1210px] px-10 py-0'>
      <div>
        <h1 className="mb-10 text-4xl font-bold">Dashboard</h1>
      </div>
      <div className='grid grid-cols-3 gap-6'>
        <div className='h-35 rounded-lg bg-black flex flex-col justify-between p-5'>
          <p className="text-left">{language==='ro'?'Incasari, fara TVA':'Income, excluding VAT'}</p>

          <div className="justify-between flex items-end">
          <h2 className="font-semibold text-3xl">$ 7.650,12</h2>
          <div className="flex items-end gap-1">
            <div className="bg-green-500/30 text-sm  px-1 text-green-500 font-bold rounded-full">+2%</div>
            <p className="text-xs">{language==='ro'?'vs ultima lună':'vs last month'}</p>
          </div>
          </div>
        </div>

        <div className='h-35 rounded-lg bg-black flex flex-col justify-between p-5'>
          <p className="text-left">{language==='ro'?'Incasari, fara TVA':'Income, excluding VAT'}</p>

          <div className="justify-between flex items-end">
          <h2 className="font-semibold text-3xl">$ 5.200,00</h2>
          <div className="flex items-end gap-1">
            <div className="bg-red-500/30 text-sm  px-1 text-red-500 font-bold rounded-full">-5%</div>
            <p className="text-xs">{language==='ro'?'vs ultima lună':'vs last month'}</p>
          </div>
          </div>
        </div>

        <div className='h-35 rounded-lg bg-black flex flex-col justify-between p-5'>
          <p className="text-left">{language==='ro'?'Incasari, fara TVA':'Income, excluding VAT'}</p>

          <div className="justify-between flex items-end">
          <h2 className="font-semibold text-3xl">$ 2.450,12</h2>
          <div className="flex items-end gap-1">
            <div className="bg-green-500/30 text-sm  px-1 text-green-500 font-bold rounded-full">+2%</div>
            <p className="text-xs">{language==='ro'?'vs ultima lună':'vs last month'}</p>
          </div>
          </div>
        </div>



        <div className='h-96 rounded-lg bg-black col-span-2'>
          <ChartDashboard/>
        </div>
        <div className='h-96 rounded-lg bg-black col-span-1'>

        </div>




        <div className='h-[28rem] rounded-lg bg-black col-span-3 py-4 px-8 flex flex-col gap-3'>
          <h4 className="text-left">Documents Status</h4>
          <div className="border-[var(--card)] border flex-1 rounded-2xl ">
            <div className="bg-[var(--card)] min-w-full max-w-full min-h-[40px] max-h-[40px] rounded-t-xl"></div>

          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage

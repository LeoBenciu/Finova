import { useSelector } from "react-redux"
import { ChartDashboard } from "../Components/ChartDashboard";
import InitialClientCopanyModalSelect from "../Components/InitialClientCompanyModalSelect";

type clientCompanyName = {
  clientCompany:{
    current:{
      name:string,
      ein:string
    }
  }
}

const HomePage = () => {

  const clientCompanyName = useSelector((state:clientCompanyName)=>state.clientCompany.current.name)
  const language = useSelector((state: {user:{language:string}}) => state.user.language);

  return (
    <div className=' min-h-full max-h-full min-w-full px-10 py-0'>
      <div>
        <h1 className="mb-10 text-4xl font-bold text-left
        text-[var(--text1)]">Dashboard</h1>
      </div>
      <div className='grid grid-cols-3 gap-6'>
        <div className='h-35 rounded-lg bg-[var(--foreground)] flex flex-col justify-between p-5'>
          <p className="text-left text-[var(--text1)]">{language==='ro'?'Incasari, fara TVA':'Income, excluding VAT'}</p>

          <div className="justify-between flex items-start flex-col ">
          <h2 className="font-semibold text-3xl mb-2 text-[var(--text1)]">$ 7.650,12</h2>
          <div className="flex items-end gap-1">
            <div className="bg-green-500/30 text-sm  px-1 text-green-500 font-bold rounded-full">+2%</div>
            <p className="text-xs text-[var(--text1)]">{language==='ro'?'vs ultima lună':'vs last month'}</p>
          </div>
          </div>
        </div>

        <div className='h-35 rounded-lg bg-[var(--foreground)] flex flex-col justify-between p-5'>
          <p className="text-left text-[var(--text1)]">{language==='ro'?'Incasari, fara TVA':'Income, excluding VAT'}</p>

          <div className="justify-between flex flex-col items-start">
          <h2 className="font-semibold text-3xl mb-2 text-[var(--text1)]">$ 5.200,00</h2>
          <div className="flex items-end gap-1">
            <div className="bg-red-500/30 text-sm  px-1 text-red-500 font-bold rounded-full">-5%</div>
            <p className="text-xs text-[var(--text1)]">{language==='ro'?'vs ultima lună':'vs last month'}</p>
          </div>
          </div>
        </div>

        <div className='h-35 rounded-lg bg-[var(--foreground)] flex flex-col justify-between p-5'>
          <p className="text-left text-[var(--text1)]">{language==='ro'?'Incasari, fara TVA':'Income, excluding VAT'}</p>

          <div className="justify-between flex flex-col items-start">
          <h2 className="font-semibold text-3xl mb-2 text-[var(--text1)]">$ 2.450,12</h2>
          <div className="flex items-end gap-1">
            <div className="bg-green-500/30 text-sm  px-1 text-green-500 font-bold rounded-full">+2%</div>
            <p className="text-xs text-[var(--text1)]">{language==='ro'?'vs ultima lună':'vs last month'}</p>
          </div>
          </div>
        </div>



        <div className='h-96 rounded-lg bg-[var(--foreground)] col-span-2'>
          <ChartDashboard/>
        </div>

        <div className='h-96 rounded-lg bg-[var(--foreground)] col-span-1 py-3 px-5'>
          <h2 className="text-2xl font-bold text-left text-[var(--text1)]">
            {language === 'ro' ? 'Erori de inser' : 'Insertion errors'}
          </h2>

          <div>

          </div>

          <div>

          </div>
        </div>
      </div>
      {clientCompanyName===''&&(<InitialClientCopanyModalSelect/>)}
    </div>
  )
}

export default HomePage

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

  const errors = [
    {
      filename:'Chitanta.pdf',
      status:'error'
    },
    {
      filename:'Chitanta.pdf',
      status:'error'
    },
    {
      filename:'Chitanta.pdf',
      status:'error'
    },
    {
      filename:'Chitanta.pdf',
      status:'error'
    },
    {
      filename:'Chitanta.pdf',
      status:'error'
    },
    {
      filename:'Chitanta.pdf',
      status:'error'
    },
  ]

  return (
    <div className=' min-h-full max-h-full min-w-full px-10 py-0'>
      <div>
        <h1 className="mb-10 text-4xl font-bold text-left
        text-[var(--text1)]">Dashboard</h1>
      </div>
      <div className='grid grid-cols-3 gap-6'>
        <div className='h-35 rounded-lg bg-[var(--foreground)] flex flex-col justify-between p-5'>
          <p className="text-left text-[var(--text1)]">{language==='ro'?'Venituri, fara TVA':'Income, excluding VAT'}</p>

          <div className="justify-between flex items-start flex-col ">
          <h2 className="font-semibold text-3xl mb-2 text-[var(--text1)]">$ 7.650,12</h2>
          <div className="flex items-end gap-1">
            <div className="bg-green-500/30 text-sm  px-1 text-green-500 font-bold rounded-full">+2%</div>
            <p className="text-xs text-[var(--text1)]">{language==='ro'?'vs ultima lună':'vs last month'}</p>
          </div>
          </div>
        </div>

        <div className='h-35 rounded-lg bg-[var(--foreground)] flex flex-col justify-between p-5'>
          <p className="text-left text-[var(--text1)]">{language==='ro'?'Cheltuieli, fara TVA':'Income, excluding VAT'}</p>

          <div className="justify-between flex flex-col items-start">
          <h2 className="font-semibold text-3xl mb-2 text-[var(--text1)]">$ 5.200,00</h2>
          <div className="flex items-end gap-1">
            <div className="bg-red-500/30 text-sm  px-1 text-red-500 font-bold rounded-full">-5%</div>
            <p className="text-xs text-[var(--text1)]">{language==='ro'?'vs ultima lună':'vs last month'}</p>
          </div>
          </div>
        </div>

        <div className='h-35 rounded-lg bg-[var(--foreground)] flex flex-col justify-between p-5'>
          <p className="text-left text-[var(--text1)]">{language==='ro'?'Profit, fara TVA':'Income, excluding VAT'}</p>

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
            {language === 'ro' ? 'Erori de inserare' : 'Insertion errors'}
          </h2>

          <div className="min-h-[90%] max-h-[90%] overflow-y-scroll">
            {errors.map((error)=>{
            if(error.status==='error'){
              return (
                <div className="min-w-[80%] min-h-11 max-h-11 hover:bg-red-500/90 pl-5
                rounded-xl mb-3 py-[1.5px] pr-[1.5px] pb-[1.5px] bg-[var(--text2)]
                cursor-pointer mx-2">
                  <div className="min-w-[90%] min-h-10 max-h-10
                  flex items-center justify-center bg-[var(--foreground)]
                  rounded-xl"
                  key={error.filename}>
                    <p className="text-[var(--text1)]">{error.filename}</p>
                  </div>
                </div>
              )
            }})}

          </div>
        </div>
      </div>
      {clientCompanyName===''&&(<InitialClientCopanyModalSelect/>)}
    </div>
  )
}

export default HomePage

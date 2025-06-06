import { useSelector } from "react-redux"
import { ChartDashboard } from "../Components/ChartDashboard";
import InitialClientCopanyModalSelect from "../Components/InitialClientCompanyModalSelect";
import { useGetCompanyDataQuery } from "@/redux/slices/apiSlice";
import LoadingComponent from "../Components/LoadingComponent";
import { useEffect, useState } from "react";

type clientCompany = {
  clientCompany:{
    current:{
      name:string,
      ein:string
    }
  }
}

const HomePage = () => {

  const clientCompanyName = useSelector((state:clientCompany)=>state.clientCompany.current.name);
  const clientCompanyEin = useSelector((state:clientCompany)=>state.clientCompany.current.ein);
  const [dashboardYear, setDashboardYear] =useState<string>();
  const language = useSelector((state: {user:{language:string}}) => state.user.language);
  const { data: companyData, isLoading: isCompanyDataLoading, isError: IsCompanyDataError } = useGetCompanyDataQuery({
    currentCompanyEin:clientCompanyEin,
    year: dashboardYear
  });
  const incomePercentChange = companyData && companyData.incomeLastMonth !== 0 ? 
  ((companyData.incomeCurrentMonth - companyData.incomeLastMonth) / Math.abs(companyData.incomeLastMonth) * 100).toFixed(0) : 0;
  const expensesPercentChange = companyData && companyData.expensesLastMonth !== 0 ? 
    ((companyData.expensesCurrentMonth - companyData.expensesLastMonth) / Math.abs(companyData.expensesLastMonth) * 100).toFixed(0) : 0;
  const lastMonthProfit = companyData ? (companyData.incomeLastMonth - companyData.expensesLastMonth) : 0;
  const currentMonthProfit = companyData ? (companyData.incomeCurrentMonth - companyData.expensesCurrentMonth) : 0;
  const profitPercentageChange = companyData && lastMonthProfit !== 0 ? 
    ((currentMonthProfit - lastMonthProfit) / Math.abs(lastMonthProfit) * 100).toFixed(0) : 0;


  useEffect(()=>{
    console.log('LOG',companyData);
  },[companyData]);

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

  if(isCompanyDataLoading) return <LoadingComponent></LoadingComponent>

  if(IsCompanyDataError) return <p>Error</p>

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
          <h2 className="font-semibold text-3xl mb-2 text-[var(--text1)]">
            <span className="font-semibold text-xl text-[var(--text1)]">RON</span> {companyData?.incomeCurrentMonth !== undefined ? companyData.incomeCurrentMonth.toFixed(2) : '0.00'}
          </h2>
          <div className="flex items-end gap-1">
          <div className={`${Number(incomePercentChange) >= 0 ? "bg-green-500/30 text-green-500" : "bg-red-500/30 text-red-500"} text-sm px-1 font-bold rounded-full`}>
            {Number(incomePercentChange) >= 0 ? `+${incomePercentChange}` : `${incomePercentChange}`}%
          </div>
            <p className="text-xs text-[var(--text1)]">{language==='ro'?'vs ultima lună':'vs last month'}</p>
          </div>
          </div>
        </div>

        <div className='h-35 rounded-lg bg-[var(--foreground)] flex flex-col justify-between p-5'>
          <p className="text-left text-[var(--text1)]">{language==='ro'?'Cheltuieli, fara TVA':'Income, excluding VAT'}</p>

          <div className="justify-between flex flex-col items-start">
          <h2 className="font-semibold text-3xl mb-2 text-[var(--text1)]">
            <span className="font-semibold text-xl text-[var(--text1)]">RON</span> {companyData?.expensesCurrentMonth !== undefined ? companyData.expensesCurrentMonth.toFixed(2) : '0.00'}
          </h2>
          <div className="flex items-end gap-1">
          <div className={`${Number(expensesPercentChange) >= 0 ? "bg-green-500/30 text-green-500" : "bg-red-500/30 text-red-500"} text-sm px-1 font-bold rounded-full`}>
            {Number(expensesPercentChange) >= 0 ? `+${expensesPercentChange}` : `${expensesPercentChange}`}%
          </div>
            <p className="text-xs text-[var(--text1)]">{language==='ro'?'vs ultima lună':'vs last month'}</p>
          </div>
          </div>
        </div>

        <div className='h-35 rounded-lg bg-[var(--foreground)] flex flex-col justify-between p-5'>
          <p className="text-left text-[var(--text1)]">{language==='ro'?'Profit, fara TVA':'Income, excluding VAT'}</p>

          <div className="justify-between flex flex-col items-start">
          <h2 className="font-semibold text-3xl mb-2 text-[var(--text1)]">
            <span className="font-semibold text-xl text-[var(--text1)]">RON</span> {companyData ? ((companyData.incomeCurrentMonth || 0) - (companyData.expensesCurrentMonth || 0)).toFixed(2) : '0.00'}
          </h2>
          <div className="flex items-end gap-1">
          <div className={`${Number(profitPercentageChange) >= 0 ? "bg-green-500/30 text-green-500" : "bg-red-500/30 text-red-500"} text-sm px-1 font-bold rounded-full`}>
            {Number(profitPercentageChange) >= 0 ? `+${profitPercentageChange}` : `${profitPercentageChange}`}%
          </div>
            <p className="text-xs text-[var(--text1)]">{language==='ro'?'vs ultima lună':'vs last month'}</p>
          </div>
          </div>
        </div>



        <div className='h-96 rounded-lg bg-[var(--foreground)] col-span-2'>
          <ChartDashboard setDashboardYear={setDashboardYear} chartData={companyData}/>
        </div>

        <div className='h-96 rounded-lg bg-[var(--foreground)] col-span-1 py-3 px-5'>
          <h2 className="text-2xl font-bold text-left text-[var(--text1)]">
            {language === 'ro' ? 'Erori de inserare' : 'Insertion errors'}
          </h2>

          <div className="min-h-[88%] max-h-[88%] overflow-y-scroll mt-3">
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

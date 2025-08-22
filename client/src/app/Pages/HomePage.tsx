import { useSelector } from "react-redux"
import { ChartDashboard } from "../Components/ChartDashboard";
import { useGetCompanyDataQuery } from "@/redux/slices/apiSlice";
import LoadingComponent from "../Components/LoadingComponent";
import { useEffect, useState } from "react";
import InitialClientCompanyModalSelect from "../Components/InitialClientCompanyModalSelect";
import { 
  TrendingDown, 
  DollarSign, 
  Clock, 
  Zap, 
  AlertTriangle, 
  CheckCircle,
  Eye
} from "lucide-react";
import { motion } from "framer-motion";

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
  currentCompanyEin: clientCompanyEin,
  year: dashboardYear
  }, {
    skip: !clientCompanyEin || clientCompanyEin === '' // Skip query when no company
  });

  const incomePercentChange = companyData && companyData.incomeLastMonth !== 0 ? 
  ((companyData.incomeCurrentMonth - companyData.incomeLastMonth) / Math.abs(companyData.incomeLastMonth) * 100).toFixed(0) : 0;
  const expensesPercentChange = companyData && companyData.expensesLastMonth !== 0 ? 
    ((companyData.expensesCurrentMonth - companyData.expensesLastMonth) / Math.abs(companyData.expensesLastMonth) * 100).toFixed(0) : 0;
  const lastMonthProfit = companyData ? (companyData.incomeLastMonth - companyData.expensesLastMonth) : 0;
  const currentMonthProfit = companyData ? (companyData.incomeCurrentMonth - companyData.expensesCurrentMonth) : 0;
  const profitPercentageChange = companyData && lastMonthProfit !== 0 ? 
    ((currentMonthProfit - lastMonthProfit) / Math.abs(lastMonthProfit) * 100).toFixed(0) : 0;

  const mockFinancialData = {
    cashBalance: 525000,
    monthlyBurn: 62500,
    runway: 11, 
    bankAccounts: [
      { name: 'BCR Principal', balance: 325000 },
      { name: 'BRD Operațional', balance: 200000 }
    ]
  };

  const insights = [
    {
      type: 'positive',
      title: language === 'ro' ? 'Performanță excelentă în vânzări' : 'Excellent Sales Performance',
      description: language === 'ro' ? 'Venitul a crescut cu 15% față de luna trecută, depășind proiecțiile cu 8%' : 'Revenue increased by 15% vs last month, exceeding projections by 8%'
    },
    {
      type: 'warning',
      title: language === 'ro' ? 'Cheltuieli operaționale în creștere' : 'Rising Operating Expenses',
      description: language === 'ro' ? 'Cheltuielile administrative au crescut cu 12%. Recomandăm revizuirea contractelor cu furnizorii' : 'Administrative expenses increased by 12%. We recommend reviewing supplier contracts'
    },
    {
      type: 'info',
      title: language === 'ro' ? 'Oportunitate de optimizare' : 'Optimization Opportunity',
      description: language === 'ro' ? 'Cashflow-ul pozitiv permite investiții în creștere sau reducerea datoriilor' : 'Positive cashflow allows for growth investments or debt reduction'
    },
    {
      type: 'info',
      title: language === 'ro' ? 'Reconciliere necesară' : 'Reconciliation Needed',
      description: language === 'ro' ? '5 tranzacții bancare necesită reconciliere manuală' : '5 bank transactions require manual reconciliation'
    }
  ];

  // Financial statements moved to ReportsPage

  useEffect(()=>{
    console.log('LOG',companyData);
  },[companyData]);

  if(IsCompanyDataError) return <p>Error</p>

  // Financial statement renderer moved to ReportsPage

  return (
    <div className='min-h-full max-h-full min-w-full px-10 py-0'>
      {clientCompanyName===''&&(
          <div style={{ zIndex: 9999, position: 'fixed', inset: 0 }}>
           <InitialClientCompanyModalSelect/>
          </div>
      )}

      <div>
        <h1 className="mb-10 text-4xl font-bold text-left text-[var(--text1)]">Dashboard</h1>
      </div>

      <div className='grid grid-cols-3 gap-6 mb-6'>
        <div className='h-35 rounded-lg bg-[var(--foreground)] flex flex-col justify-between p-5'>
          <p className="text-left text-[var(--text1)]">{language==='ro'?'Venituri, fără TVA':'Income, excluding VAT'}</p>
          <div className="justify-between flex items-start flex-col ">
            <h2 className="font-semibold text-3xl mb-2 text-[var(--text1)]">
              <span className="font-semibold text-xl text-[var(--text1)]">RON</span> {companyData?.incomeCurrentMonth !== undefined ? companyData.incomeCurrentMonth.toFixed(2) : '0.00'}
            </h2>
            <div className="flex items-end gap-1">
              <div className={`${Number(incomePercentChange) >= 0 ? "bg-emerald-500/30 text-emerald-500" : "bg-red-500/30 text-red-500"} text-sm px-1 font-bold rounded-full`}>
                {Number(incomePercentChange) >= 0 ? `+${incomePercentChange}` : `${incomePercentChange}`}%
              </div>
              <p className="text-xs text-[var(--text1)]">{language==='ro'?'vs ultima lună':'vs last month'}</p>
            </div>
          </div>
        </div>

        <div className='h-35 rounded-lg bg-[var(--foreground)] flex flex-col justify-between p-5'>
          <p className="text-left text-[var(--text1)]">{language==='ro'?'Cheltuieli, fără TVA':'Expenses, excluding VAT'}</p>
          <div className="justify-between flex flex-col items-start">
            <h2 className="font-semibold text-3xl mb-2 text-[var(--text1)]">
              <span className="font-semibold text-xl text-[var(--text1)]">RON</span> {companyData?.expensesCurrentMonth !== undefined ? companyData.expensesCurrentMonth.toFixed(2) : '0.00'}
            </h2>
            <div className="flex items-end gap-1">
              <div className={`${Number(expensesPercentChange) >= 0 ? "bg-emerald-500/30 text-emerald-500" : "bg-red-500/30 text-red-500"} text-sm px-1 font-bold rounded-full`}>
                {Number(expensesPercentChange) >= 0 ? `+${expensesPercentChange}` : `${expensesPercentChange}`}%
              </div>
              <p className="text-xs text-[var(--text1)]">{language==='ro'?'vs ultima lună':'vs last month'}</p>
            </div>
          </div>
        </div>

        <div className='h-35 rounded-lg bg-[var(--foreground)] flex flex-col justify-between p-5'>
          <p className="text-left text-[var(--text1)]">{language==='ro'?'Profit, fără TVA':'Profit, excluding VAT'}</p>
          <div className="justify-between flex flex-col items-start">
            <h2 className="font-semibold text-3xl mb-2 text-[var(--text1)]">
              <span className="font-semibold text-xl text-[var(--text1)]">RON</span> {companyData ? ((companyData.incomeCurrentMonth || 0) - (companyData.expensesCurrentMonth || 0)).toFixed(2) : '0.00'}
            </h2>
            <div className="flex items-end gap-1">
              <div className={`${Number(profitPercentageChange) >= 0 ? "bg-emerald-500/30 text-emerald-500" : "bg-red-500/30 text-red-500"} text-sm px-1 font-bold rounded-full`}>
                {Number(profitPercentageChange) >= 0 ? `+${profitPercentageChange}` : `${profitPercentageChange}`}%
              </div>
              <p className="text-xs text-[var(--text1)]">{language==='ro'?'vs ultima lună':'vs last month'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-3 gap-6 mb-6'>
        <div className='h-35 rounded-lg bg-[var(--foreground)] flex flex-col justify-between p-5'>
          <p className="text-left text-[var(--text1)] flex items-center gap-2">
            <DollarSign size={20} />
            {language==='ro'?'Sold Disponibil Băncile':'Available Bank Balance'}
          </p>
          <div className="justify-between flex flex-col items-start">
            <h2 className="font-semibold text-3xl mb-2 text-[var(--text1)]">
              <span className="font-semibold text-xl text-[var(--text1))]">RON</span> {mockFinancialData.cashBalance.toLocaleString()}
            </h2>
            <p className="text-xs text-[var(--text3)]">
              {mockFinancialData.bankAccounts.length} {language==='ro'?'conturi conectate':'connected accounts'}
            </p>
          </div>
        </div>

        <div className='h-35 rounded-lg bg-[var(--foreground)] flex flex-col justify-between p-5'>
          <p className="text-left text-[var(--text1)] flex items-center gap-2">
            <TrendingDown size={20} />
            {language==='ro'?'Net Burn Rate':'Net Burn Rate'}
          </p>
          <div className="justify-between flex flex-col items-start">
            <h2 className="font-semibold text-3xl mb-2 text-[var(--text1)]">
              <span className="font-semibold text-xl text-[var(--text1)]">RON</span> {mockFinancialData.monthlyBurn.toLocaleString()}
            </h2>
            <p className="text-xs text-[var(--text3)]">
              {language==='ro'?'cheltuieli nete lunar':'net monthly expenses'}
            </p>
          </div>
        </div>

        <div className='h-35 rounded-lg bg-[var(--foreground)] flex flex-col justify-between p-5'>
          <p className="text-left text-[var(--text1)] flex items-center gap-2">
            <Clock size={20} />
            {language==='ro'?'Runway Run Rate':'Runway Run Rate'}
          </p>
          <div className="justify-between flex flex-col items-start">
            <h2 className="font-semibold text-3xl mb-2 text-[var(--text1)]">
              {mockFinancialData.runway} {language==='ro'?'luni':'months'}
            </h2>
            <p className="text-xs text-[var(--text3)]">
              {language==='ro'?'la rata actuală de cheltuire':'at current burn rate'}
            </p>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-3 gap-6 mb-6'>
        <div className='h-96 rounded-lg bg-[var(--foreground)] col-span-2'>
          <ChartDashboard setDashboardYear={setDashboardYear} chartData={companyData}/>
        </div>

        <div className='h-96 rounded-lg bg-[var(--foreground)] col-span-1 py-4 px-5'>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="text-[var(--primary)]" size={24} />
            <h2 className="text-xl font-bold text-[var(--text1)]">
              {language === 'ro' ? 'AI Insights' : 'AI Smart Insights'}
            </h2>
          </div>
          
          <div className="h-80 overflow-y-auto space-y-3">
            {insights.map((insight, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-3 rounded-xl border border-[var(--text4)] bg-[var(--background)] hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    insight.type === 'positive' ? 'bg-green-100 text-green-600' :
                    insight.type === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {insight.type === 'positive' && <CheckCircle size={16} />}
                    {insight.type === 'warning' && <AlertTriangle size={16} />}
                    {insight.type === 'info' && <Eye size={16} />}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-[var(--text1)] text-sm mb-1">{insight.title}</h3>
                    <p className="text-xs text-[var(--text3)] leading-relaxed">{insight.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Links replacing moved financial statements */}
      <div className='grid grid-cols-3 gap-6 mb-6'>
        <div className='h-35 rounded-lg bg-[var(--foreground)] flex flex-col justify-between p-5 col-span-3'>
          <p className="text-left text-[var(--text1)] font-semibold mb-3">{language==='ro'?'Link-uri rapide':'Quick Links'}</p>
          <div className="flex gap-3 flex-wrap">
            <a href="/bank" className="px-4 py-2 rounded-xl border border-[var(--text4)] bg-[var(--background)] text-[var(--text1)] hover:border-[var(--text3)] transition">{language==='ro'?'Reconciliere Bancară':'Bank Reconciliation'}</a>
            <a href="/files" className="px-4 py-2 rounded-xl border border-[var(--text4)] bg-[var(--background)] text-[var(--text1)] hover:border-[var(--text3)] transition">{language==='ro'?'Documente':'Documents'}</a>
            <a href="/reports" className="px-4 py-2 rounded-xl border border-[var(--text4)] bg-[var(--background)] text-[var(--text1)] hover:border-[var(--text3)] transition">{language==='ro'?'Rapoarte':'Reports'}</a>
          </div>
        </div>
      </div>


      {isCompanyDataLoading&&(
      <div className='fixed inset-0 z-50 flex items-center justify-center
       w-full h-full bg-[var(--background)]/60 backdrop-blur-sm'>
        <div className="bg-[var(--foreground)] rounded-3xl p-8 shadow-2xl border border-[var(--text4)]">
          <LoadingComponent/>
        </div>
      </div>
      )}
    </div>
  )
}

export default HomePage
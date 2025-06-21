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
  ArrowUp,
  ArrowDown,
  Eye,
  FileText,
  BarChart3,
  PieChart,
  Activity
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

  const mockFinancialData = {
    cashBalance: 125000.50,
    monthlyBurn: 15000.00,
    runway: 8.3,
    bankAccounts: [
      { name: 'BCR Principal', balance: 75000.50 },
      { name: 'BRD Operațional', balance: 50000.00 }
    ]
  };

  const insights = [
    {
      type: 'positive',
      title: language === 'ro' ? 'Performanță excelentă' : 'Excellent Performance',
      description: language === 'ro' ? 'Venitul a crescut cu 15% față de luna trecută' : 'Revenue increased by 15% vs last month'
    },
    {
      type: 'warning',
      title: language === 'ro' ? 'Atenție la cheltuieli' : 'Watch Expenses',
      description: language === 'ro' ? 'Cheltuielile operaționale sunt în creștere' : 'Operating expenses are trending upward'
    },
    {
      type: 'info',
      title: language === 'ro' ? 'Reconciliere necesară' : 'Reconciliation Needed',
      description: language === 'ro' ? '5 tranzacții au nevoie de reconciliere' : '5 transactions need reconciliation'
    }
  ];

  const financialStatements = {
    cashflow: {
      operating: 25000,
      investing: -5000,
      financing: 10000,
      netChange: 30000
    },
    pnl: {
      revenue: companyData?.incomeCurrentMonth || 0,
      expenses: companyData?.expensesCurrentMonth || 0,
      grossProfit: (companyData?.incomeCurrentMonth || 0) - (companyData?.expensesCurrentMonth || 0),
      netIncome: (companyData?.incomeCurrentMonth || 0) - (companyData?.expensesCurrentMonth || 0)
    },
    balanceSheet: {
      assets: 250000,
      liabilities: 75000,
      equity: 175000
    }
  };

  useEffect(()=>{
    console.log('LOG',companyData);
  },[companyData]);

  const errors = [
    { filename:'Chitanta.pdf', status:'error' },
    { filename:'Chitanta.pdf', status:'error' },
    { filename:'Chitanta.pdf', status:'error' },
    { filename:'Chitanta.pdf', status:'error' },
    { filename:'Chitanta.pdf', status:'error' },
    { filename:'Chitanta.pdf', status:'error' },
  ];

  if(isCompanyDataLoading) return <LoadingComponent></LoadingComponent>
  if(IsCompanyDataError) return <p>Error</p>

  return (
    <div className='min-h-full max-h-full min-w-full px-10 py-0'>
      <div>
        <h1 className="mb-10 text-4xl font-bold text-left text-[var(--text1)]">Dashboard</h1>
      </div>

      <div className='grid grid-cols-6 gap-4 mb-6'>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className='h-32 rounded-2xl bg-[var(--foreground)] flex flex-col justify-between p-4 border border-[var(--text5)]'
        >
          <p className="text-sm text-[var(--text2)]">{language==='ro'?'Venituri, fără TVA':'Income, excluding VAT'}</p>
          <div>
            <h2 className="font-bold text-xl text-[var(--text1)]">
              RON {companyData?.incomeCurrentMonth !== undefined ? companyData.incomeCurrentMonth.toFixed(0) : '0'}
            </h2>
            <div className="flex items-center gap-1 mt-1">
              <div className={`${Number(incomePercentChange) >= 0 ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"} text-xs px-2 py-1 font-semibold rounded-full flex items-center gap-1`}>
                {Number(incomePercentChange) >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                {Math.abs(Number(incomePercentChange))}%
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className='h-32 rounded-2xl bg-[var(--foreground)] flex flex-col justify-between p-4 border border-[var(--text5)]'
        >
          <p className="text-sm text-[var(--text2)]">{language==='ro'?'Cheltuieli, fără TVA':'Expenses, excluding VAT'}</p>
          <div>
            <h2 className="font-bold text-xl text-[var(--text1)]">
              RON {companyData?.expensesCurrentMonth !== undefined ? companyData.expensesCurrentMonth.toFixed(0) : '0'}
            </h2>
            <div className="flex items-center gap-1 mt-1">
              <div className={`${Number(expensesPercentChange) <= 0 ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"} text-xs px-2 py-1 font-semibold rounded-full flex items-center gap-1`}>
                {Number(expensesPercentChange) >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                {Math.abs(Number(expensesPercentChange))}%
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className='h-32 rounded-2xl bg-[var(--foreground)] flex flex-col justify-between p-4 border border-[var(--text5)]'
        >
          <p className="text-sm text-[var(--text2)]">{language==='ro'?'Profit, fără TVA':'Profit, excluding VAT'}</p>
          <div>
            <h2 className="font-bold text-xl text-[var(--text1)]">
              RON {companyData ? ((companyData.incomeCurrentMonth || 0) - (companyData.expensesCurrentMonth || 0)).toFixed(0) : '0'}
            </h2>
            <div className="flex items-center gap-1 mt-1">
              <div className={`${Number(profitPercentageChange) >= 0 ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"} text-xs px-2 py-1 font-semibold rounded-full flex items-center gap-1`}>
                {Number(profitPercentageChange) >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                {Math.abs(Number(profitPercentageChange))}%
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className='h-32 rounded-2xl bg-[var(--foreground)] flex flex-col justify-between p-4 border border-[var(--text5)]'
        >
          <p className="text-sm text-[var(--text2)] flex items-center gap-1">
            <DollarSign size={14} />
            {language==='ro'?'Sold Disponibil':'Available Cash'}
          </p>
          <div>
            <h2 className="font-bold text-xl text-[var(--primary)]">
              RON {mockFinancialData.cashBalance.toFixed(0)}
            </h2>
            <p className="text-xs text-[var(--text3)] mt-1">
              {mockFinancialData.bankAccounts.length} {language==='ro'?'conturi conectate':'connected accounts'}
            </p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className='h-32 rounded-2xl bg-[var(--foreground)] flex flex-col justify-between p-4 border border-[var(--text5)]'
        >
          <p className="text-sm text-[var(--text2)] flex items-center gap-1">
            <TrendingDown size={14} />
            {language==='ro'?'Burn Rate Lunar':'Monthly Burn Rate'}
          </p>
          <div>
            <h2 className="font-bold text-xl text-red-600">
              RON {mockFinancialData.monthlyBurn.toFixed(0)}
            </h2>
            <p className="text-xs text-[var(--text3)] mt-1">
              {language==='ro'?'cheltuieli nete/lună':'net expenses/month'}
            </p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className='h-32 rounded-2xl bg-[var(--foreground)] flex flex-col justify-between p-4 border border-[var(--text5)]'
        >
          <p className="text-sm text-[var(--text2)] flex items-center gap-1">
            <Clock size={14} />
            {language==='ro'?'Runway':'Runway'}
          </p>
          <div>
            <h2 className="font-bold text-xl text-[var(--text1)]">
              {mockFinancialData.runway} {language==='ro'?'luni':'months'}
            </h2>
            <p className="text-xs text-[var(--text3)] mt-1">
              {language==='ro'?'la rata actuală':'at current burn rate'}
            </p>
          </div>
        </motion.div>
      </div>

      <div className='grid grid-cols-12 gap-6'>
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 }}
          className='h-96 rounded-2xl bg-[var(--foreground)] col-span-8 border border-[var(--text5)]'
        >
          <ChartDashboard setDashboardYear={setDashboardYear} chartData={companyData}/>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 }}
          className='h-96 rounded-2xl bg-[var(--foreground)] col-span-4 py-4 px-5 border border-[var(--text5)]'
        >
          <h2 className="text-xl font-bold text-left text-[var(--text1)] mb-3">
            {language === 'ro' ? 'Erori de Inserare' : 'Processing Errors'}
          </h2>
          <div className="h-80 overflow-y-auto space-y-2">
            {errors.map((error, index) => (
              <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 cursor-pointer transition-colors duration-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-500" />
                  <p className="text-red-700 text-sm font-medium">{error.filename}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className='h-80 rounded-2xl bg-[var(--foreground)] col-span-6 p-5 border border-[var(--text5)]'
        >
          <div className="flex items-center gap-2 mb-4">
            <Zap className="text-[var(--primary)]" size={24} />
            <h2 className="text-xl font-bold text-[var(--text1)]">
              {language === 'ro' ? 'Insights AI' : 'AI Smart Insights'}
            </h2>
          </div>
          
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1 + (index * 0.1) }}
                className="p-4 rounded-xl border border-[var(--text4)] bg-[var(--background)] hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    insight.type === 'positive' ? 'bg-green-100 text-green-600' :
                    insight.type === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {insight.type === 'positive' && <CheckCircle size={16} />}
                    {insight.type === 'warning' && <AlertTriangle size={16} />}
                    {insight.type === 'info' && <Eye size={16} />}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-[var(--text1)] text-sm">{insight.title}</h3>
                    <p className="text-xs text-[var(--text3)] mt-1">{insight.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className='h-80 rounded-2xl bg-[var(--foreground)] col-span-6 p-5 border border-[var(--text5)]'
        >
          <h2 className="text-xl font-bold text-[var(--text1)] mb-4 flex items-center gap-2">
            <BarChart3 size={20} />
            {language === 'ro' ? 'Situații Financiare' : 'Financial Statements'}
          </h2>
          
          <div className="grid grid-cols-3 gap-4 h-60">
            <div className="bg-[var(--background)] rounded-xl p-3 border border-[var(--text4)]">
              <div className="flex items-center gap-2 mb-3">
                <Activity size={16} className="text-blue-500" />
                <h3 className="font-semibold text-sm text-[var(--text1)]">
                  {language === 'ro' ? 'Cashflow' : 'Cash Flow'}
                </h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[var(--text3)]">{language === 'ro' ? 'Operațional' : 'Operating'}</span>
                  <span className="text-xs font-semibold text-green-600">+{financialStatements.cashflow.operating.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[var(--text3)]">{language === 'ro' ? 'Investiții' : 'Investing'}</span>
                  <span className="text-xs font-semibold text-red-600">{financialStatements.cashflow.investing.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[var(--text3)]">{language === 'ro' ? 'Finanțare' : 'Financing'}</span>
                  <span className="text-xs font-semibold text-blue-600">+{financialStatements.cashflow.financing.toLocaleString()}</span>
                </div>
                <div className="border-t border-[var(--text4)] pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-[var(--text1)]">{language === 'ro' ? 'Net' : 'Net Change'}</span>
                    <span className="text-xs font-bold text-[var(--primary)]">+{financialStatements.cashflow.netChange.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[var(--background)] rounded-xl p-3 border border-[var(--text4)]">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={16} className="text-green-500" />
                <h3 className="font-semibold text-sm text-[var(--text1)]">P&L</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[var(--text3)]">{language === 'ro' ? 'Venituri' : 'Revenue'}</span>
                  <span className="text-xs font-semibold text-green-600">{financialStatements.pnl.revenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[var(--text3)]">{language === 'ro' ? 'Cheltuieli' : 'Expenses'}</span>
                  <span className="text-xs font-semibold text-red-600">-{financialStatements.pnl.expenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[var(--text3)]">{language === 'ro' ? 'Profit Brut' : 'Gross Profit'}</span>
                  <span className="text-xs font-semibold text-blue-600">{financialStatements.pnl.grossProfit.toLocaleString()}</span>
                </div>
                <div className="border-t border-[var(--text4)] pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-[var(--text1)]">{language === 'ro' ? 'Profit Net' : 'Net Income'}</span>
                    <span className="text-xs font-bold text-[var(--primary)]">{financialStatements.pnl.netIncome.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[var(--background)] rounded-xl p-3 border border-[var(--text4)]">
              <div className="flex items-center gap-2 mb-3">
                <PieChart size={16} className="text-purple-500" />
                <h3 className="font-semibold text-sm text-[var(--text1)]">
                  {language === 'ro' ? 'Bilanț' : 'Balance Sheet'}
                </h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[var(--text3)]">{language === 'ro' ? 'Active' : 'Assets'}</span>
                  <span className="text-xs font-semibold text-blue-600">{financialStatements.balanceSheet.assets.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[var(--text3)]">{language === 'ro' ? 'Datorii' : 'Liabilities'}</span>
                  <span className="text-xs font-semibold text-red-600">{financialStatements.balanceSheet.liabilities.toLocaleString()}</span>
                </div>
                <div className="border-t border-[var(--text4)] pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-[var(--text1)]">{language === 'ro' ? 'Capital' : 'Equity'}</span>
                    <span className="text-xs font-bold text-[var(--primary)]">{financialStatements.balanceSheet.equity.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {clientCompanyName===''&&(<InitialClientCompanyModalSelect/>)}
    </div>
  )
}

export default HomePage
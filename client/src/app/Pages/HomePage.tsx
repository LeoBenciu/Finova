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
  Eye,
  Activity,
  PieChart,
  BarChart3
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
  const [selectedStatement, setSelectedStatement] = useState<'cashflow' | 'pnl' | 'balance'>('cashflow');
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

  const financialStatements = {
    cashflow: {
      title: language === 'ro' ? 'Situația Fluxurilor de Numerar' : 'Cash Flow Statement',
      period: language === 'ro' ? 'Luna curentă' : 'Current Month',
      sections: [
        {
          title: language === 'ro' ? 'Activități Operaționale' : 'Operating Activities',
          items: [
            { name: language === 'ro' ? 'Încasări de la clienți' : 'Collections from customers', amount: 185000, positive: true },
            { name: language === 'ro' ? 'Plăți către furnizori' : 'Payments to suppliers', amount: -125000, positive: false },
            { name: language === 'ro' ? 'Plăți angajați' : 'Employee payments', amount: -35000, positive: false },
            { name: language === 'ro' ? 'Alte plăți operaționale' : 'Other operating payments', amount: -8000, positive: false }
          ],
          total: 17000
        },
        {
          title: language === 'ro' ? 'Activități de Investiții' : 'Investing Activities',
          items: [
            { name: language === 'ro' ? 'Achiziție echipamente' : 'Equipment purchases', amount: -15000, positive: false },
            { name: language === 'ro' ? 'Vânzare active' : 'Asset sales', amount: 5000, positive: true }
          ],
          total: -10000
        },
        {
          title: language === 'ro' ? 'Activități de Finanțare' : 'Financing Activities',
          items: [
            { name: language === 'ro' ? 'Rambursare împrumut' : 'Loan repayment', amount: -12000, positive: false },
            { name: language === 'ro' ? 'Aport capital' : 'Capital contribution', amount: 25000, positive: true }
          ],
          total: 13000
        }
      ],
      netChange: 20000
    },
    pnl: {
      title: language === 'ro' ? 'Contul de Profit și Pierdere' : 'Profit & Loss Statement',
      period: language === 'ro' ? 'Luna curentă' : 'Current Month',
      sections: [
        {
          title: language === 'ro' ? 'Venituri' : 'Revenue',
          items: [
            { name: language === 'ro' ? 'Vânzări produse' : 'Product sales', amount: companyData?.incomeCurrentMonth * 0.8 || 120000, positive: true },
            { name: language === 'ro' ? 'Servicii' : 'Services', amount: companyData?.incomeCurrentMonth * 0.2 || 30000, positive: true }
          ],
          total: companyData?.incomeCurrentMonth || 150000
        },
        {
          title: language === 'ro' ? 'Cheltuieli Directe' : 'Direct Expenses',
          items: [
            { name: language === 'ro' ? 'Cost mărfuri vândute' : 'Cost of goods sold', amount: -(companyData?.expensesCurrentMonth * 0.6 || 60000), positive: false },
            { name: language === 'ro' ? 'Materiale directe' : 'Direct materials', amount: -(companyData?.expensesCurrentMonth * 0.2 || 20000), positive: false }
          ],
          total: -(companyData?.expensesCurrentMonth * 0.8 || 80000)
        },
        {
          title: language === 'ro' ? 'Cheltuieli Operaționale' : 'Operating Expenses',
          items: [
            { name: language === 'ro' ? 'Salarii și beneficii' : 'Salaries & benefits', amount: -(companyData?.expensesCurrentMonth * 0.15 || 15000), positive: false },
            { name: language === 'ro' ? 'Chirie și utilități' : 'Rent & utilities', amount: -(companyData?.expensesCurrentMonth * 0.05 || 5000), positive: false }
          ],
          total: -(companyData?.expensesCurrentMonth * 0.2 || 20000)
        }
      ],
      netIncome: (companyData?.incomeCurrentMonth || 150000) - (companyData?.expensesCurrentMonth || 100000)
    },
    balance: {
      title: language === 'ro' ? 'Bilantul Contabil' : 'Balance Sheet',
      period: language === 'ro' ? 'Sfârșitul lunii' : 'End of Month',
      sections: [
        {
          title: language === 'ro' ? 'Active Curente' : 'Current Assets',
          items: [
            { name: language === 'ro' ? 'Numerar și echivalente' : 'Cash and equivalents', amount: 525000, positive: true },
            { name: language === 'ro' ? 'Creanțe clienți' : 'Accounts receivable', amount: 125000, positive: true },
            { name: language === 'ro' ? 'Stocuri' : 'Inventory', amount: 85000, positive: true }
          ],
          total: 735000
        },
        {
          title: language === 'ro' ? 'Active Fixe' : 'Fixed Assets',
          items: [
            { name: language === 'ro' ? 'Echipamente' : 'Equipment', amount: 150000, positive: true },
            { name: language === 'ro' ? 'Amortizare cumulată' : 'Accumulated depreciation', amount: -35000, positive: false }
          ],
          total: 115000
        },
        {
          title: language === 'ro' ? 'Datorii' : 'Liabilities',
          items: [
            { name: language === 'ro' ? 'Datorii furnizori' : 'Accounts payable', amount: -65000, positive: false },
            { name: language === 'ro' ? 'Împrumuturi pe termen scurt' : 'Short-term loans', amount: -25000, positive: false },
            { name: language === 'ro' ? 'Împrumuturi pe termen lung' : 'Long-term loans', amount: -150000, positive: false }
          ],
          total: -240000
        }
      ],
      equity: 610000
    }
  };

  useEffect(()=>{
    console.log('LOG',companyData);
  },[companyData]);

  if(isCompanyDataLoading) return <LoadingComponent></LoadingComponent>
  if(IsCompanyDataError) return <p>Error</p>

  const renderFinancialStatement = () => {
    const statement = financialStatements[selectedStatement];
    
    return (
      <div className="bg-[var(--foreground)] rounded-2xl p-6 border border-[var(--text5)]">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-[var(--text1)] mb-2">{statement.title}</h2>
          <p className="text-[var(--text3)]">{statement.period}</p>
        </div>

        <div className="space-y-6">
          {statement.sections.map((section, index) => (
            <div key={index}>
              <h3 className="text-lg font-semibold text-[var(--text1)] mb-3 pb-2 border-b border-[var(--text4)]">
                {section.title}
              </h3>
              <div className="space-y-2 mb-3">
                {section.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex justify-between items-center py-2">
                    <span className="text-[var(--text2)]">{item.name}</span>
                    <span className={`font-semibold ${item.positive ? 'text-[var(--primary)]' : 'text-[var(--text1)]'}`}>
                      {item.positive ? '+' : ''}{item.amount.toLocaleString('ro-RO')} RON
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center py-2 border-t border-[var(--text4)] font-bold">
                <span className="text-[var(--text1)]">
                  {language === 'ro' ? 'Total' : 'Total'} {section.title}
                </span>
                <span className={`${section.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {section.total >= 0 ? '+' : ''}{section.total.toLocaleString('ro-RO')} RON
                </span>
              </div>
            </div>
          ))}

          <div className="border-t-2 border-[var(--primary)] pt-4">
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-[var(--text1)]">
                {selectedStatement === 'cashflow' && (language === 'ro' ? 'Variația Netă a Numerarului' : 'Net Change in Cash')}
                {selectedStatement === 'pnl' && (language === 'ro' ? 'Profit Net' : 'Net Income')}
                {selectedStatement === 'balance' && (language === 'ro' ? 'Capital Propriu' : 'Total Equity')}
              </span>
              <span className={`text-xl font-bold ${
                (selectedStatement === 'cashflow' ? financialStatements.cashflow.netChange : 
                 selectedStatement === 'pnl' ? financialStatements.pnl.netIncome : 
                 financialStatements.balance.equity) >= 0 ? 'text-[var(--primary)]' : 'text-red-600'
              }`}>
                {selectedStatement === 'cashflow' && `${financialStatements.cashflow.netChange >= 0 ? '+' : ''}${financialStatements.cashflow.netChange.toLocaleString('ro-RO')} RON`}
                {selectedStatement === 'pnl' && `${financialStatements.pnl.netIncome >= 0 ? '+' : ''}${financialStatements.pnl.netIncome.toLocaleString('ro-RO')} RON`}
                {selectedStatement === 'balance' && `+${financialStatements.balance.equity.toLocaleString('ro-RO')} RON`}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className='min-h-full max-h-full min-w-full px-10 py-0'>
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
              <div className={`${Number(incomePercentChange) >= 0 ? "bg-green-500/30 text-green-500" : "bg-red-500/30 text-red-500"} text-sm px-1 font-bold rounded-full`}>
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
              <div className={`${Number(expensesPercentChange) >= 0 ? "bg-green-500/30 text-green-500" : "bg-red-500/30 text-red-500"} text-sm px-1 font-bold rounded-full`}>
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
              <div className={`${Number(profitPercentageChange) >= 0 ? "bg-green-500/30 text-green-500" : "bg-red-500/30 text-red-500"} text-sm px-1 font-bold rounded-full`}>
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

      <div className="flex gap-4 mb-6 justify-center">
        <button
          onClick={() => setSelectedStatement('cashflow')}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 ${
            selectedStatement === 'cashflow'
              ? 'bg-[var(--primary)] text-white shadow-lg'
              : 'bg-[var(--foreground)] text-[var(--text2)] hover:bg-[var(--background)] border border-[var(--text4)]'
          }`}
        >
          <Activity size={20} />
          {language === 'ro' ? 'Cash Flow' : 'Cash Flow'}
        </button>
        
        <button
          onClick={() => setSelectedStatement('pnl')}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 ${
            selectedStatement === 'pnl'
              ? 'bg-[var(--primary)] text-white shadow-lg'
              : 'bg-[var(--foreground)] text-[var(--text2)] hover:bg-[var(--background)] border border-[var(--text4)]'
          }`}
        >
          <BarChart3 size={20} />
          P&L
        </button>
        
        <button
          onClick={() => setSelectedStatement('balance')}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 ${
            selectedStatement === 'balance'
              ? 'bg-[var(--primary)] text-white shadow-lg'
              : 'bg-[var(--foreground)] text-[var(--text2)] hover:bg-[var(--background)] border border-[var(--text4)]'
          }`}
        >
          <PieChart size={20} />
          {language === 'ro' ? 'Bilanț' : 'Balance Sheet'}
        </button>
      </div>

      <motion.div
        key={selectedStatement}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        {renderFinancialStatement()}
      </motion.div>

      {clientCompanyName===''&&(
        <>
          {console.log('Rendering modal on HomePage')}
          <div style={{ zIndex: 9999, position: 'fixed', inset: 0 }}>
           <InitialClientCompanyModalSelect/>
          </div>
        </>
      )}
    </div>
  )
}

export default HomePage
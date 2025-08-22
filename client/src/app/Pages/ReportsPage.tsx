"use client";
import { useSelector } from "react-redux";
import { useState, useMemo, useRef } from "react";
import InitialClientCompanyModalSelect from "../Components/InitialClientCompanyModalSelect";
import { useGetCompanyDataQuery } from "@/redux/slices/apiSlice";
import { Activity, BarChart3, PieChart } from "lucide-react";
import html2pdf from "html2pdf.js";

type RootState = {
  clientCompany: { current: { name: string; ein: string } };
  user: { language: string };
};

function ReportsPage() {
  const clientCompanyName = useSelector((state: RootState) => state.clientCompany.current.name);
  const clientCompanyEin = useSelector((state: RootState) => state.clientCompany.current.ein);
  const language = useSelector((state: RootState) => state.user.language);

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<string>(currentYear.toString());
  const availableYears = useMemo(() => Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString()), [currentYear]);

  const [selectedStatement, setSelectedStatement] = useState<'cashflow' | 'pnl' | 'balance'>('cashflow');
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: companyData, isLoading, isError } = useGetCompanyDataQuery(
    { currentCompanyEin: clientCompanyEin, year },
    { skip: !clientCompanyEin || clientCompanyEin === '' }
  );

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
  } as const;

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
                <span className={`${section.total >= 0 ? 'text-[var(--primary)]' : 'text-[var(--text1)]'}`}>
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

  const handleDownloadPdf = async () => {
    const element = reportRef.current;
    if (!element) return;
    const fileSafeCompany = (clientCompanyName || 'Company').replace(/[^a-z0-9_-]+/gi, '_');
    const fileSafeReport = selectedStatement;
    const filename = `${fileSafeCompany}_${fileSafeReport}_${year}.pdf`;

    const opt = {
      margin:       [10, 10, 10, 10],
      filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    } as const;

    await html2pdf().set(opt).from(element).save();
  };

  if (isError) return <p>Error</p>;

  return (
    <div className="min-h-full max-h-full min-w-full px-10 py-0">
      {clientCompanyName === '' && (
        <div style={{ zIndex: 9999, position: 'fixed', inset: 0 }}>
          <InitialClientCompanyModalSelect />
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-left text-[var(--text1)]">{language==='ro'?'Rapoarte':'Reports'}</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-[var(--text2)]">{language==='ro'?'An':'Year'}:</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-[160px] rounded-lg border border-[var(--text4)] bg-[var(--foreground)] text-[var(--text1)] px-3 py-2"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleDownloadPdf}
            className="px-4 py-2 rounded-xl border border-[var(--text4)] bg-[var(--foreground)] text-[var(--text1)] hover:border-[var(--text3)] transition"
          >
            {language==='ro'?'Descarcă PDF':'Download PDF'}
          </button>
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

      <div className="mb-6" ref={reportRef}>
        {renderFinancialStatement()}
      </div>

      {isLoading && (
        <div className='fixed inset-0 z-50 flex items-center justify-center w-full h-full bg-[var(--background)]/60 backdrop-blur-sm'>
          <div className="bg-[var(--foreground)] rounded-3xl p-8 shadow-2xl border border-[var(--text4)]">
            <span className="text-[var(--text1)]">Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportsPage

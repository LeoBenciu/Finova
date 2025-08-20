import React, { useState, useMemo } from 'react';
import { Calendar, TrendingUp, TrendingDown, DollarSign, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useGetBalanceReconciliationStatementQuery } from '@/redux/slices/apiSlice';

interface BalanceReconciliationStatementProps {
  clientEin: string;
  language: 'ro' | 'en';
}

interface PeriodOption {
  label: string;
  value: string;
  startDate: string;
  endDate: string;
}

const BalanceReconciliationStatement: React.FC<BalanceReconciliationStatementProps> = ({
  clientEin,
  language
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('current-month');
  
  // Generate period options
  const periodOptions = useMemo<PeriodOption[]>(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Current month
    const currentMonthStart = new Date(currentYear, currentMonth, 1);
    const currentMonthEnd = new Date(currentYear, currentMonth + 1, 0);
    
    // Previous month
    const prevMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const prevMonthEnd = new Date(currentYear, currentMonth, 0);
    
    return [
      {
        label: language === 'ro' ? 'Luna Curentă' : 'Current Month',
        value: 'current-month',
        startDate: currentMonthStart.toISOString().split('T')[0],
        endDate: currentMonthEnd.toISOString().split('T')[0]
      },
      {
        label: language === 'ro' ? 'Luna Anterioară' : 'Previous Month',
        value: 'previous-month',
        startDate: prevMonthStart.toISOString().split('T')[0],
        endDate: prevMonthEnd.toISOString().split('T')[0]
      }
    ];
  }, [language]);

  const selectedPeriodData = periodOptions.find(p => p.value === selectedPeriod);
  
  const {
    data: reconciliationData,
    isLoading,
    error,
    refetch
  } = useGetBalanceReconciliationStatementQuery(
    {
      clientEin,
      startDate: selectedPeriodData?.startDate || '',
      endDate: selectedPeriodData?.endDate || ''
    },
    {
      skip: !selectedPeriodData
    }
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'ro' ? 'ro-RO' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getReconciliationStatusColor = (isBalanced: boolean, percentage: number) => {
    if (isBalanced && percentage >= 90) return 'text-green-600 bg-green-50';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getReconciliationStatusIcon = (isBalanced: boolean, percentage: number) => {
    if (isBalanced && percentage >= 90) return <CheckCircle size={20} className="text-green-600" />;
    return <AlertCircle size={20} className="text-yellow-600" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={32} className="animate-spin text-blue-600" />
        <span className="ml-3 text-[var(--text2)]">
          {language === 'ro' ? 'Se încarcă raportul de reconciliere...' : 'Loading reconciliation report...'}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
        <p className="text-red-600 mb-4">
          {language === 'ro' ? 'Eroare la încărcarea raportului' : 'Error loading reconciliation report'}
        </p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center mx-auto"
        >
          <RefreshCw size={16} className="mr-2" />
          {language === 'ro' ? 'Încearcă din nou' : 'Try Again'}
        </button>
      </div>
    );
  }

  if (!reconciliationData) {
    return (
      <div className="text-center py-12">
        <TrendingUp size={48} className="mx-auto text-[var(--text3)] mb-4" />
        <p className="text-[var(--text2)]">
          {language === 'ro' ? 'Nu există date pentru perioada selectată' : 'No data available for selected period'}
        </p>
      </div>
    );
  }

  const {
    period,
    openingBalance,
    totalDebits,
    totalCredits,
    calculatedClosingBalance,
    actualClosingBalance,
    isBalanced,
    reconciliationPercentage,
    totalTransactions,
    reconciledTransactions,
    balanceDifference
  } = reconciliationData;

  return (
    <div className="space-y-6">
      {/* Period Selection */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Calendar size={20} className="text-[var(--text3)]" />
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border border-[var(--border)] rounded-lg bg-white text-[var(--text1)] focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        
        <div className="text-sm text-[var(--text3)]">
          {formatDate(period.startDate)} - {formatDate(period.endDate)}
        </div>
      </div>

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Opening Balance */}
        <div className="bg-white rounded-lg border border-[var(--border)] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--text3)]">
              {language === 'ro' ? 'Sold Inițial' : 'Opening Balance'}
            </span>
            <DollarSign size={16} className="text-blue-600" />
          </div>
          <div className="text-xl font-semibold text-[var(--text1)]">
            {formatCurrency(openingBalance)}
          </div>
        </div>

        {/* Total Debits */}
        <div className="bg-white rounded-lg border border-[var(--border)] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--text3)]">
              {language === 'ro' ? 'Total Încasări' : 'Total Debits'}
            </span>
            <TrendingUp size={16} className="text-green-600" />
          </div>
          <div className="text-xl font-semibold text-green-600">
            {formatCurrency(totalDebits)}
          </div>
        </div>

        {/* Total Credits */}
        <div className="bg-white rounded-lg border border-[var(--border)] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--text3)]">
              {language === 'ro' ? 'Total Plăți' : 'Total Credits'}
            </span>
            <TrendingDown size={16} className="text-red-600" />
          </div>
          <div className="text-xl font-semibold text-red-600">
            {formatCurrency(totalCredits)}
          </div>
        </div>

        {/* Closing Balance */}
        <div className="bg-white rounded-lg border border-[var(--border)] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--text3)]">
              {language === 'ro' ? 'Sold Final' : 'Closing Balance'}
            </span>
            <DollarSign size={16} className="text-blue-600" />
          </div>
          <div className="text-xl font-semibold text-[var(--text1)]">
            {formatCurrency(actualClosingBalance)}
          </div>
        </div>
      </div>

      {/* Reconciliation Status */}
      <div className="bg-white rounded-lg border border-[var(--border)] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--text1)]">
            {language === 'ro' ? 'Starea Reconcilierii' : 'Reconciliation Status'}
          </h3>
          {getReconciliationStatusIcon(isBalanced, reconciliationPercentage)}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Balance Verification */}
          <div>
            <h4 className="font-medium text-[var(--text2)] mb-2">
              {language === 'ro' ? 'Verificarea Soldului' : 'Balance Verification'}
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text3)]">
                  {language === 'ro' ? 'Sold Calculat:' : 'Calculated Balance:'}
                </span>
                <span className="font-medium">{formatCurrency(calculatedClosingBalance)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text3)]">
                  {language === 'ro' ? 'Sold Real:' : 'Actual Balance:'}
                </span>
                <span className="font-medium">{formatCurrency(actualClosingBalance)}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-[var(--text3)]">
                  {language === 'ro' ? 'Diferență:' : 'Difference:'}
                </span>
                <span className={`font-medium ${balanceDifference === 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(Math.abs(balanceDifference))}
                </span>
              </div>
            </div>
          </div>

          {/* Reconciliation Progress */}
          <div>
            <h4 className="font-medium text-[var(--text2)] mb-2">
              {language === 'ro' ? 'Progresul Reconcilierii' : 'Reconciliation Progress'}
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text3)]">
                  {language === 'ro' ? 'Tranzacții Reconciliate:' : 'Reconciled Transactions:'}
                </span>
                <span className="font-medium">{reconciledTransactions}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text3)]">
                  {language === 'ro' ? 'Total Tranzacții:' : 'Total Transactions:'}
                </span>
                <span className="font-medium">{totalTransactions}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${reconciliationPercentage}%` }}
                ></div>
              </div>
              <div className="text-sm text-center font-medium text-blue-600">
                {reconciliationPercentage.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div>
            <h4 className="font-medium text-[var(--text2)] mb-2">
              {language === 'ro' ? 'Starea Finală' : 'Final Status'}
            </h4>
            <div className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium ${getReconciliationStatusColor(isBalanced, reconciliationPercentage)}`}>
              {getReconciliationStatusIcon(isBalanced, reconciliationPercentage)}
              <span className="ml-2">
                {isBalanced 
                  ? (language === 'ro' ? 'Reconciliat' : 'Balanced')
                  : (language === 'ro' ? 'Nereconciliat' : 'Unbalanced')
                }
              </span>
            </div>
            {!isBalanced && (
              <p className="text-xs text-red-600 mt-2">
                {language === 'ro' 
                  ? 'Există discrepanțe care necesită investigare'
                  : 'There are discrepancies that need investigation'
                }
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Summary Information */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">
          {language === 'ro' ? 'Informații Suplimentare' : 'Additional Information'}
        </h4>
        <div className="text-sm text-blue-800 space-y-1">
          <p>
            {language === 'ro' 
              ? `Perioada analizată: ${formatDate(period.startDate)} - ${formatDate(period.endDate)}`
              : `Analysis period: ${formatDate(period.startDate)} - ${formatDate(period.endDate)}`
            }
          </p>
          <p>
            {language === 'ro' 
              ? `Reconcilierea este ${isBalanced ? 'completă' : 'incompletă'} pentru această perioadă.`
              : `Reconciliation is ${isBalanced ? 'complete' : 'incomplete'} for this period.`
            }
          </p>
          {!isBalanced && (
            <p className="font-medium">
              {language === 'ro' 
                ? 'Recomandare: Verificați tranzacțiile nereconciliate și taxele bancare.'
                : 'Recommendation: Check unreconciled transactions and bank fees.'
              }
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BalanceReconciliationStatement;

"use client";
import { useState } from "react";
import { useGetLedgerEntriesQuery, useGetLedgerSummaryQuery } from "@/redux/slices/apiSlice";
import { useSelector } from "react-redux";
import { MyDateRangePicker } from '@/app/Components/MyDateRangePicker';

type RootState = {
  clientCompany: { current: { ein: string } };
  user: { language: string };
};

export default function LedgerViewer() {
  const clientCompanyEin = useSelector((state: RootState) => state.clientCompany.current.ein);
  const language = useSelector((state: RootState) => state.user.language);
  
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState<{ from: string | undefined; to: string | undefined }>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  const [selectedAccount, setSelectedAccount] = useState('');

  // Helper function to convert DD-MM-YYYY to YYYY-MM-DD
  const convertDateFormat = (dateStr: string | undefined): string | undefined => {
    if (!dateStr) return undefined;
    const [day, month, year] = dateStr.split('-');
    return `${year}-${month}-${day}`;
  };

  const { data: ledgerData, isLoading: entriesLoading, error: entriesError } = useGetLedgerEntriesQuery({
    ein: clientCompanyEin,
    page,
    size: 50,
    startDate: convertDateFormat(dateRange.from),
    endDate: convertDateFormat(dateRange.to),
    accountCode: selectedAccount || undefined
  });

  const { data: summaryData, isLoading: summaryLoading, error: summaryError } = useGetLedgerSummaryQuery({
    ein: clientCompanyEin,
    startDate: convertDateFormat(dateRange.from),
    endDate: convertDateFormat(dateRange.to)
  });

  // Debug logging
  console.log('[LEDGER VIEWER] Component state:', {
    clientCompanyEin,
    page,
    dateRange,
    selectedAccount,
    entriesLoading,
    summaryLoading,
    entriesError,
    summaryError,
    ledgerData,
    summaryData
  });

  if (entriesLoading || summaryLoading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
          <p className="text-[var(--text2)]">
            {language === 'ro' ? 'Se încarcă datele registrului contabil...' : 'Loading ledger data...'}
          </p>
        </div>
      </div>
    );
  }

  if (entriesError || summaryError) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <p className="text-lg font-semibold">Error Loading Ledger Data</p>
            <p className="text-sm mt-2">
              {language === 'ro' ? 'Eroare la încărcarea datelor registrului contabil' : 'Error loading ledger data'}
            </p>
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm">Debug Info</summary>
              <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                {JSON.stringify({ entriesError, summaryError }, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[var(--text1)]">
          {language === 'ro' ? 'Vizualizare Registru Contabil' : 'Ledger Viewer'}
        </h2>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <label className="text-[var(--text2)] text-sm">
              {language === 'ro' ? 'Perioada:' : 'Date Range:'}
            </label>
            <div className="w-[280px]">
              <MyDateRangePicker 
                dateRange={dateRange} 
                setDateRange={setDateRange} 
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[var(--text2)] text-sm">
              {language === 'ro' ? 'Cont:' : 'Account:'}
            </label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="px-3 py-2 border border-[var(--text4)] rounded-lg bg-[var(--foreground)] text-[var(--text1)] text-sm min-w-[120px]"
            >
              <option value="">{language === 'ro' ? 'Toate conturile' : 'All Accounts'}</option>
              {summaryData?.accountSummary.map((account: any) => (
                <option key={account.accountCode} value={account.accountCode}>
                  {account.accountCode}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--foreground)] p-4 rounded-lg border border-[var(--text4)]">
          <h3 className="font-semibold text-[var(--text2)] text-sm mb-2">
            {language === 'ro' ? 'Total Intrări' : 'Total Entries'}
          </h3>
          <p className="text-2xl font-bold text-[var(--text1)]">
            {summaryData?.totalEntries || 0}
          </p>
        </div>
        <div className="bg-[var(--foreground)] p-4 rounded-lg border border-[var(--text4)]">
          <h3 className="font-semibold text-[var(--text2)] text-sm mb-2">
            {language === 'ro' ? 'Conturi Active' : 'Active Accounts'}
          </h3>
          <p className="text-2xl font-bold text-[var(--text1)]">
            {summaryData?.accountSummary.length || 0}
          </p>
        </div>
        <div className="bg-[var(--foreground)] p-4 rounded-lg border border-[var(--text4)]">
          <h3 className="font-semibold text-[var(--text2)] text-sm mb-2">
            {language === 'ro' ? 'Tipuri de Tranzacții' : 'Transaction Types'}
          </h3>
          <p className="text-2xl font-bold text-[var(--text1)]">
            {summaryData?.sourceSummary.length || 0}
          </p>
        </div>
      </div>

      {/* Ledger Entries Table */}
      <div className="bg-[var(--foreground)] rounded-lg border border-[var(--text4)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--background)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text2)] uppercase tracking-wider">
                  {language === 'ro' ? 'Data' : 'Date'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text2)] uppercase tracking-wider">
                  {language === 'ro' ? 'Cont' : 'Account'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text2)] uppercase tracking-wider">
                  {language === 'ro' ? 'Debit' : 'Debit'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text2)] uppercase tracking-wider">
                  {language === 'ro' ? 'Credit' : 'Credit'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text2)] uppercase tracking-wider">
                  {language === 'ro' ? 'Sursa' : 'Source'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text2)] uppercase tracking-wider">
                  {language === 'ro' ? 'Document' : 'Document'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--text4)]">
              {ledgerData?.entries?.map((entry: any) => (
                <tr key={entry.id} className="hover:bg-[var(--background)] transition-colors">
                  <td className="px-4 py-3 text-sm text-[var(--text1)]">
                    {entry.postingDate ? new Date(entry.postingDate).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-[var(--text1)]">
                    {entry.accountCode}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text1)]">
                    {entry.debit && entry.debit > 0 ? (
                      <span className="text-red-600 font-medium">
                        {Number(entry.debit).toLocaleString('ro-RO')} RON
                      </span>
                    ) : (
                      <span className="text-[var(--text3)]">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text1)]">
                    {entry.credit && entry.credit > 0 ? (
                      <span className="text-green-600 font-medium">
                        {Number(entry.credit).toLocaleString('ro-RO')} RON
                      </span>
                    ) : (
                      <span className="text-[var(--text3)]">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 font-medium">
                      {entry.sourceType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {entry.document ? (
                      <span className="text-blue-600 hover:underline cursor-pointer">
                        {entry.document.name}
                      </span>
                    ) : entry.bankTransaction ? (
                      <span className="text-green-600">
                        Bank: {entry.bankTransaction.description}
                      </span>
                    ) : (
                      <span className="text-[var(--text3)]">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {ledgerData?.pagination && (
          <div className="px-4 py-3 border-t border-[var(--text4)] flex items-center justify-between">
            <div className="text-sm text-[var(--text2)]">
              {language === 'ro' ? 'Afișare' : 'Showing'} {((page - 1) * 50) + 1} - {Math.min(page * 50, ledgerData.pagination.total)} {language === 'ro' ? 'din' : 'of'} {ledgerData.pagination.total}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-[var(--text4)] rounded bg-[var(--foreground)] text-[var(--text1)] hover:bg-[var(--background)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {language === 'ro' ? 'Anterior' : 'Previous'}
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= ledgerData.pagination.totalPages}
                className="px-3 py-1 text-sm border border-[var(--text4)] rounded bg-[var(--foreground)] text-[var(--text1)] hover:bg-[var(--background)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {language === 'ro' ? 'Următor' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Account Summary */}
      {summaryData?.accountSummary && summaryData.accountSummary.length > 0 && (
        <div className="bg-[var(--foreground)] rounded-lg border border-[var(--text4)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text1)] mb-4">
            {language === 'ro' ? 'Sumar pe Conturi' : 'Account Summary'}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--text4)]">
                  <th className="text-left py-2 text-[var(--text2)] font-medium">
                    {language === 'ro' ? 'Cont' : 'Account'}
                  </th>
                  <th className="text-right py-2 text-[var(--text2)] font-medium">
                    {language === 'ro' ? 'Debit Total' : 'Total Debit'}
                  </th>
                  <th className="text-right py-2 text-[var(--text2)] font-medium">
                    {language === 'ro' ? 'Credit Total' : 'Total Credit'}
                  </th>
                  <th className="text-right py-2 text-[var(--text2)] font-medium">
                    {language === 'ro' ? 'Sold Net' : 'Net Balance'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {summaryData.accountSummary.map((account: any) => (
                  <tr key={account.accountCode} className="border-b border-[var(--text4)]">
                    <td className="py-2 text-[var(--text1)] font-mono">
                      {account.accountCode}
                    </td>
                    <td className="py-2 text-right text-[var(--text1)]">
                      {account.totalDebit.toLocaleString('ro-RO')} RON
                    </td>
                    <td className="py-2 text-right text-[var(--text1)]">
                      {account.totalCredit.toLocaleString('ro-RO')} RON
                    </td>
                    <td className="py-2 text-right">
                      <span className={`font-medium ${
                        account.netAmount >= 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {account.netAmount.toLocaleString('ro-RO')} RON
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

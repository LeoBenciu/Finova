import { useState } from 'react';
import { TrendingUp, FileText, Landmark, Calendar, Loader2 } from 'lucide-react';
import {
  useGetBalanceReconciliationStatementQuery,
  useGetBankReconciliationSummaryReportQuery,
  useGetReconciliationHistoryAndAuditTrailQuery,
} from '@/redux/slices/apiSlice';

interface ComprehensiveReportingSystemProps {
  clientEin: string;
  language: 'ro' | 'en';
}

function ComprehensiveReportingSystem({ clientEin, language }: ComprehensiveReportingSystemProps) {
  const [activeReport, setActiveReport] = useState<'summary' | 'audit' | 'balance'>('summary');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [auditPage] = useState(1);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel'>('pdf');
  const [isExporting, setIsExporting] = useState(false);

  // API Queries
  const { data: summaryReport, isLoading: summaryLoading } = useGetBankReconciliationSummaryReportQuery({
    clientEin,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate
  });

  const { data: auditTrail, isLoading: auditLoading } = useGetReconciliationHistoryAndAuditTrailQuery({
    clientEin,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    page: auditPage,
    size: 25
  });

  const { data: balanceStatement, isLoading: balanceLoading } = useGetBalanceReconciliationStatementQuery({
    clientEin,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate
  });

  const handleExport = async (format: 'pdf' | 'excel') => {
    setIsExporting(true);
    try {
      if (format === 'pdf') {
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF();

        doc.setFontSize(20);
        doc.text(language === 'ro' ? 'Raport Reconciliere Bancara' : 'Bank Reconciliation Report', 20, 30);

        doc.setFontSize(12);
        doc.text(`${language === 'ro' ? 'Perioada' : 'Period'}: ${dateRange.startDate} - ${dateRange.endDate}`, 20, 50);

        let yPos = 70;

        if (summaryReport) {
          doc.setFontSize(16);
          doc.text(language === 'ro' ? 'Sumar Reconciliere' : 'Reconciliation Summary', 20, yPos);
          yPos += 20;

          doc.setFontSize(10);
          if (summaryReport.summary?.balances) {
            doc.text(`${language === 'ro' ? 'Sold Initial' : 'Opening Balance'}: ${summaryReport.summary.balances.openingBalance?.toFixed(2) || '0.00'} RON`, 20, yPos);
            yPos += 10;
            doc.text(`${language === 'ro' ? 'Sold Final' : 'Closing Balance'}: ${summaryReport.summary.balances.closingBalance?.toFixed(2) || '0.00'} RON`, 20, yPos);
            yPos += 10;
            doc.text(`${language === 'ro' ? 'Diferenta' : 'Difference'}: ${summaryReport.summary.balances.difference?.toFixed(2) || '0.00'} RON`, 20, yPos);
            yPos += 20;
          }

          if (summaryReport.summary?.reconciliationHealth) {
            const health = summaryReport.summary.reconciliationHealth;
            doc.text(`${language === 'ro' ? 'Documente Reconciliate' : 'Documents Reconciled'}: ${health.documentsReconciled}/${health.totalDocuments} (${health.documentReconciliationRate.toFixed(1)}%)`, 20, yPos);
            yPos += 10;
            doc.text(`${language === 'ro' ? 'Tranzactii Reconciliate' : 'Transactions Reconciled'}: ${health.transactionsReconciled}/${health.totalTransactions} (${health.transactionReconciliationRate.toFixed(1)}%)`, 20, yPos);
            yPos += 20;
          }
        }

        // Add generation timestamp
        doc.setFontSize(8);
        doc.text(`${language === 'ro' ? 'Generat la' : 'Generated at'}: ${new Date().toLocaleString()}`, 20, 280);

        // Save PDF
        doc.save(`bank-reconciliation-report-${dateRange.startDate}-to-${dateRange.endDate}.pdf`);

      } else if (format === 'excel') {
        // Generate Excel using xlsx
        const XLSX = await import('xlsx');
        const workbook = XLSX.utils.book_new();

        // Summary Sheet
        if (summaryReport) {
          const summaryData = [
            [language === 'ro' ? 'Raport Sumar Reconciliere' : 'Reconciliation Summary Report'],
            [language === 'ro' ? 'Perioada' : 'Period', `${dateRange.startDate} - ${dateRange.endDate}`],
            [],
            [language === 'ro' ? 'Solduri' : 'Balances'],
            [language === 'ro' ? 'Sold Initial' : 'Opening Balance', summaryReport.summary?.balances?.openingBalance?.toFixed(2) || '0.00', 'RON'],
            [language === 'ro' ? 'Sold Final' : 'Closing Balance', summaryReport.summary?.balances?.closingBalance?.toFixed(2) || '0.00', 'RON'],
            [language === 'ro' ? 'Diferenta' : 'Difference', summaryReport.summary?.balances?.difference?.toFixed(2) || '0.00', 'RON'],
            [],
            [language === 'ro' ? 'Starea Reconcilierii' : 'Reconciliation Health'],
          ];

          if (summaryReport.summary?.reconciliationHealth) {
            const health = summaryReport.summary.reconciliationHealth;
            summaryData.push(
              [language === 'ro' ? 'Documente Reconciliate' : 'Documents Reconciled', health.documentsReconciled, health.totalDocuments, `${health.documentReconciliationRate.toFixed(1)}%`],
              [language === 'ro' ? 'Tranzactii Reconciliate' : 'Transactions Reconciled', health.transactionsReconciled, health.totalTransactions, `${health.transactionReconciliationRate.toFixed(1)}%`]
            );
          }

          const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
          XLSX.utils.book_append_sheet(workbook, summarySheet, language === 'ro' ? 'Sumar' : 'Summary');
        }

        // Balance Sheet
        if (balanceStatement) {
          const balanceData = [
            [language === 'ro' ? 'Reconciliere Sold' : 'Balance Reconciliation'],
            [language === 'ro' ? 'Perioada' : 'Period', `${balanceStatement.period?.startDate} - ${balanceStatement.period?.endDate}`],
            [],
            [language === 'ro' ? 'Solduri' : 'Balances'],
            [language === 'ro' ? 'Sold Initial' : 'Opening Balance', balanceStatement.balances?.openingBalance?.toFixed(2) || '0.00', 'RON'],
            [language === 'ro' ? 'Total Credite' : 'Total Credits', balanceStatement.balances?.totalCredits?.toFixed(2) || '0.00', 'RON'],
            [language === 'ro' ? 'Total Debite' : 'Total Debits', balanceStatement.balances?.totalDebits?.toFixed(2) || '0.00', 'RON'],
            [language === 'ro' ? 'Sold Final' : 'Closing Balance', balanceStatement.balances?.closingBalance?.toFixed(2) || '0.00', 'RON'],
            [language === 'ro' ? 'Diferenta' : 'Difference', balanceStatement.balances?.difference?.toFixed(2) || '0.00', 'RON']
          ];

          if (balanceStatement.reconciliationStatus) {
            balanceData.push(
              [],
              [language === 'ro' ? 'Starea Reconcilierii' : 'Reconciliation Status'],
              [language === 'ro' ? 'Echilibrat' : 'Balanced', balanceStatement.reconciliationStatus.isBalanced ? 'Da' : 'Nu'],
              [language === 'ro' ? 'Rata Reconciliere' : 'Reconciliation Rate', `${balanceStatement.reconciliationStatus.reconciliationPercentage?.toFixed(1) || '0.0'}%`]
            );
          }

          const balanceSheet = XLSX.utils.aoa_to_sheet(balanceData);
          XLSX.utils.book_append_sheet(workbook, balanceSheet, language === 'ro' ? 'Sold' : 'Balance');
        }

        // Save Excel
        XLSX.writeFile(workbook, `bank-reconciliation-report-${dateRange.startDate}-to-${dateRange.endDate}.xlsx`);
      }

    } catch (error) {
      console.error('Export failed:', error);
      alert(language === 'ro' ? 'Exportul a eșuat. Vă rugăm să încercați din nou.' : 'Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const reportTabs = [
    { id: 'summary', label: language === 'ro' ? 'Sumar' : 'Summary', icon: TrendingUp },
    { id: 'audit', label: language === 'ro' ? 'Istoric Audit' : 'Audit Trail', icon: FileText },
    { id: 'balance', label: language === 'ro' ? 'Reconciliere Sold' : 'Balance Reconciliation', icon: Landmark }
  ];

  return (
    <div className="space-y-6">
      {/* Report Navigation and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {reportTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveReport(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  activeReport === tab.id
                    ? 'bg-[var(--primary)] text-white shadow-lg'
                    : 'bg-[var(--background)] text-[var(--text2)] hover:bg-[var(--text4)] hover:text-[var(--text1)]'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {/* Date Range Selector */}
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-[var(--text2)]" />
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="px-3 py-2 bg-[var(--background)] border border-[var(--text4)] rounded-lg text-[var(--text1)] text-sm"
            />
            <span className="text-[var(--text2)]">-</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="px-3 py-2 bg-[var(--background)] border border-[var(--text4)] rounded-lg text-[var(--text1)] text-sm"
            />
          </div>

          {/* Export Controls */}
          <div className="flex items-center gap-2">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'pdf' | 'excel')}
              className="px-3 py-2 bg-[var(--background)] border border-[var(--text4)] rounded-lg text-[var(--text1)] text-sm"
            >
              <option value="pdf">PDF</option>
              <option value="excel">Excel</option>
            </select>
            <button
              onClick={() => handleExport(exportFormat)}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isExporting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <FileText size={16} />
              )}
              {language === 'ro' ? 'Export' : 'Export'}
            </button>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="bg-[var(--background)] rounded-xl border border-[var(--text4)] overflow-hidden p-6">
        {activeReport === 'summary' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-[var(--text1)]">
              {language === 'ro' ? 'Raport Sumar de Reconciliere' : 'Bank Reconciliation Summary Report'}
            </h3>
            {summaryLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-[var(--primary)]" />
              </div>
            ) : summaryReport ? (
              <div className="space-y-6">
                {/* Period Information */}
                <div className="bg-[var(--text4)] rounded-lg p-4">
                  <h4 className="font-semibold text-[var(--text1)] mb-2">
                    {language === 'ro' ? 'Perioada Raportului' : 'Report Period'}
                  </h4>
                  <p className="text-[var(--text2)]">
                    {summaryReport.summary.period.startDate} - {summaryReport.summary.period.endDate}
                  </p>
                </div>

                {/* Balance Information */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h5 className="font-semibold text-blue-800 mb-1">
                      {language === 'ro' ? 'Sold Inițial' : 'Opening Balance'}
                    </h5>
                    <p className="text-2xl font-bold text-blue-900">
                      {summaryReport.summary.balances.openingBalance?.toFixed(2) || '0.00'} RON
                    </p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h5 className="font-semibold text-green-800 mb-1">
                      {language === 'ro' ? 'Sold Final' : 'Closing Balance'}
                    </h5>
                    <p className="text-2xl font-bold text-green-900">
                      {summaryReport.summary.balances.closingBalance?.toFixed(2) || '0.00'} RON
                    </p>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h5 className="font-semibold text-purple-800 mb-1">
                      {language === 'ro' ? 'Diferență' : 'Difference'}
                    </h5>
                    <p className="text-2xl font-bold text-purple-900">
                      {summaryReport.summary.balances.difference?.toFixed(2) || '0.00'} RON
                    </p>
                  </div>
                </div>

                {/* Reconciliation Health */}
                <div className="bg-[var(--text4)] rounded-lg p-6">
                  <h4 className="font-semibold text-[var(--text1)] mb-4">
                    {language === 'ro' ? 'Starea Reconcilierii' : 'Reconciliation Health'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[var(--text2)]">
                          {language === 'ro' ? 'Documente Reconciliate' : 'Documents Reconciled'}
                        </span>
                        <span className="font-semibold text-[var(--text1)]">
                          {summaryReport.summary.reconciliationHealth.documentsReconciled} / {summaryReport.summary.reconciliationHealth.totalDocuments}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-[var(--primary)] h-2 rounded-full" 
                          style={{ width: `${summaryReport.summary.reconciliationHealth.documentReconciliationRate}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-[var(--text2)] mt-1">
                        {summaryReport.summary.reconciliationHealth.documentReconciliationRate.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[var(--text2)]">
                          {language === 'ro' ? 'Tranzacții Reconciliate' : 'Transactions Reconciled'}
                        </span>
                        <span className="font-semibold text-[var(--text1)]">
                          {summaryReport.summary.reconciliationHealth.transactionsReconciled} / {summaryReport.summary.reconciliationHealth.totalTransactions}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-[var(--primary)] h-2 rounded-full" 
                          style={{ width: `${summaryReport.summary.reconciliationHealth.transactionReconciliationRate}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-[var(--text2)] mt-1">
                        {summaryReport.summary.reconciliationHealth.transactionReconciliationRate.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                {summaryReport.recentActivity && summaryReport.recentActivity.length > 0 && (
                  <div className="bg-[var(--text4)] rounded-lg p-6">
                    <h4 className="font-semibold text-[var(--text1)] mb-4">
                      {language === 'ro' ? 'Activitate Recentă' : 'Recent Activity'}
                    </h4>
                    <div className="space-y-3">
                      {summaryReport.recentActivity.slice(0, 5).map((activity: any) => (
                        <div key={activity.id} className="flex items-center justify-between py-2 border-b border-[var(--text3)] last:border-b-0">
                          <div>
                            <p className="text-[var(--text1)] font-medium">{activity.description}</p>
                            <p className="text-sm text-[var(--text2)]">
                              {new Date(activity.timestamp).toLocaleDateString(language === 'ro' ? 'ro-RO' : 'en-US')}
                            </p>
                          </div>
                          {/* Removed erroneous splits preview from Recent Activity (no txn context here) */}
                          <div className="text-sm text-[var(--text2)]">
                            {activity.details.confidence && `${(activity.details.confidence * 100).toFixed(1)}%`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-[var(--text2)] py-12">
                {language === 'ro' ? 'Nu există date disponibile pentru perioada selectată' : 'No data available for the selected period'}
              </div>
            )}
          </div>
        )}

        {activeReport === 'audit' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-[var(--text1)]">
              {language === 'ro' ? 'Istoric și Audit Trail' : 'Reconciliation History & Audit Trail'}
            </h3>
            {auditLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-[var(--primary)]" />
              </div>
            ) : auditTrail ? (
              <div className="space-y-6">
                {/* Summary Stats */}
                {auditTrail.summary && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h5 className="font-semibold text-blue-800 mb-1">
                        {language === 'ro' ? 'Total Activități' : 'Total Activities'}
                      </h5>
                      <p className="text-2xl font-bold text-blue-900">
                        {auditTrail.summary.totalActivities || 0}
                      </p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h5 className="font-semibold text-green-800 mb-1">
                        {language === 'ro' ? 'Reconcilieri Acceptate' : 'Accepted Reconciliations'}
                      </h5>
                      <p className="text-2xl font-bold text-green-900">
                        {auditTrail.summary.acceptedReconciliations || 0}
                      </p>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h5 className="font-semibold text-orange-800 mb-1">
                        {language === 'ro' ? 'Sugestii Respinse' : 'Rejected Suggestions'}
                      </h5>
                      <p className="text-2xl font-bold text-orange-900">
                        {auditTrail.summary.rejectedSuggestions || 0}
                      </p>
                    </div>
                  </div>
                )}

                {/* Audit Trail Table */}
                {auditTrail.activities && auditTrail.activities.length > 0 ? (
                  <div className="bg-[var(--text4)] rounded-lg p-6">
                    <h4 className="font-semibold text-[var(--text1)] mb-4">
                      {language === 'ro' ? 'Istoric Activități' : 'Activity History'}
                    </h4>
                    <div className="overflow-x-auto scrollbar-soft">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[var(--text3)]">
                            <th className="text-left py-2 text-[var(--text2)] font-medium">
                              {language === 'ro' ? 'Data/Ora' : 'Date/Time'}
                            </th>
                            <th className="text-left py-2 text-[var(--text2)] font-medium">
                              {language === 'ro' ? 'Acțiune' : 'Action'}
                            </th>
                            <th className="text-left py-2 text-[var(--text2)] font-medium">
                              {language === 'ro' ? 'Descriere' : 'Description'}
                            </th>
                            <th className="text-left py-2 text-[var(--text2)] font-medium">
                              {language === 'ro' ? 'Utilizator' : 'User'}
                            </th>
                            <th className="text-center py-2 text-[var(--text2)] font-medium">
                              {language === 'ro' ? 'Detalii' : 'Details'}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditTrail.activities.map((activity: any) => (
                            <tr key={activity.id} className="border-b border-[var(--text3)] last:border-b-0">
                              <td className="py-3 text-[var(--text1)]">
                                {new Date(activity.timestamp).toLocaleString(language === 'ro' ? 'ro-RO' : 'en-US')}
                              </td>
                              <td className="py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  activity.action === 'ACCEPTED' ? 'bg-green-100 text-green-800' :
                                  activity.action === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                  activity.action === 'MANUAL_MATCH' ? 'bg-blue-100 text-blue-800' :
                                  activity.action === 'UNRECONCILED' ? 'bg-purple-100 text-purple-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {activity.action}
                                </span>
                              </td>
                              <td className="py-3 text-[var(--text2)]">
                                {activity.description}
                              </td>
                              <td className="py-3 text-[var(--text2)]">
                                {activity.user?.name || activity.user?.email || 'System'}
                              </td>
                              <td className="py-3 text-center">
                                {activity.details && (
                                  <button className="text-[var(--primary)] hover:text-[var(--primary)]/80 text-sm">
                                    {language === 'ro' ? 'Vezi' : 'View'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Info */}
                    {auditTrail.pagination && (
                      <div className="mt-4 flex items-center justify-between text-sm text-[var(--text2)]">
                        <span>
                          {language === 'ro' ? 'Afișare' : 'Showing'} {((auditTrail.pagination.page - 1) * auditTrail.pagination.size) + 1} - {Math.min(auditTrail.pagination.page * auditTrail.pagination.size, auditTrail.pagination.total)} {language === 'ro' ? 'din' : 'of'} {auditTrail.pagination.total} {language === 'ro' ? 'înregistrări' : 'records'}
                        </span>
                        <span>
                          {language === 'ro' ? 'Pagina' : 'Page'} {auditTrail.pagination.page} {language === 'ro' ? 'din' : 'of'} {auditTrail.pagination.totalPages}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-[var(--text4)] rounded-lg p-6 text-center">
                    <p className="text-[var(--text2)]">
                      {language === 'ro' ? 'Nu există activități în perioada selectată' : 'No activities found for the selected period'}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-[var(--text2)] py-12">
                {language === 'ro' ? 'Nu există date de audit disponibile' : 'No audit data available'}
              </div>
            )}
          </div>
        )}

        {activeReport === 'balance' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-[var(--text1)]">
              {language === 'ro' ? 'Reconciliere Sold Bancar' : 'Balance Reconciliation Statement'}
            </h3>
            {balanceLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-[var(--primary)]" />
              </div>
            ) : balanceStatement ? (
              <div className="space-y-6">
                {/* Period Information */}
                <div className="bg-[var(--text4)] rounded-lg p-4">
                  <h4 className="font-semibold text-[var(--text1)] mb-2">
                    {language === 'ro' ? 'Perioada Reconcilierii' : 'Reconciliation Period'}
                  </h4>
                  <p className="text-[var(--text2)]">
                    {balanceStatement.period?.startDate} - {balanceStatement.period?.endDate}
                  </p>
                </div>

                {/* Balance Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h5 className="font-semibold text-blue-800 mb-1">
                      {language === 'ro' ? 'Sold Inițial' : 'Opening Balance'}
                    </h5>
                    <p className="text-2xl font-bold text-blue-900">
                      {balanceStatement.balances?.openingBalance?.toFixed(2) || '0.00'} RON
                    </p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h5 className="font-semibold text-green-800 mb-1">
                      {language === 'ro' ? 'Total Credite' : 'Total Credits'}
                    </h5>
                    <p className="text-2xl font-bold text-green-900">
                      {balanceStatement.balances?.totalCredits?.toFixed(2) || '0.00'} RON
                    </p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h5 className="font-semibold text-red-800 mb-1">
                      {language === 'ro' ? 'Total Debite' : 'Total Debits'}
                    </h5>
                    <p className="text-2xl font-bold text-red-900">
                      {balanceStatement.balances?.totalDebits?.toFixed(2) || '0.00'} RON
                    </p>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h5 className="font-semibold text-purple-800 mb-1">
                      {language === 'ro' ? 'Sold Final' : 'Closing Balance'}
                    </h5>
                    <p className="text-2xl font-bold text-purple-900">
                      {balanceStatement.balances?.closingBalance?.toFixed(2) || '0.00'} RON
                    </p>
                  </div>
                </div>

                {/* Reconciliation Status */}
                {balanceStatement.reconciliationStatus && (
                  <div className={`rounded-lg p-6 ${
                    balanceStatement.reconciliationStatus.isBalanced 
                      ? 'bg-green-50 border border-green-200' 
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className={`font-semibold ${
                        balanceStatement.reconciliationStatus.isBalanced 
                          ? 'text-green-800' 
                          : 'text-red-800'
                      }`}>
                        {language === 'ro' ? 'Starea Reconcilierii' : 'Reconciliation Status'}
                      </h4>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        balanceStatement.reconciliationStatus.isBalanced
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {balanceStatement.reconciliationStatus.isBalanced
                          ? (language === 'ro' ? 'Echilibrat' : 'Balanced')
                          : (language === 'ro' ? 'Neechilibrat' : 'Unbalanced')
                        }
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className={`text-sm ${
                          balanceStatement.reconciliationStatus.isBalanced 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {language === 'ro' ? 'Diferență' : 'Difference'}
                        </p>
                        <p className={`text-xl font-bold ${
                          balanceStatement.reconciliationStatus.isBalanced 
                            ? 'text-green-800' 
                            : 'text-red-800'
                        }`}>
                          {balanceStatement.balances?.difference?.toFixed(2) || '0.00'} RON
                        </p>
                      </div>
                      <div>
                        <p className={`text-sm ${
                          balanceStatement.reconciliationStatus.isBalanced 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {language === 'ro' ? 'Tranzacții Reconciliate' : 'Reconciled Transactions'}
                        </p>
                        <p className={`text-xl font-bold ${
                          balanceStatement.reconciliationStatus.isBalanced 
                            ? 'text-green-800' 
                            : 'text-red-800'
                        }`}>
                          {balanceStatement.reconciliationStatus.reconciledCount || 0} / {balanceStatement.reconciliationStatus.totalCount || 0}
                        </p>
                      </div>
                      <div>
                        <p className={`text-sm ${
                          balanceStatement.reconciliationStatus.isBalanced 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {language === 'ro' ? 'Rata Reconciliere' : 'Reconciliation Rate'}
                        </p>
                        <p className={`text-xl font-bold ${
                          balanceStatement.reconciliationStatus.isBalanced 
                            ? 'text-green-800' 
                            : 'text-red-800'
                        }`}>
                          {balanceStatement.reconciliationStatus.reconciliationPercentage?.toFixed(1) || '0.0'}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Transaction Summary */}
                {balanceStatement.transactionSummary && (
                  <div className="bg-[var(--text4)] rounded-lg p-6">
                    <h4 className="font-semibold text-[var(--text1)] mb-4">
                      {language === 'ro' ? 'Sumar Tranzacții' : 'Transaction Summary'}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h5 className="font-medium text-[var(--text1)] mb-3">
                          {language === 'ro' ? 'Tranzacții Credit' : 'Credit Transactions'}
                        </h5>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-[var(--text2)]">{language === 'ro' ? 'Număr:' : 'Count:'}</span>
                            <span className="font-medium text-[var(--text1)]">{balanceStatement.transactionSummary.creditCount || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--text2)]">{language === 'ro' ? 'Total:' : 'Total:'}</span>
                            <span className="font-medium text-[var(--text1)]">{balanceStatement.transactionSummary.totalCredits?.toFixed(2) || '0.00'} RON</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--text2)]">{language === 'ro' ? 'Reconciliate:' : 'Reconciled:'}</span>
                            <span className="font-medium text-[var(--text1)]">{balanceStatement.transactionSummary.reconciledCredits || 0}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h5 className="font-medium text-[var(--text1)] mb-3">
                          {language === 'ro' ? 'Tranzacții Debit' : 'Debit Transactions'}
                        </h5>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-[var(--text2)]">{language === 'ro' ? 'Număr:' : 'Count:'}</span>
                            <span className="font-medium text-[var(--text1)]">{balanceStatement.transactionSummary.debitCount || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--text2)]">{language === 'ro' ? 'Total:' : 'Total:'}</span>
                            <span className="font-medium text-[var(--text1)]">{balanceStatement.transactionSummary.totalDebits?.toFixed(2) || '0.00'} RON</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--text2)]">{language === 'ro' ? 'Reconciliate:' : 'Reconciled:'}</span>
                            <span className="font-medium text-[var(--text1)]">{balanceStatement.transactionSummary.reconciledDebits || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-[var(--text2)] py-12">
                {language === 'ro' ? 'Nu există date de reconciliere disponibile' : 'No reconciliation data available'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ComprehensiveReportingSystem;

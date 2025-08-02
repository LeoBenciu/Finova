import React from 'react';
import { FileText, TrendingUp } from 'lucide-react';

interface ReconciliationSummaryReportProps {
  data: any;
  language: string;
}

const ReconciliationSummaryReport: React.FC<ReconciliationSummaryReportProps> = ({ data, language }) => {
  if (!data) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ro-RO');
  };

  return (
    <div id="reconciliation-summary-report" className="bg-white p-8 space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {language === 'ro' ? 'Raport Sumar Reconciliere' : 'Reconciliation Summary Report'}
            </h2>
            <p className="text-gray-600 mt-1">
              {language === 'ro' ? 'Perioada:' : 'Period:'} {data.period}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">{data.companyName}</p>
            <p className="text-sm text-gray-600">CUI: {data.companyEin}</p>
            <p className="text-sm text-gray-600">
              {language === 'ro' ? 'Generat la:' : 'Generated on:'} {formatDate(new Date().toISOString())}
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Documents Statistics */}
        <div className="bg-blue-50 p-6 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <FileText size={24} className="text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              {language === 'ro' ? 'Documente' : 'Documents'}
            </h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">{language === 'ro' ? 'Total documente:' : 'Total documents:'}</span>
              <span className="font-semibold">{data.documents.total.count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{language === 'ro' ? 'Reconciliate:' : 'Reconciled:'}</span>
              <span className="font-semibold text-green-600">{data.documents.matched.count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{language === 'ro' ? 'Nereconciliate:' : 'Unreconciled:'}</span>
              <span className="font-semibold text-orange-600">{data.documents.unmatched.count}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-gray-600">{language === 'ro' ? 'Valoare totală:' : 'Total value:'}</span>
              <span className="font-semibold">{formatCurrency(data.documents.total.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{language === 'ro' ? 'Rata reconciliere:' : 'Reconciliation rate:'}</span>
              <span className="font-semibold text-blue-600">{data.reconciliationRate.documents.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Transactions Statistics */}
        <div className="bg-green-50 p-6 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp size={24} className="text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              {language === 'ro' ? 'Tranzacții Bancare' : 'Bank Transactions'}
            </h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">{language === 'ro' ? 'Total tranzacții:' : 'Total transactions:'}</span>
              <span className="font-semibold">{data.transactions.total.count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{language === 'ro' ? 'Reconciliate:' : 'Reconciled:'}</span>
              <span className="font-semibold text-green-600">{data.transactions.matched.count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{language === 'ro' ? 'Nereconciliate:' : 'Unreconciled:'}</span>
              <span className="font-semibold text-orange-600">{data.transactions.unmatched.count}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-gray-600">{language === 'ro' ? 'Intrări:' : 'Credits:'}</span>
              <span className="font-semibold text-green-600">+{formatCurrency(data.transactions.total.credit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{language === 'ro' ? 'Ieșiri:' : 'Debits:'}</span>
              <span className="font-semibold text-red-600">-{formatCurrency(data.transactions.total.debit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{language === 'ro' ? 'Rata reconciliere:' : 'Reconciliation rate:'}</span>
              <span className="font-semibold text-green-600">{data.reconciliationRate.transactions.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Reconciliation Activity */}
      {data.reconciliationActivity.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {language === 'ro' ? 'Activitate Reconciliere Recentă' : 'Recent Reconciliation Activity'}
          </h3>
          <div className="bg-gray-50 rounded-lg overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    {language === 'ro' ? 'Document' : 'Document'}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    {language === 'ro' ? 'Tranzacție' : 'Transaction'}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    {language === 'ro' ? 'Sumă' : 'Amount'}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    {language === 'ro' ? 'Reconciliat de' : 'Reconciled by'}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    {language === 'ro' ? 'Data' : 'Date'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.reconciliationActivity.slice(0, 10).map((activity: any, index: number) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{activity.documentName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-48">{activity.transactionDescription}</td>
                    <td className="px-4 py-3 text-sm font-medium">{formatCurrency(Number(activity.amount))}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{activity.reconciledBy}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(activity.reconciledAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReconciliationSummaryReport;
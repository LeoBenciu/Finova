// Create new file: src/components/reports/AccountAttributionReport.tsx
import React from 'react';
import { PieChart, BarChart, AlertCircle } from 'lucide-react';

interface AccountAttributionReportProps {
  data: any;
  language: string;
}

const AccountAttributionReport: React.FC<AccountAttributionReportProps> = ({ data, language }) => {
  if (!data) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ro-RO');
  };

  const getAccountTypeLabel = (type: string) => {
    const labels = {
      'ASSETS': language === 'ro' ? 'Active' : 'Assets',
      'LIABILITIES': language === 'ro' ? 'Pasive' : 'Liabilities', 
      'INCOME': language === 'ro' ? 'Venituri' : 'Income',
      'EXPENSE': language === 'ro' ? 'Cheltuieli' : 'Expenses',
      'EQUITY': language === 'ro' ? 'Capital' : 'Equity'
    };
    return labels[type as keyof typeof labels] || type;
  };

  return (
    <div id="account-attribution-report" className="bg-white p-8 space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {language === 'ro' ? 'Raport Atribuire Conturi' : 'Account Attribution Report'}
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

      {/* Summary Statistics */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <BarChart size={20} className="text-blue-600" />
            <h3 className="font-semibold text-gray-900">
              {language === 'ro' ? 'Total Tranzacții' : 'Total Transactions'}
            </h3>
          </div>
          <p className="text-2xl font-bold text-blue-600">{data.summary.totalTransactions}</p>
          <p className="text-sm text-gray-600">
            {language === 'ro' ? 'Atribuite:' : 'Assigned:'} {data.summary.assignedTransactions}
          </p>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <PieChart size={20} className="text-green-600" />
            <h3 className="font-semibold text-gray-900">
              {language === 'ro' ? 'Poziție Netă' : 'Net Position'}
            </h3>
          </div>
          <p className={`text-2xl font-bold ${data.summary.netPosition >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(data.summary.netPosition)}
          </p>
          <p className="text-sm text-gray-600">
            {language === 'ro' ? 'Intrări - Ieșiri' : 'Credits - Debits'}
          </p>
        </div>

        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={20} className="text-orange-600" />
            <h3 className="font-semibold text-gray-900">
              {language === 'ro' ? 'Neatribuite' : 'Unassigned'}
            </h3>
          </div>
          <p className="text-2xl font-bold text-orange-600">{data.summary.unassignedTransactions}</p>
          <p className="text-sm text-gray-600">
            {language === 'ro' ? 'Necesită atenție' : 'Need attention'}
          </p>
        </div>
      </div>

      {/* Account Breakdown */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {language === 'ro' ? 'Defalcare pe Conturi' : 'Account Breakdown'}
        </h3>
        <div className="bg-gray-50 rounded-lg overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  {language === 'ro' ? 'Cod Cont' : 'Account Code'}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  {language === 'ro' ? 'Denumire Cont' : 'Account Name'}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  {language === 'ro' ? 'Tip' : 'Type'}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                  {language === 'ro' ? 'Debit' : 'Debit'}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                  {language === 'ro' ? 'Credit' : 'Credit'}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                  {language === 'ro' ? 'Nr. Tranzacții' : 'Transactions'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.accountBreakdown.map((account: any, index: number) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{account.accountCode}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{account.accountName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{getAccountTypeLabel(account.accountType)}</td>
                  <td className="px-4 py-3 text-sm text-right text-red-600">
                    {account.debit > 0 ? formatCurrency(account.debit) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-green-600">
                    {account.credit > 0 ? formatCurrency(account.credit) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">{account.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unassigned Transactions */}
      {data.unassignedTransactions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {language === 'ro' ? 'Tranzacții Neatribuite' : 'Unassigned Transactions'}
          </h3>
          <div className="bg-orange-50 rounded-lg overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-orange-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    {language === 'ro' ? 'Data' : 'Date'}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    {language === 'ro' ? 'Descriere' : 'Description'}
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                    {language === 'ro' ? 'Sumă' : 'Amount'}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    {language === 'ro' ? 'Tip' : 'Type'}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    {language === 'ro' ? 'Status' : 'Status'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.unassignedTransactions.map((transaction: any, index: number) => (
                  <tr key={index} className="hover:bg-orange-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{formatDate(transaction.date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 truncate max-w-64">{transaction.description}</td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${
                      transaction.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.type === 'CREDIT' ? '+' : ''}{formatCurrency(Number(transaction.amount))}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{transaction.type}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        transaction.isStandalone ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {transaction.isStandalone 
                          ? (language === 'ro' ? 'Standalone' : 'Standalone')
                          : (language === 'ro' ? 'Neprocesat' : 'Unprocessed')
                        }
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
};

export default AccountAttributionReport;
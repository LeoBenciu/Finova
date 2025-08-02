import React from 'react';
import { AlertTriangle, Clock, DollarSign, XCircle } from 'lucide-react';

interface ExceptionReportProps {
  data: any;
  language: string;
}

const ExceptionReport: React.FC<ExceptionReportProps> = ({ data, language }) => {
  if (!data) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ro-RO');
  };

  return (
    <div id="exception-report" className="bg-white p-8 space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {language === 'ro' ? 'Raport Excepții' : 'Exception Report'}
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
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={20} className="text-orange-600" />
            <h3 className="font-semibold text-gray-900 text-sm">
              {language === 'ro' ? 'Documente Vechi' : 'Old Documents'}
            </h3>
          </div>
          <p className="text-2xl font-bold text-orange-600">{data.summary.oldUnmatchedDocuments}</p>
          <p className="text-xs text-gray-600">
            {language === 'ro' ? '> 30 zile' : '> 30 days'}
          </p>
        </div>

        <div className="bg-red-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={20} className="text-red-600" />
            <h3 className="font-semibold text-gray-900 text-sm">
              {language === 'ro' ? 'Tranzacții Vechi' : 'Old Transactions'}
            </h3>
          </div>
          <p className="text-2xl font-bold text-red-600">{data.summary.oldUnmatchedTransactions}</p>
          <p className="text-xs text-gray-600">
            {language === 'ro' ? '> 30 zile' : '> 30 days'}
          </p>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={20} className="text-purple-600" />
            <h3 className="font-semibold text-gray-900 text-sm">
              {language === 'ro' ? 'Sume Mari' : 'Large Amounts'}
            </h3>
          </div>
          <p className="text-2xl font-bold text-purple-600">{data.summary.largeTransactions}</p>
          <p className="text-xs text-gray-600">
            {language === 'ro' ? '> 10,000 RON' : '> 10,000 RON'}
          </p>
        </div>

        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={20} className="text-yellow-600" />
            <h3 className="font-semibold text-gray-900 text-sm">
              {language === 'ro' ? 'Probleme Conformitate' : 'Compliance Issues'}
            </h3>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{data.summary.complianceIssues}</p>
          <p className="text-xs text-gray-600">
            {language === 'ro' ? 'Documente' : 'Documents'}
          </p>
        </div>
      </div>

      {/* Old Unmatched Documents */}
      {data.exceptions.oldUnmatchedDocuments.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock size={20} className="text-orange-600" />
            {language === 'ro' ? 'Documente Nereconciliate Vechi (>30 zile)' : 'Old Unmatched Documents (>30 days)'}
          </h3>
          <div className="bg-orange-50 rounded-lg overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-orange-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    {language === 'ro' ? 'Document' : 'Document'}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    {language === 'ro' ? 'Tip' : 'Type'}
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                    {language === 'ro' ? 'Sumă' : 'Amount'}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    {language === 'ro' ? 'Data Creare' : 'Created Date'}
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                    {language === 'ro' ? 'Vechime (zile)' : 'Age (days)'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.exceptions.oldUnmatchedDocuments.map((doc: any, index: number) => (
                  <tr key={index} className="hover:bg-orange-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{doc.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{doc.type}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(doc.amount)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(doc.createdAt)}</td>
                    <td className="px-4 py-3 text-sm text-right text-orange-600 font-medium">{doc.daysOld}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Large Transactions */}
      {data.exceptions.largeTransactions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign size={20} className="text-purple-600" />
            {language === 'ro' ? 'Tranzacții cu Sume Mari (>10,000 RON)' : 'Large Amount Transactions (>10,000 RON)'}
          </h3>
          <div className="bg-purple-50 rounded-lg overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-purple-100">
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
                    {language === 'ro' ? 'Status Reconciliere' : 'Reconciliation Status'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.exceptions.largeTransactions.map((txn: any, index: number) => (
                  <tr key={index} className="hover:bg-purple-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{formatDate(txn.transactionDate)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 truncate max-w-64">{txn.description}</td>
                    <td className={`px-4 py-3 text-sm text-right font-bold ${
                      Number(txn.amount) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(Number(txn.amount))}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        txn.reconciliationStatus === 'MATCHED' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {txn.reconciliationStatus === 'MATCHED' 
                          ? (language === 'ro' ? 'Reconciliat' : 'Matched')
                          : (language === 'ro' ? 'Nereconciliat' : 'Unmatched')
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

      {/* Compliance Issues */}
      {data.exceptions.complianceIssues.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle size={20} className="text-yellow-600" />
            {language === 'ro' ? 'Probleme de Conformitate' : 'Compliance Issues'}
          </h3>
          <div className="bg-yellow-50 rounded-lg overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-yellow-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    {language === 'ro' ? 'Document' : 'Document'}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    {language === 'ro' ? 'Status' : 'Status'}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    {language === 'ro' ? 'Probleme' : 'Issues'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.exceptions.complianceIssues.map((issue: any, index: number) => (
                  <tr key={index} className="hover:bg-yellow-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{issue.documentName}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        issue.status === 'NON_COMPLIANT' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {issue.status === 'NON_COMPLIANT' 
                          ? (language === 'ro' ? 'Neconform' : 'Non-Compliant')
                          : (language === 'ro' ? 'Avertisment' : 'Warning')
                        }
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {issue.errors?.ro && issue.errors.ro.length > 0 && (
                        <div className="text-red-600">
                          {language === 'ro' ? 'Erori: ' : 'Errors: '}
                          {issue.errors[language]?.slice(0, 2).join(', ')}
                          {issue.errors[language]?.length > 2 && '...'}
                        </div>
                      )}
                      {issue.warnings?.ro && issue.warnings.ro.length > 0 && (
                        <div className="text-yellow-600">
                          {language === 'ro' ? 'Avertismente: ' : 'Warnings: '}
                          {issue.warnings[language]?.slice(0, 2).join(', ')}
                          {issue.warnings[language]?.length > 2 && '...'}
                        </div>
                      )}
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

export default ExceptionReport;
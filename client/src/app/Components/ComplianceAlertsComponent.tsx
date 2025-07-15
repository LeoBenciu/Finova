import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, X, FileText, AlertCircle, Info } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useGetComplianceAlertsQuery } from '@/redux/slices/apiSlice';

interface ComplianceAlertsProps {
  clientCompanyEin: string;
  onClose?: () => void;
}

const ComplianceAlertsComponent: React.FC<ComplianceAlertsProps> = ({ clientCompanyEin, onClose }) => {
  const language = useSelector((state: {user:{language:string}}) => state.user.language);
  
  const { data: complianceAlerts = [], isLoading } = useGetComplianceAlertsQuery({
    company: clientCompanyEin
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NON_COMPLIANT':
        return 'text-red-600 bg-red-100 border-red-200';
      case 'WARNING':
        return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'COMPLIANT':
        return 'text-green-600 bg-green-100 border-green-200';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'NON_COMPLIANT':
        return <AlertCircle size={20} className="text-red-600" />;
      case 'WARNING':
        return <AlertTriangle size={20} className="text-orange-600" />;
      case 'COMPLIANT':
        return <CheckCircle size={20} className="text-green-600" />;
      default:
        return <Info size={20} className="text-gray-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'NON_COMPLIANT':
        return language === 'ro' ? 'Neconform' : 'Non-Compliant';
      case 'WARNING':
        return language === 'ro' ? 'Avertisment' : 'Warning';
      case 'COMPLIANT':
        return language === 'ro' ? 'Conform' : 'Compliant';
      default:
        return status;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'bg-red-500 text-white';
      case 'high':
        return 'bg-red-400 text-white';
      case 'medium':
        return 'bg-orange-400 text-white';
      case 'low':
        return 'bg-yellow-400 text-black';
      default:
        return 'bg-gray-400 text-white';
    }
  };

  const translateRuleName = (ruleName: string) => {
    const translations = {
      'VAT_NUMBER_FORMAT': language === 'ro' ? 'Format CUI' : 'VAT Number Format',
      'INVOICE_NUMBERING': language === 'ro' ? 'Numerotarea Facturilor' : 'Invoice Numbering',
      'REQUIRED_FIELDS': language === 'ro' ? 'Câmpuri Obligatorii' : 'Required Fields',
      'VAT_RATES': language === 'ro' ? 'Cote TVA' : 'VAT Rates',
      'DATE_VALIDATION': language === 'ro' ? 'Validare Date' : 'Date Validation',
      'AMOUNT_CALCULATIONS': language === 'ro' ? 'Calcule Sume' : 'Amount Calculations',
      'CURRENCY_COMPLIANCE': language === 'ro' ? 'Conformitate Valută' : 'Currency Compliance',
      'ANAF_FORMAT': language === 'ro' ? 'Format ANAF' : 'ANAF Format'
    };
    return translations[ruleName as keyof typeof translations] || ruleName;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (complianceAlerts.length === 0) {
    return (
      <div className="text-center p-8">
        <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
        <h3 className="text-lg font-semibold text-[var(--text1)] mb-2">
          {language === 'ro' ? 'Toate documentele sunt conforme' : 'All Documents Compliant'}
        </h3>
        <p className="text-[var(--text2)]">
          {language === 'ro' ? 'Nu există probleme de conformitate' : 'No compliance issues found'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--text4)] pb-4">
        <div className="flex items-center gap-3">
          <AlertTriangle size={24} className="text-orange-500" />
          <div>
            <h2 className="text-xl font-bold text-[var(--text1)]">
              {language === 'ro' ? 'Alerte Conformitate' : 'Compliance Alerts'}
            </h2>
            <p className="text-[var(--text2)] text-sm">
              {language === 'ro' 
                ? `${complianceAlerts.length} probleme de conformitate găsite`
                : `${complianceAlerts.length} compliance issues found`
              }
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--background)] rounded-lg transition-colors"
          >
            <X size={20} className="text-[var(--text2)]" />
          </button>
        )}
      </div>

      {/* Alerts List */}
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {complianceAlerts.map((alert: any) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[var(--background)] border border-[var(--text4)] rounded-2xl p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-[var(--primary)] flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-[var(--text1)]">
                    {alert.document.name}
                  </h3>
                  <p className="text-sm text-[var(--text2)]">
                    {language === 'ro' ? 'Validat la: ' : 'Validated at: '}
                    {new Date(alert.validatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              {/* Status Badge */}
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${getStatusColor(alert.overallStatus)}`}>
                {getStatusIcon(alert.overallStatus)}
                <span className="text-sm font-medium">
                  {getStatusText(alert.overallStatus)}
                </span>
              </div>
            </div>

            {/* Errors Section */}
            {Array.isArray(alert.errors) && alert.errors.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-2">
                  <AlertCircle size={16} />
                  {language === 'ro' ? 'Erori' : 'Errors'}
                </h4>
                <div className="space-y-2">
                  {alert.errors.map((error: any, index: number) => (
                    <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getSeverityColor(error.severity)}`}>
                          {error.severity || 'HIGH'}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-800">
                            {translateRuleName(error.rule || error.type)}
                          </p>
                          <p className="text-sm text-red-700 mt-1">
                            {error.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings Section */}
            {Array.isArray(alert.warnings) && alert.warnings.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-orange-600 mb-2 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  {language === 'ro' ? 'Avertismente' : 'Warnings'}
                </h4>
                <div className="space-y-2">
                  {alert.warnings.map((warning: any, index: number) => (
                    <div key={index} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getSeverityColor(warning.severity)}`}>
                          {warning.severity || 'MEDIUM'}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-orange-800">
                            {translateRuleName(warning.rule || warning.type)}
                          </p>
                          <p className="text-sm text-orange-700 mt-1">
                            {warning.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Validation Rules Summary */}
            {Array.isArray(alert.validationRules) && alert.validationRules.length > 0 && (
              <div className="pt-3 border-t border-[var(--text4)]">
                <h4 className="text-sm font-semibold text-[var(--text1)] mb-2">
                  {language === 'ro' ? 'Reguli Validate' : 'Validation Rules'}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {alert.validationRules.map((rule: any, index: number) => {
                    const isValid = rule.status === 'PASS' || rule.valid;
                    return (
                      <span
                        key={index}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
                          isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {isValid ? <CheckCircle size={12} /> : <X size={12} />}
                        {translateRuleName(rule.rule || rule.name)}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ComplianceAlertsComponent;
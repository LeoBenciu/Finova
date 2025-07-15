import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, X, FileText, Calendar, DollarSign } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useGetDuplicateAlertsQuery, useUpdateDuplicateStatusMutation } from '@/redux/slices/apiSlice';

interface DuplicateAlertsProps {
  clientCompanyEin: string;
  onClose?: () => void;
}

const DuplicateAlertsComponent: React.FC<DuplicateAlertsProps> = ({ clientCompanyEin, onClose }) => {
  const language = useSelector((state: {user:{language:string}}) => state.user.language);
  
  const { data: duplicateAlerts = [], isLoading, refetch } = useGetDuplicateAlertsQuery({
    company: clientCompanyEin
  });

  const [updateDuplicateStatus] = useUpdateDuplicateStatusMutation();

  const handleUpdateStatus = async (duplicateCheckId: number, status: 'CONFIRMED' | 'DISMISSED') => {
    try {
      await updateDuplicateStatus({ duplicateCheckId, status }).unwrap();
      refetch();
    } catch (error) {
      console.error('Failed to update duplicate status:', error);
    }
  };

  const getSimilarityColor = (score: number) => {
    if (score >= 0.9) return 'text-red-600 bg-red-100';
    if (score >= 0.7) return 'text-orange-600 bg-orange-100';
    return 'text-yellow-600 bg-yellow-100';
  };

  const getDuplicateTypeText = (type: string) => {
    switch (type) {
      case 'EXACT_MATCH':
        return language === 'ro' ? 'Identic' : 'Exact Match';
      case 'CONTENT_MATCH':
        return language === 'ro' ? 'Conținut Similar' : 'Content Match';
      case 'SIMILAR_CONTENT':
        return language === 'ro' ? 'Similar' : 'Similar Content';
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (duplicateAlerts.length === 0) {
    return (
      <div className="text-center p-8">
        <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
        <h3 className="text-lg font-semibold text-[var(--text1)] mb-2">
          {language === 'ro' ? 'Nu există duplicate' : 'No Duplicates Found'}
        </h3>
        <p className="text-[var(--text2)]">
          {language === 'ro' ? 'Toate documentele sunt unice' : 'All documents are unique'}
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
              {language === 'ro' ? 'Alerte Duplicate' : 'Duplicate Alerts'}
            </h2>
            <p className="text-[var(--text2)] text-sm">
              {language === 'ro' 
                ? `${duplicateAlerts.length} posibile duplicate găsite`
                : `${duplicateAlerts.length} potential duplicates found`
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
        {duplicateAlerts.map((alert: any) => (
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
                    {alert.duplicateDocument.name}
                  </h3>
                  <p className="text-sm text-[var(--text2)]">
                    {language === 'ro' ? 'Similar cu: ' : 'Similar to: '}
                    {alert.originalDocument.name}
                  </p>
                </div>
              </div>
              
              {/* Similarity Score */}
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${getSimilarityColor(alert.similarityScore)}`}>
                {Math.round(alert.similarityScore * 100)}% {language === 'ro' ? 'similar' : 'match'}
              </div>
            </div>

            {/* Duplicate Details */}
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div>
                <span className="text-[var(--text2)]">
                  {language === 'ro' ? 'Tip:' : 'Type:'}
                </span>
                <span className="ml-2 font-medium text-[var(--text1)]">
                  {getDuplicateTypeText(alert.duplicateType)}
                </span>
              </div>
              <div>
                <span className="text-[var(--text2)]">
                  {language === 'ro' ? 'Câmpuri comune:' : 'Matching fields:'}
                </span>
                <span className="ml-2 font-medium text-[var(--text1)]">
                  {Array.isArray(alert.matchingFields) ? alert.matchingFields.length : 0}
                </span>
              </div>
            </div>

            {/* Matching Fields */}
            {Array.isArray(alert.matchingFields) && alert.matchingFields.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-[var(--text2)] mb-2">
                  {language === 'ro' ? 'Câmpuri care se potrivesc:' : 'Matching fields:'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {alert.matchingFields.map((field: string, index: number) => {
                    const getFieldIcon = (fieldName: string) => {
                      if (fieldName.includes('date')) return <Calendar size={12} />;
                      if (fieldName.includes('amount')) return <DollarSign size={12} />;
                      return <FileText size={12} />;
                    };

                    const getFieldLabel = (fieldName: string) => {
                      const labels = {
                        'document_number': language === 'ro' ? 'Nr. Document' : 'Doc Number',
                        'total_amount': language === 'ro' ? 'Sumă Totală' : 'Total Amount',
                        'document_date': language === 'ro' ? 'Dată Document' : 'Doc Date',
                        'vendor_ein': language === 'ro' ? 'CUI Furnizor' : 'Vendor EIN',
                        'buyer_ein': language === 'ro' ? 'CUI Cumpărător' : 'Buyer EIN'
                      };
                      return labels[fieldName as keyof typeof labels] || fieldName;
                    };

                    return (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs"
                      >
                        {getFieldIcon(field)}
                        {getFieldLabel(field)}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-3 border-t border-[var(--text4)]">
              <button
                onClick={() => handleUpdateStatus(alert.id, 'CONFIRMED')}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl 
                hover:bg-red-600 transition-colors text-sm font-medium"
              >
                <AlertTriangle size={16} />
                {language === 'ro' ? 'Confirmă Duplicat' : 'Confirm Duplicate'}
              </button>
              
              <button
                onClick={() => handleUpdateStatus(alert.id, 'DISMISSED')}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl 
                hover:bg-green-600 transition-colors text-sm font-medium"
              >
                <CheckCircle size={16} />
                {language === 'ro' ? 'Nu este Duplicat' : 'Not Duplicate'}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default DuplicateAlertsComponent;
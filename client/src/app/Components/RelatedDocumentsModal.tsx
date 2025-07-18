import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Plus, Receipt, FileText, CreditCard, 
  CheckCircle, AlertCircle, Clock, DollarSign,
  Link, Unlink, Eye
} from 'lucide-react';
import { MyTooltip } from './MyTooltip';

interface PaymentSummary {
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'FULLY_PAID' | 'OVERPAID';
  lastPaymentDate?: string;
}

interface RelatedDocument {
  id: number;
  name: string;
  type: string;
  relationshipType: 'PAYMENT' | 'CORRECTION' | 'ATTACHMENT';
  paymentAmount?: number;
  notes?: string;
  createdAt: string;
  signedUrl?: string;
}

interface DocumentWithRelations {
  id: number;
  name: string;
  type: string;
  totalAmount?: number;
  paymentSummary?: PaymentSummary;
  relatedDocuments: {
    payments: RelatedDocument[];
    attachments: RelatedDocument[];
    corrections: RelatedDocument[];
  };
}

interface RelatedDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: any;
  onRefresh: () => void;
}

const RelatedDocumentsModal: React.FC<RelatedDocumentsModalProps> = ({
  isOpen,
  onClose,
  document,
  onRefresh
}) => {
  const [documentWithRelations, setDocumentWithRelations] = useState<DocumentWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [availableDocuments, setAvailableDocuments] = useState<any[]>([]);
  const [selectedPaymentDoc, setSelectedPaymentDoc] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  const language = useSelector((state: {user: {language: string}}) => state.user.language);
  const clientCompanyEin = useSelector((state: any) => state.clientCompany.current.ein);

  useEffect(() => {
    if (isOpen && document) {
      fetchDocumentWithRelations();
    }
  }, [isOpen, document]);

  const fetchDocumentWithRelations = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/files/document/${document.id}/relations`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDocumentWithRelations(data);
      } else {
        console.error('Failed to fetch document relations');
      }
    } catch (error) {
      console.error('Error fetching document relations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableDocuments = async () => {
    try {
      const response = await fetch(`/api/files/${clientCompanyEin}/available-payments/${document.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableDocuments(data);
      }
    } catch (error) {
      console.error('Error fetching available documents:', error);
    }
  };

  const handleAddPayment = async () => {
    if (!selectedPaymentDoc || !paymentAmount) return;

    try {
      const response = await fetch('/api/files/relations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          parentDocumentId: document.id,
          childDocumentId: selectedPaymentDoc,
          relationshipType: 'PAYMENT',
          paymentAmount: parseFloat(paymentAmount),
          notes: paymentNotes || undefined
        })
      });

      if (response.ok) {
        await fetchDocumentWithRelations();
        setShowAddPayment(false);
        setSelectedPaymentDoc(null);
        setPaymentAmount('');
        setPaymentNotes('');
        onRefresh();
      } else {
        console.error('Failed to add payment relation');
      }
    } catch (error) {
      console.error('Error adding payment relation:', error);
    }
  };

  const handleRemoveRelation = async (relationId: number) => {
    try {
      const response = await fetch(`/api/files/relations/${relationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchDocumentWithRelations();
        onRefresh();
      } else {
        console.error('Failed to remove relation');
      }
    } catch (error) {
      console.error('Error removing relation:', error);
    }
  };

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case 'UNPAID':
        return <AlertCircle className="text-red-500" size={20} />;
      case 'PARTIALLY_PAID':
        return <Clock className="text-yellow-500" size={20} />;
      case 'FULLY_PAID':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'OVERPAID':
        return <CheckCircle className="text-blue-500" size={20} />;
      default:
        return <Clock className="text-gray-500" size={20} />;
    }
  };

  const getPaymentStatusText = (status: string) => {
    const statusMap = {
      'UNPAID': language === 'ro' ? 'Neplatită' : 'Unpaid',
      'PARTIALLY_PAID': language === 'ro' ? 'Parțial plătită' : 'Partially paid',
      'FULLY_PAID': language === 'ro' ? 'Plătită complet' : 'Fully paid',
      'OVERPAID': language === 'ro' ? 'Supraplatită' : 'Overpaid'
    };
    return statusMap[status as keyof typeof statusMap] || status;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON'
    }).format(amount);
  };

  const getDocumentIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'receipt':
        return <Receipt size={16} className="text-orange-500" />;
      case 'bank statement':
        return <CreditCard size={16} className="text-blue-500" />;
      default:
        return <FileText size={16} className="text-gray-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[var(--foreground)] rounded-3xl shadow-2xl border border-[var(--text4)] w-full max-w-4xl max-h-[90vh] overflow-hidden"
        >
          <div className="flex items-center justify-between p-6 border-b border-[var(--text4)]">
            <div className="flex items-center gap-3">
              <Link size={24} className="text-[var(--primary)]" />
              <div>
                <h2 className="text-xl font-bold text-[var(--text1)]">
                  {language === 'ro' ? 'Documente Asociate' : 'Related Documents'}
                </h2>
                <p className="text-[var(--text2)] text-sm">
                  {document?.name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[var(--text4)]/20 rounded-lg transition-colors"
            >
              <X size={20} className="text-[var(--text2)]" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
              </div>
            ) : (
              <div className="space-y-6">
                {document?.type === 'Invoice' && documentWithRelations?.paymentSummary && (
                  <div className="bg-[var(--background)] rounded-2xl p-6 border border-[var(--text4)]">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-[var(--text1)] flex items-center gap-2">
                        <DollarSign size={20} className="text-[var(--primary)]" />
                        {language === 'ro' ? 'Sumar Plăți' : 'Payment Summary'}
                      </h3>
                      <div className="flex items-center gap-2">
                        {getPaymentStatusIcon(documentWithRelations.paymentSummary.paymentStatus)}
                        <span className="font-medium text-[var(--text1)]">
                          {getPaymentStatusText(documentWithRelations.paymentSummary.paymentStatus)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-[var(--foreground)] rounded-lg p-4">
                        <p className="text-[var(--text3)] text-sm">
                          {language === 'ro' ? 'Total factură' : 'Invoice total'}
                        </p>
                        <p className="text-[var(--text1)] font-bold text-lg">
                          {formatCurrency(documentWithRelations.paymentSummary.totalAmount)}
                        </p>
                      </div>
                      <div className="bg-[var(--foreground)] rounded-lg p-4">
                        <p className="text-[var(--text3)] text-sm">
                          {language === 'ro' ? 'Suma plătită' : 'Amount paid'}
                        </p>
                        <p className="text-green-600 font-bold text-lg">
                          {formatCurrency(documentWithRelations.paymentSummary.paidAmount)}
                        </p>
                      </div>
                      <div className="bg-[var(--foreground)] rounded-lg p-4">
                        <p className="text-[var(--text3)] text-sm">
                          {language === 'ro' ? 'Rămas de plată' : 'Remaining amount'}
                        </p>
                        <p className="text-red-600 font-bold text-lg">
                          {formatCurrency(documentWithRelations.paymentSummary.remainingAmount)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex justify-between text-sm text-[var(--text2)] mb-2">
                        <span>{language === 'ro' ? 'Progres plată' : 'Payment progress'}</span>
                        <span>
                          {Math.round((documentWithRelations.paymentSummary.paidAmount / documentWithRelations.paymentSummary.totalAmount) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-[var(--text4)] rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, (documentWithRelations.paymentSummary.paidAmount / documentWithRelations.paymentSummary.totalAmount) * 100)}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-[var(--background)] rounded-2xl p-6 border border-[var(--text4)]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-[var(--text1)] flex items-center gap-2">
                      <Receipt size={20} className="text-green-500" />
                      {language === 'ro' ? 'Documente de Plată' : 'Payment Documents'}
                      <span className="text-sm text-[var(--text3)] bg-[var(--text4)]/20 px-2 py-1 rounded-full">
                        {documentWithRelations?.relatedDocuments?.payments?.length || 0}
                      </span>
                    </h3>
                    {document?.type === 'Invoice' && (
                      <button
                        onClick={() => {
                          setShowAddPayment(true);
                          fetchAvailableDocuments();
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors"
                      >
                        <Plus size={16} />
                        {language === 'ro' ? 'Adaugă Plată' : 'Add Payment'}
                      </button>
                    )}
                  </div>

                  {!documentWithRelations?.relatedDocuments?.payments?.length ? (
                    <div className="text-center py-8 text-[var(--text3)]">
                      <Receipt size={48} className="mx-auto mb-2 opacity-50" />
                      <p>{language === 'ro' ? 'Nu există documente de plată asociate' : 'No payment documents found'}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {documentWithRelations.relatedDocuments.payments.map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between p-4 bg-[var(--foreground)] rounded-lg border border-[var(--text4)]">
                          <div className="flex items-center gap-3">
                            {getDocumentIcon(payment.type)}
                            <div>
                              <p className="font-medium text-[var(--text1)]">{payment.name}</p>
                              <p className="text-sm text-[var(--text3)]">{payment.type}</p>
                              {payment.paymentAmount && (
                                <p className="text-sm text-green-600 font-medium">
                                  {formatCurrency(payment.paymentAmount)}
                                </p>
                              )}
                              {payment.notes && (
                                <p className="text-xs text-[var(--text3)] italic">{payment.notes}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {payment.signedUrl && (
                              <MyTooltip content={language === 'ro' ? 'Vezi document' : 'View document'} trigger={
                                <a
                                  href={payment.signedUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 rounded-lg transition-colors"
                                >
                                  <Eye size={16} />
                                </a>
                              }/>
                            )}
                            <MyTooltip content={language === 'ro' ? 'Elimină asocierea' : 'Remove relation'} trigger={
                              <button
                                onClick={() => handleRemoveRelation(payment.id)}
                                className="p-2 text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                              >
                                <Unlink size={16} />
                              </button>
                            }/>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {((documentWithRelations?.relatedDocuments?.attachments?.length ?? 0) > 0 || 
                  (documentWithRelations?.relatedDocuments?.corrections?.length ?? 0) > 0) && (
                  <div className="bg-[var(--background)] rounded-2xl p-6 border border-[var(--text4)]">
                    <h3 className="text-lg font-semibold text-[var(--text1)] mb-4 flex items-center gap-2">
                      <FileText size={20} className="text-[var(--primary)]" />
                      {language === 'ro' ? 'Alte Documente' : 'Other Documents'}
                    </h3>

                    {(documentWithRelations?.relatedDocuments?.attachments?.length ?? 0) > 0 && (
                      <div className="mb-4">
                        <h4 className="font-medium text-[var(--text1)] mb-2">
                          {language === 'ro' ? 'Atașamente' : 'Attachments'}
                        </h4>
                        <div className="space-y-2">
                          {documentWithRelations?.relatedDocuments?.attachments?.map((attachment) => (
                            <div key={attachment.id} className="flex items-center justify-between p-3 bg-[var(--foreground)] rounded-lg">
                              <div className="flex items-center gap-2">
                                {getDocumentIcon(attachment.type)}
                                <span className="text-[var(--text1)]">{attachment.name}</span>
                              </div>
                              {attachment.signedUrl && (
                                <a
                                  href={attachment.signedUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 text-[var(--primary)] hover:text-[var(--primary)]/80"
                                >
                                  <Eye size={16} />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(documentWithRelations?.relatedDocuments?.corrections?.length ?? 0) > 0 && (
                      <div>
                        <h4 className="font-medium text-[var(--text1)] mb-2">
                          {language === 'ro' ? 'Corecții' : 'Corrections'}
                        </h4>
                        <div className="space-y-2">
                          {documentWithRelations?.relatedDocuments?.corrections?.map((correction) => (
                            <div key={correction.id} className="flex items-center justify-between p-3 bg-[var(--foreground)] rounded-lg">
                              <div className="flex items-center gap-2">
                                {getDocumentIcon(correction.type)}
                                <span className="text-[var(--text1)]">{correction.name}</span>
                              </div>
                              {correction.signedUrl && (
                                <a
                                  href={correction.signedUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 text-[var(--primary)] hover:text-[var(--primary)]/80"
                                >
                                  <Eye size={16} />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {showAddPayment && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
              <div className="bg-[var(--foreground)] rounded-2xl p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold text-[var(--text1)] mb-4">
                  {language === 'ro' ? 'Adaugă Document de Plată' : 'Add Payment Document'}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text1)] mb-2">
                      {language === 'ro' ? 'Selectează document' : 'Select document'}
                    </label>
                    <select
                      value={selectedPaymentDoc || ''}
                      onChange={(e) => setSelectedPaymentDoc(Number(e.target.value))}
                      className="w-full p-3 border border-[var(--text4)] rounded-lg bg-[var(--background)] text-[var(--text1)]"
                    >
                      <option value="">
                        {language === 'ro' ? 'Alege un document...' : 'Choose a document...'}
                      </option>
                      {availableDocuments.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.name} ({doc.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--text1)] mb-2">
                      {language === 'ro' ? 'Suma plătită' : 'Payment amount'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full p-3 border border-[var(--text4)] rounded-lg bg-[var(--background)] text-[var(--text1)]"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--text1)] mb-2">
                      {language === 'ro' ? 'Notițe (opțional)' : 'Notes (optional)'}
                    </label>
                    <textarea
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      className="w-full p-3 border border-[var(--text4)] rounded-lg bg-[var(--background)] text-[var(--text1)]"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleAddPayment}
                    disabled={!selectedPaymentDoc || !paymentAmount}
                    className="flex-1 bg-[var(--primary)] text-white py-2 px-4 rounded-lg hover:bg-[var(--primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {language === 'ro' ? 'Adaugă' : 'Add'}
                  </button>
                  <button
                    onClick={() => setShowAddPayment(false)}
                    className="flex-1 bg-[var(--text4)] text-[var(--text1)] py-2 px-4 rounded-lg hover:bg-[var(--text4)]/80 transition-colors"
                  >
                    {language === 'ro' ? 'Anulează' : 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default RelatedDocumentsModal;
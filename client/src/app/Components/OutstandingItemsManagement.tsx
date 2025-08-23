import { useState } from 'react';
import { 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Edit, 
  Trash2,
  Calendar,
  DollarSign,
  FileText,
  Filter
} from 'lucide-react';
import {
  useGetOutstandingItemsQuery,
  useGetOutstandingItemsAgingQuery,
  useMarkOutstandingItemAsClearedMutation,
  useMarkOutstandingItemAsStaleMutation,
  useVoidOutstandingItemMutation,
  useDeleteOutstandingItemMutation,
  useUpdateOutstandingItemMutation
} from '@/redux/slices/apiSlice';
import { 
  useGetPendingTransferReconciliationsQuery,
  useDeleteTransferReconciliationMutation
} from '@/redux/slices/apiSlice';

interface OutstandingItemsManagementProps {
  clientEin: string;
  language: 'ro' | 'en';
}

interface OutstandingItem {
  id: number;
  type: 'OUTSTANDING_CHECK' | 'DEPOSIT_IN_TRANSIT' | 'PENDING_TRANSFER';
  status: 'OUTSTANDING' | 'CLEARED' | 'STALE' | 'VOIDED';
  referenceNumber: string;
  description: string;
  amount: number;
  issueDate: string;
  expectedClearDate?: string;
  actualClearDate?: string;
  daysOutstanding: number;
  payeeBeneficiary?: string;
  bankAccount?: string;
  notes?: string;
  relatedDocument?: {
    id: number;
    name: string;
    type: string;
  };
  relatedTransaction?: {
    id: string;
    description: string;
    amount: number;
    transactionDate: string;
  };
  createdByUser?: {
    id: number;
    name: string;
  };
}

function OutstandingItemsManagement({ clientEin, language }: OutstandingItemsManagementProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'aging'>('list');
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [editingItem, setEditingItem] = useState<OutstandingItem | null>(null);

  // Pending Transfers integration
  const { data: pendingTransfers, refetch: refetchPendingTransfers, isLoading: pendingTransfersLoading } = useGetPendingTransferReconciliationsQuery(
    { clientEin },
    { skip: !clientEin }
  );
  const [deleteTransferReconciliation, { isLoading: deletingTransfer }] = useDeleteTransferReconciliationMutation();

  // API Hooks
  const { data: outstandingItems, isLoading: itemsLoading, refetch } = useGetOutstandingItemsQuery({
    clientEin,
    type: filterType || undefined,
    status: filterStatus || undefined
  });

  const { data: agingData, isLoading: agingLoading } = useGetOutstandingItemsAgingQuery({
    clientEin
  });


  const [markAsCleared] = useMarkOutstandingItemAsClearedMutation();
  const [markAsStale] = useMarkOutstandingItemAsStaleMutation();
  const [voidItem] = useVoidOutstandingItemMutation();
  const [deleteItem] = useDeleteOutstandingItemMutation();
  const [updateOutstandingItem, { isLoading: updating }] = useUpdateOutstandingItemMutation();

  const getTypeLabel = (type: string) => {
    const labels = {
      'OUTSTANDING_CHECK': language === 'ro' ? 'Cec în Așteptare' : 'Outstanding Check',
      'DEPOSIT_IN_TRANSIT': language === 'ro' ? 'Depozit în Tranzit' : 'Deposit in Transit',
      'PENDING_TRANSFER': language === 'ro' ? 'Transfer în Așteptare' : 'Pending Transfer'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      'OUTSTANDING': language === 'ro' ? 'În Așteptare' : 'Outstanding',
      'CLEARED': language === 'ro' ? 'Compensat' : 'Cleared',
      'STALE': language === 'ro' ? 'Învechit' : 'Stale',
      'VOIDED': language === 'ro' ? 'Anulat' : 'Voided'
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      'OUTSTANDING': 'bg-yellow-100 text-yellow-800',
      'CLEARED': 'bg-green-100 text-green-800',
      'STALE': 'bg-red-100 text-red-800',
      'VOIDED': 'bg-gray-100 text-gray-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getAgingColor = (days: number) => {
    if (days <= 30) return 'text-green-600';
    if (days <= 60) return 'text-yellow-600';
    if (days <= 90) return 'text-orange-600';
    return 'text-red-600';
  };

  const handleMarkAsCleared = async (itemId: number) => {
    try {
      await markAsCleared({
        itemId,
        data: { clearDate: new Date().toISOString() }
      }).unwrap();
      refetch();
    } catch (error) {
      console.error('Error marking item as cleared:', error);
    }
  };

  const handleMarkAsStale = async (itemId: number) => {
    try {
      await markAsStale({
        itemId,
        data: { notes: 'Marked as stale - requires follow-up' }
      }).unwrap();
      refetch();
    } catch (error) {
      console.error('Error marking item as stale:', error);
    }
  };

  const handleVoidItem = async (itemId: number) => {
    try {
      await voidItem({
        itemId,
        data: { notes: 'Item voided' }
      }).unwrap();
      refetch();
    } catch (error) {
      console.error('Error voiding item:', error);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (window.confirm(language === 'ro' ? 'Sigur doriți să ștergeți acest element?' : 'Are you sure you want to delete this item?')) {
      try {
        await deleteItem({ itemId }).unwrap();
        refetch();
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }
  };

  if (itemsLoading || agingLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          {language === 'ro' ? 'Gestionarea Elementelor în Așteptare' : 'Outstanding Items Management'}
        </h2>
        <div className="text-sm text-gray-500">
          {language === 'ro' ? 'Elementele sunt create automat din documente nereconciliate' : 'Items are created automatically from unreconciled documents'}
        </div>
      </div>

      {/* Pending Transfers Section */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-gray-900">{language === 'ro' ? 'Transferuri în așteptare' : 'Pending Transfers'}</h3>
          </div>
          <button
            className="text-xs text-emerald-700 hover:underline"
            onClick={() => refetchPendingTransfers()}
          >
            {language === 'ro' ? 'Reîncarcă' : 'Refresh'}
          </button>
        </div>
        <div className="px-4 py-3">
          {pendingTransfersLoading ? (
            <div className="text-sm text-gray-500">{language === 'ro' ? 'Se încarcă...' : 'Loading...'}</div>
          ) : !pendingTransfers || pendingTransfers.length === 0 ? (
            <div className="text-sm text-gray-500">{language === 'ro' ? 'Nu există transferuri în așteptare' : 'No pending transfers'}</div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-auto scrollbar-soft">
              {pendingTransfers.map((tr: any) => (
                <div key={tr.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">#{tr.id} {tr.description || ''}</div>
                    <div className="text-xs text-gray-500 truncate">{tr.createdAt ? new Date(tr.createdAt).toLocaleString() : ''}</div>
                  </div>
                  <button
                    className={`ml-3 px-2 py-1 text-xs rounded-md ${deletingTransfer ? 'bg-red-300 text-white cursor-wait' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                    onClick={async () => {
                      try {
                        await deleteTransferReconciliation({ clientEin, id: tr.id }).unwrap();
                        refetchPendingTransfers();
                      } catch (error: any) {
                        if (error?.status === 401 || error?.data?.statusCode === 401) {
                          window.location.href = '/authentication';
                          return;
                        }
                        alert((language === 'ro' ? 'Eroare: ' : 'Error: ') + (error?.data?.message || error?.message || 'Unknown error'));
                      }
                    }}
                  >
                    {language === 'ro' ? 'Șterge' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'list'
              ? 'bg-[var(--primary)] text-white shadow-sm'
              : 'text-[var(--primary)] hover:text-gray-900 bg-white'
          }`}
        >
          {language === 'ro' ? 'Listă Elemente' : 'Items List'}
        </button>
        <button
          onClick={() => setActiveTab('aging')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'aging'
              ? 'bg-[var(--primary)] text-white shadow-sm'
              : 'text-[var(--primary)] hover:text-gray-900 bg-white'
          }`}
        >
          {language === 'ro' ? 'Analiza Vechimii' : 'Aging Analysis'}
        </button>
      </div>

      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border border-gray-300 bg-white text-gray-500 focus:outline-0 focus:ring-0 rounded-md px-3 py-1 text-sm"
              >
                <option value="">{language === 'ro' ? 'Toate Tipurile' : 'All Types'}</option>
                <option value="OUTSTANDING_CHECK">{language === 'ro' ? 'Cecuri în Așteptare' : 'Outstanding Checks'}</option>
                <option value="DEPOSIT_IN_TRANSIT">{language === 'ro' ? 'Depozite în Tranzit' : 'Deposits in Transit'}</option>
                <option value="PENDING_TRANSFER">{language === 'ro' ? 'Transferuri în Așteptare' : 'Pending Transfers'}</option>
              </select>
            </div>
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-300 bg-white text-gray-500 focus:outline-0 focus:ring-0 rounded-md px-3 py-1 text-sm"
              >
                <option value="">{language === 'ro' ? 'Toate Statusurile' : 'All Statuses'}</option>
                <option value="OUTSTANDING">{language === 'ro' ? 'În Așteptare' : 'Outstanding'}</option>
                <option value="CLEARED">{language === 'ro' ? 'Compensat' : 'Cleared'}</option>
                <option value="STALE">{language === 'ro' ? 'Învechit' : 'Stale'}</option>
                <option value="VOIDED">{language === 'ro' ? 'Anulat' : 'Voided'}</option>
              </select>
            </div>
          </div>

          {/* Items List */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {outstandingItems?.items?.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {language === 'ro' ? 'Nu există elemente în așteptare' : 'No outstanding items found'}
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-soft">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {language === 'ro' ? 'Tip' : 'Type'}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {language === 'ro' ? 'Referință' : 'Reference'}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {language === 'ro' ? 'Descriere' : 'Description'}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {language === 'ro' ? 'Sumă' : 'Amount'}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {language === 'ro' ? 'Vechime' : 'Age'}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {language === 'ro' ? 'Status' : 'Status'}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {language === 'ro' ? 'Acțiuni' : 'Actions'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {outstandingItems?.items?.map((item: OutstandingItem) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getTypeLabel(item.type)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.referenceNumber}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                          {item.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.amount.toFixed(2)} RON
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`font-medium ${getAgingColor(item.daysOutstanding)}`}>
                            {item.daysOutstanding} {language === 'ro' ? 'zile' : 'days'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status)}`}>
                            {getStatusLabel(item.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            {item.status === 'OUTSTANDING' && (
                              <>
                                <button
                                  onClick={() => handleMarkAsCleared(item.id)}
                                  className="bg-green-100 text-emerald-500 hover:bg-emerald-200 transition-colors rounded-md p-1"
                                  title={language === 'ro' ? 'Marchează ca Compensat' : 'Mark as Cleared'}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleMarkAsStale(item.id)}
                                  className="bg-orange-100 text-orange-500 hover:bg-orange-200 transition-colors rounded-md p-1"
                                  title={language === 'ro' ? 'Marchează ca Învechit' : 'Mark as Stale'}
                                >
                                  <AlertTriangle className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleVoidItem(item.id)}
                                  className="bg-red-100 text-red-500 hover:bg-red-200 transition-colors rounded-md p-1"
                                  title={language === 'ro' ? 'Anulează' : 'Void'}
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => setEditingItem(item)}
                              className="bg-blue-100 text-blue-500 hover:bg-blue-200 transition-colors rounded-md p-1"
                              title={language === 'ro' ? 'Editează' : 'Edit'}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="bg-red-100 text-red-500 hover:bg-red-200 transition-colors rounded-md p-1"
                              title={language === 'ro' ? 'Șterge' : 'Delete'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'aging' && agingData && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    {language === 'ro' ? 'Total Elemente' : 'Total Items'}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {agingData.summary?.totalOutstandingItems || 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    {language === 'ro' ? 'Sumă Totală' : 'Total Amount'}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {agingData.summary?.totalOutstandingAmount?.toFixed(2) || '0.00'} RON
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    {language === 'ro' ? 'Cel Mai Vechi' : 'Oldest Item'}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {agingData.summary?.oldestItem || 0} {language === 'ro' ? 'zile' : 'days'}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    {language === 'ro' ? 'Vechime Medie' : 'Average Age'}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {agingData.summary?.averageAge || 0} {language === 'ro' ? 'zile' : 'days'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Aging Buckets */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {language === 'ro' ? 'Analiza Vechimii' : 'Aging Analysis'}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {language === 'ro' ? 'Perioada' : 'Period'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {language === 'ro' ? 'Numărul de Elemente' : 'Number of Items'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {language === 'ro' ? 'Suma Totală' : 'Total Amount'}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      {language === 'ro' ? 'Curent (0-30 zile)' : 'Current (0-30 days)'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {agingData.agingBuckets?.current?.count || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {agingData.agingBuckets?.current?.totalAmount?.toFixed(2) || '0.00'} RON
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-yellow-600">
                      {language === 'ro' ? '31-60 zile' : '31-60 days'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {agingData.agingBuckets?.thirtyDays?.count || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {agingData.agingBuckets?.thirtyDays?.totalAmount?.toFixed(2) || '0.00'} RON
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">
                      {language === 'ro' ? '61-90 zile' : '61-90 days'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {agingData.agingBuckets?.sixtyDays?.count || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {agingData.agingBuckets?.sixtyDays?.totalAmount?.toFixed(2) || '0.00'} RON
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                      {language === 'ro' ? 'Peste 90 zile' : 'Over 90 days'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {agingData.agingBuckets?.overNinety?.count || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {agingData.agingBuckets?.overNinety?.totalAmount?.toFixed(2) || '0.00'} RON
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal - Simplified for status updates only */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {language === 'ro' ? 'Actualizează Status' : 'Update Status'}
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="bg-red-200 text-red-500 hover:bg-red-500 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <SimpleEditForm
              language={language}
              item={editingItem}
              onCancel={() => setEditingItem(null)}
              onSubmit={async (form) => {
                try {
                  await updateOutstandingItem({ itemId: editingItem.id, data: form }).unwrap();
                  setEditingItem(null);
                  refetch();
                } catch (e) {
                  console.error('Update outstanding item failed', e);
                  alert(language === 'ro' ? 'Actualizarea a eșuat' : 'Update failed');
                }
              }}
              submitting={updating}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ----- Simplified Edit Form -----
function SimpleEditForm({
  language,
  item,
  onCancel,
  onSubmit,
  submitting
}: {
  language: 'ro' | 'en';
  item: OutstandingItem;
  onCancel: () => void;
  onSubmit: (form: {
    status?: 'OUTSTANDING' | 'CLEARED' | 'STALE' | 'VOIDED';
    actualClearDate?: string;
    notes?: string;
    relatedTransactionId?: string;
  }) => void | Promise<void>;
  submitting: boolean;
}) {
  const [form, setForm] = useState({
    status: item.status as 'OUTSTANDING' | 'CLEARED' | 'STALE' | 'VOIDED',
    actualClearDate: item.actualClearDate ? item.actualClearDate.slice(0, 10) : '',
    notes: item.notes || '',
    relatedTransactionId: item.relatedTransaction?.id || ''
  });

  const label = (ro: string, en: string) => (language === 'ro' ? ro : en);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const payload = {
          ...form,
          actualClearDate: form.actualClearDate || undefined,
          notes: form.notes || undefined,
          relatedTransactionId: form.relatedTransactionId || undefined
        };
        await onSubmit(payload);
      }}
      className="px-6 py-4 space-y-4"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">{label('Status', 'Status')}</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as any })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          >
            <option value="OUTSTANDING">{label('În Așteptare', 'Outstanding')}</option>
            <option value="CLEARED">{label('Compensat', 'Cleared')}</option>
            <option value="STALE">{label('Învechit', 'Stale')}</option>
            <option value="VOIDED">{label('Anulat', 'Voided')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">{label('Data Compensării', 'Actual Clear Date')}</label>
          <input
            type="date"
            value={form.actualClearDate}
            onChange={(e) => setForm({ ...form, actualClearDate: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">{label('Note', 'Notes')}</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            rows={3}
          />
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3 border-t pt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md border text-gray-700">
          {label('Anulează', 'Cancel')}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? label('Se salvează...', 'Saving...') : label('Salvează', 'Save')}
        </button>
      </div>
    </form>
  );
}

export default OutstandingItemsManagement;

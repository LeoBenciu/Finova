interface PendingTransferItem {
  id: number;
  description?: string | null;
}

interface PendingTransfersListProps {
  language: string;
  items: PendingTransferItem[];
  deleting: boolean;
  onRefresh: () => void;
  onDelete: (id: number) => Promise<void> | void;
}

export default function PendingTransfersList({
  language,
  items,
  deleting,
  onRefresh,
  onDelete,
}: PendingTransfersListProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className="bg-[var(--foreground)] border border-[var(--text4)] rounded-2xl p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-[var(--text1)]">
          {language === 'ro' ? 'Transferuri în așteptare' : 'Pending Transfers'}
        </h4>
        <button className="text-sm text-[var(--primary)] hover:underline" onClick={onRefresh}>
          {language === 'ro' ? 'Reîncarcă' : 'Refresh'}
        </button>
      </div>
      <div className="space-y-2">
        {items.map((tr) => (
          <div key={tr.id} className="flex items-center justify-between bg-[var(--background)] border border-[var(--text4)] rounded-lg px-3 py-2">
            <div className="text-sm text-[var(--text2)] truncate">
              <span className="font-medium text-[var(--text1)] mr-2">#{tr.id}</span>
              <span>{tr.description || ''}</span>
            </div>
            <button
              className={`px-2 py-1 text-xs rounded-lg ${deleting ? 'bg-red-300 text-white cursor-wait' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
              onClick={() => onDelete(tr.id)}
              disabled={deleting}
            >
              {language === 'ro' ? 'Șterge' : 'Delete'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

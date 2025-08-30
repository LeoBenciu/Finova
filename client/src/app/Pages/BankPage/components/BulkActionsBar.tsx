import { X } from 'lucide-react';

interface BulkActionsBarProps {
  language: string;
  selectedCount: number;
  selectedTransactionsCount: number;
  onDeselectAll: () => void;
  onOpenTransfer: () => void;
  onClose: () => void;
}

export default function BulkActionsBar({
  language,
  selectedCount,
  selectedTransactionsCount,
  onDeselectAll,
  onOpenTransfer,
  onClose,
}: BulkActionsBarProps) {
  const canTransfer = selectedTransactionsCount === 2;

  return (
    <div className="bg-[var(--foreground)] border border-[var(--primary)] text-[var(--text1)] rounded-2xl p-4 mb-6 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-[var(--primary)]">
            {selectedCount} {language === 'ro' ? 'elemente selectate' : 'items selected'}
          </span>
          <button
            onClick={onDeselectAll}
            className="text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 transition-colors text-sm px-3 py-1 rounded-lg"
          >
            {language === 'ro' ? 'Deselectează toate' : 'Deselect all'}
          </button>
          <button
            onClick={onOpenTransfer}
            className={`text-white text-sm px-3 py-1 rounded-lg transition-colors ${canTransfer ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-300 cursor-not-allowed'}`}
            disabled={!canTransfer}
            title={language === 'ro' ? 'Marchează ca Transfer' : 'Mark as Transfer'}
          >
            {language === 'ro' ? 'Transfer' : 'Transfer'}
          </button>
        </div>

        <button
          onClick={onClose}
          className="p-2 bg-[var(--background)] text-[var(--text3)] hover:text-red-500 hover:bg-red-500/20 rounded-lg transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

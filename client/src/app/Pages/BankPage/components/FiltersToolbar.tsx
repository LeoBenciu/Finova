import React from 'react';
import { Search, CheckSquare, Square, Loader2, Clock } from 'lucide-react';

interface FiltersToolbarProps {
  language: string;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  excludeOutstanding: boolean;
  setExcludeOutstanding: (fn: (prev: boolean) => boolean) => void;
  showBulkActions: boolean;
  isCreatingBulkMatches: boolean;
  handleBulkAction: (action: 'match_selected' | 'ignore_selected') => void;
  setShowOutstandingPanel: (v: boolean) => void;
}

const FiltersToolbar: React.FC<FiltersToolbarProps> = ({
  language,
  searchTerm,
  setSearchTerm,
  filterStatus,
  setFilterStatus,
  excludeOutstanding,
  setExcludeOutstanding,
  showBulkActions,
  isCreatingBulkMatches,
  handleBulkAction,
  setShowOutstandingPanel,
}) => {
  return (
    <div className="bg-[var(--foreground)] rounded-2xl p-4 border border-[var(--text4)] shadow-sm mb-6">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-64">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--text3)]" size={18} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-[var(--background)] border border-[var(--text4)] rounded-xl \
                focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent\n                text-[var(--text1)] placeholder:text-[var(--text3)]"
              placeholder={language === 'ro' ? 'Caută documente sau tranzacții...' : 'Search documents or transactions...'}
            />
          </div>
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-3 bg-[var(--background)] border border-[var(--text4)] rounded-xl \
            focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--text1)]"
        >
          <option value="all">{language === 'ro' ? 'Toate statusurile' : 'All statuses'}</option>
          <option value="unreconciled">{language === 'ro' ? 'Nereconciliate' : 'Unreconciled'}</option>
          <option value="reconciled">{language === 'ro' ? 'Reconciliate' : 'Reconciled'}</option>
          <option value="ignored">{language === 'ro' ? 'Ignorate' : 'Ignored'}</option>
        </select>

        {/* Outstanding toggle */}
        <div className="flex items-center gap-2 text-sm text-[var(--text1)] select-none">
          <button
            type="button"
            onClick={() => setExcludeOutstanding(prev => !prev)}
            aria-pressed={excludeOutstanding}
            aria-label={language === 'ro' ? 'Filtrează elementele în așteptare' : 'Filter outstanding items'}
            className="p-1 hover:bg-[var(--text4)]/20 bg-transparent rounded-lg transition-colors"
          >
            {excludeOutstanding ? (
              <CheckSquare size={20} className="text-[var(--primary)]" />
            ) : (
              <Square size={20} className="text-[var(--text3)]" />
            )}
          </button>
          <span>
            {language === 'ro' ? 'În așteptare' : 'Outstanding'}
          </span>
        </div>

        {/* Bulk Actions */}
        {showBulkActions && (
          <div className="flex gap-2">
            <button 
              onClick={() => handleBulkAction('match_selected')}
              disabled={isCreatingBulkMatches}
              className="px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {isCreatingBulkMatches && <Loader2 size={14} className="animate-spin" />}
              {language === 'ro' ? 'Reconciliază' : 'Match'}
            </button>
            <button 
              onClick={() => handleBulkAction('ignore_selected')}
              className="px-4 py-2 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-colors text-sm font-medium"
            >
              {language === 'ro' ? 'Ignoră' : 'Ignore'}
            </button>
          </div>
        )}

        {/* Open Outstanding Items management panel */}
        <button
          type="button"
          onClick={() => setShowOutstandingPanel(true)}
          className="relative group p-2 bg-[var(--primary)]/30 text-[var(--primary)] rounded-xl hover:bg-[var(--primary)] hover:text-white cursor-pointer transition-colors"
          title={language === 'ro' ? 'Administrează elementele în așteptare' : 'Manage Outstanding Items'}
          aria-label={language === 'ro' ? 'Elemente în Așteptare' : 'Outstanding Items'}
        >
          <Clock size={16} />
          <span
            className="absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity"
          >
            {language === 'ro' ? 'Elemente în Așteptare' : 'Outstanding Items'}
          </span>
        </button>
      </div>
    </div>
  );
};

export default FiltersToolbar;

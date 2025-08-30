import React from 'react';

interface TransferModalProps {
  open: boolean;
  language: 'ro' | 'en' | string;
  fxRate: string;
  notes: string;
  onChange: (field: 'fxRate' | 'notes', value: string) => void;
  creating: boolean;
  onCancel: () => void;
  onSave: () => void | Promise<void>;
}

const TransferModal: React.FC<TransferModalProps> = ({
  open,
  language,
  fxRate,
  notes,
  onChange,
  creating,
  onCancel,
  onSave,
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel}></div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-2xl shadow-xl">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {language === 'ro' ? 'Marchează Transfer' : 'Mark Transfer'}
          </h3>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            {language === 'ro'
              ? 'Conturile analitice vor fi atribuite automat pe baza mapping-ului IBAN. Completați doar cursul (dacă este necesar) și notițele.'
              : 'Analytic accounts will be assigned automatically based on IBAN mappings. Only fill FX (if needed) and notes.'}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">FX</label>
              <input
                type="number"
                step="0.0001"
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={fxRate}
                onChange={(e) => onChange('fxRate', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'ro' ? 'Notițe' : 'Notes'}</label>
              <input
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={notes}
                onChange={(e) => onChange('notes', e.target.value)}
                placeholder={language === 'ro' ? 'Optional' : 'Optional'}
              />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex items-center justify-end gap-2">
          <button className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200" onClick={onCancel}>
            {language === 'ro' ? 'Anulează' : 'Cancel'}
          </button>
          <button
            className={`px-4 py-2 rounded-lg text-white ${creating ? 'bg-emerald-400 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-700'}`}
            onClick={onSave}
            disabled={creating}
          >
            {creating ? (language === 'ro' ? 'Se salvează...' : 'Saving...') : (language === 'ro' ? 'Salvează' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferModal;

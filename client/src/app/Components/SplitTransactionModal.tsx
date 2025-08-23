import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Minus, Loader2, AlertTriangle } from 'lucide-react';
import { useGetTransactionSplitsQuery, useSetTransactionSplitsMutation, useSuggestTransactionSplitsMutation } from '@/redux/slices/apiSlice';

type SplitRow = {
  amount: number | '';
  accountCode: string;
  notes?: string;
};

interface SplitTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: {
    id: string;
    amount: number;
    description?: string;
    transactionType?: 'credit' | 'debit' | string;
    referenceNumber?: string;
    transactionDate?: string | Date;
  } | null;
  language?: 'ro' | 'en';
}

const currencyFormat = (n: number) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'RON', maximumFractionDigits: 2 }).format(n);
  } catch {
    return n.toFixed(2);
  }
};

export default function SplitTransactionModal({ isOpen, onClose, transaction, language = 'ro' }: SplitTransactionModalProps) {
  const txnId = transaction?.id || '';
  const txnAbsAmount = Math.abs(transaction?.amount || 0);
  const { data: existingSplits, isFetching, refetch } = useGetTransactionSplitsQuery(
    { transactionId: txnId },
    { skip: !isOpen || !txnId }
  );
  const [setSplits, { isLoading: isSaving } ] = useSetTransactionSplitsMutation();
  const [suggestSplits, { isLoading: isSuggesting } ] = useSuggestTransactionSplitsMutation();

  const [rows, setRows] = useState<SplitRow[]>([{ amount: '', accountCode: '', notes: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [activeSuggestIdx, setActiveSuggestIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (existingSplits && Array.isArray(existingSplits) && existingSplits.length > 0) {
      setRows(existingSplits.map((s: any) => ({
        amount: Math.abs(Number(s.amount ?? s.value ?? 0)) || 0,
        accountCode: s.account?.accountCode || s.accountCode || '',
        notes: s.notes || ''
      })));
    } else if (txnAbsAmount > 0) {
      // Default to one row with full amount
      setRows([{ amount: Number(txnAbsAmount.toFixed(2)), accountCode: '', notes: '' }]);
    }
  }, [isOpen, existingSplits, txnAbsAmount]);

  const total = useMemo(() => {
    const sum = rows.reduce((acc, r) => acc + (typeof r.amount === 'number' ? r.amount : 0), 0);
    return Number(sum.toFixed(2));
  }, [rows]);

  const remaining = useMemo(() => Number((txnAbsAmount - total).toFixed(2)), [txnAbsAmount, total]);

  const addRow = () => setRows(prev => [...prev, { amount: '', accountCode: '', notes: '' }]);
  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx));

  const updateRow = (idx: number, patch: Partial<SplitRow>) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };

  const onSuggest = async () => {
    if (!transaction) return;
    setError(null);
    try {
      const res = await suggestSplits({ transactionId: transaction.id }).unwrap();
      const suggested = Array.isArray(res?.splits) ? res.splits : [];
      if (suggested.length === 0) {
        setError(language === 'ro' ? 'Nicio sugestie disponibilă pentru această tranzacție.' : 'No suggestions available for this transaction.');
        return;
      }
      const newRows: SplitRow[] = suggested.map((s: any) => ({
        amount: Math.abs(Number(s.amount) || 0),
        accountCode: s.accountCode || s?.chartOfAccount?.accountCode || '',
        notes: s.notes || ''
      }));
      setRows(newRows.length > 0 ? newRows : [{ amount: '', accountCode: '', notes: '' }]);
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || 'Unknown error';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  // Build suggestions for account codes: from existing splits and recent local storage
  const recentCodes: { code: string; name?: string }[] = useMemo(() => {
    try {
      const raw = localStorage.getItem('recentAccountCodes');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((x) => typeof x?.code === 'string');
    } catch {}
    return [];
  }, []);

  const existingCodes: { code: string; name?: string }[] = useMemo(() => {
    if (!existingSplits || !Array.isArray(existingSplits)) return [];
    const set = new Map<string, { code: string; name?: string }>();
    for (const s of existingSplits) {
      const code = s?.account?.accountCode || s?.accountCode;
      const name = s?.account?.accountName || s?.account?.name;
      if (code && !set.has(code)) set.set(code, { code, name });
    }
    return Array.from(set.values());
  }, [existingSplits]);

  const allSuggestions = useMemo(() => {
    const map = new Map<string, { code: string; name?: string }>();
    [...existingCodes, ...recentCodes].forEach((x) => {
      if (!map.has(x.code)) map.set(x.code, x);
    });
    return Array.from(map.values());
  }, [existingCodes, recentCodes]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setActiveSuggestIdx(null);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const validate = (): string | null => {
    // Basic validation
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.amount === '' || Number.isNaN(Number(r.amount))) {
        return (language === 'ro' ? `Valoare lipsă pe rândul ${i + 1}` : `Missing amount on row ${i + 1}`);
      }
      if (Number(r.amount) <= 0) {
        return (language === 'ro' ? `Suma trebuie să fie > 0 la rândul ${i + 1}` : `Amount must be > 0 on row ${i + 1}`);
      }
      if (!r.accountCode?.trim()) {
        return (language === 'ro' ? `Cont contabil lipsă la rândul ${i + 1}` : `Missing account code on row ${i + 1}`);
      }
    }
    // Sum validation with small tolerance
    if (Math.abs(remaining) > 0.01) {
      return (language === 'ro' ? 'Totalul împărțirilor trebuie să egaleze suma tranzacției' : 'Sum of splits must equal the transaction amount');
    }
    return null;
  };

  const onSave = async () => {
    if (!transaction) return;
    const v = validate();
    setError(v);
    if (v) return;
    try {
      const payload = rows.map(r => ({ amount: Number(Number(r.amount).toFixed(2)), accountCode: r.accountCode.trim(), notes: r.notes?.trim() || undefined }));
      await setSplits({ transactionId: transaction.id, splits: payload }).unwrap();
      // Store recent account codes
      try {
        const current = new Map<string, { code: string; name?: string }>();
        for (const r of rows) {
          if (r.accountCode?.trim()) current.set(r.accountCode.trim(), { code: r.accountCode.trim() });
        }
        const prevRaw = localStorage.getItem('recentAccountCodes');
        if (prevRaw) {
          const prev = JSON.parse(prevRaw);
          if (Array.isArray(prev)) {
            for (const p of prev) {
              if (p?.code && !current.has(p.code)) current.set(p.code, { code: p.code, name: p.name });
            }
          }
        }
        localStorage.setItem('recentAccountCodes', JSON.stringify(Array.from(current.values()).slice(0, 50)));
      } catch {}
      await refetch();
      onClose();
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || 'Unknown error';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div>
            <h3 className="text-lg text-left font-semibold text-gray-900">{language === 'ro' ? 'Împarte Tranzacția' : 'Split Transaction'}</h3>
            <p className="text-sm text-gray-500">
              {transaction.description || ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-red-500 hover:text-white text-neutral-800 bg-neutral-200">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{language === 'ro' ? 'Suma Tranzacției' : 'Transaction Amount'}:</span>
            <span className="font-semibold text-black">{currencyFormat(txnAbsAmount)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{language === 'ro' ? 'Total Împărțiri' : 'Total Splits'}:</span>
            <span className="font-semibold text-black">{currencyFormat(total)}</span>
          </div>
          <div className={`flex items-center justify-between text-sm ${Math.abs(remaining) < 0.01 ? 'text-emerald-500' : 'text-orange-500'}`}>
            <span>{language === 'ro' ? 'Rămas' : 'Remaining'}:</span>
            <span className="font-semibold">{currencyFormat(remaining)}</span>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">
              <AlertTriangle size={16} className="mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="border rounded-xl overflow-hidden" ref={containerRef}>
            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 text-xs font-medium text-gray-600">
              <div className="col-span-3">{language === 'ro' ? 'Sumă' : 'Amount'}</div>
              <div className="col-span-4">{language === 'ro' ? 'Cont Contabil (cod)' : 'Account Code'}</div>
              <div className="col-span-4">{language === 'ro' ? 'Note' : 'Notes'}</div>
              <div className="col-span-1"></div>
            </div>
            <div className="divide-y">
              {rows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center">
                  <div className="col-span-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-black focus:shadow-none"
                      value={row.amount}
                      onChange={(e) => updateRow(idx, { amount: e.target.value === '' ? '' : Number(e.target.value) })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-span-4 relative">
                    <input
                      type="text"
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-black focus:shadow-none"
                      value={row.accountCode}
                      onChange={(e) => {
                        updateRow(idx, { accountCode: e.target.value });
                        setActiveSuggestIdx(idx);
                      }}
                      onFocus={() => setActiveSuggestIdx(idx)}
                      placeholder={language === 'ro' ? 'Ex: 704, 5311' : 'e.g. 704, 5311'}
                    />
                    {activeSuggestIdx === idx && allSuggestions.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-md max-h-44 overflow-auto">
                        {allSuggestions
                          .filter(s => !row.accountCode || s.code.toLowerCase().includes(row.accountCode.toLowerCase()) || (s.name || '').toLowerCase().includes(row.accountCode.toLowerCase()))
                          .slice(0, 20)
                          .map((s) => (
                            <button
                              key={s.code}
                              type="button"
                              className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100"
                              onClick={() => {
                                updateRow(idx, { accountCode: s.code });
                                setActiveSuggestIdx(null);
                              }}
                            >
                              <span className="font-medium mr-2">{s.code}</span>
                              <span className="text-gray-500">{s.name || ''}</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                  <div className="col-span-4">
                    <input
                      type="text"
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-black focus:shadow-none"
                      value={row.notes || ''}
                      onChange={(e) => updateRow(idx, { notes: e.target.value })}
                      placeholder={language === 'ro' ? 'Opțional' : 'Optional'}
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                      onClick={() => removeRow(idx)}
                      disabled={rows.length <= 1}
                      title={language === 'ro' ? 'Șterge rând' : 'Remove row'}
                    >
                      <Minus size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={addRow} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 text-black hover:bg-gray-400 hover:text-white text-sm font-medium">
              <Plus size={16} /> {language === 'ro' ? 'Adaugă rând' : 'Add row'}
            </button>
            <button
              onClick={onSuggest}
              disabled={isSuggesting || isFetching}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:brightness-110 disabled:opacity-60 text-sm font-medium"
            >
              {isSuggesting ? <Loader2 size={16} className="animate-spin" /> : null}
              {language === 'ro' ? 'Sugerează împărțiri' : 'Suggest splits'}
            </button>
          </div>
        </div>

        <div className="px-5 py-4 border-t flex items-center justify-end gap-2 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white border text-gray-700 hover:bg-gray-50 text-sm font-medium">
            {language === 'ro' ? 'Anulează' : 'Cancel'}
          </button>
          <button
            onClick={onSave}
            disabled={isSaving || isFetching}
            className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white hover:brightness-110 disabled:opacity-60 inline-flex items-center gap-2 text-sm font-medium"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
            {language === 'ro' ? 'Salvează Împărțirea' : 'Save Splits'}
          </button>
        </div>
      </div>
    </div>
  );
}

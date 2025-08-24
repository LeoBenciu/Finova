import { useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus, Search, CalendarDays, Flag, Loader2, Edit2, Trash2, X, CheckCircle2 } from 'lucide-react';
import todosIllustration from '@/assets/todos.svg';
import { useGetTodosQuery, useCreateTodoMutation, useUpdateTodoMutation, useDeleteTodoMutation, useGetUserDataQuery, useGetCompanyUsersQuery } from '@/redux/slices/apiSlice';

const TodosPage = () => {
  const language = useSelector((state: { user: { language: string } }) => state.user.language);
  const clientEin = useSelector((state: { clientCompany: { current: { ein: string } } }) => state.clientCompany.current.ein);

  // Local placeholder state until API is wired
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'pending'|'in_progress'|'completed'|'all'>('all');
  const [priority, setPriority] = useState<'low'|'medium'|'high'|'all'>('all');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<{ title: string; description?: string; dueDate?: string; status: 'pending'|'in_progress'|'completed'; priority: 'low'|'medium'|'high'; tags: string[]; assignedToId?: number | null }>(
    { title: '', description: '', dueDate: '', status: 'pending', priority: 'medium', tags: [], assignedToId: null }
  );
  const dueInputRef = useRef<HTMLInputElement | null>(null);

  // Current user (used for Assign to me / Unassign actions)
  const { data: me } = useGetUserDataQuery(undefined);

  const [createTodo, { isLoading: creating }] = useCreateTodoMutation();
  const [updateTodo, { isLoading: updating }] = useUpdateTodoMutation();
  const [deleteTodo, { isLoading: deleting }] = useDeleteTodoMutation();

  // UI helpers

  const avatarFor = (nameOrEmail?: string) => {
    const base = (nameOrEmail || '').trim();
    if (!base) return { initials: '?', color: '#6B7280' };
    const parts = base.includes('@') ? base.split('@')[0].split(/[\.\-_\s]+/) : base.split(/[\s]+/);
    const initials = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
    const hash = Array.from(base).reduce((a, c) => a + c.charCodeAt(0), 0);
    const palette = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#DC2626', '#0EA5E9'];
    return { initials: initials.toUpperCase() || base[0]?.toUpperCase() || '?', color: palette[hash % palette.length] };
  };

  const t = useMemo(() => ({
    title: language === 'ro' ? 'Sarcini Contabile' : 'Accounting TODOs',
    subtitle: language === 'ro' ? 'Planifica, urmărește și finalizează sarcinile echipei' : 'Plan, track, and complete your team tasks',
    create: language === 'ro' ? 'Adaugă sarcină' : 'Add Task',
    searchPlaceholder: language === 'ro' ? 'Caută după titlu, etichete, asignat...' : 'Search by title, tags, assignee...',
    filters: language === 'ro' ? 'Filtre' : 'Filters',
    status: language === 'ro' ? 'Status' : 'Status',
    priority: language === 'ro' ? 'Prioritate' : 'Priority',
    assignee: language === 'ro' ? 'Asignat' : 'Assignee',
    due: language === 'ro' ? 'Scadență' : 'Due',
    tags: language === 'ro' ? 'Etichete' : 'Tags',
    empty: language === 'ro' ? 'Nicio sarcină încă. Adaugă o sarcină pentru a începe.' : 'No tasks yet. Add a task to get started.',
    titleLabel: language === 'ro' ? 'Titlu' : 'Title',
    descLabel: language === 'ro' ? 'Descriere' : 'Description',
    dueLabel: language === 'ro' ? 'Data scadenței' : 'Due date',
    save: language === 'ro' ? 'Salvează' : 'Save',
    cancel: language === 'ro' ? 'Anulează' : 'Cancel',
    edit: language === 'ro' ? 'Editează' : 'Edit',
    del: language === 'ro' ? 'Șterge' : 'Delete',
    confirmDelete: language === 'ro' ? 'Sigur dorești să ștergi această sarcină?' : 'Are you sure you want to delete this task?',
    assignToMe: language === 'ro' ? 'Atribuie-mi mie' : 'Assign to me',
    unassign: language === 'ro' ? 'Anulează atribuire' : 'Unassign',
    unassigned: language === 'ro' ? 'Neatribuit' : 'Unassigned',
    addTagPlaceholder: language === 'ro' ? 'Adaugă etichete și apasă Enter' : 'Add tags and press Enter',
  }), [language]);

  const mapStatusQuery = (s: typeof status) => {
    if (s === 'all') return 'all' as const;
    return (s === 'in_progress' ? 'IN_PROGRESS' : s.toUpperCase()) as any;
  };
  const mapPriorityQuery = (p: typeof priority) => {
    if (p === 'all') return 'all' as const;
    return p.toUpperCase() as any;
  };

  const { data, isLoading, isFetching, error } = useGetTodosQuery(
    clientEin
      ? {
          clientEin,
          page,
          size,
          status: mapStatusQuery(status),
          priority: mapPriorityQuery(priority),
        }
      : ({} as any),
    { skip: !clientEin }
  );

  const items: any[] = Array.isArray((data as any)?.items)
    ? (data as any).items
    : Array.isArray(data)
    ? (data as any)
    : [];
  const total: number = (data as any)?.total ?? items.length ?? 0;

  console.log("ITEMS:",items)

  // Company users for assignee dropdown (optional endpoint)
  const { data: companyUsers } = useGetCompanyUsersQuery();

  const statusLc = (s: any) => (s || '').toString().toLowerCase();


  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="mb-2">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-[var(--primary)] to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
            <CheckCircle2 size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-[var(--text1)] mb-1 text-left">{t.title}</h1>
            <p className="text-[var(--text2)] text-left">{t.subtitle}</p>
          </div>
          <div className="ml-auto">
            <button
              onClick={() => {
                setEditing(null);
                setForm({ title: '', description: '', dueDate: '', status: 'pending', priority: 'medium', tags: [], assignedToId: null });
                setShowModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition disabled:opacity-50"
              disabled={!clientEin}
            >
              <Plus size={18} /> {t.create}
            </button>
          </div>
        </div>
      </div>

      {/* Filters row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="col-span-1 lg:col-span-2 flex items-center gap-2 border border-[var(--text4)] rounded-lg px-3 py-2 bg-white">
          <Search size={18} className="text-[var(--text3)]" />
          <input
            className="w-full bg-white outline-none text-black focus:shadow-none focus:ring-0"
            placeholder={t.searchPlaceholder}
            value={query}
            onChange={(e) => { setPage(1); setQuery(e.target.value); }}
          />
        </div>
        <div className="col-span-1 flex items-center gap-2 border border-[var(--text4)] rounded-lg px-3 py-2 bg-white">
          <Flag size={18} className="text-[var(--text3)]" />
          <select className="bg-white outline-none w-full text-black" value={priority} onChange={(e)=>{ setPage(1); setPriority(e.target.value as any); }}>
            <option value="all">{language==='ro'?'Toate':'All'}</option>
            <option value="high">{language==='ro'?'Mare':'High'}</option>
            <option value="medium">{language==='ro'?'Medie':'Medium'}</option>
            <option value="low">{language==='ro'?'Mică':'Low'}</option>
          </select>
        </div>
      </div>

      {/* Pills: ALL / ACTIVE / COMPLETED */}
      <div className="flex items-center gap-2">
        {[
          { key: 'active', label: language==='ro'?'Active':'Active' },
          { key: 'completed', label: language==='ro'?'Finalizate':'Completed' },
        ].map(p => (
          <button
            key={p.key}
            className={`px-3 py-1.5 rounded-full text-sm border ${
              (p.key==='all' && status==='all') || (p.key==='completed' && status==='completed') || (p.key==='active' && status==='pending')
              ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-white text-[var(--text1)] border-[var(--text4)]'
            }`}
            onClick={() => {
              if (p.key==='all') setStatus('all');
              else if (p.key==='completed') setStatus('completed');
              else setStatus('pending'); // Active should show pending todos
              setPage(1);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Main grid: left rail + content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Content column */}
        <div className="lg:col-span-3">
          {/* List container */}
          <div className="mt-2 bg-[var(--foreground)] rounded-2xl shadow-lg overflow-hidden">

            {error && (
          <div className="p-6 text-center text-red-600">
            {language === 'ro' ? 'Eroare la încărcare.' : 'Failed to load.'}
          </div>
            )}
            {(isLoading || isFetching) && (
          <div className="p-6 flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 size={18} className="animate-spin" />
            {language === 'ro' ? 'Se încarcă...' : 'Loading...'}
          </div>
            )}
            {!isLoading && !isFetching && items.length === 0 && (
          <div className="p-10 text-center text-muted-foreground flex flex-col items-center gap-4">
            <img src={todosIllustration} alt="empty todos" className="w-64 max-w-full opacity-90" />
            <div>{t.empty}</div>
          </div>
            )}
            {!isLoading && !isFetching && items.length > 0 && (
          <div className="divide-y">
            {items.map((item: any) => (
              <div key={item.id} className={`border-[1px] p-3 rounded-2xl ${item.priority==='high'?'bg-red-100 border-red-500':item.priority==='medium'?'bg-yellow-100 border-yellow-500':'bg-[var(--primary)]/20 border-[var(--primary)]'}`}>
                <div className={`flex items-start gap-3 ${item.priority==='high'?'bg-red-100':item.priority==='medium'?'bg-yellow-100':'bg-[var(--primary)]/10'}`}>
                  {/* left checkbox */}
                  <div
                    className={`mt-1 min-w-[20px] min-h-[20px] max-w-[20px] max-h-[20px]  bg-white cursor-pointer
                        rounded-full border  ${item.priority==='high'?'border-red-500':item.priority==='medium'?'border-yellow-500':'border-[var(--primary)]'} flex items-center justify-center transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]`}
                    onClick={async () => {
                      const next = item.status === 'completed' ? 'PENDING' : 'COMPLETED';
                      await updateTodo({ clientEin, id: item.id, data: { status: next } as any });
                    }}
                    aria-label={item.status==='completed' ? (language==='ro'?'Marchează nefinalizat':'Mark incomplete') : (language==='ro'?'Marchează finalizat':'Mark complete')}
                  >
                    {item.status==='completed' && <CheckCircle2 size={14} className="text-white" />}
                  </div>
                  {/* content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-[var(--text1)] truncate">{item.title || '-'}</div>
                    </div>
                    {item.description && (
                      <div className="text-[var(--text2)] text-sm mt-0.5 line-clamp-1 text-left">{item.description}</div>
                    )}

                  </div>
                  {/* controls */}
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[var(--text2)]">
                      <div className="inline-flex items-center gap-2">
                        {/* avatar chip */}
                        {(() => { const label = item.assignedTo?.name || item.assignedTo?.email; const a = avatarFor(label); return (
                          <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] text-white" style={{ backgroundColor: a.color }}>
                            {a.initials}
                          </span>
                        );})()}
                        <span className="inline-flex items-center gap-1">{item.assignedTo?.name || item.assignedTo?.email || t.unassigned}</span>
                      </div>
                      <div className="inline-flex items-center gap-1"><CalendarDays size={14}/>{item.dueDate ? new Date(item.dueDate).toLocaleDateString(language==='ro'?'ro-RO':'en-US') : '-'}</div>
                      <div className="flex flex-wrap items-center gap-1">
                        {(item.tags || []).slice(0,4).map((tag:string)=> (
                          <span key={tag} className="px-2 py-0.5 rounded-full bg-[var(--primary-foreground)]">{tag}</span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className="px-2 py-1 rounded-md border hover:bg-[var(--primary-foreground)] hover:text-white bg-black text-white"
                        onClick={() => {
                          setEditing(item);
                          setForm({
                            title: item.title || '',
                            description: item.description || '',
                            dueDate: item.dueDate ? String(item.dueDate).slice(0, 10) : '',
                            status: (statusLc(item.status) || 'pending') as any,
                            priority: ((item.priority || 'medium').toString().toLowerCase() as any),
                            tags: item.tags || [],
                            assignedToId: item.assignedTo?.id ?? null,
                          });
                          setShowModal(true);
                        }}
                        aria-label={t.edit}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        className="px-2 py-1 rounded-md border hover:bg-red-500 hover:text-white bg-black text-white"
                        disabled={deleting}
                        onClick={async () => {
                          if (!window.confirm(t.confirmDelete)) return;
                          await deleteTodo({ clientEin, id: item.id });
                        }}
                        aria-label={t.del}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Simple pagination controls if total is provided */}
      {total > 0 && (
        <div className="flex items-center justify-between gap-3 text-sm text-[var(--text2)]">
          <div className="flex items-center gap-2">
            <span>{language === 'ro' ? 'Rânduri pe pagină' : 'Rows per page'}:</span>
            <select
              className="px-2 py-1 border border-[var(--text4)] rounded-lg bg-white text-black"
              value={size}
              onChange={(e) => {
                setPage(1);
                setSize(Number(e.target.value));
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
          <button
            className="px-3 py-1 border rounded-lg disabled:opacity-50 hover:bg-black hover:text-white bg-neutral-300 text-black"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {language === 'ro' ? 'Înapoi' : 'Prev'}
          </button>
          <span>
            {language === 'ro' ? 'Pagina' : 'Page'} {page}
          </span>
          <button
            className="px-3 py-1 border rounded-lg disabled:opacity-50 hover:bg-black hover:text-white bg-neutral-300 text-black"
            disabled={items.length < size || isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            {language === 'ro' ? 'Înainte' : 'Next'}
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowModal(false)}></div>
          <div className="relative z-10 w-full max-w-lg bg-white rounded-xl shadow-lg border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-black">{editing ? t.edit : t.create}</h3>
              <button onClick={() => setShowModal(false)} className="bg-neutral-300 text-black hover:bg-red-500
              hover:text-white  cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text2)] mb-1">{t.titleLabel}</label>
                <input
                  className="w-full border border-[var(--text4)] rounded-lg px-3 py-2 bg-white text-black"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text2)] mb-1">{t.descLabel}</label>
                <textarea
                  className="w-full border border-[var(--text4)] rounded-lg px-3 py-2 bg-white text-black"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[var(--text2)] mb-1">{t.dueLabel}</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="flex-1 inline-flex items-center justify-between gap-2 px-3 py-2 border border-[var(--text4)] rounded-lg bg-white text-black hover:bg-[var(--primary-foreground)]"
                      onClick={() => {
                        const el = dueInputRef.current;
                        if (!el) return;
                        // Prefer native showPicker when available for a clear calendar UX
                        // @ts-ignore
                        if (typeof el.showPicker === 'function') {
                          // @ts-ignore
                          el.showPicker();
                        } else {
                          el.focus();
                          el.click();
                        }
                      }}
                      aria-label="open-date-picker"
                    >
                      <span className="truncate text-left">
                        {form.dueDate ? new Date(form.dueDate).toLocaleDateString(language==='ro'?'ro-RO':'en-US') : (language==='ro'?'Alege data':'Pick a date')}
                      </span>
                      <CalendarDays size={18} className="text-[var(--text3)]" />
                    </button>
                    {form.dueDate && (
                      <button
                        type="button"
                        className="px-3 py-2 border border-[var(--text4)] rounded-lg bg-white text-black hover:bg-red-50"
                        onClick={() => setForm((f) => ({ ...f, dueDate: '' }))}
                      >
                        {language==='ro'?'Șterge':'Clear'}
                      </button>
                    )}
                    {/* Hidden native date input to leverage OS calendar */}
                    <input
                      ref={dueInputRef}
                      type="date"
                      className="absolute opacity-0 pointer-events-none w-0 h-0"
                      value={form.dueDate || ''}
                      onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                      tabIndex={-1}
                      aria-hidden
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-[var(--text2)] mb-1">{t.priority}</label>
                  <select
                    className="w-full border border-[var(--text4)] rounded-lg px-3 py-2 bg-white text-black"
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as any }))}
                  >
                    <option value="high">{language === 'ro' ? 'Mare' : 'High'}</option>
                    <option value="medium">{language === 'ro' ? 'Medie' : 'Medium'}</option>
                    <option value="low">{language === 'ro' ? 'Mică' : 'Low'}</option>
                  </select>
                </div>
              </div>
              {/* Assignee controls */}
              <div>
                <label className="block text-sm text-[var(--text2)] mb-1">{t.assignee}</label>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    className="px-3 py-2 border border-[var(--text4)] rounded-lg bg-white text-black"
                    value={form.assignedToId ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => ({ ...f, assignedToId: v ? Number(v) : null }));
                    }}
                  >
                    <option value="">{t.unassigned}</option>
                    {/* company users */}
                    {Array.isArray(companyUsers) && companyUsers.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email || `#${u.id}`}
                      </option>
                    ))}
                    {/* ensure self present */}
                    {me?.id && (!Array.isArray(companyUsers) || !companyUsers.some((u: any) => u.id === me.id)) && (
                      <option value={me.id}>{me.name || me.email || `#${me.id}`}</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button className="px-4 py-2 rounded-lg border bg-neutral-300 text-black hover:bg-black hover:text-white" onClick={() => setShowModal(false)}>{t.cancel}</button>
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white disabled:opacity-50"
                disabled={!clientEin || !form.title || creating || updating}
                onClick={async () => {
                  const payload: any = {
                    title: form.title,
                    description: form.description || undefined,
                    priority: (form.priority as any)?.toUpperCase?.(),
                    dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
                    assignedToId: form.assignedToId ?? undefined,
                  };
                  try {
                    if (editing) {
                      await updateTodo({ clientEin, id: editing.id, data: payload }).unwrap();
                    } else {
                      await createTodo({ clientEin, data: { ...payload, status: 'PENDING' } }).unwrap();
                    }
                    setShowModal(false);
                  } catch (e) {
                    console.error(e);
                    alert(language === 'ro' ? 'Eroare la salvare.' : 'Save failed.');
                  }
                }}
              >
                {(creating || updating) && <Loader2 size={16} className="animate-spin" />}
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TodosPage;

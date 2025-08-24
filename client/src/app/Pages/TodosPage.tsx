import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus, Filter, Search, CalendarDays, Tag, User, Flag, Loader2, Edit2, Trash2, X, CheckCircle2, Clock3, Loader } from 'lucide-react';
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

  // Current user (used for Assign to me / Unassign actions)
  const { data: me } = useGetUserDataQuery(undefined);
  const [tagInput, setTagInput] = useState('');

  const [createTodo, { isLoading: creating }] = useCreateTodoMutation();
  const [updateTodo, { isLoading: updating }] = useUpdateTodoMutation();
  const [deleteTodo, { isLoading: deleting }] = useDeleteTodoMutation();

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

  const { data, isLoading, isFetching, error } = useGetTodosQuery(
    clientEin
      ? {
          clientEin,
          page,
          size,
          status,
          priority,
          q: query,
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

  // Tag suggestions from existing items
  const existingTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i: any) => (i.tags || []).forEach((t: string) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Company users for assignee dropdown (optional endpoint)
  const { data: companyUsers } = useGetCompanyUsersQuery();

  const stats = useMemo(() => {
    const pending = items.filter((i: any) => i.status === 'pending').length;
    const inProgress = items.filter((i: any) => i.status === 'in_progress').length;
    const completed = items.filter((i: any) => i.status === 'completed').length;
    return { pending, inProgress, completed };
  }, [items]);


  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="mb-2">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-[var(--primary)] to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
            <CheckCircle2 size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-[var(--text1)] mb-1">{t.title}</h1>
            <p className="text-[var(--text2)]">{t.subtitle}</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="col-span-1 lg:col-span-2 flex items-center gap-2 border border-[var(--text4)] rounded-lg px-3 py-2 bg-white">
          <Search size={18} className="text-[var(--text3)]" />
          <input
            className="w-full bg-white outline-none text-black"
            placeholder={t.searchPlaceholder}
            value={query}
            onChange={(e) => { setPage(1); setQuery(e.target.value); }}
          />
        </div>
        <div className="col-span-1 flex items-center gap-2 border border-[var(--text4)] rounded-lg px-3 py-2 bg-white">
          <Filter size={18} className="text-[var(--text3)]" />
          <select className="bg-white outline-none w-full text-black" value={status} onChange={(e)=>{ setPage(1); setStatus(e.target.value as any); }}>
            <option value="all">{language==='ro'?'Toate':'All'}</option>
            <option value="pending">{language==='ro'?'În așteptare':'Pending'}</option>
            <option value="in_progress">{language==='ro'?'În curs':'In Progress'}</option>
            <option value="completed">{language==='ro'?'Finalizate':'Completed'}</option>
          </select>
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

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="border rounded-xl p-4 bg-white flex items-center justify-between">
          <div>
            <div className="text-sm text-[var(--text2)]">{language==='ro'?'În așteptare':'Pending'}</div>
            <div className="text-2xl font-semibold">{stats.pending}</div>
          </div>
          <Clock3 className="text-yellow-600" size={22} />
        </div>
        <div className="border rounded-xl p-4 bg-white flex items-center justify-between">
          <div>
            <div className="text-sm text-[var(--text2)]">{language==='ro'?'În curs':'In Progress'}</div>
            <div className="text-2xl font-semibold">{stats.inProgress}</div>
          </div>
          <Loader className="text-blue-600" size={22} />
        </div>
        <div className="border rounded-xl p-4 bg-white flex items-center justify-between">
          <div>
            <div className="text-sm text-[var(--text2)]">{language==='ro'?'Finalizate':'Completed'}</div>
            <div className="text-2xl font-semibold">{stats.completed}</div>
          </div>
          <CheckCircle2 className="text-green-600" size={22} />
        </div>
      </div>

      <div className="mt-2 bg-[var(--foreground)] rounded-3xl border border-[var(--text4)] shadow-lg overflow-hidden">
        <div className="grid grid-cols-12 bg-[var(--primary-foreground)] px-4 py-3 text-sm font-medium text-muted-foreground">
          <div className="col-span-4">{t.titleLabel}</div>
          <div className="col-span-2 flex items-center gap-2"><User size={16}/> {t.assignee}</div>
          <div className="col-span-2 flex items-center gap-2"><CalendarDays size={16}/> {t.due}</div>
          <div className="col-span-1 text-center">{t.status}</div>
          <div className="col-span-1 text-center">{t.priority}</div>
          <div className="col-span-1 flex items-center gap-2 justify-center"><Tag size={16}/> {t.tags}</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>
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
          <div className="p-10 text-center text-muted-foreground flex flex-col items-center gap-2">
            <CheckCircle2 size={28} className="opacity-40" />
            <div>{t.empty}</div>
          </div>
        )}
        {!isLoading && !isFetching && items.length > 0 && (
          <div className="divide-y">
            {items.map((item: any) => (
              <div key={item.id} className="grid grid-cols-12 items-center px-4 py-3 text-sm">
                <div className="col-span-4">
                  <div className="font-medium text-[var(--text1)]">{item.title || '-'}</div>
                  {item.description && (
                    <div className="text-[var(--text2)] text-xs line-clamp-1">{item.description}</div>
                  )}
                </div>
                <div className="col-span-2 text-[var(--text2)]">
                  {item.assignedTo?.name || item.assignedTo?.email || '-'}
                </div>
                <div className="col-span-2 text-[var(--text2)]">
                  {item.dueDate ? new Date(item.dueDate).toLocaleDateString(language === 'ro' ? 'ro-RO' : 'en-US') : '-'}
                </div>
                <div className="col-span-1 text-center">
                  <select
                    className="bg-white text-black outline-none text-xs border border-[var(--text4)] rounded px-2 py-1"
                    value={item.status}
                    onChange={async (e) => {
                      await updateTodo({ clientEin, id: item.id, data: { status: e.target.value } as any });
                    }}
                  >
                    <option value="pending">{language === 'ro' ? 'În așteptare' : 'Pending'}</option>
                    <option value="in_progress">{language === 'ro' ? 'În curs' : 'In Progress'}</option>
                    <option value="completed">{language === 'ro' ? 'Finalizat' : 'Completed'}</option>
                  </select>
                </div>
                <div className="col-span-1 text-center">
                  <select
                    className="bg-white text-black outline-none text-xs border border-[var(--text4)] rounded px-2 py-1"
                    value={item.priority}
                    onChange={async (e) => {
                      await updateTodo({ clientEin, id: item.id, data: { priority: e.target.value } as any });
                    }}
                  >
                    <option value="high">{language === 'ro' ? 'Mare' : 'High'}</option>
                    <option value="medium">{language === 'ro' ? 'Medie' : 'Medium'}</option>
                    <option value="low">{language === 'ro' ? 'Mică' : 'Low'}</option>
                  </select>
                </div>
                <div className="col-span-1 flex flex-wrap gap-1 justify-center">
                  {(item.tags || []).slice(0, 3).map((tag: string) => (
                    <span key={tag} className="px-2 py-0.5 text-xs rounded-full bg-[var(--primary-foreground)] text-[var(--text2)]">{tag}</span>
                  ))}
                </div>
                <div className="col-span-1 text-right flex items-center justify-end gap-2">
                  {/* quick assign/unassign */}
                  {me?.id && (
                    item.assignedTo?.id === me.id ? (
                      <button
                        className="px-2 py-1 rounded-md border hover:bg-[var(--primary-foreground)]"
                        onClick={async () => {
                          await updateTodo({ clientEin, id: item.id, data: { assignedToId: null } as any });
                        }}
                        title={t.unassign}
                      >
                        <User size={14} />
                      </button>
                    ) : (
                      <button
                        className="px-2 py-1 rounded-md border hover:bg-[var(--primary-foreground)]"
                        onClick={async () => {
                          await updateTodo({ clientEin, id: item.id, data: { assignedToId: me.id } as any });
                        }}
                        title={t.assignToMe}
                      >
                        <User size={14} />
                      </button>
                    )
                  )}
                  <button
                    className="px-2 py-1 rounded-md border hover:bg-[var(--primary-foreground)]"
                    onClick={() => {
                      setEditing(item);
                      setForm({
                        title: item.title || '',
                        description: item.description || '',
                        dueDate: item.dueDate ? String(item.dueDate).slice(0, 10) : '',
                        status: item.status || 'pending',
                        priority: item.priority || 'medium',
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
                    className="px-2 py-1 rounded-md border hover:bg-red-50 text-red-600 border-red-200"
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
            ))}
          </div>
        )}
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
            className="px-3 py-1 border rounded-lg disabled:opacity-50"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {language === 'ro' ? 'Înapoi' : 'Prev'}
          </button>
          <span>
            {language === 'ro' ? 'Pagina' : 'Page'} {page}
          </span>
          <button
            className="px-3 py-1 border rounded-lg disabled:opacity-50"
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
              <h3 className="text-lg font-semibold">{editing ? t.edit : t.create}</h3>
              <button onClick={() => setShowModal(false)} className="text-[var(--text2)] hover:text-[var(--text1)]">
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
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-[var(--text2)] mb-1">{t.dueLabel}</label>
                  <input
                    type="date"
                    className="w-full border border-[var(--text4)] rounded-lg px-3 py-2 bg-white text-black"
                    value={form.dueDate || ''}
                    onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text2)] mb-1">{t.status}</label>
                  <select
                    className="w-full border border-[var(--text4)] rounded-lg px-3 py-2 bg-white text-black"
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as any }))}
                  >
                    <option value="pending">{language === 'ro' ? 'În așteptare' : 'Pending'}</option>
                    <option value="in_progress">{language === 'ro' ? 'În curs' : 'In Progress'}</option>
                    <option value="completed">{language === 'ro' ? 'Finalizat' : 'Completed'}</option>
                  </select>
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

              {/* Tags chips editor */}
              <div>
                <label className="block text-sm text-[var(--text2)] mb-1">{t.tags}</label>
                <div className="w-full border border-[var(--text4)] rounded-lg px-3 py-2 flex flex-wrap gap-2 bg-white">
                  {(form.tags || []).map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-[var(--primary-foreground)] text-[var(--text2)]">
                      {tag}
                      <button
                        className="ml-1 text-[var(--text2)] hover:text-[var(--text1)]"
                        onClick={() => setForm((f) => ({ ...f, tags: (f.tags || []).filter((t) => t !== tag) }))}
                        aria-label="remove-tag"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <input
                    className="flex-1 min-w-[120px] outline-none bg-white text-black"
                    placeholder={t.addTagPlaceholder}
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const val = tagInput.trim().replace(/,$/, '');
                        if (val && !(form.tags || []).includes(val)) {
                          setForm((f) => ({ ...f, tags: [...(f.tags || []), val] }));
                        }
                        setTagInput('');
                      } else if (e.key === 'Backspace' && !tagInput && (form.tags || []).length) {
                        setForm((f) => ({ ...f, tags: f.tags.slice(0, -1) }));
                      }
                    }}
                  />
                </div>
                {/* Tag suggestions / autocomplete */}
                {existingTags && existingTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(tagInput
                      ? existingTags.filter((tg) => tg.toLowerCase().startsWith(tagInput.toLowerCase()))
                      : existingTags.slice(0, 10)
                    )
                      .filter((tg) => !(form.tags || []).includes(tg))
                      .map((tg) => (
                        <button
                          key={tg}
                          className="px-2 py-0.5 text-xs rounded-full border hover:bg-[var(--primary-foreground)]"
                          onClick={() => setForm((f) => ({ ...f, tags: [...(f.tags || []), tg] }))}
                        >
                          + {tg}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Assignee controls */}
              <div>
                <label className="block text-sm text-[var(--text2)] mb-1">{t.assignee}</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Optional dropdown when company users are available */}
                  {Array.isArray(companyUsers) && companyUsers.length > 0 && (
                    <select
                      className="px-3 py-2 border border-[var(--text4)] rounded-lg bg-white text-black"
                      value={form.assignedToId ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((f) => ({ ...f, assignedToId: v ? Number(v) : null }));
                      }}
                    >
                      <option value="">{t.unassigned}</option>
                      {companyUsers.map((u: any) => (
                        <option key={u.id} value={u.id}>
                          {u.name || u.email || `#${u.id}`}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="px-3 py-2 border rounded-lg text-sm text-[var(--text2)] min-w-[160px]">
                    {form.assignedToId
                      ? (editing?.assignedTo?.name || editing?.assignedTo?.email || `${t.assignee}: #${form.assignedToId}`)
                      : t.unassigned}
                  </div>
                  {me?.id && (
                    <>
                      <button
                        className="px-3 py-2 rounded-lg border hover:bg-[var(--primary-foreground)]"
                        onClick={() => setForm((f) => ({ ...f, assignedToId: me.id as number }))}
                      >
                        {t.assignToMe}
                      </button>
                      <button
                        className="px-3 py-2 rounded-lg border hover:bg-[var(--primary-foreground)]"
                        onClick={() => setForm((f) => ({ ...f, assignedToId: null }))}
                      >
                        {t.unassign}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button className="px-4 py-2 rounded-lg border" onClick={() => setShowModal(false)}>{t.cancel}</button>
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white disabled:opacity-50"
                disabled={!clientEin || !form.title || creating || updating}
                onClick={async () => {
                  const payload: any = {
                    title: form.title,
                    description: form.description || undefined,
                    priority: form.priority,
                    status: form.status,
                    dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
                    tags: (form.tags || []).length ? form.tags : undefined,
                    assignedToId: form.assignedToId ?? undefined,
                  };
                  try {
                    if (editing) {
                      await updateTodo({ clientEin, id: editing.id, data: payload }).unwrap();
                    } else {
                      await createTodo({ clientEin, data: payload }).unwrap();
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

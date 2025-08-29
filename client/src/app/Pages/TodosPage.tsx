import { useMemo, useRef, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Plus, Search, CalendarDays, Flag, Loader2, Edit2, Trash2, X, CheckCircle2, Circle, CheckCircle, User } from 'lucide-react';
import todosIllustration from '@/assets/todos.svg';
import { useGetTodosQuery, useCreateTodoMutation, useUpdateTodoMutation, useDeleteTodoMutation, useGetUserDataQuery, useGetCompanyUsersQuery, useReorderTodosMutation } from '@/redux/slices/apiSlice';
import LoadingComponent from '../Components/LoadingComponent';

const TodosPage = () => {
  const language = useSelector((state: { user: { language: string } }) => state.user.language);
  const clientEin = useSelector((state: { clientCompany: { current: { ein: string } } }) => state.clientCompany.current.ein);

  // Local placeholder state until API is wired
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'pending'|'completed'|'all'|'in_progress'>('pending');
  const [priority, setPriority] = useState<'low'|'medium'|'high'|'all'>('all');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [assigneeFilter, setAssigneeFilter] = useState<number | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<{ title: string; description?: string; dueDate?: string; status: 'pending'|'in_progress'|'completed'; priority: 'low'|'medium'|'high'; tags: string[]; assigneeIds: number[] }>(
    { title: '', description: '', dueDate: '', status: 'pending', priority: 'medium', tags: [], assigneeIds: [] }
  );
  const dueInputRef = useRef<HTMLInputElement | null>(null);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const [assigneeHighlighted, setAssigneeHighlighted] = useState<number>(0);
  const assigneeContainerRef = useRef<HTMLDivElement | null>(null);
  const assigneeListRef = useRef<HTMLDivElement | null>(null);

  const MAX_ASSIGNEE_CHIPS = 3;

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
          ...(assigneeFilter !== 'all' ? { assigneeId: assigneeFilter as number } : {}),
        }
      : ({} as any),
    { skip: !clientEin }
  );

  const items: any[] = Array.isArray((data as any)?.items)
    ? (data as any).items
    : Array.isArray(data)
    ? (data as any)
    : [];

  // Local ordered items for DnD (falls back to API order)
  const [ordered, setOrdered] = useState<any[]>([]);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [reorderTodos] = useReorderTodosMutation();
  const [reordering, setReordering] = useState<boolean>(false);

  // Initialize/refresh local ordered list when data changes
  useEffect(() => {
    // While a reorder mutation is in-flight, avoid resetting local order from network/cache
    if (reordering) return;
    if (!items || !items.length) {
      setOrdered([]);
      return;
    }
    // Sort by sortOrder if present, else stable by current index (undefined orders go last)
    const withIndex = items.map((it: any, idx: number) => ({ ...it, __idx: idx }));
    withIndex.sort((a: any, b: any) => {
      const sa = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const sb = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
      if (sa !== sb) return sa - sb;
      return a.__idx - b.__idx;
    });
    setOrdered(withIndex.map(({ __idx, ...rest }) => rest));
  }, [items, reordering]);

  const onDragStart = (e: React.DragEvent, id: number) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(id));
  };

  const onDragOver = (e: React.DragEvent, overId: number) => {
    e.preventDefault(); // allow drop
    if (draggingId === null || draggingId === overId) return;
    const curr = ordered.slice();
    const from = curr.findIndex((x) => x.id === draggingId);
    const to = curr.findIndex((x) => x.id === overId);
    if (from < 0 || to < 0 || from === to) return;
    const [moved] = curr.splice(from, 1);
    curr.splice(to, 0, moved);
    setOrdered(curr);
  };

  const onDrop = async (e: React.DragEvent) => {
    // Prevent default browser behavior (e.g., opening dragged content)
    e.preventDefault();
    e.stopPropagation();
    if (!clientEin) return;
    const curr = ordered.slice();
    // Compute a base offset to preserve global ordering across pages
    // Prefer the smallest existing sortOrder within the current list; fallback to page window
    const existingOrders = curr
      .map((x: any) => (typeof x.sortOrder === 'number' ? x.sortOrder : undefined))
      .filter((v: any) => typeof v === 'number') as number[];
    const pageBaseFallback = (page - 1) * size + 1;
    const base = existingOrders.length ? Math.min(...existingOrders) : pageBaseFallback;
    // Build payload keeping a contiguous sequence starting from base
    const payload = curr.map((x, idx) => ({ id: x.id as number, sortOrder: base + idx }));
    try {
      setReordering(true);
      await reorderTodos({ clientEin, items: payload } as any).unwrap();
    } catch (err) {
      console.error('Failed to reorder todos', err);
      // Surface a simple UI error so the user knows why the list snapped back
      alert('Failed to save new order. Please check your login and try again.');
    } finally {
      setDraggingId(null);
      setReordering(false);
    }
  };
  
  const onDragEnd = () => {
    // Ensure visual state resets even if mutation is slow
    setDraggingId(null);
  };
  const total: number = (data as any)?.total ?? items.length ?? 0;

  // removed debug log

  // Company users for assignee dropdown (optional endpoint)
  const { data: companyUsers } = useGetCompanyUsersQuery();

  // Build user lists for assignee dropdown
  const allAssigneeUsers: any[] = useMemo(() => {
    const base: any[] = Array.isArray(companyUsers) ? companyUsers.slice() : [];
    if (me?.id && !base.some((u: any) => u.id === me.id)) base.push(me as any);
    return base;
  }, [companyUsers, me]);

  const filteredAssigneeUsers: any[] = useMemo(() => {
    const q = (assigneeQuery || '').trim().toLowerCase();
    if (!q) return allAssigneeUsers;
    return allAssigneeUsers.filter((u: any) => (u?.name || u?.email || '').toLowerCase().includes(q));
  }, [allAssigneeUsers, assigneeQuery]);

  // Reset highlighted item when opening or list changes
  useEffect(() => {
    if (assigneeOpen) setAssigneeHighlighted(0);
  }, [assigneeOpen, assigneeQuery]);

  // Click-outside to close
  useEffect(() => {
    if (!assigneeOpen) return;
    const onDown = (e: MouseEvent) => {
      const node = assigneeContainerRef.current;
      if (node && !node.contains(e.target as Node)) {
        setAssigneeOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [assigneeOpen]);

  // Ensure highlighted option stays in view
  useEffect(() => {
    if (!assigneeOpen) return;
    const list = assigneeListRef.current;
    if (!list) return;
    const el = list.querySelector(`[data-index="${assigneeHighlighted}"]`);
    if (el && 'scrollIntoView' in el) {
      (el as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, [assigneeHighlighted, assigneeOpen]);

  const statusLc = (s: any) => (s || '').toString().toLowerCase();
  const priorityLc = (p: any) => (p || '').toString().toLowerCase();


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
          {status !== 'completed' && (
            <div className="ml-auto">
              <button
                onClick={() => {
                  setEditing(null);
                  setForm({ title: '', description: '', dueDate: '', status: 'pending', priority: 'medium', tags: [], assigneeIds: [] });
                  setShowModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition disabled:opacity-50"
                disabled={!clientEin}
              >
                <Plus size={18} /> {t.create}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
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
        <div className="col-span-1 flex items-center gap-2 border border-[var(--text4)] rounded-lg px-3 py-2 bg-white">
          <User size={18} className="text-[var(--text3)]" />
          <select
            className="bg-white outline-none w-full text-black"
            value={assigneeFilter}
            onChange={(e) => {
              const val = e.target.value;
              setPage(1);
              setAssigneeFilter(val === 'all' ? 'all' : Number(val));
            }}
          >
            <option value="all">{language==='ro'?'Toți asignații':'All assignees'}</option>
            {allAssigneeUsers.map((u: any) => (
              <option key={u.id} value={u.id}>
                {u?.name || u?.email || `#${u?.id}`}
              </option>
            ))}
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
          <div className="mt-2 bg-transparent shadow-none rounded-2xl overflow-hidden">

            {error && (
          <div className="p-6 text-center text-red-600">
            {language === 'ro' ? 'Eroare la încărcare.' : 'Failed to load.'}
          </div>
            )}
            {(isLoading || isFetching) && !reordering && (
              <LoadingComponent/>
            )}
            {!isLoading && !isFetching && items.length === 0 ? (
              <div className="p-10 text-center text-[var(--text2)] bg-white rounded-xl border border-[var(--text4)]">
                <img src={todosIllustration} alt="Todos" className="mx-auto w-40 h-40 opacity-80 mb-4" />
                <div className="text-lg mb-2 text-black">{t.empty}</div>
                {status !== 'completed' && (
                  <button
                    onClick={() => {
                      setEditing(null);
                      setForm({ title: '', description: '', dueDate: '', status: 'pending', priority: 'medium', tags: [], assigneeIds: [] });
                      setShowModal(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition disabled:opacity-50"
                    disabled={!clientEin}
                  >
                    <Plus size={18} /> {t.create}
                  </button>
                )}
              </div>
            ) : (
              <div
                className="flex flex-col gap-3"
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
                role="list"
                aria-label="todos-list"
              >
                {(!isLoading && !isFetching) &&
                ordered.map((item: any) => (
                  <div
                    key={item.id}
                    role="listitem"
                    className={`group border-2 ${priorityLc(item.priority)==='high' ? 'border-red-300' : priorityLc(item.priority)==='low' ? 'border-blue-300' : 'border-amber-300'}
                       bg-white rounded-2xl p-4 text-black ${draggingId===item.id ? 'opacity-60' : ''}`}
                    draggable={!!clientEin}
                    title={clientEin ? undefined : 'Select a client to enable reordering'}
                    onDragStart={(e) => onDragStart(e, item.id)}
                    onDragOver={(e) => onDragOver(e, item.id)}
                    onDragEnd={onDragEnd}
                    aria-grabbed={draggingId === item.id}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={`shrink-0 inline-flex items-center cursor-pointer justify-center w-5 h-5 rounded-full border ${statusLc(item.status)==='completed' ? 'border-green-500 text-green-600' : 'border-gray-300 text-gray-400'} hover:bg-green-50`}
                              onClick={async () => {
                                try {
                                  const isCompleted = statusLc(item.status) === 'completed';
                                  await updateTodo({ clientEin, id: item.id, data: { status: isCompleted ? 'PENDING' : 'COMPLETED' } } as any).unwrap();
                                } catch (e) {
                                  console.error('Failed to toggle todo status', e);
                                }
                              }}
                              onKeyDown={async (e) => {
                                if (e.key === ' ' || e.key === 'Enter') {
                                  e.preventDefault();
                                  try {
                                    const isCompleted = statusLc(item.status) === 'completed';
                                    await updateTodo({ clientEin, id: item.id, data: { status: isCompleted ? 'PENDING' : 'COMPLETED' } } as any).unwrap();
                                  } catch (err) {
                                    console.error('Failed to toggle todo status (kbd)', err);
                                  }
                                }
                              }}
                              role="checkbox"
                              aria-checked={statusLc(item.status)==='completed'}
                              aria-label={statusLc(item.status)==='completed' ? (language==='ro'?'Marchează ca nefinalizat':'Mark as pending') : (language==='ro'?'Marchează ca finalizat':'Mark as completed')}
                            >
                              {statusLc(item.status)==='completed' ? <CheckCircle size={16} /> : <Circle size={16} />}
                            </div>
                            <h3 className="font-semibold text-left truncate" title={item.title}>{item.title}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs border ${priorityLc(item.priority)==='high' ? 'bg-red-50 border-red-200 text-red-700' : priorityLc(item.priority)==='low' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>{(item.priority||'medium').toString().toUpperCase()}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs border ${statusLc(item.status)==='completed' ? 'bg-green-50 border-green-200 text-green-700' : statusLc(item.status)==='in_progress' ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>{(item.status||'PENDING').toString().toUpperCase()}</span>
                          </div>
                        </div>
                        {item.description && (
                          <div className="text-[var(--text2)] text-sm mt-0.5 line-clamp-1 text-left">{item.description}</div>
                        )}

                        {/* controls */}
                        <div className="mt-3 flex flex-col sm:flex-row items-end sm:items-center gap-2">
                          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text2)]">
                            <div className="inline-flex items-center gap-2 flex-wrap">
                              {/* avatars chips for multiple assignees */}
                              {Array.isArray(item.assignees) && item.assignees.length > 0 ? (
                                item.assignees.map((a: any, idx: number) => {
                                  const label = a?.user?.name || a?.user?.email;
                                  const av = avatarFor(label);
                                  return (
                                    <span key={a?.user?.id ?? idx} className="inline-flex items-center gap-1">
                                      <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] text-white" style={{ backgroundColor: av.color }}>
                                        {av.initials}
                                      </span>
                                      <span>{label}</span>
                                    </span>
                                  );
                                })
                              ) : (
                                <span>{t.unassigned}</span>
                              )}
                            </div>
                            <div className="inline-flex items-center gap-1"><CalendarDays size={14}/>{item.dueDate ? new Date(item.dueDate).toLocaleDateString(language==='ro'?'ro-RO':'en-US') : '-'}</div>
                            <div className="flex flex-wrap items-center gap-1">
                              {(item.tags || []).slice(0,4).map((tag:string)=> (
                                <span key={tag} className="px-2 py-0.5 rounded-full bg-[var(--primary-foreground)]">{tag}</span>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 ml-auto">
                            <button
                              className="p-0 rounded-md border hover:text-purple-500 bg-transparent text-black"
                              onClick={() => {
                                setEditing(item);
                                setForm({
                                  title: item.title || '',
                                  description: item.description || '',
                                  dueDate: item.dueDate ? String(item.dueDate).slice(0, 10) : '',
                                  status: (statusLc(item.status) || 'pending') as any,
                                  priority: ((item.priority || 'medium').toString().toLowerCase() as any),
                                  tags: item.tags || [],
                                  assigneeIds: Array.isArray(item.assignees) ? item.assignees.map((a: any) => a?.user?.id).filter((v: any) => !!v) : [],
                                });
                                setShowModal(true);
                              }}
                              aria-label={t.edit}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              className="p-0 rounded-md border hover:text-red-500 bg-transparent text-black"
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
                  className="w-full border border-[var(--text4)] rounded-lg px-3 py-2 bg-white text-black
                  focus:shadow-none"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text2)] mb-1">{t.descLabel}</label>
                <textarea
                  className="w-full border border-[var(--text4)] rounded-lg 
                  focus:ring-[var(--primary)] px-3 py-2 bg-white text-black"
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
                      className="flex-1 inline-flex items-center justify-between gap-2 px-3 hover:text-white
                      py-[6px] border border-[var(--text4)] hover:border-[var(--primaryLow)] rounded-lg bg-white text-black hover:bg-[var(--primary-foreground)]"
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
                      <CalendarDays size={18} />
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
                    className="w-full border border-[var(--text4)] rounded-lg px-3 py-2 bg-white text-black
                    focus:ring-[var(--primary)]"
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as any }))}
                  >
                    <option value="high">{language === 'ro' ? 'Mare' : 'High'}</option>
                    <option value="medium">{language === 'ro' ? 'Medie' : 'Medium'}</option>
                    <option value="low">{language === 'ro' ? 'Mică' : 'Low'}</option>
                  </select>
                </div>
              </div>
              {/* Assignees controls (searchable multi-select with chips) */}
              <div>
                <label className="block text-sm text-[var(--text2)] mb-1">{t.assignee}</label>
                <div className="flex flex-col gap-2">
                  {/* Selected chips */}
                  <div className="flex flex-wrap gap-2">
                    {(form.assigneeIds || []).length === 0 && (
                      <span className="text-xs text-[var(--text3)]">{t.unassigned}</span>
                    )}
                    {(() => {
                      const selectedIds = form.assigneeIds || [];
                      const shown = selectedIds.slice(0, MAX_ASSIGNEE_CHIPS);
                      const hiddenCount = Math.max(0, selectedIds.length - shown.length);
                      const getUser = (id: number) => allAssigneeUsers.find((x: any) => x?.id === id);
                      return (
                        <>
                          {shown.map((id) => {
                            const u = getUser(id);
                            const label = u?.name || u?.email || `#${id}`;
                            const av = avatarFor(label);
                            return (
                              <span key={id} className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-[var(--primary-foreground)] text-black border border-[var(--text4)]">
                                <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] text-white" style={{ backgroundColor: av.color }}>{av.initials}</span>
                                <span className="text-sm max-w-[120px] truncate text-white" title={label}>{label}</span>
                                <button
                                  type="button"
                                  className="p-0 hover:text-red-500 bg-white text-red-500 hover:bg-red-200"
                                  onClick={() => setForm((f) => ({ ...f, assigneeIds: (f.assigneeIds || []).filter((x) => x !== id) }))}
                                  aria-label="remove-assignee"
                                >
                                  <X size={14} />
                                </button>
                              </span>
                            );
                          })}
                          {hiddenCount > 0 && (
                            <span className="px-2 py-1 rounded-full bg-neutral-100 text-black border border-[var(--text4)] text-xs">{language==='ro'?`+${hiddenCount} în plus`:`+${hiddenCount} more`}</span>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Trigger / input */}
                  <div className="relative" ref={assigneeContainerRef}>
                    <div className="flex items-center gap-2 px-3 py-2 border border-[var(--text4)] rounded-lg bg-white text-black cursor-text"
                      onClick={() => setAssigneeOpen((o) => !o)}
                      role="button"
                      aria-haspopup="listbox"
                      aria-expanded={assigneeOpen}
                    >
                      <Search size={16} className="text-[var(--text3)]" />
                      <input
                        placeholder={language==='ro'?'Caută utilizatori...':'Search users...'}
                        className="flex-1 bg-white outline-none text-black focus:shadow-none"
                        value={assigneeQuery}
                        onChange={(e) => setAssigneeQuery(e.target.value)}
                        onFocus={() => setAssigneeOpen(true)}
                        onKeyDown={(e) => {
                          if (!assigneeOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                            setAssigneeOpen(true);
                            return;
                          }
                          if (!assigneeOpen) return;
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setAssigneeHighlighted((i) => Math.min((filteredAssigneeUsers.length - 1), i + 1));
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setAssigneeHighlighted((i) => Math.max(0, i - 1));
                          } else if (e.key === 'Enter') {
                            e.preventDefault();
                            const u = filteredAssigneeUsers[assigneeHighlighted];
                            if (u) {
                              setForm((f) => {
                                const set = new Set(f.assigneeIds || []);
                                if (set.has(u.id)) set.delete(u.id); else set.add(u.id);
                                return { ...f, assigneeIds: Array.from(set) as number[] };
                              });
                            }
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setAssigneeOpen(false);
                          }
                        }}
                      />
                      <span className="text-xs text-[var(--text3)]">{(form.assigneeIds || []).length} {language==='ro'?'selectați':'selected'}</span>
                    </div>

                    {assigneeOpen && (
                      <div ref={assigneeListRef} className="absolute z-10 px-[2px] overflow-x-hidden mt-1 w-full max-h-64 overflow-auto bg-white border border-[var(--text4)] rounded-lg shadow-lg">
                        {filteredAssigneeUsers.length === 0 ? (
                          <div className="p-3 text-sm text-[var(--text3)]">{language==='ro'?'Niciun rezultat':'No results'}</div>
                        ) : (
                          filteredAssigneeUsers.map((u: any, idx: number) => {
                            const label = u?.name || u?.email || `#${u?.id}`;
                            const selected = (form.assigneeIds || []).includes(u.id);
                            const av = avatarFor(label);
                            const highlighted = idx === assigneeHighlighted;
                            return (
                              <button
                                key={u.id}
                                type="button"
                                data-index={idx}
                                role="option"
                                aria-selected={highlighted}
                                className={`w-full bg-white hover:text-white text-black
                                   text-left px-3 py-2 flex items-center gap-2 
                                   hover:bg-[var(--primaryLow)] my-1 
                                   ${selected ? 'bg-[var(--primaryLow)]' : ''} mx-1`}
                                onMouseEnter={() => setAssigneeHighlighted(idx)}
                                onClick={() => {
                                  setForm((f) => {
                                    const set = new Set(f.assigneeIds || []);
                                    if (set.has(u.id)) set.delete(u.id); else set.add(u.id);
                                    return { ...f, assigneeIds: Array.from(set) as number[] };
                                  });
                                }}
                              >
                                <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] text-white" style={{ backgroundColor: av.color }}>{av.initials}</span>
                                <span className="flex-1 text-sm text-black">{label}</span>
                              </button>
                            );
                          })
                        )}
                        <div className="p-2 border-t border-[var(--text4)] flex items-center justify-between gap-2 bg-white">
                          {/* Assign to me quick action */}
                          {me?.id && (
                            <button
                              type="button"
                              className="px-3 py-1 text-sm rounded-md border bg-[var(--primaryLow)] text-[var(--primary)] hover:text-white
                              hover:bg-[var(--primary-foreground)]"
                              onClick={() => {
                                setForm((f) => {
                                  const set = new Set(f.assigneeIds || []);
                                  set.add(me.id as number);
                                  return { ...f, assigneeIds: Array.from(set) as number[] };
                                });
                              }}
                            >
                              {t.assignToMe}
                            </button>
                          )}
                          <button type="button" className="px-3 py-1 text-sm rounded-md border bg-neutral-100 text-black hover:bg-neutral-200" onClick={() => setAssigneeOpen(false)}>
                            {language==='ro'?'Închide':'Close'}
                          </button>
                          <button type="button" className="px-3 py-1 text-sm rounded-md border bg-neutral-100 text-black hover:bg-neutral-200" onClick={() => { setAssigneeQuery(''); setForm((f)=>({...f, assigneeIds: []})); }}>
                            {language==='ro'?'Golește':'Clear'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
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
                    assigneeIds: Array.isArray(form.assigneeIds) && form.assigneeIds.length ? form.assigneeIds : [],
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

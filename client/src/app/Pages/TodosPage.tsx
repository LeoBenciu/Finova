import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus, Filter, Search, CalendarDays, Tag, User, Flag } from 'lucide-react';

const TodosPage = () => {
  const language = useSelector((state: { user: { language: string } }) => state.user.language);

  // Local placeholder state until API is wired
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'pending'|'in_progress'|'completed'|'all'>('all');
  const [priority, setPriority] = useState<'low'|'medium'|'high'|'all'>('all');

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
    empty: language === 'ro' ? 'Nicio sarcină încă. Adaugă o sarcină pentru a începe.' : 'No tasks yet. Add a task to get started.'
  }), [language]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{t.title}</h1>
          <p className="text-muted-foreground mt-1">{t.subtitle}</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition">
          <Plus size={18} /> {t.create}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="col-span-1 lg:col-span-2 flex items-center gap-2 border rounded-lg px-3 py-2 bg-[var(--primary-foreground)]">
          <Search size={18} className="text-muted-foreground" />
          <input
            className="w-full bg-transparent outline-none"
            placeholder={t.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-[var(--primary-foreground)]">
          <Filter size={18} className="text-muted-foreground" />
          <span className="text-sm text-muted-foreground mr-2">{t.status}</span>
          <select className="bg-transparent outline-none" value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-[var(--primary-foreground)]">
          <Flag size={18} className="text-muted-foreground" />
          <span className="text-sm text-muted-foreground mr-2">{t.priority}</span>
          <select className="bg-transparent outline-none" value={priority} onChange={(e) => setPriority(e.target.value as any)}>
            <option value="all">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      <div className="mt-2 border rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 bg-[var(--primary-foreground)] px-4 py-3 text-sm font-medium text-muted-foreground">
          <div className="col-span-4">Title</div>
          <div className="col-span-2 flex items-center gap-2"><User size={16}/> {t.assignee}</div>
          <div className="col-span-2 flex items-center gap-2"><CalendarDays size={16}/> {t.due}</div>
          <div className="col-span-2 flex items-center gap-2"><Tag size={16}/> {t.tags}</div>
          <div className="col-span-2 text-right">{t.status}</div>
        </div>
        <div className="p-6 text-center text-muted-foreground">
          {t.empty}
        </div>
      </div>
    </div>
  );
};

export default TodosPage;

import { AnimatePresence } from 'motion/react';
import { useMemo, useState } from 'react';
import type { Priority } from '../../core/types';
import { priorityLabel } from '../../i18n';
import { TaskRow } from '../components/TaskRow';
import { useApp } from '../context';
import { Icon } from '../icons';

type Status = 'all' | 'open' | 'done';

export function Search() {
  const { core, t, tick, back } = useApp();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const [priority, setPriority] = useState<Priority | null>(null);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const active = q.trim() !== '' || status !== 'all' || priority !== null || overdueOnly;
  const results = useMemo(
    () => (active ? core.search(q, { status, priority, overdueOnly }) : []),
    [core, tick, q, status, priority, overdueOnly, active],
  );
  return (
    <div className="screen" data-testid="search">
      <header className="topbar">
        <button className="icon-btn" aria-label={t.close} onClick={back}>
          <Icon name="back" className="flip" />
        </button>
        <h1>{t.search}</h1>
      </header>
      <label className="search-box">
        <Icon name="search" />
        <input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPlaceholder} aria-label={t.search} />
      </label>
      <div className="seg" style={{ marginBottom: 8 }}>
        {(['all', 'open', 'done'] as Status[]).map((s) => (
          <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)}>
            {s === 'all' ? t.filterAll : s === 'open' ? t.filterOpen : t.filterDone}
          </button>
        ))}
        <button aria-pressed={overdueOnly} onClick={() => setOverdueOnly(!overdueOnly)}>
          {t.filterOverdue}
        </button>
      </div>
      <div className="seg" style={{ marginBottom: 16 }}>
        {(['high', 'medium', 'low'] as Priority[]).map((p) => (
          <button key={p} aria-pressed={priority === p} onClick={() => setPriority(priority === p ? null : p)}>
            {priorityLabel(t, p)}
          </button>
        ))}
      </div>
      {active && results.length === 0 && <div className="empty">{t.noResults}</div>}
      <div className="list">
        <AnimatePresence initial={false}>
          {results.map((task) => (
            <TaskRow key={task.id} task={task} showDate />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

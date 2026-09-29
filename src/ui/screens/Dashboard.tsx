import { AnimatePresence, motion } from 'motion/react';
import { useMemo } from 'react';
import { formatDay, formatTime } from '../../i18n';
import { Bar, ProgressRing } from '../components/Progress';
import { SPRING, TaskRow } from '../components/TaskRow';
import { useApp } from '../context';
import { Icon } from '../icons';
import { UpdateBanner } from '../components/UpdateBanner';

export function Dashboard() {
  const { core, lang, t, tick, navigate, openEditor } = useApp();
  const d = useMemo(() => core.dashboard(), [core, tick]);
  const hour = core.now().getHours();
  const greeting = hour < 12 ? t.greetingMorning : hour < 17 ? t.greetingDay : t.greetingEvening;
  const left = d.progress.total - d.progress.done;
  const allDone = d.progress.total > 0 && left === 0;
  const list = [...d.overdue, ...d.tasks];
  const cats = core.categories();
  const inbox = d.categories.find((c) => c.categoryId === null)!;

  return (
    <div className="screen" data-testid="dashboard">
      <header className="topbar">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sub">{greeting}</div>
          <h1 data-testid="today-date">{formatDay(lang, d.today)}</h1>
        </div>
        <button className="icon-btn" aria-label={t.search} onClick={() => navigate({ name: 'search' })}>
          <Icon name="search" />
        </button>
      </header>

      <UpdateBanner />

      <motion.section className="hero" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>
        <ProgressRing done={d.progress.done} total={d.progress.total} />
        <div>
          <h2 data-testid="progress-text">{allDone ? t.allDoneShort : d.progress.total ? t.tasksLeft(left) : t.today}</h2>
          <div className="chips">
            {d.overdue.length > 0 && <span className="chip red">{t.overdueCount(d.overdue.length)}</span>}
            {core.settings.bedtimeEnabled && (
              <span className="chip">
                <Icon name="bell" small />
                {t.bedtimeChip(formatTime(lang, core.settings.bedtimeTime))}
              </span>
            )}
          </div>
          <div className="visually-hidden">{t.progress(d.progress.done, d.progress.total)}</div>
        </div>
      </motion.section>

      <div className="cat-grid">
        {cats.map((c, i) => {
          const p = d.categories.find((x) => x.categoryId === c.id)!;
          return (
            <motion.button
              key={c.id}
              className={`cat-card c-${c.color}`}
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ ...SPRING, delay: 0.05 + i * 0.05 }}
              onClick={() => navigate({ name: 'list', categoryId: c.id })}
              data-testid={`cat-card-${c.name}`}
            >
              <span className="e">{c.emoji}</span>
              <span className="nm">{c.name}</span>
              <span className="rm">{p.total ? t.leftCount(p.left) : t.taskCount(0)}</span>
              <Bar ratio={p.total ? (p.total - p.left) / p.total : 0} />
            </motion.button>
          );
        })}
        {inbox.total > 0 && (
          <motion.button className="cat-card c-inbox" whileTap={{ scale: 0.95 }} onClick={() => navigate({ name: 'list', categoryId: null })}>
            <span className="e">
              <Icon name="inbox" />
            </span>
            <span className="nm">{t.inbox}</span>
            <span className="rm">{t.leftCount(inbox.left)}</span>
            <Bar ratio={(inbox.total - inbox.left) / inbox.total} />
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {allDone && (
          <motion.div className="celebrate" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={SPRING}>
            {t.allDone}
          </motion.div>
        )}
      </AnimatePresence>

      <h2 className="section-h">
        {t.todaysTasks}
        <span>{t.taskCount(list.length)}</span>
      </h2>
      {list.length === 0 ? (
        <div className="empty">{t.nothingToday}</div>
      ) : (
        <div className="list">
          <AnimatePresence initial={false}>
            {list.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {d.undated.length > 0 && (
        <section data-testid="undated">
          <h2 className="section-h">
            {t.noDate}
            <span>{t.taskCount(d.undated.length)}</span>
          </h2>
          <div className="list">
            <AnimatePresence initial={false}>
              {d.undated.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      <section className="tomorrow" id="tomorrow" data-testid="tomorrow">
        <div className="tomorrow-h">
          <div>
            <div className="e">{t.tomorrow}</div>
            <h3>{formatDay(lang, d.tomorrow)}</h3>
          </div>
          <span className="chip">{t.taskCount(d.tomorrowItems.length)}</span>
        </div>
        {d.tomorrowItems.length === 0 ? (
          <p className="muted" style={{ margin: '10px 0 0' }}>
            {t.tomorrowEmpty}
          </p>
        ) : (
          <ul>
            {d.tomorrowItems.map((o) => {
              const cat = core.category(o.task.categoryId);
              return (
                <li key={`${o.task.id}-${o.date}`} className={cat ? `c-${cat.color}` : 'c-inbox'}>
                  <button onClick={() => openEditor({ taskId: o.task.id })}>
                    <span className="tm num">{o.task.time ? formatTime(lang, o.task.time) : ''}</span>
                    <i className="dot" />
                    <span className="tt">{o.task.title}</span>
                    {o.task.repeat && (
                      <span className="rp">
                        <Icon name="repeat" small />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

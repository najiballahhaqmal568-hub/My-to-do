import { AnimatePresence, motion } from 'motion/react';
import { useMemo } from 'react';
import { formatDay, formatTime } from '../../i18n';
import { Bar, ProgressRing } from '../components/Progress';
import { SPRING, TaskRow } from '../components/TaskRow';
import { useApp } from '../context';
import { Icon } from '../icons';
import { UpdateBanner } from '../components/UpdateBanner';
import { OrderBar } from '../components/OrderBar';
import { ManualList } from './ListScreen';

export function Dashboard() {
  const { core, lang, t, tick, navigate, openEditor } = useApp();
  const d = useMemo(() => core.dashboard(), [core, tick]);
  const hour = core.now().getHours();
  const greeting = hour < 12 ? t.greetingMorning : hour < 17 ? t.greetingDay : t.greetingEvening;
  const left = d.progress.total - d.progress.done;
  const allDone = d.progress.total > 0 && left === 0;
  const list = d.todayList;
  const manual = core.dashboardOrder() === 'manual';
  const openList = list.filter((x) => !x.done);
  const doneList = list.filter((x) => x.done);
  const cats = core.categories();
  const inbox = d.categories.find((c) => c.categoryId === null)!;

  return (
    <div className="screen" data-testid="dashboard">
      <header className="topbar">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{t.dashboard}</h1>
          <div className="sub">
            <span data-testid="today-date">{formatDay(lang, d.today)}</span>
            {' — '}
            <span data-testid="today-count">{t.taskCount(list.length)}</span>
          </div>
        </div>
        <button className="icon-btn" aria-label={t.stats} data-testid="open-stats" onClick={() => navigate({ name: 'stats' })}>
          <Icon name="chart" />
        </button>
        <button className="icon-btn" aria-label={t.search} onClick={() => navigate({ name: 'search' })}>
          <Icon name="search" />
        </button>
      </header>

      <UpdateBanner />

      <AnimatePresence>
        {allDone && (
          <motion.div className="celebrate" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={SPRING}>
            {t.allDone}
          </motion.div>
        )}
      </AnimatePresence>

      <OrderBar value={core.dashboardOrder()} options={['time', 'newest', 'priority', 'title', 'manual']} onChange={(o) => core.setDashboardOrder(o)} />
      {manual && openList.length > 1 && <p className="muted mode-hint">{t.orderHint}</p>}
      {list.length === 0 ? (
        <div className="empty">{t.nothingToday}</div>
      ) : manual ? (
        <>
          {openList.length > 0 && <ManualList tasks={openList} onReorder={(ids) => core.reorderToday(ids)} showCategory showDate={false} todayButton={false} />}
          {doneList.length > 0 && (
            <div className="list">
              <AnimatePresence initial={false}>
                {doneList.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      ) : (
        <div className="list">
          <AnimatePresence initial={false}>
            {list.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </AnimatePresence>
        </div>
      )}


      <h2 className="section-h">{t.dayOverview}</h2>
      <motion.section className="hero" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>
        <ProgressRing done={d.progress.done} total={d.progress.total} />
        <div>
          <div className="sub">{greeting}</div>
          <h2 data-testid="progress-text">{allDone ? t.allDoneShort : d.progress.total ? t.tasksLeft(left) : t.today}</h2>
          <div className="chips">
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
          // A category switched off for Today shows no card there.
          if (c.daily === false) return null;
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

import { AnimatePresence } from 'motion/react';
import { useMemo } from 'react';
import { formatDayShort, weekdayName } from '../../i18n';
import { TaskRow } from '../components/TaskRow';
import { useApp } from '../context';

export function Upcoming() {
  const { core, lang, t, tick } = useApp();
  const days = useMemo(() => core.upcoming(7), [core, tick]);
  return (
    <div className="screen" data-testid="upcoming">
      <header className="topbar">
        <h1>{t.upcoming}</h1>
      </header>
      {days.map((g, i) => (
        <section className="day-group" key={g.date} data-testid="day-group">
          <h3>
            {i === 0 ? t.tomorrow : weekdayName(lang, g.date)}
            <small>{formatDayShort(lang, g.date)}</small>
          </h3>
          {g.items.length === 0 ? (
            <div className="empty" style={{ padding: 12 }}>
              {t.nothingThatDay}
            </div>
          ) : (
            <div className="list">
              <AnimatePresence initial={false}>
                {g.items.map((o) => (
                  <TaskRow key={`${o.task.id}-${o.date}`} task={o.task} projected={o.projected} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

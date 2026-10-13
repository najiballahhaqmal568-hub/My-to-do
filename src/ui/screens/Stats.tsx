import { motion } from 'motion/react';
import { useMemo } from 'react';
import { digits, weekHeader } from '../../i18n';
import { SPRING } from '../components/TaskRow';
import { useApp } from '../context';
import { Icon } from '../icons';

export function Stats() {
  const { core, lang, t, tick, back } = useApp();
  const cards = useMemo(
    () => [
      { id: 'all', name: t.allCategories, emoji: '📊', cls: 'c-teal', stats: core.stats('all') },
      ...core.categories().map((c) => ({ id: c.id, name: c.name, emoji: c.emoji, cls: `c-${c.color}`, stats: core.stats(c.id) })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [core, tick, t],
  );
  const initials = weekHeader(lang);
  return (
    <div className="screen" data-testid="stats">
      <header className="topbar">
        <button className="icon-btn" aria-label={t.close} onClick={back}>
          <Icon name="back" className="flip" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{t.stats}</h1>
          <div className="sub">{t.statsHint}</div>
        </div>
      </header>
      <div className="list">
        {cards.map((c, i) => {
          const max = Math.max(1, ...c.stats.days.map((d) => d.count));
          return (
            <motion.section
              key={c.id}
              className={`stat-card ${c.cls}`}
              data-testid={`stat-${c.id}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING, delay: i * 0.04 }}
            >
              <div className="stat-head">
                <span className="stat-name">
                  <span className="e">{c.emoji}</span>
                  {c.name}
                </span>
                <span className="chip streak" data-testid="streak">
                  {c.stats.streak > 0 ? '🔥 ' : ''}
                  {t.streakDays(c.stats.streak)}
                </span>
              </div>
              <div className="bars" role="img" aria-label={t.thisWeek(c.stats.weekTotal)}>
                {c.stats.days.map((d, k) => (
                  <div key={d.date} className={`bar-col${d.future ? ' future' : ''}${d.date === core.today() ? ' today' : ''}`} data-count={d.count}>
                    <span className="n num">{d.future ? '' : digits(lang, d.count)}</span>
                    <span className="track">
                      <motion.i initial={{ height: 0 }} animate={{ height: `${(d.count / max) * 100}%` }} transition={{ ...SPRING, delay: 0.1 + k * 0.03 }} />
                    </span>
                    <span className="wd">{initials[k]}</span>
                  </div>
                ))}
              </div>
              <div className="stat-foot">
                <span data-testid="week-total">{t.thisWeek(c.stats.weekTotal)}</span>
                <span className="muted">{t.lastWeek(c.stats.lastWeekTotal)}</span>
              </div>
            </motion.section>
          );
        })}
      </div>
    </div>
  );
}

import { motion } from 'motion/react';
import { useMemo } from 'react';
import { SPRING } from '../components/TaskRow';
import { useApp } from '../context';
import { Icon } from '../icons';

export function Categories({ onEdit }: { onEdit(categoryId: string | null): void }) {
  const { core, t, tick, navigate } = useApp();
  const cats = useMemo(() => core.categories(), [core, tick]);
  return (
    <div className="screen" data-testid="categories">
      <header className="topbar">
        <h1>{t.categories}</h1>
        <button className="icon-btn" aria-label={t.newCategory} onClick={() => onEdit(null)}>
          <Icon name="plus" />
        </button>
      </header>
      <div className="list">
        {cats.map((c, i) => (
          <motion.div key={c.id} layout className={`cat-item c-${c.color}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: i * 0.03 }}>
            <button className="e" onClick={() => navigate({ name: 'list', categoryId: c.id })} aria-label={c.name}>
              {c.emoji}
            </button>
            <button className="grow" style={{ textAlign: 'start' }} onClick={() => navigate({ name: 'list', categoryId: c.id })}>
              {c.name}
              <small>{t.leftCount(core.openCount(c.id))}</small>
            </button>
            <button aria-label="up" onClick={() => core.moveCategory(c.id, -1)} disabled={i === 0}>
              <Icon name="up" small />
            </button>
            <button aria-label="down" onClick={() => core.moveCategory(c.id, 1)} disabled={i === cats.length - 1}>
              <Icon name="down" small />
            </button>
            <button aria-label={t.editCategory} onClick={() => onEdit(c.id)}>
              <Icon name="edit" small />
            </button>
          </motion.div>
        ))}
        <div className="cat-item c-inbox">
          <button className="e" onClick={() => navigate({ name: 'list', categoryId: null })} aria-label={t.inbox}>
            <Icon name="inbox" />
          </button>
          <button className="grow" style={{ textAlign: 'start' }} onClick={() => navigate({ name: 'list', categoryId: null })}>
            {t.inbox}
            <small>{t.leftCount(core.openCount(null))}</small>
          </button>
        </div>
      </div>
    </div>
  );
}

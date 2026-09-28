import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { TaskRow } from '../components/TaskRow';
import { useApp } from '../context';
import { Icon } from '../icons';

export function ListScreen({ categoryId }: { categoryId: string | null }) {
  const { core, t, tick, back } = useApp();
  const [showDone, setShowDone] = useState(false);
  const view = useMemo(() => core.list(categoryId), [core, categoryId, tick]);
  const cat = core.category(categoryId);
  return (
    <div className={`screen ${cat ? `c-${cat.color}` : 'c-inbox'}`} data-testid="list-screen">
      <header className="topbar">
        <button className="icon-btn" aria-label={t.close} onClick={back}>
          <Icon name="back" className="flip" />
        </button>
        <h1>
          {cat ? `${cat.emoji} ${cat.name}` : t.inbox}
        </h1>
      </header>
      {view.open.length === 0 ? (
        <div className="empty">{t.nothingHere}</div>
      ) : (
        <div className="list">
          <AnimatePresence initial={false}>
            {view.open.map((task) => (
              <TaskRow key={task.id} task={task} showCategory={false} showDate />
            ))}
          </AnimatePresence>
        </div>
      )}
      {view.done.length > 0 && (
        <>
          <button className="completed-toggle" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>
            <span className="chev">
              <Icon name="chevron" small />
            </span>
            {t.completed} ({view.done.length})
          </button>
          <AnimatePresence initial={false}>
            {showDone && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                <div className="list">
                  <AnimatePresence initial={false}>
                    {view.done.map((task) => (
                      <TaskRow key={task.id} task={task} showCategory={false} showDate />
                    ))}
                  </AnimatePresence>
                </div>
                <button className="text-btn danger" onClick={() => core.clearCompleted(categoryId)}>
                  {t.clearCompleted}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

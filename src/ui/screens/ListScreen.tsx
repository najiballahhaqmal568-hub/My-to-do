import { AnimatePresence, motion, Reorder, useDragControls } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Task } from '../../core/types';
import { OrderBar } from '../components/OrderBar';
import { TaskRow } from '../components/TaskRow';
import { useApp } from '../context';
import { Icon } from '../icons';

export function ListScreen({ categoryId }: { categoryId: string | null }) {
  const { core, t, tick, back } = useApp();
  const [showDone, setShowDone] = useState(false);
  const view = useMemo(() => core.list(categoryId), [core, categoryId, tick]);
  const cat = core.category(categoryId);
  const manual = core.isManual(categoryId);
  return (
    <div className={`screen ${cat ? `c-${cat.color}` : 'c-inbox'}`} data-testid="list-screen">
      <header className="topbar">
        <button className="icon-btn" aria-label={t.close} onClick={back}>
          <Icon name="back" className="flip" />
        </button>
        <h1>{cat ? `${cat.emoji} ${cat.name}` : t.inbox}</h1>
      </header>
      <OrderBar value={core.listOrder(categoryId)} options={['time', 'newest', 'priority', 'title', 'manual']} onChange={(o) => core.setListOrder(categoryId, o)} />
      {manual && <p className="muted mode-hint">{t.orderHint}</p>}
      {view.open.length === 0 ? (
        <div className="empty">{t.nothingHere}</div>
      ) : manual ? (
        <ManualList tasks={view.open} categoryId={categoryId} />
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

/** A list the user arranges by hand: drag the handle, or press the arrow keys while it has focus. */
function ManualList({ tasks, categoryId }: { tasks: Task[]; categoryId: string | null }) {
  const { core } = useApp();
  const ids = tasks.map((x) => x.id);
  const key = ids.join('|');
  const [order, setOrder] = useState(ids);
  const latest = useRef(order);
  latest.current = order;
  useEffect(() => setOrder(ids), [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = new Map(tasks.map((x) => [x.id, x]));
  const shown = [...order.filter((id) => byId.has(id)), ...ids.filter((id) => !order.includes(id))];

  const commit = (next: string[]) => {
    setOrder(next);
    core.reorder(categoryId, next);
  };
  const move = (id: string, delta: -1 | 1) => {
    const list = [...shown];
    const i = list.indexOf(id);
    const j = i + delta;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    commit(list);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-handle="${id}"]`)?.focus());
  };

  return (
    <Reorder.Group axis="y" values={shown} onReorder={setOrder} as="div" className="list" data-testid="manual-list">
      {shown.map((id) => (
        <ManualRow key={id} task={byId.get(id)!} onDrop={() => core.reorder(categoryId, latest.current)} onMove={move} />
      ))}
    </Reorder.Group>
  );
}

function ManualRow({ task, onDrop, onMove }: { task: Task; onDrop: () => void; onMove: (id: string, delta: -1 | 1) => void }) {
  const { t } = useApp();
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={task.id}
      as="div"
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      whileDrag={{ scale: 1.02, zIndex: 5, boxShadow: '0 12px 30px rgba(0,0,0,0.18)' }}
      style={{ position: 'relative', borderRadius: 20 }}
    >
      <TaskRow
        task={task}
        showCategory={false}
        showDate
        plain
        handle={
          <button
            className="drag-handle"
            data-handle={task.id}
            aria-label={`${t.dragHandle}: ${task.title}`}
            onPointerDown={(e) => {
              e.preventDefault();
              controls.start(e);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                onMove(task.id, e.key === 'ArrowUp' ? -1 : 1);
              }
            }}
          >
            <Icon name="grip" />
          </button>
        }
      />
    </Reorder.Item>
  );
}

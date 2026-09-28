import { motion, useMotionValue, useTransform } from 'motion/react';
import { useRef } from 'react';
import type { Task } from '../../core/types';
import { formatDayShort, formatTime, repeatLabel } from '../../i18n';
import { useApp } from '../context';
import { Icon } from '../icons';

export const SPRING = { type: 'spring', stiffness: 420, damping: 32, mass: 0.9 } as const;

interface Props {
  task: Task;
  showCategory?: boolean;
  showDate?: boolean;
  /** A projected future run of a repeating task: shown, but not completable. */
  projected?: boolean;
}

export function TaskRow({ task, showCategory = true, showDate = false, projected = false }: Props) {
  const { core, lang, t, complete, openEditor } = useApp();
  const x = useMotionValue(0);
  const bgOpacity = useTransform(x, [-110, -12, 0, 12, 110], [1, 0.15, 0, 0.15, 1]);
  const checkRef = useRef<HTMLButtonElement>(null);
  const cat = core.category(task.categoryId);
  const late = !projected && core.isOverdue(task);
  const swipeLabel = task.done ? t.undo : t.done;
  const doneSubs = task.subtasks.filter((s) => s.done).length;

  return (
    <motion.div
      layout="position"
      className={`swipe ${cat ? `c-${cat.color}` : 'c-inbox'}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
      transition={SPRING}
      data-testid="task-row"
      data-title={task.title}
    >
      {!projected && (
        <motion.div className="swipe-bg" style={{ opacity: bgOpacity }} aria-hidden="true">
          <span>{swipeLabel}</span>
          <span>{swipeLabel}</span>
        </motion.div>
      )}
      <motion.div
        className={`row${task.done ? ' done' : ''}${late ? ' late' : ''}${projected ? ' projected' : ''}`}
        style={{ x }}
        drag={projected ? false : 'x'}
        dragDirectionLock
        dragSnapToOrigin
        dragElastic={0.65}
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={(_, info) => {
          if (Math.abs(info.offset.x) > 90) complete(task.id, !task.done, checkRef.current?.getBoundingClientRect());
        }}
      >
        <motion.button
          ref={checkRef}
          className="check"
          disabled={projected}
          aria-pressed={task.done}
          aria-label={`${task.done ? t.undo : t.done}: ${task.title}`}
          whileTap={{ scale: 0.82 }}
          animate={task.done ? { scale: [0.55, 1.18, 1] } : { scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          onClick={(e) => complete(task.id, !task.done, e.currentTarget.getBoundingClientRect())}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12.5l4.2 4.2L19 7" />
          </svg>
        </motion.button>
        <button className="row-main" onClick={() => openEditor({ taskId: task.id })}>
          <div className="row-title">{task.title}</div>
          <div className="meta">
            {showCategory && cat && (
              <span className="catpill">
                {cat.emoji} {cat.name}
              </span>
            )}
            {showCategory && !cat && <span className="catpill">{t.inbox}</span>}
            {late && <span className="late-tag">{t.dueYesterday}</span>}
            {showDate && task.due && (
              <span>
                <Icon name="calendar" small />
                {formatDayShort(lang, task.due)}
              </span>
            )}
            {task.time && (
              <span className="num">
                <Icon name="clock" small />
                {formatTime(lang, task.time)}
              </span>
            )}
            {task.repeat && (
              <span>
                <Icon name="repeat" small />
                {repeatLabel(lang, task.repeat)}
              </span>
            )}
            {task.subtasks.length > 0 && (
              <span>
                <Icon name="subtasks" small />
                {t.subtaskProgress(doneSubs, task.subtasks.length)}
              </span>
            )}
          </div>
        </button>
        {!task.done && task.priority !== 'none' && (
          <span className={`pri ${task.priority}`}>{task.priority === 'high' ? t.important : task.priority === 'medium' ? t.priorityMedium : t.priorityLow}</span>
        )}
      </motion.div>
    </motion.div>
  );
}

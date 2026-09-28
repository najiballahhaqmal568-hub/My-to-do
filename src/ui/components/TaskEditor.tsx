import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { CoreError } from '../../core/core';
import type { Priority, ReminderOffset, RepeatRule, TaskInput } from '../../core/types';
import { WEEK_ORDER, digits, formatDay, priorityLabel, shortWeekday } from '../../i18n';
import { notifications } from '../../platform/notifications';
import { useApp, type EditorRequest } from '../context';
import { Icon } from '../icons';
import { DatePicker } from './DatePicker';

type RepeatKind = 'none' | RepeatRule['kind'];
interface SubDraft {
  id?: string;
  title: string;
  done: boolean;
}

const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high'];
const REPEATS: RepeatKind[] = ['none', 'daily', 'weekly', 'weekdays', 'everyN', 'monthly', 'yearly'];
const REMINDERS: (ReminderOffset | null)[] = [null, 'atTime', '15m', '1h', '1d'];

export function TaskEditor({ request, onClose }: { request: EditorRequest; onClose(): void }) {
  const { core, lang, t, toast } = useApp();
  const existing = request.taskId ? core.task(request.taskId) : undefined;
  const init: TaskInput = existing ?? { title: '', ...request.defaults };

  const [title, setTitle] = useState(init.title);
  const [notes, setNotes] = useState(init.notes ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(init.categoryId ?? null);
  const [due, setDue] = useState(init.due ?? null);
  const [time, setTime] = useState(init.time ?? '');
  const [priority, setPriority] = useState<Priority>(init.priority ?? 'none');
  const [repeatKind, setRepeatKind] = useState<RepeatKind>(init.repeat?.kind ?? 'none');
  const [weekdays, setWeekdays] = useState<number[]>(init.repeat?.kind === 'weekdays' ? init.repeat.days : []);
  const [everyN, setEveryN] = useState(init.repeat?.kind === 'everyN' ? init.repeat.n : 2);
  const [reminder, setReminder] = useState<ReminderOffset | null>(init.reminder ?? null);
  const [subs, setSubs] = useState<SubDraft[]>((init.subtasks ?? []).map((s) => ({ id: s.id, title: s.title, done: !!s.done })));
  const [newSub, setNewSub] = useState('');
  const [pickDate, setPickDate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cats = core.categories();
  const reminderLabel = (r: ReminderOffset | null) =>
    r === null ? t.reminderNone : { atTime: t.reminderAtTime, '15m': t.reminder15m, '1h': t.reminder1h, '1d': t.reminder1d }[r];
  const repeatName = (k: RepeatKind) =>
    ({ none: t.repeatNone, daily: t.repeatDaily, weekly: t.repeatWeekly, weekdays: t.repeatWeekdays, everyN: t.repeatEveryN, monthly: t.repeatMonthly, yearly: t.repeatYearly })[k];

  function rule(): RepeatRule | null {
    if (repeatKind === 'none') return null;
    if (repeatKind === 'weekdays') return { kind: 'weekdays', days: weekdays };
    if (repeatKind === 'everyN') return { kind: 'everyN', n: everyN };
    // Keep the existing anchor when the rule kind and date are unchanged.
    if (existing?.repeat?.kind === repeatKind && existing.due === due) return existing.repeat;
    return { kind: repeatKind } as RepeatRule;
  }

  function addSub() {
    if (!newSub.trim()) return;
    setSubs([...subs, { title: newSub.trim(), done: false }]);
    setNewSub('');
  }

  async function save() {
    const pending = newSub.trim() ? [...subs, { title: newSub.trim(), done: false }] : subs;
    const input: TaskInput = {
      title,
      notes,
      categoryId,
      due,
      time: due && time ? time : null,
      priority,
      repeat: rule(),
      reminder: due && time ? reminder : null,
      subtasks: pending,
    };
    try {
      if (existing) core.updateTask(existing.id, input);
      else core.addTask(input);
    } catch (e) {
      const code = e instanceof CoreError ? e.code : '';
      setError(
        code === 'title-required' ? t.titleRequired : code === 'repeat-needs-due' ? t.repeatNeedsDate : code === 'weekdays-empty' ? t.pickDays : String(e),
      );
      return;
    }
    onClose();
    if (input.reminder) {
      const askExact = !core.settings.exactAlarmAsked;
      await notifications.ensurePermission(askExact);
      if (askExact) core.updateSettings({ exactAlarmAsked: true });
    }
  }

  function remove() {
    if (!existing) return;
    core.deleteTask(existing.id);
    onClose();
    toast(t.deleted, true);
  }

  function skip() {
    if (!existing) return;
    core.skipOccurrence(existing.id);
    onClose();
    toast(t.skipped);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="sheet-h">
        <h2>{existing ? t.editTask : t.newTask}</h2>
        <button type="button" className="icon-btn" aria-label={t.close} onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>

      <div className="field">
        <label htmlFor="task-title">{t.title}</label>
        <input
          id="task-title"
          className="input big"
          value={title}
          autoFocus={!existing}
          placeholder={t.titlePlaceholder}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
        />
      </div>
      {error && <div className="error">{error}</div>}

      <div className="field">
        <span className="label">{t.category}</span>
        <div className="seg">
          <button type="button" className="cat c-inbox" aria-pressed={categoryId === null} onClick={() => setCategoryId(null)}>
            {t.inbox}
          </button>
          {cats.map((c) => (
            <button type="button" key={c.id} className={`cat c-${c.color}`} aria-pressed={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="row2">
        <div className="field">
          <span className="label">{t.date}</span>
          <button type="button" className="input pickbtn" aria-expanded={pickDate} onClick={() => setPickDate(!pickDate)} data-testid="date-field">
            <span>{due ? formatDay(lang, due) : t.noDate}</span>
            <Icon name="calendar" small />
          </button>
        </div>
        <div className="field">
          <label htmlFor="task-time">{t.time}</label>
          <input id="task-time" className="input" type="time" value={time} disabled={!due} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <AnimatePresence initial={false}>
        {pickDate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden', marginBottom: 14 }}>
            <DatePicker
              value={due}
              onChange={(v) => {
                setDue(v);
                setPickDate(false);
                setError(null);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="field">
        <span className="label">{t.priority}</span>
        <div className="seg">
          {PRIORITIES.map((p) => (
            <button type="button" key={p} aria-pressed={priority === p} onClick={() => setPriority(p)}>
              {priorityLabel(t, p)}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="label">{t.repeat}</span>
        <div className="seg">
          {REPEATS.map((k) => (
            <button type="button" key={k} aria-pressed={repeatKind === k} onClick={() => setRepeatKind(k)}>
              {repeatName(k)}
            </button>
          ))}
        </div>
        {repeatKind === 'weekdays' && (
          <div className="seg" style={{ marginTop: 6 }}>
            {WEEK_ORDER.map((d) => (
              <button
                type="button"
                key={d}
                aria-pressed={weekdays.includes(d)}
                onClick={() => setWeekdays(weekdays.includes(d) ? weekdays.filter((x) => x !== d) : [...weekdays, d])}
              >
                {shortWeekday(lang, d)}
              </button>
            ))}
          </div>
        )}
        {repeatKind === 'everyN' && (
          <label className="pickbtn" style={{ marginTop: 6 }}>
            <span className="muted">{t.everyNDays}</span>
            <input className="input" style={{ width: 90 }} type="number" min={1} max={365} value={everyN} onChange={(e) => setEveryN(Math.max(1, Number(e.target.value) || 1))} />
          </label>
        )}
        {repeatKind !== 'none' && !due && <div className="error" style={{ margin: '6px 0 0' }}>{t.repeatNeedsDate}</div>}
      </div>

      <div className="field">
        <span className="label">{t.reminder}</span>
        <div className="seg">
          {REMINDERS.map((r) => (
            <button type="button" key={String(r)} disabled={!time && r !== null} aria-pressed={reminder === r} onClick={() => setReminder(r)}>
              {reminderLabel(r)}
            </button>
          ))}
        </div>
        {!time && <small className="muted">{t.reminderNeedsTime}</small>}
      </div>

      <div className="field">
        <span className="label">
          {t.subtasks} {subs.length > 0 && digits(lang, `${subs.filter((s) => s.done).length}/${subs.length}`)}
        </span>
        {subs.map((s, i) => (
          <div key={s.id ?? `n${i}`} className={`sub-row${s.done ? ' done' : ''}`}>
            <button
              type="button"
              className="check"
              style={s.done ? { background: 'var(--accent)', borderColor: 'var(--accent)' } : undefined}
              aria-pressed={s.done}
              aria-label={s.title}
              onClick={() => setSubs(subs.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
            >
              <svg viewBox="0 0 24 24" style={{ opacity: s.done ? 1 : 0 }}>
                <path d="M5 12.5l4.2 4.2L19 7" />
              </svg>
            </button>
            <input value={s.title} aria-label={t.subtasks} onChange={(e) => setSubs(subs.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
            <button type="button" aria-label={t.delete} onClick={() => setSubs(subs.filter((_, j) => j !== i))}>
              <Icon name="close" small />
            </button>
          </div>
        ))}
        <div className="sub-row">
          <Icon name="plus" small />
          <input
            value={newSub}
            placeholder={t.addSubtask}
            aria-label={t.addSubtask}
            onChange={(e) => setNewSub(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSub();
              }
            }}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="task-notes">{t.notes}</label>
        <textarea id="task-notes" className="input" value={notes} placeholder={t.notesPlaceholder} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="actions">
        <button type="submit" className="btn primary">
          {t.save}
        </button>
        {existing?.repeat && !existing.done && (
          <button type="button" className="btn" onClick={skip}>
            <Icon name="skip" small />
            {t.skipOccurrence}
          </button>
        )}
        {existing && (
          <button type="button" className="btn danger" onClick={remove}>
            <Icon name="trash" small />
            {t.delete}
          </button>
        )}
      </div>
    </form>
  );
}

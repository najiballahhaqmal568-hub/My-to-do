import { MESSAGES, formatDay, formatTime, normalizeText } from '../i18n';
import { addDays, atLocal, localISO, weekday, type ISODate } from './dates';
import { nextDate, normalizeRule } from './recurrence';
import type {
  Category,
  CategoryColor,
  Clock,
  Data,
  ListOrder,
  Occurrence,
  PlannedNotification,
  Priority,
  RepeatRule,
  Settings,
  StoragePort,
  Subtask,
  Task,
  TaskInput,
} from './types';

export const BACKUP_VERSION = 1;

export type CoreErrorCode =
  | 'title-required'
  | 'repeat-needs-due'
  | 'weekdays-empty'
  | 'every-n-invalid'
  | 'not-found'
  | 'not-repeating'
  | 'name-required'
  | 'backup-invalid'
  | 'backup-newer';

export class CoreError extends Error {
  constructor(public code: CoreErrorCode) {
    super(code);
  }
}

type UndoEntry = { kind: 'delete'; task: Task; index: number } | { kind: 'complete'; before: Task };

export interface ListView {
  open: Task[];
  done: Task[];
}

export interface CategoryProgress {
  categoryId: string | null;
  left: number;
  total: number;
}

export interface Dashboard {
  today: ISODate;
  tomorrow: ISODate;
  progress: { done: number; total: number };
  overdue: Task[];
  /** Today's tasks: open ones first, then the ones completed today. */
  tasks: Task[];
  /** Open tasks with no due date; they are not part of today's progress. */
  undated: Task[];
  /** Per category: today's and overdue tasks plus open undated ones. */
  categories: CategoryProgress[];
  tomorrowItems: Occurrence[];
}

export interface DayGroup {
  date: ISODate;
  items: Occurrence[];
}

export interface CategoryStats {
  /** This week, Saturday first. */
  days: { date: ISODate; count: number; future: boolean }[];
  weekTotal: number;
  lastWeekTotal: number;
  /** Days in a row with at least one completed task, counting back from today (or yesterday if today has none yet). */
  streak: number;
  today: number;
}

export interface SearchFilters {
  priority?: Priority | null;
  status?: 'all' | 'open' | 'done';
  overdueOnly?: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  language: 'fa',
  bedtimeEnabled: true,
  bedtimeTime: '22:00',
  exactAlarmAsked: false,
  autoBackup: true,
  lastBackup: null,
  backupReminder: true,
  listOrders: {},
};
const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2, none: 3 };
const REMINDER_MINUTES = { atTime: 0, '15m': 15, '1h': 60, '1d': 1440 } as const;

export function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function seedData(): Data {
  const cat = (id: string, name: string, emoji: string, color: CategoryColor, order: number): Category => ({ id, name, emoji, color, order });
  return {
    version: 1,
    tasks: [],
    categories: [cat('sport', 'ورزش', '🏃', 'green', 0), cat('shop', 'دوکان', '🏪', 'orange', 1), cat('study', 'مطالعه', '📚', 'indigo', 2)],
    settings: { ...DEFAULT_SETTINGS },
    history: {},
  };
}

const listKey = (categoryId: string | null) => categoryId ?? '_inbox';
const TODAY_KEY = '_today';

/** A stable positive 31-bit id for a notification key (FNV-1a). */
export function notificationId(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 1) || 1;
}

/**
 * The Task Core: every rule of the app lives here. It knows nothing about React, IndexedDB or Android;
 * it is given a clock and a storage port, and the UI reads it through queries and changes it through commands.
 */
export class TaskCore {
  private listeners = new Set<() => void>();
  private saving: Promise<void> = Promise.resolve();
  private lastUndo: UndoEntry | null = null;
  /** Increments on every change; lets React subscribe with useSyncExternalStore. */
  version = 0;

  private constructor(
    private clock: Clock,
    private storage: StoragePort,
    private data: Data,
  ) {}

  static async open(deps: { clock: Clock; storage: StoragePort }): Promise<TaskCore> {
    const loaded = await deps.storage.load();
    const core = new TaskCore(deps.clock, deps.storage, loaded ? withDefaults(loaded) : seedData());
    if (!loaded) core.persist();
    await core.flush();
    return core;
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  /** Resolves once every change so far has been written to storage. */
  flush(): Promise<void> {
    return this.saving;
  }

  private persist() {
    const snapshot = this.data;
    this.saving = this.saving.then(() => this.storage.save(snapshot)).catch((e) => console.error('save failed', e));
  }

  private commit(next: Data) {
    this.data = next;
    this.version++;
    this.persist();
    this.listeners.forEach((fn) => fn());
  }

  private setTasks(tasks: Task[], history = this.data.history) {
    this.commit({ ...this.data, tasks, history });
  }

  /** A copy of the history with one completion added to (or taken from) a day. */
  private bumped(categoryId: string | null, day: ISODate, delta: number): Data['history'] {
    const history = { ...this.data.history };
    const dayCounts = { ...(history[day] ?? {}) };
    const key = listKey(categoryId);
    const next = (dayCounts[key] ?? 0) + delta;
    if (next > 0) dayCounts[key] = next;
    else delete dayCounts[key];
    if (Object.keys(dayCounts).length) history[day] = dayCounts;
    else delete history[day];
    return history;
  }

  private find(id: string): Task {
    const t = this.data.tasks.find((x) => x.id === id);
    if (!t) throw new CoreError('not-found');
    return t;
  }

  private replace(task: Task, tasks = this.data.tasks): Task[] {
    return tasks.map((x) => (x.id === task.id ? task : x));
  }

  /* ---------------- clock ---------------- */

  now(): Date {
    return this.clock.now();
  }

  today(): ISODate {
    return localISO(this.clock.now());
  }

  /* ---------------- task commands ---------------- */

  addTask(input: TaskInput): Task {
    const task = this.build({ id: newId(), createdAt: this.now().toISOString(), done: false, completedAt: null, spawnedId: null }, input);
    const placed = this.isManual(task.categoryId) ? { ...task, pos: this.topPos(task.categoryId) } : task;
    this.setTasks([...this.data.tasks, placed]);
    return placed;
  }

  updateTask(id: string, patch: Partial<TaskInput>): Task {
    const old = this.find(id);
    let repeat = patch.repeat !== undefined ? patch.repeat : old.repeat;
    if (patch.due !== undefined && patch.due !== old.due && repeat && patch.repeat === undefined) {
      // Re-anchor monthly/yearly repeats on the new due date.
      if (repeat.kind === 'monthly' || repeat.kind === 'yearly') repeat = { kind: repeat.kind };
    }
    const merged: TaskInput = {
      title: patch.title ?? old.title,
      notes: patch.notes ?? old.notes,
      categoryId: patch.categoryId !== undefined ? patch.categoryId : old.categoryId,
      due: patch.due !== undefined ? patch.due : old.due,
      time: patch.time !== undefined ? patch.time : old.time,
      priority: patch.priority ?? old.priority,
      repeat,
      reminder: patch.reminder !== undefined ? patch.reminder : old.reminder,
      subtasks: patch.subtasks ?? old.subtasks,
    };
    let task = this.build({ ...old, snoozedUntil: null }, merged);
    if (task.categoryId !== old.categoryId && this.isManual(task.categoryId)) task = { ...task, pos: this.topPos(task.categoryId) };
    this.setTasks(this.replace(task));
    return task;
  }

  private build(base: Pick<Task, 'id' | 'createdAt' | 'done' | 'completedAt'> & Partial<Task>, input: TaskInput): Task {
    const title = input.title.trim();
    if (!title) throw new CoreError('title-required');
    const due = input.due || null;
    const time = due && input.time ? input.time : null;
    let repeat: RepeatRule | null = input.repeat ?? null;
    if (repeat) {
      if (!due) throw new CoreError('repeat-needs-due');
      try {
        repeat = normalizeRule(repeat, due);
      } catch (e) {
        throw new CoreError((e as Error).message as CoreErrorCode);
      }
    }
    const categoryId = input.categoryId && this.data.categories.some((c) => c.id === input.categoryId) ? input.categoryId : null;
    const subtasks: Subtask[] = (input.subtasks ?? [])
      .filter((s) => s.title.trim())
      .map((s) => ({ id: s.id ?? newId(), title: s.title.trim(), done: !!s.done }));
    return {
      spawnedId: null,
      ...base,
      title,
      notes: (input.notes ?? '').trim(),
      categoryId,
      due,
      time,
      priority: input.priority ?? 'none',
      repeat,
      reminder: time ? (input.reminder ?? null) : null,
      subtasks,
    } as Task;
  }

  /** Marks a task done or not done. Completing a repeating task creates its next occurrence. */
  setDone(id: string, done: boolean): void {
    const task = this.find(id);
    if (task.done === done) return;
    if (done) {
      const completed: Task = { ...task, done: true, completedAt: this.now().toISOString(), spawnedId: null, snoozedUntil: null };
      let tasks = this.data.tasks;
      if (task.repeat && task.due) {
        const next: Task = {
          ...task,
          id: newId(),
          due: nextDate(task.repeat, task.due),
          done: false,
          completedAt: null,
          createdAt: this.now().toISOString(),
          spawnedId: null,
          snoozedUntil: null,
          subtasks: task.subtasks.map((s) => ({ ...s, id: newId(), done: false })),
        };
        completed.spawnedId = next.id;
        tasks = [...tasks, next];
      }
      this.lastUndo = { kind: 'complete', before: task };
      this.setTasks(this.replace(completed, tasks), this.bumped(task.categoryId, this.today(), 1));
    } else {
      this.lastUndo = null;
      this.setTasks(this.reopen(task), this.uncounted(task));
    }
  }

  /** Reopens a completed task and removes the next occurrence it created, unless that one is already done. */
  /** The history without the completion of a task that is being reopened. */
  private uncounted(task: Task): Data['history'] {
    return task.done && task.completedAt ? this.bumped(task.categoryId, localISO(new Date(task.completedAt)), -1) : this.data.history;
  }

  private reopen(task: Task, restored?: Task): Task[] {
    const spawned = task.spawnedId ? this.data.tasks.find((x) => x.id === task.spawnedId) : undefined;
    const tasks = spawned && !spawned.done ? this.data.tasks.filter((x) => x.id !== spawned.id) : this.data.tasks;
    return this.replace(restored ?? { ...task, done: false, completedAt: null, spawnedId: null }, tasks);
  }

  deleteTask(id: string): void {
    const index = this.data.tasks.findIndex((x) => x.id === id);
    if (index < 0) throw new CoreError('not-found');
    this.lastUndo = { kind: 'delete', task: this.data.tasks[index], index };
    this.setTasks(this.data.tasks.filter((x) => x.id !== id));
  }

  canUndo(): boolean {
    return this.lastUndo !== null;
  }

  /** Reverses the most recent delete or completion. Returns what was undone. */
  undo(): 'delete' | 'complete' | null {
    const u = this.lastUndo;
    if (!u) return null;
    this.lastUndo = null;
    if (u.kind === 'delete') {
      const tasks = [...this.data.tasks];
      tasks.splice(Math.min(u.index, tasks.length), 0, u.task);
      this.setTasks(tasks);
    } else {
      const current = this.data.tasks.find((x) => x.id === u.before.id);
      if (!current) return null;
      this.setTasks(this.reopen(current, u.before), this.uncounted(current));
    }
    return u.kind;
  }

  toggleSubtask(taskId: string, subtaskId: string): void {
    const t = this.find(taskId);
    this.setTasks(this.replace({ ...t, subtasks: t.subtasks.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s)) }));
  }

  /** «بعداً» on a reminder: ring again after `minutes`. */
  snoozeReminder(id: string, minutes = 15): void {
    const t = this.find(id);
    this.setTasks(this.replace({ ...t, snoozedUntil: new Date(this.now().getTime() + minutes * 60000).toISOString() }));
  }

  /** Moves a repeating task to its next occurrence without completing it. */
  skipOccurrence(id: string): Task {
    const t = this.find(id);
    if (!t.repeat || !t.due) throw new CoreError('not-repeating');
    const next: Task = { ...t, due: nextDate(t.repeat, t.due), snoozedUntil: null, subtasks: t.subtasks.map((s) => ({ ...s, done: false })) };
    this.setTasks(this.replace(next));
    return next;
  }

  /** Deletes the completed tasks of a category, or of the Inbox when `categoryId` is null. */
  clearCompleted(categoryId: string | null): void {
    this.lastUndo = null;
    this.setTasks(this.data.tasks.filter((t) => !(t.done && t.categoryId === categoryId)));
  }

  /* ---------------- categories ---------------- */

  addCategory(input: { name: string; emoji: string; color: CategoryColor }): Category {
    const name = input.name.trim();
    if (!name) throw new CoreError('name-required');
    const order = Math.max(-1, ...this.data.categories.map((c) => c.order)) + 1;
    const cat: Category = { id: newId(), name, emoji: input.emoji.trim() || '📌', color: input.color, order };
    this.commit({ ...this.data, categories: [...this.data.categories, cat] });
    return cat;
  }

  updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'emoji' | 'color'>>): void {
    if (patch.name !== undefined && !patch.name.trim()) throw new CoreError('name-required');
    this.commit({
      ...this.data,
      categories: this.data.categories.map((c) =>
        c.id === id ? { ...c, ...patch, name: (patch.name ?? c.name).trim(), emoji: (patch.emoji ?? c.emoji).trim() || c.emoji } : c,
      ),
    });
  }

  deleteCategory(id: string, mode: 'moveToInbox' | 'deleteTasks'): void {
    this.lastUndo = null;
    const tasks =
      mode === 'moveToInbox'
        ? this.data.tasks.map((t) => (t.categoryId === id ? { ...t, categoryId: null } : t))
        : this.data.tasks.filter((t) => t.categoryId !== id);
    this.commit({ ...this.data, tasks, categories: this.data.categories.filter((c) => c.id !== id) });
  }

  moveCategory(id: string, delta: -1 | 1): void {
    const list = this.categories();
    const i = list.findIndex((c) => c.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const order = new Map(list.map((c, k) => [c.id, k]));
    this.commit({ ...this.data, categories: this.data.categories.map((c) => ({ ...c, order: order.get(c.id)! })) });
  }

  /* ---------------- settings & backup ---------------- */

  updateSettings(patch: Partial<Settings>): void {
    this.commit({ ...this.data, settings: { ...this.data.settings, ...patch } });
  }

  exportBackup(): string {
    return JSON.stringify({ app: 'my-to-do', version: BACKUP_VERSION, exportedAt: this.now().toISOString(), data: this.data }, null, 2);
  }

  /** Replaces all data with a backup. Throws `backup-invalid` or `backup-newer` and leaves data untouched on failure. */
  importBackup(text: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new CoreError('backup-invalid');
    }
    const p = parsed as { app?: unknown; version?: unknown; data?: Partial<Data> };
    if (!p || p.app !== 'my-to-do' || typeof p.version !== 'number' || !p.data) throw new CoreError('backup-invalid');
    if (p.version > BACKUP_VERSION) throw new CoreError('backup-newer');
    const d = p.data;
    const validTasks = Array.isArray(d.tasks) && d.tasks.every((t) => t && typeof t.id === 'string' && typeof t.title === 'string');
    const validCats = Array.isArray(d.categories) && d.categories.every((c) => c && typeof c.id === 'string' && typeof c.name === 'string');
    if (!validTasks || !validCats) throw new CoreError('backup-invalid');
    this.lastUndo = null;
    this.commit(withDefaults(d as Data));
  }

  /* ---------------- queries ---------------- */

  get settings(): Settings {
    return this.data.settings;
  }

  task(id: string): Task | undefined {
    return this.data.tasks.find((t) => t.id === id);
  }

  categories(): Category[] {
    return [...this.data.categories].sort((a, b) => a.order - b.order);
  }

  category(id: string | null): Category | undefined {
    return id ? this.data.categories.find((c) => c.id === id) : undefined;
  }

  isOverdue(t: Task, today = this.today()): boolean {
    return !t.done && !!t.due && t.due < today;
  }

  /** Overdue first, then due date, due time (untimed last), priority; completed tasks last. */
  sort(tasks: Task[], today = this.today()): Task[] {
    const added = this.addedOrder();
    return [...tasks].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const oa = this.isOverdue(a, today);
      const ob = this.isOverdue(b, today);
      if (oa !== ob) return oa ? -1 : 1;
      const da = a.due ?? '9999-99-99';
      const db = b.due ?? '9999-99-99';
      if (da !== db) return da < db ? -1 : 1;
      const ta = a.time ?? '99:99';
      const tb = b.time ?? '99:99';
      if (ta !== tb) return ta < tb ? -1 : 1;
      const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pr) return pr;
      // Tasks that tie on everything else: the most recently added comes first, so a new task is on top.
      return (added.get(b.id) ?? 0) - (added.get(a.id) ?? 0);
    });
  }

  /** Where each task sits in storage: later means added more recently. Editing a task does not move it. */
  private addedOrder(): Map<string, number> {
    return new Map(this.data.tasks.map((t, i) => [t.id, i]));
  }

  /**
   * Sorts by one of the list orders. Ties, and the `time` order itself, follow `sort`; completed tasks go
   * last. `manual` is handled by the list itself, so here it means `time`.
   */
  sortBy(tasks: Task[], order: ListOrder, today = this.today()): Task[] {
    if (order === 'time' || order === 'manual') return this.sort(tasks, today);
    const base = new Map(this.sort(tasks, today).map((t, i) => [t.id, i]));
    const added = this.addedOrder();
    const collator = new Intl.Collator(this.data.settings.language, { sensitivity: 'base', numeric: true });
    return [...tasks].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      let d = 0;
      if (order === 'newest') d = (added.get(b.id) ?? 0) - (added.get(a.id) ?? 0);
      else if (order === 'priority') d = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      else d = collator.compare(a.title, b.title);
      return d || base.get(a.id)! - base.get(b.id)!;
    });
  }

  dashboard(): Dashboard {
    const today = this.today();
    const tomorrow = addDays(today, 1);
    const order = this.dashboardOrder();
    const overdue = this.sortBy(this.data.tasks.filter((t) => this.isOverdue(t, today)), order, today);
    const doneToday = (t: Task) => t.done && !!t.completedAt && localISO(new Date(t.completedAt)) === today && !!t.due && t.due < today;
    const tasks = this.sortBy(this.data.tasks.filter((t) => t.due === today || doneToday(t)), order, today);
    const all = [...overdue, ...tasks];
    const undated = this.sortBy(this.data.tasks.filter((t) => !t.due && !t.done), order, today);
    const ids: (string | null)[] = [...this.categories().map((c) => c.id), null];
    const categories = ids.map((categoryId) => {
      const mine = [...all, ...undated].filter((t) => t.categoryId === categoryId);
      return { categoryId, total: mine.length, left: mine.filter((t) => !t.done).length };
    });
    return {
      today,
      tomorrow,
      progress: { done: all.filter((t) => t.done).length, total: all.length },
      overdue,
      tasks,
      undated,
      categories,
      tomorrowItems: this.occurrences(tomorrow, tomorrow),
    };
  }

  /** Open tasks due in the range, plus projected future runs of repeating tasks, sorted by date then time. */
  occurrences(from: ISODate, to: ISODate): Occurrence[] {
    const out: Occurrence[] = [];
    for (const task of this.data.tasks) {
      if (task.done || !task.due) continue;
      if (task.due >= from && task.due <= to) out.push({ task, date: task.due, projected: false });
      if (!task.repeat) continue;
      let d = task.due;
      for (let i = 0; i < 400; i++) {
        d = nextDate(task.repeat, d);
        if (d > to) break;
        if (d >= from) out.push({ task, date: d, projected: true });
      }
    }
    const added = this.addedOrder();
    return out.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      const ta = a.task.time ?? '99:99';
      const tb = b.task.time ?? '99:99';
      if (ta !== tb) return ta < tb ? -1 : 1;
      return PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority] || (added.get(b.task.id) ?? 0) - (added.get(a.task.id) ?? 0);
    });
  }

  upcoming(days = 7): DayGroup[] {
    const today = this.today();
    const all = this.occurrences(addDays(today, 1), addDays(today, days));
    return Array.from({ length: days }, (_, i) => {
      const date = addDays(today, i + 1);
      return { date, items: all.filter((o) => o.date === date) };
    });
  }

  /** A category's tasks, or the Inbox's when `categoryId` is null. */
  list(categoryId: string | null): ListView {
    const mine = this.data.tasks.filter((t) => t.categoryId === categoryId);
    const open = mine.filter((t) => !t.done);
    return {
      open: this.isManual(categoryId) ? this.manualSort(open) : this.sortBy(open, this.listOrder(categoryId)),
      done: mine.filter((t) => t.done).sort((a, b) => ((a.completedAt ?? '') < (b.completedAt ?? '') ? 1 : -1)),
    };
  }

  /* ---------------- list order ---------------- */

  /** How a category's list (or the Inbox's, for null) is arranged. */
  listOrder(categoryId: string | null): ListOrder {
    return this.data.settings.listOrders[listKey(categoryId)] ?? 'time';
  }

  /** Arranges a list. Switching to manual keeps the order you see now, so you start from there. */
  setListOrder(categoryId: string | null, order: ListOrder): void {
    const was = this.listOrder(categoryId);
    if (order === was) return;
    let tasks = this.data.tasks;
    if (order === 'manual') {
      const shown = this.sortBy(tasks.filter((t) => t.categoryId === categoryId && !t.done), was);
      const frozen = new Map(shown.map((t, i) => [t.id, i]));
      tasks = tasks.map((t) => (frozen.has(t.id) ? { ...t, pos: frozen.get(t.id)! } : t));
    }
    this.commit({ ...this.data, tasks, settings: { ...this.data.settings, listOrders: { ...this.data.settings.listOrders, [listKey(categoryId)]: order } } });
  }

  /** How the dashboard's lists are arranged; they mix categories, so there is no manual order. */
  dashboardOrder(): ListOrder {
    const order = this.data.settings.listOrders[TODAY_KEY] ?? 'time';
    return order === 'manual' ? 'time' : order;
  }

  setDashboardOrder(order: Exclude<ListOrder, 'manual'>): void {
    if (order === this.dashboardOrder()) return;
    this.updateSettings({ listOrders: { ...this.data.settings.listOrders, [TODAY_KEY]: order } });
  }

  isManual(categoryId: string | null): boolean {
    return this.listOrder(categoryId) === 'manual';
  }

  /** Switches a list between manual order and the automatic order by date and time. */
  setManual(categoryId: string | null, on: boolean): void {
    if (on !== this.isManual(categoryId)) this.setListOrder(categoryId, on ? 'manual' : 'time');
  }

  /** Puts the given tasks of a manual list in this order. */
  reorder(categoryId: string | null, orderedIds: string[]): void {
    const pos = new Map(orderedIds.map((id, i) => [id, i]));
    this.setTasks(this.data.tasks.map((t) => (t.categoryId === categoryId && pos.has(t.id) ? { ...t, pos: pos.get(t.id)! } : t)));
  }

  /** A position above every task already placed in the list. */
  private topPos(categoryId: string | null): number {
    const placed = this.data.tasks.filter((t) => t.categoryId === categoryId && t.pos != null && !t.done).map((t) => t.pos as number);
    return placed.length ? Math.min(...placed) - 1 : 0;
  }

  private manualSort(tasks: Task[]): Task[] {
    const added = this.addedOrder();
    return [...tasks].sort((a, b) => (a.pos ?? -1e9) - (b.pos ?? -1e9) || (added.get(b.id) ?? 0) - (added.get(a.id) ?? 0));
  }

  /* ---------------- history and stats ---------------- */

  /**
   * How many tasks were completed each day of this week (Saturday to Friday) in a category, in all
   * categories (`'all'`), or in the Inbox (`null`), with the streak of days in a row and last week's total.
   */
  stats(categoryId: string | null | 'all'): CategoryStats {
    const today = this.today();
    const count = (day: ISODate): number => {
      const counts = this.data.history[day];
      if (!counts) return 0;
      return categoryId === 'all' ? Object.values(counts).reduce((a, b) => a + b, 0) : (counts[listKey(categoryId)] ?? 0);
    };
    const start = addDays(today, -((weekday(today) + 1) % 7));
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      return { date, count: date > today ? 0 : count(date), future: date > today };
    });
    let streak = 0;
    for (let d = count(today) > 0 ? today : addDays(today, -1); count(d) > 0 && streak < 3650; d = addDays(d, -1)) streak++;
    const lastWeekTotal = Array.from({ length: 7 }, (_, i) => count(addDays(start, i - 7))).reduce((a, b) => a + b, 0);
    return { days, weekTotal: days.reduce((a, d) => a + d.count, 0), lastWeekTotal, streak, today: count(today) };
  }

  openCount(categoryId: string | null): number {
    return this.data.tasks.filter((t) => t.categoryId === categoryId && !t.done).length;
  }

  search(query: string, filters: SearchFilters = {}): Task[] {
    const q = normalizeText(query.trim());
    const today = this.today();
    const status = filters.status ?? 'all';
    return this.sort(
      this.data.tasks.filter((t) => {
        if (status === 'open' && t.done) return false;
        if (status === 'done' && !t.done) return false;
        if (filters.priority && t.priority !== filters.priority) return false;
        if (filters.overdueOnly && !this.isOverdue(t, today)) return false;
        if (!q) return true;
        return [t.title, t.notes, ...t.subtasks.map((s) => s.title)].some((s) => normalizeText(s).includes(q));
      }),
      today,
    );
  }

  /** Every notification that should be scheduled right now: task reminders and bedtime summaries for the next 7 nights. */
  notificationPlan(): PlannedNotification[] {
    const now = this.now();
    const today = this.today();
    const lang = this.data.settings.language;
    const t = MESSAGES[lang];
    const plan: PlannedNotification[] = [];

    for (const o of this.occurrences(today, addDays(today, 8))) {
      const { task } = o;
      if (!task.time || !task.reminder) continue;
      const at = new Date(atLocal(o.date, task.time).getTime() - REMINDER_MINUTES[task.reminder] * 60000);
      if (at <= now) continue;
      plan.push({
        id: notificationId(`r:${task.id}:${o.date}`),
        at,
        title: task.title,
        body: t.dueAt(formatDay(lang, o.date), formatTime(lang, task.time)),
        link: `task:${task.id}`,
        actions: true,
      });
    }

    // A reminder the user snoozed rings again at the chosen moment.
    for (const task of this.data.tasks) {
      if (task.done || !task.snoozedUntil) continue;
      const at = new Date(task.snoozedUntil);
      if (at <= now) continue;
      plan.push({
        id: notificationId(`s:${task.id}`),
        at,
        title: task.title,
        body: task.due && task.time ? t.dueAt(formatDay(lang, task.due), formatTime(lang, task.time)) : '',
        link: `task:${task.id}`,
        actions: true,
      });
    }

    if (this.data.settings.bedtimeEnabled) {
      for (let k = 0; k < 7; k++) {
        const night = addDays(today, k);
        const at = atLocal(night, this.data.settings.bedtimeTime);
        if (at <= now) continue;
        const next = this.occurrences(addDays(night, 1), addDays(night, 1));
        if (!next.length) continue;
        const left =
          this.data.tasks.filter((x) => !x.done && x.due && x.due <= night).length +
          this.occurrences(night, night).filter((o) => o.projected).length;
        const names = next.slice(0, 3).map((o) => o.task.title).join(lang === 'fa' ? '، ' : ', ') + (next.length > 3 ? '…' : '');
        plan.push({
          id: notificationId(`b:${night}`),
          at,
          title: t.bedtimeNotifTitle(next.length),
          body: left ? `${names}\n${t.bedtimeNotifLeft(left)}` : names,
          link: 'tomorrow',
        });
      }
    }
    if (this.data.settings.backupReminder) {
      // The next four Fridays at 10:00: a nudge to copy the automatic backup somewhere safe.
      let found = 0;
      for (let k = 0; k < 35 && found < 4; k++) {
        const day = addDays(today, k);
        const at = atLocal(day, '10:00');
        if (weekday(day) !== 5 || at <= now) continue;
        found++;
        plan.push({ id: notificationId(`w:${day}`), at, title: t.backupReminderTitle, body: t.backupReminderBody, link: 'backup' });
      }
    }
    return plan.sort((a, b) => a.at.getTime() - b.at.getTime());
  }
}

/** History for data saved before it was kept: built from the tasks that are already completed. */
function historyFromTasks(tasks: Task[]): Data['history'] {
  const history: Data['history'] = {};
  for (const t of tasks) {
    if (!t.done || !t.completedAt) continue;
    const day = localISO(new Date(t.completedAt));
    history[day] ??= {};
    history[day][listKey(t.categoryId ?? null)] = (history[day][listKey(t.categoryId ?? null)] ?? 0) + 1;
  }
  return history;
}

/** Fills in settings added since the data was saved. Lists arranged by hand before list orders existed stay manual. */
function settingsWithDefaults(saved: Partial<Settings> & { manualLists?: string[] } = {}): Settings {
  const { manualLists, ...rest } = saved;
  const listOrders = { ...Object.fromEntries((manualLists ?? []).map((k) => [k, 'manual' as const])), ...(rest.listOrders ?? {}) };
  return { ...DEFAULT_SETTINGS, ...rest, listOrders };
}

function withDefaults(d: Data): Data {
  const tasks = (d.tasks ?? []).map((t) => ({
      notes: '',
      categoryId: null,
      due: null,
      time: null,
      priority: 'none',
      repeat: null,
      reminder: null,
      subtasks: [],
      done: false,
      completedAt: null,
      createdAt: new Date(0).toISOString(),
      spawnedId: null,
      ...(t as Partial<Task>),
    })) as Task[];
  return {
    version: 1,
    categories: d.categories ?? [],
    settings: settingsWithDefaults(d.settings),
    tasks,
    history: d.history ?? historyFromTasks(tasks),
  };
}

export class MemoryStorage implements StoragePort {
  saved: Data | null;
  constructor(initial: Data | null = null) {
    this.saved = initial;
  }
  async load() {
    return this.saved ? structuredClone(this.saved) : null;
  }
  async save(data: Data) {
    this.saved = structuredClone(data);
  }
}

export class FixedClock implements Clock {
  constructor(public current: Date) {}
  now() {
    return new Date(this.current.getTime());
  }
  set(date: Date) {
    this.current = date;
  }
}

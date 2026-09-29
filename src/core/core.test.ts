import { beforeEach, describe, expect, it } from 'vitest';
import { CoreError, FixedClock, MemoryStorage, TaskCore } from './core';
import type { RepeatRule } from './types';

// Monday 6 Mizan 1405, 09:00 in Kabul (TZ is pinned to Asia/Kabul in the Vitest config).
const MONDAY = new Date('2026-09-28T09:00:00+04:30');

let clock: FixedClock;
let storage: MemoryStorage;
let core: TaskCore;

async function openCore() {
  clock = new FixedClock(MONDAY);
  storage = new MemoryStorage();
  core = await TaskCore.open({ clock, storage });
}

beforeEach(openCore);

const titles = (xs: { title: string }[]) => xs.map((x) => x.title);

describe('first launch', () => {
  it('seeds ورزش, دوکان and مطالعه once', async () => {
    expect(core.categories().map((c) => c.name)).toEqual(['ورزش', 'دوکان', 'مطالعه']);
    core.deleteCategory('sport', 'moveToInbox');
    await core.flush();
    const reopened = await TaskCore.open({ clock, storage });
    expect(reopened.categories().map((c) => c.name)).toEqual(['دوکان', 'مطالعه']);
  });

  it('persists tasks through the storage port', async () => {
    core.addTask({ title: 'خرید نان', due: '2026-09-28' });
    await core.flush();
    const reopened = await TaskCore.open({ clock, storage });
    expect(titles(reopened.dashboard().tasks)).toEqual(['خرید نان']);
  });
});

describe('adding and completing', () => {
  it('rejects an empty title', () => {
    expect(() => core.addTask({ title: '   ' })).toThrowError(CoreError);
  });

  it('counts progress over today and overdue tasks', () => {
    const a = core.addTask({ title: 'a', due: '2026-09-28' });
    core.addTask({ title: 'b', due: '2026-09-28' });
    core.addTask({ title: 'late', due: '2026-09-27' });
    core.addTask({ title: 'later', due: '2026-10-02' });
    core.setDone(a.id, true);
    const d = core.dashboard();
    expect(d.progress).toEqual({ done: 1, total: 3 });
    expect(titles(d.overdue)).toEqual(['late']);
    expect(titles(d.tasks)).toEqual(['b', 'a']);
  });

  it('keeps an overdue task completed today on the dashboard', () => {
    const late = core.addTask({ title: 'late', due: '2026-09-26' });
    core.setDone(late.id, true);
    const d = core.dashboard();
    expect(d.overdue).toEqual([]);
    expect(titles(d.tasks)).toEqual(['late']);
    expect(d.progress).toEqual({ done: 1, total: 1 });
  });

  it('un-completing reopens the task', () => {
    const a = core.addTask({ title: 'a', due: '2026-09-28' });
    core.setDone(a.id, true);
    core.setDone(a.id, false);
    expect(core.dashboard().progress).toEqual({ done: 0, total: 1 });
  });

  it('turns a task overdue when the day changes', () => {
    core.addTask({ title: 'a', due: '2026-09-28', time: '23:30' });
    expect(core.dashboard().overdue).toEqual([]);
    clock.set(new Date('2026-09-29T00:01:00+04:30'));
    expect(titles(core.dashboard().overdue)).toEqual(['a']);
  });

  it('ignores a time without a date and a reminder without a time', () => {
    const t = core.addTask({ title: 'x', time: '10:00', reminder: '1h' });
    expect(t.time).toBeNull();
    expect(t.reminder).toBeNull();
  });
});

describe('sorting', () => {
  it('orders overdue, date, time (untimed last), priority, then completed', () => {
    core.addTask({ title: 'untimed', due: '2026-09-28' });
    core.addTask({ title: 'nine', due: '2026-09-28', time: '09:00' });
    core.addTask({ title: 'seven-low', due: '2026-09-28', time: '07:00', priority: 'low' });
    core.addTask({ title: 'seven-high', due: '2026-09-28', time: '07:00', priority: 'high' });
    core.addTask({ title: 'overdue', due: '2026-09-20' });
    const done = core.addTask({ title: 'done', due: '2026-09-28', time: '06:00' });
    core.setDone(done.id, true);
    expect(titles(core.sort(core.search('')))).toEqual(['overdue', 'seven-high', 'seven-low', 'nine', 'untimed', 'done']);
  });
});

describe('categories and Inbox', () => {
  it('reports remaining work per category on the dashboard', () => {
    const a = core.addTask({ title: 'run', categoryId: 'sport', due: '2026-09-28' });
    core.addTask({ title: 'gym', categoryId: 'sport', due: '2026-09-28' });
    core.addTask({ title: 'loose', due: '2026-09-28' });
    core.setDone(a.id, true);
    const byId = Object.fromEntries(core.dashboard().categories.map((c) => [String(c.categoryId), c]));
    expect(byId.sport).toMatchObject({ left: 1, total: 2 });
    expect(byId.null).toMatchObject({ left: 1, total: 1 });
    expect(byId.shop).toMatchObject({ left: 0, total: 0 });
  });

  it('moves tasks to the Inbox when their category is deleted that way', () => {
    core.addTask({ title: 'read', categoryId: 'study' });
    core.deleteCategory('study', 'moveToInbox');
    expect(titles(core.list(null).open)).toEqual(['read']);
  });

  it('deletes tasks with their category when asked', () => {
    core.addTask({ title: 'read', categoryId: 'study' });
    core.deleteCategory('study', 'deleteTasks');
    expect(core.search('')).toEqual([]);
  });

  it('treats an unknown category as the Inbox', () => {
    expect(core.addTask({ title: 'x', categoryId: 'nope' }).categoryId).toBeNull();
  });

  it('adds, renames and reorders categories', () => {
    const c = core.addCategory({ name: ' خانه ', emoji: '🏠', color: 'rose' });
    core.updateCategory(c.id, { name: 'خانواده' });
    core.moveCategory(c.id, -1);
    expect(core.categories().map((x) => x.name)).toEqual(['ورزش', 'دوکان', 'خانواده', 'مطالعه']);
    expect(() => core.addCategory({ name: ' ', emoji: '', color: 'green' })).toThrowError(CoreError);
  });

  it('clears only the completed tasks of one list', () => {
    const a = core.addTask({ title: 'a', categoryId: 'shop' });
    const b = core.addTask({ title: 'b' });
    core.addTask({ title: 'c', categoryId: 'shop' });
    core.setDone(a.id, true);
    core.setDone(b.id, true);
    core.clearCompleted('shop');
    expect(titles(core.list('shop').open)).toEqual(['c']);
    expect(core.list('shop').done).toEqual([]);
    expect(titles(core.list(null).done)).toEqual(['b']);
  });
});

describe('subtasks', () => {
  it('toggles subtasks independently', () => {
    const t = core.addTask({ title: 't', subtasks: [{ title: 'one' }, { title: 'two' }, { title: '  ' }] });
    expect(t.subtasks).toHaveLength(2);
    core.toggleSubtask(t.id, t.subtasks[1].id);
    expect(core.task(t.id)!.subtasks.map((s) => s.done)).toEqual([false, true]);
  });
});

describe('undo', () => {
  it('restores a deleted task with its subtasks, category and position', () => {
    core.addTask({ title: 'first', categoryId: 'shop' });
    const t = core.addTask({ title: 'middle', categoryId: 'shop', subtasks: [{ title: 's', done: true }] });
    core.addTask({ title: 'last', categoryId: 'shop' });
    core.deleteTask(t.id);
    expect(core.undo()).toBe('delete');
    const back = core.task(t.id)!;
    expect(back.categoryId).toBe('shop');
    expect(back.subtasks[0]).toMatchObject({ title: 's', done: true });
    expect(titles(core.search(''))).toEqual(['first', 'middle', 'last']);
  });

  it('undoes a completion', () => {
    const t = core.addTask({ title: 't', due: '2026-09-28' });
    core.setDone(t.id, true);
    expect(core.undo()).toBe('complete');
    expect(core.task(t.id)!.done).toBe(false);
    expect(core.undo()).toBeNull();
  });
});

describe('repeating tasks', () => {
  const next = (rule: Parameters<TaskCore['addTask']>[0]['repeat'], due: string) => {
    const t = core.addTask({ title: 'r', due, repeat: rule });
    core.setDone(t.id, true);
    return core.search('', { status: 'open' })[0].due;
  };

  it('requires a due date', () => {
    expect(() => core.addTask({ title: 'r', repeat: { kind: 'daily' } })).toThrowError(expect.objectContaining({ code: 'repeat-needs-due' }));
  });

  it('computes the next occurrence for every rule kind', () => {
    expect(next({ kind: 'daily' }, '2026-09-28')).toBe('2026-09-29');
  });
  it.each<[RepeatRule, string, string]>([
    [{ kind: 'weekly' }, '2026-09-28', '2026-10-05'],
    [{ kind: 'everyN', n: 3 }, '2026-09-28', '2026-10-01'],
    // Tuesday → next Saturday
    [{ kind: 'weekdays', days: [6, 2] }, '2026-09-29', '2026-10-03'],
    // 6 Mizan → 6 Aqrab
    [{ kind: 'monthly' }, '2026-09-28', '2026-10-28'],
    // 31 Hamal → 31 Sawr (both 31-day months)
    [{ kind: 'monthly' }, '2026-04-20', '2026-05-21'],
    // 31 Sonbola → 30 Mizan (clamped)
    [{ kind: 'monthly' }, '2026-09-22', '2026-10-22'],
    // 6 Mizan 1405 → 6 Mizan 1406
    [{ kind: 'yearly' }, '2026-09-28', '2027-09-28'],
  ])('%j from %s → %s', (rule, due, expected) => {
    expect(next(rule, due)).toBe(expected);
  });

  it('keeps a monthly anchor after a clamped month', () => {
    // 31 Sonbola 1405 → 30 Mizan → 30 Aqrab → … 31 Hamal is not reachable before Hamal; check the anchor survives.
    const t = core.addTask({ title: 'm', due: '2026-09-22', repeat: { kind: 'monthly' } });
    expect(t.repeat).toEqual({ kind: 'monthly', day: 31 });
    const skipped = core.skipOccurrence(t.id);
    expect(skipped.repeat).toEqual({ kind: 'monthly', day: 31 });
  });

  it('creates the next occurrence from the due date and resets subtasks', () => {
    const t = core.addTask({ title: 'daily', due: '2026-09-26', repeat: { kind: 'daily' }, subtasks: [{ title: 's' }] });
    core.toggleSubtask(t.id, core.task(t.id)!.subtasks[0].id);
    core.setDone(t.id, true);
    const open = core.search('', { status: 'open' });
    expect(open).toHaveLength(1);
    expect(open[0].due).toBe('2026-09-27');
    expect(open[0].subtasks.map((s) => s.done)).toEqual([false]);
    expect(core.dashboard().overdue.map((x) => x.id)).toEqual([open[0].id]);
  });

  it('removes the created occurrence when the completion is undone or reverted', () => {
    const t = core.addTask({ title: 'daily', due: '2026-09-28', repeat: { kind: 'daily' } });
    core.setDone(t.id, true);
    core.undo();
    expect(core.search('')).toHaveLength(1);
    core.setDone(t.id, true);
    core.setDone(t.id, false);
    expect(core.search('')).toHaveLength(1);
  });

  it('skips an occurrence without completing it', () => {
    const t = core.addTask({ title: 'gym', due: '2026-09-28', repeat: { kind: 'weekdays', days: [6, 2] } });
    expect(core.skipOccurrence(t.id).due).toBe('2026-09-29');
    expect(core.search('', { status: 'done' })).toEqual([]);
    const plain = core.addTask({ title: 'plain' });
    expect(() => core.skipOccurrence(plain.id)).toThrowError(CoreError);
  });

  it('ends the series when deleted', () => {
    const t = core.addTask({ title: 'daily', due: '2026-09-28', repeat: { kind: 'daily' } });
    core.deleteTask(t.id);
    expect(core.upcoming().every((d) => d.items.length === 0)).toBe(true);
  });

  it('projects future occurrences into tomorrow and the Upcoming view', () => {
    core.addTask({ title: 'run', due: '2026-09-28', repeat: { kind: 'daily' } });
    core.addTask({ title: 'class', due: '2026-09-29', time: '16:00' });
    // Timed tasks come before untimed ones within a day, whether live or projected.
    const d = core.dashboard();
    expect(d.tomorrowItems.map((o) => [o.task.title, o.projected])).toEqual([
      ['class', false],
      ['run', true],
    ]);
    const up = core.upcoming();
    expect(up).toHaveLength(7);
    expect(up[0].date).toBe('2026-09-29');
    expect(up[6].date).toBe('2026-10-05');
    expect(up.every((g) => g.items.some((o) => o.task.title === 'run'))).toBe(true);
  });

  it('rejects an empty weekday rule', () => {
    expect(() => core.addTask({ title: 'x', due: '2026-09-28', repeat: { kind: 'weekdays', days: [] } })).toThrowError(CoreError);
  });

  it('re-anchors a monthly rule when the due date changes', () => {
    const t = core.addTask({ title: 'rent', due: '2026-09-28', repeat: { kind: 'monthly' } });
    const moved = core.updateTask(t.id, { due: '2026-09-23' });
    expect(moved.repeat).toEqual({ kind: 'monthly', day: 1 });
  });
});

describe('search', () => {
  beforeEach(() => {
    core.addTask({ title: 'خرید نان', priority: 'high' });
    core.addTask({ title: 'Read book', notes: 'chapter three' });
    core.addTask({ title: 'Trip', subtasks: [{ title: 'کیف را ببند' }] });
    core.addTask({ title: 'late', due: '2026-09-20' });
  });

  it('matches titles, notes and subtasks', () => {
    expect(titles(core.search('three'))).toEqual(['Read book']);
    expect(titles(core.search('کیف'))).toEqual(['Trip']);
    expect(titles(core.search('READ'))).toEqual(['Read book']);
  });

  it('folds Arabic ي and ك into Persian letters', () => {
    core.addTask({ title: 'کتاب یک' });
    expect(titles(core.search('كتاب يك'))).toEqual(['کتاب یک']);
  });

  it('combines filters', () => {
    expect(titles(core.search('', { priority: 'high' }))).toEqual(['خرید نان']);
    expect(titles(core.search('', { overdueOnly: true }))).toEqual(['late']);
    const t = core.search('trip')[0];
    core.setDone(t.id, true);
    expect(titles(core.search('', { status: 'done' }))).toEqual(['Trip']);
    expect(core.search('trip', { status: 'open' })).toEqual([]);
  });
});

describe('backup', () => {
  it('round-trips through export and import', () => {
    core.addTask({ title: 'a', due: '2026-09-28', repeat: { kind: 'daily' }, subtasks: [{ title: 's' }] });
    core.addCategory({ name: 'خانه', emoji: '🏠', color: 'teal' });
    const json = core.exportBackup();
    const before = { dash: core.dashboard(), cats: core.categories(), up: core.upcoming() };
    core.addTask({ title: 'extra' });
    core.importBackup(json);
    expect({ dash: core.dashboard(), cats: core.categories(), up: core.upcoming() }).toEqual(before);
    expect(titles(core.search('extra'))).toEqual([]);
  });

  it('rejects invalid and newer backups without touching data', () => {
    core.addTask({ title: 'keep' });
    expect(() => core.importBackup('not json')).toThrowError(expect.objectContaining({ code: 'backup-invalid' }));
    expect(() => core.importBackup(JSON.stringify({ app: 'other', version: 1, data: {} }))).toThrowError(
      expect.objectContaining({ code: 'backup-invalid' }),
    );
    expect(() => core.importBackup(JSON.stringify({ app: 'my-to-do', version: 99, data: { tasks: [], categories: [] } }))).toThrowError(
      expect.objectContaining({ code: 'backup-newer' }),
    );
    expect(titles(core.search(''))).toEqual(['keep']);
  });
});

describe('notification plan', () => {
  it('plans a reminder for each offset and drops it once the task is done', () => {
    const offsets = [
      ['atTime', '2026-09-28T18:00:00+04:30'],
      ['15m', '2026-09-28T17:45:00+04:30'],
      ['1h', '2026-09-28T17:00:00+04:30'],
      ['1d', '2026-09-29T18:00:00+04:30'],
    ] as const;
    core.updateSettings({ bedtimeEnabled: false });
    for (const [reminder, expected] of offsets) {
      const due = reminder === '1d' ? '2026-09-30' : '2026-09-28';
      const t = core.addTask({ title: reminder, due, time: '18:00', reminder });
      const plan = core.notificationPlan().filter((p) => p.link === `task:${t.id}`);
      expect(plan.map((p) => p.at.toISOString())).toEqual([new Date(expected).toISOString()]);
      core.setDone(t.id, true);
      expect(core.notificationPlan().filter((p) => p.link === `task:${t.id}`)).toEqual([]);
    }
  });

  it('skips reminders in the past and follows an edited time', () => {
    core.updateSettings({ bedtimeEnabled: false });
    const t = core.addTask({ title: 'early', due: '2026-09-28', time: '08:00', reminder: 'atTime' });
    expect(core.notificationPlan()).toEqual([]);
    core.updateTask(t.id, { time: '20:00' });
    expect(core.notificationPlan().map((p) => p.at.toISOString())).toEqual([new Date('2026-09-28T20:00:00+04:30').toISOString()]);
  });

  it('reminds for projected runs of a repeating task', () => {
    core.updateSettings({ bedtimeEnabled: false });
    core.addTask({ title: 'pill', due: '2026-09-28', time: '21:00', reminder: 'atTime', repeat: { kind: 'daily' } });
    expect(core.notificationPlan().length).toBeGreaterThanOrEqual(8);
  });

  it('sends a bedtime summary naming tomorrow and today’s leftovers', () => {
    core.addTask({ title: 'دویدن صبحگاهی', due: '2026-09-28', time: '06:30', repeat: { kind: 'daily' } });
    core.addTask({ title: 'تحویل سفارش', due: '2026-09-29', time: '11:00' });
    core.addTask({ title: 'کلاس انگلیسی', due: '2026-09-29', time: '16:00' });
    core.addTask({ title: 'حساب دوکان', due: '2026-09-29', time: '20:30' });
    const tonight = core.notificationPlan().find((p) => p.link === 'tomorrow')!;
    expect(tonight.at.toISOString()).toBe(new Date('2026-09-28T22:00:00+04:30').toISOString());
    expect(tonight.title).toBe('فردا ۴ کار دارید');
    expect(tonight.body).toBe('دویدن صبحگاهی، تحویل سفارش، کلاس انگلیسی…\n۱ کار امروز مانده');
  });

  it('writes the bedtime summary in English and without leftovers', () => {
    core.updateSettings({ language: 'en' });
    core.addTask({ title: 'Class', due: '2026-09-29' });
    const tonight = core.notificationPlan().find((p) => p.link === 'tomorrow')!;
    expect(tonight.title).toBe('You have 1 task tomorrow');
    expect(tonight.body).toBe('Class');
  });

  it('covers the next 7 nights and skips nights before an empty day', () => {
    core.addTask({ title: 'run', due: '2026-09-28', repeat: { kind: 'daily' } });
    expect(core.notificationPlan().filter((p) => p.link === 'tomorrow')).toHaveLength(7);
    core.updateSettings({ bedtimeTime: '07:00' });
    // 07:00 today has already passed, so tonight's summary moves to the following nights.
    expect(core.notificationPlan().filter((p) => p.link === 'tomorrow')).toHaveLength(6);
    core.updateSettings({ bedtimeEnabled: false });
    expect(core.notificationPlan()).toEqual([]);
  });

  it('sends nothing when tomorrow is empty', () => {
    core.addTask({ title: 'today only', due: '2026-09-28' });
    expect(core.notificationPlan()).toEqual([]);
  });

  it('keeps notification ids stable', () => {
    core.addTask({ title: 'x', due: '2026-09-29' });
    expect(core.notificationPlan()[0].id).toBe(core.notificationPlan()[0].id);
    expect(core.notificationPlan()[0].id).toBeGreaterThan(0);
  });
});

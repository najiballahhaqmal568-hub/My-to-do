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

describe('tasks without a date', () => {
  it('shows open undated tasks on the dashboard and counts them on category cards', () => {
    core.addTask({ title: 'سفارش جنس', categoryId: 'shop' });
    const done = core.addTask({ title: 'قدیمی', categoryId: 'shop' });
    core.setDone(done.id, true);
    core.addTask({ title: 'امروز', categoryId: 'shop', due: '2026-09-28' });
    const d = core.dashboard();
    expect(titles(d.undated)).toEqual(['سفارش جنس']);
    expect(titles(d.tasks)).toEqual(['امروز']);
    expect(d.progress).toEqual({ done: 0, total: 1 });
    expect(d.categories.find((c) => c.categoryId === 'shop')).toMatchObject({ left: 2, total: 2 });
  });
});

describe('newest first', () => {
  it('lists the most recently added task first among tasks that tie', () => {
    core.addTask({ title: 'یک', categoryId: 'shop', due: '2026-09-28' });
    core.addTask({ title: 'دو', categoryId: 'shop', due: '2026-09-28' });
    core.addTask({ title: 'سه', categoryId: 'shop', due: '2026-09-28' });
    expect(titles(core.list('shop').open)).toEqual(['سه', 'دو', 'یک']);
    expect(titles(core.dashboard().tasks)).toEqual(['سه', 'دو', 'یک']);
  });

  it('still orders by time and priority before recency', () => {
    core.addTask({ title: 'نیم‌روز', due: '2026-09-28', time: '12:00' });
    core.addTask({ title: 'مهم', due: '2026-09-28', priority: 'high' });
    core.addTask({ title: 'ساده', due: '2026-09-28' });
    core.addTask({ title: 'صبح', due: '2026-09-28', time: '07:00' });
    expect(titles(core.dashboard().tasks)).toEqual(['صبح', 'نیم‌روز', 'مهم', 'ساده']);
  });

  it('keeps a task where it is when it is edited', () => {
    const first = core.addTask({ title: 'قدیمی', due: '2026-09-28' });
    core.addTask({ title: 'تازه', due: '2026-09-28' });
    core.updateTask(first.id, { notes: 'تغییر' });
    expect(titles(core.dashboard().tasks)).toEqual(['تازه', 'قدیمی']);
  });

  it('puts the newest first in Upcoming and in search results too', () => {
    core.addTask({ title: 'الف', due: '2026-09-29' });
    core.addTask({ title: 'ب', due: '2026-09-29' });
    expect(titles(core.upcoming()[0].items.map((o) => o.task))).toEqual(['ب', 'الف']);
    expect(titles(core.search(''))).toEqual(['ب', 'الف']);
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
    expect(titles(core.search(''))).toEqual(['last', 'middle', 'first']);
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
  beforeEach(() => core.updateSettings({ backupReminder: false }));

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

describe('automatic backup settings', () => {
  it('turns the daily backup and the weekly reminder on by default', () => {
    expect(core.settings).toMatchObject({ autoBackup: true, lastBackup: null, backupReminder: true });
  });

  it('gives defaults to data saved before these settings existed', async () => {
    const old = { version: 1 as const, tasks: [], categories: [], settings: { language: 'en' as const, bedtimeEnabled: false, bedtimeTime: '21:00', exactAlarmAsked: true } };
    const reopened = await TaskCore.open({ clock, storage: new MemoryStorage(old as never) });
    expect(reopened.settings).toMatchObject({ language: 'en', bedtimeTime: '21:00', autoBackup: true, backupReminder: true, lastBackup: null });
  });

  it('plans a reminder for each of the next four Fridays at 10:00', () => {
    core.updateSettings({ bedtimeEnabled: false });
    const reminders = core.notificationPlan().filter((p) => p.link === 'backup');
    expect(reminders.map((p) => p.at.toISOString())).toEqual(
      ['2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23'].map((d) => new Date(`${d}T10:00:00+04:30`).toISOString()),
    );
    expect(reminders[0].title).toBe('پشتیبان کارهایتان را نگه دارید');
  });

  it('skips a Friday reminder that has already passed and respects the switch', () => {
    core.updateSettings({ bedtimeEnabled: false });
    clock.set(new Date('2026-10-02T11:00:00+04:30'));
    expect(core.notificationPlan().filter((p) => p.link === 'backup')[0].at.toISOString()).toBe(new Date('2026-10-09T10:00:00+04:30').toISOString());
    core.updateSettings({ backupReminder: false });
    expect(core.notificationPlan()).toEqual([]);
  });

  it('keeps the last backup day through export and import', () => {
    core.updateSettings({ lastBackup: '2026-09-28' });
    const json = core.exportBackup();
    core.updateSettings({ lastBackup: null });
    core.importBackup(json);
    expect(core.settings.lastBackup).toBe('2026-09-28');
  });
});

describe('reminder buttons', () => {
  const NINE = new Date('2026-09-28T09:00:00+04:30').getTime();
  const reminder = (id: string) => core.notificationPlan().filter((p) => p.link === `task:${id}`);

  beforeEach(() => core.updateSettings({ bedtimeEnabled: false, backupReminder: false }));

  it('puts the buttons on task reminders but not on the bedtime summary', () => {
    core.updateSettings({ bedtimeEnabled: true });
    const t = core.addTask({ title: 'جلسه', due: '2026-09-28', time: '18:00', reminder: '1h' });
    core.addTask({ title: 'فردا', due: '2026-09-29' });
    const plan = core.notificationPlan();
    expect(plan.find((p) => p.link === `task:${t.id}`)?.actions).toBe(true);
    expect(plan.find((p) => p.link === 'tomorrow')?.actions).toBeUndefined();
  });

  it('rings again after a snooze, 15 minutes later by default', () => {
    const t = core.addTask({ title: 'جلسه', due: '2026-09-28', time: '09:00', reminder: 'atTime' });
    clock.set(new Date(NINE + 60_000));
    core.snoozeReminder(t.id);
    const [again] = reminder(t.id);
    expect(again.at.toISOString()).toBe(new Date(NINE + 60_000 + 15 * 60_000).toISOString());
    expect(again).toMatchObject({ title: 'جلسه', actions: true });
    expect(again.body).toBe('دوشنبه، ۶ میزان، ساعت ۹:۰۰ صبح');
  });

  it('forgets the snooze when the task is done, edited or skipped', () => {
    const a = core.addTask({ title: 'الف', due: '2026-09-28', time: '09:00', reminder: 'atTime' });
    const b = core.addTask({ title: 'ب', due: '2026-09-28', time: '09:00', reminder: 'atTime' });
    const c = core.addTask({ title: 'ج', due: '2026-09-28', time: '09:00', reminder: 'atTime', repeat: { kind: 'daily' } });
    for (const t of [a, b, c]) core.snoozeReminder(t.id, 30);
    expect(reminder(a.id)).toHaveLength(1);
    core.setDone(a.id, true);
    expect(reminder(a.id)).toEqual([]);
    core.updateTask(b.id, { title: 'ب تازه' });
    expect(core.task(b.id)!.snoozedUntil).toBeNull();
    core.skipOccurrence(c.id);
    expect(core.task(c.id)!.snoozedUntil).toBeNull();
  });

  it('does not carry a snooze into the next occurrence of a repeating task', () => {
    const t = core.addTask({ title: 'دارو', due: '2026-09-28', time: '09:00', reminder: 'atTime', repeat: { kind: 'daily' } });
    core.snoozeReminder(t.id);
    core.setDone(t.id, true);
    const next = core.search('', { status: 'open' })[0];
    expect(next.due).toBe('2026-09-29');
    expect(next.snoozedUntil).toBeNull();
  });
});

describe('home screen widget snapshot', () => {
  it('lists open tasks for today, overdue first, with category colours and times', async () => {
    const { widgetSnapshot } = await import('./widget');
    core.addTask({ title: 'دیروز', categoryId: 'shop', due: '2026-09-27' });
    core.addTask({ title: 'دویدن', categoryId: 'sport', due: '2026-09-28', time: '06:30' });
    core.addTask({ title: 'مرور', categoryId: 'study', due: '2026-09-28' });
    const done = core.addTask({ title: 'انجام‌شده', due: '2026-09-28' });
    core.setDone(done.id, true);
    core.addTask({ title: 'بی‌تاریخ' });
    core.addTask({ title: 'فردا', due: '2026-09-29' });
    const s = widgetSnapshot(core);
    expect(s.title).toBe('دوشنبه، ۶ میزان');
    expect(s.day).toBe('2026-09-28');
    expect(s.rtl).toBe(true);
    expect(s.items.map((i) => i.title)).toEqual(['دیروز', 'دویدن', 'مرور', 'بی‌تاریخ']);
    expect(s.items[0]).toMatchObject({ overdue: true, color: '#C06A00' });
    expect(s.items[1]).toMatchObject({ time: '۶:۳۰ صبح', color: '#23875A', overdue: false });
    expect(s.summary).toBe('۱ از ۴ انجام شد');
    expect(s.progress).toBe(25);
    expect(s.tomorrow).toBe('فردا: ۱ کار');
    expect(s.more).toBe('');
  });

  it('shows at most six tasks and counts the rest', async () => {
    const { widgetSnapshot } = await import('./widget');
    for (let i = 1; i <= 9; i++) core.addTask({ title: `کار ${i}`, due: '2026-09-28' });
    const s = widgetSnapshot(core);
    expect(s.items).toHaveLength(6);
    expect(s.more).toBe('+۳ کار دیگر');
  });

  it('speaks English when the app does', async () => {
    const { widgetSnapshot } = await import('./widget');
    core.updateSettings({ language: 'en' });
    core.addTask({ title: 'Run', due: '2026-09-28', time: '18:30' });
    const s = widgetSnapshot(core);
    expect(s).toMatchObject({ rtl: false, title: 'Monday, September 28', summary: '0 of 1 done', tomorrow: 'Tomorrow: 0 tasks' });
    expect(s.items[0].time).toBe('6:30 PM');
  });

  it('has a calm message on a day with no tasks', async () => {
    const { widgetSnapshot } = await import('./widget');
    expect(widgetSnapshot(core)).toMatchObject({ summary: 'امروز کاری ندارید', items: [], progress: 0 });
  });
});

describe('manual order', () => {
  const order = (id: string | null) => titles(core.list(id).open);

  it('keeps the order you see when switching to manual, then follows your arrangement', () => {
    core.addTask({ title: 'ب', categoryId: 'shop', due: '2026-09-28', time: '12:00' });
    core.addTask({ title: 'الف', categoryId: 'shop', due: '2026-09-28', time: '08:00' });
    core.addTask({ title: 'ج', categoryId: 'shop', due: '2026-09-28' });
    expect(order('shop')).toEqual(['الف', 'ب', 'ج']);
    core.setManual('shop', true);
    expect(core.isManual('shop')).toBe(true);
    expect(order('shop')).toEqual(['الف', 'ب', 'ج']);
    const [a, b, c] = core.list('shop').open.map((t) => t.id);
    core.reorder('shop', [c, a, b]);
    expect(order('shop')).toEqual(['ج', 'الف', 'ب']);
    core.setManual('shop', false);
    expect(order('shop')).toEqual(['الف', 'ب', 'ج']);
  });

  it('puts a new task on top of a manual list, and a task moved into it too', () => {
    core.addTask({ title: 'قدیمی', categoryId: 'shop' });
    core.setManual('shop', true);
    core.addTask({ title: 'تازه', categoryId: 'shop' });
    expect(order('shop')).toEqual(['تازه', 'قدیمی']);
    const other = core.addTask({ title: 'مهمان', categoryId: 'sport' });
    core.updateTask(other.id, { categoryId: 'shop' });
    expect(order('shop')).toEqual(['مهمان', 'تازه', 'قدیمی']);
  });

  it('only changes the lists you arranged, and leaves the dashboard automatic', () => {
    core.addTask({ title: 'یک', categoryId: 'shop', due: '2026-09-28', time: '12:00' });
    core.addTask({ title: 'دو', categoryId: 'shop', due: '2026-09-28', time: '08:00' });
    core.addTask({ title: 'ورزش ۱', categoryId: 'sport', due: '2026-09-28', time: '12:00' });
    core.addTask({ title: 'ورزش ۲', categoryId: 'sport', due: '2026-09-28', time: '08:00' });
    core.setManual('shop', true);
    const [first, second] = core.list('shop').open.map((t) => t.id);
    core.reorder('shop', [first, second].reverse());
    expect(order('shop')).toEqual(['یک', 'دو']);
    expect(order('sport')).toEqual(['ورزش ۲', 'ورزش ۱']);
    // Automatic order by time; tasks at the same time list the newest first.
    expect(titles(core.dashboard().tasks)).toEqual(['ورزش ۲', 'دو', 'ورزش ۱', 'یک']);
  });

  it('works for the Inbox and survives export and import', () => {
    core.addTask({ title: 'اول' });
    core.addTask({ title: 'دوم' });
    core.setManual(null, true);
    const [x, y] = core.list(null).open.map((t) => t.id);
    core.reorder(null, [y, x]);
    const json = core.exportBackup();
    core.setManual(null, false);
    core.importBackup(json);
    expect(core.isManual(null)).toBe(true);
    expect(order(null)).toEqual(['اول', 'دوم']);
  });

  it('puts a reopened task back where it was', () => {
    core.addTask({ title: 'الف', categoryId: 'shop' });
    const b = core.addTask({ title: 'ب', categoryId: 'shop' });
    core.setManual('shop', true);
    core.setDone(b.id, true);
    expect(order('shop')).toEqual(['الف']);
    core.setDone(b.id, false);
    expect(order('shop')).toEqual(['ب', 'الف']);
  });
});

describe('add to today', () => {
  it('moves a task to today, keeps its time and repeat, and can be undone', () => {
    const t = core.addTask({ title: 'خرید', categoryId: 'shop', due: '2026-10-05', time: '09:30', repeat: { kind: 'weekly' } });
    const moved = core.addToToday(t.id);
    expect(moved.due).toBe('2026-09-28');
    expect(moved.time).toBe('09:30');
    expect(moved.repeat?.kind).toBe('weekly');
    expect(titles(core.dashboard().tasks)).toEqual(['خرید']);
    expect(core.undo()).toBe('move');
    expect(core.task(t.id)?.due).toBe('2026-10-05');
    expect(core.dashboard().tasks).toEqual([]);
  });

  it('puts an undated task on today, and brings an overdue one forward', () => {
    const a = core.addTask({ title: 'بدون تاریخ', categoryId: 'shop' });
    const b = core.addTask({ title: 'دیروز', categoryId: 'shop', due: '2026-09-27' });
    expect(titles(core.dashboard().undated)).toEqual(['بدون تاریخ']);
    core.addToToday(a.id);
    core.addToToday(b.id);
    expect(core.dashboard().undated).toEqual([]);
    expect(core.dashboard().overdue).toEqual([]);
    expect(titles(core.dashboard().tasks).sort()).toEqual(['بدون تاریخ', 'دیروز']);
  });

  it('leaves a task already due today, and a completed task, alone', () => {
    const a = core.addTask({ title: 'امروزی', due: '2026-09-28' });
    const done = core.addTask({ title: 'تمام', due: '2026-09-20' });
    core.setDone(done.id, true);
    expect(core.addToToday(a.id).due).toBe('2026-09-28');
    expect(core.canUndo()).toBe(true); // still the completion, not a move
    expect(core.addToToday(done.id).due).toBe('2026-09-20');
    expect(core.undo()).toBe('complete');
  });
});

describe('list orders', () => {
  const order = (id: string | null) => titles(core.list(id).open);
  const fill = () => {
    core.addTask({ title: 'ب نان', categoryId: 'shop', due: '2026-09-28', time: '09:00', priority: 'low' });
    core.addTask({ title: 'الف شیر', categoryId: 'shop', due: '2026-09-28', time: '18:00', priority: 'high' });
    core.addTask({ title: 'ج چای', categoryId: 'shop', due: '2026-09-28', time: '12:00' });
  };

  it('arranges a list by time, newest, priority or title, and remembers it per list', () => {
    fill();
    expect(core.listOrder('shop')).toBe('time');
    expect(order('shop')).toEqual(['ب نان', 'ج چای', 'الف شیر']);
    core.setListOrder('shop', 'newest');
    expect(order('shop')).toEqual(['ج چای', 'الف شیر', 'ب نان']);
    core.setListOrder('shop', 'priority');
    expect(order('shop')).toEqual(['الف شیر', 'ب نان', 'ج چای']);
    core.setListOrder('shop', 'title');
    expect(order('shop')).toEqual(['الف شیر', 'ب نان', 'ج چای']);
    expect(core.listOrder('sport')).toBe('time');
  });

  it('starts manual order from the order you see', () => {
    fill();
    core.setListOrder('shop', 'priority');
    core.setListOrder('shop', 'manual');
    expect(core.isManual('shop')).toBe(true);
    expect(order('shop')).toEqual(['الف شیر', 'ب نان', 'ج چای']);
  });

  it('arranges the dashboard too, keeping overdue tasks in their own group', () => {
    fill();
    core.addTask({ title: 'دیروزی', due: '2026-09-27', priority: 'low' });
    core.setDashboardOrder('priority');
    expect(core.dashboardOrder()).toBe('priority');
    expect(titles(core.dashboard().overdue)).toEqual(['دیروزی']);
    expect(titles(core.dashboard().tasks)).toEqual(['الف شیر', 'ب نان', 'ج چای']);
    // The category list keeps its own order.
    expect(order('shop')).toEqual(['ب نان', 'ج چای', 'الف شیر']);
  });

  it('puts completed tasks last whatever the order', () => {
    fill();
    const first = core.dashboard().tasks.find((t) => t.title === 'الف شیر')!;
    core.setDone(first.id, true);
    core.setDashboardOrder('title');
    expect(titles(core.dashboard().tasks)).toEqual(['ب نان', 'ج چای', 'الف شیر']);
  });

  it('keeps lists arranged by hand in data saved before list orders existed', async () => {
    core.addTask({ title: 'یک', categoryId: 'shop' });
    const saved = JSON.parse(JSON.stringify(storage.saved));
    delete saved.settings.listOrders;
    saved.settings.manualLists = ['shop'];
    const reopened = await TaskCore.open({ clock, storage: new MemoryStorage(saved) });
    expect(reopened.isManual('shop')).toBe(true);
    expect(reopened.listOrder('sport')).toBe('time');
    expect('manualLists' in reopened.settings).toBe(false);
  });
});

describe('history and stats', () => {
  const day = (iso: string, h = 12) => new Date(`${iso}T${String(h).padStart(2, '0')}:00:00+04:30`);
  const finish = (title: string, categoryId: string | null, on: string) => {
    clock.set(day(on));
    const t = core.addTask({ title, categoryId });
    core.setDone(t.id, true);
    return t;
  };

  it('counts this week from Saturday, per category and in all', () => {
    // 2026-09-26 is a Saturday, 2026-09-28 the Monday of this week; 2026-09-19 a Saturday of last week.
    finish('دویدن ۱', 'sport', '2026-09-26');
    finish('دویدن ۲', 'sport', '2026-09-28');
    finish('دویدن ۳', 'sport', '2026-09-28');
    finish('کتاب', 'study', '2026-09-28');
    finish('هفتهٔ پیش', 'sport', '2026-09-20');
    clock.set(day('2026-09-28'));
    const sport = core.stats('sport');
    expect(sport.days.map((d) => d.count)).toEqual([1, 0, 2, 0, 0, 0, 0]);
    expect(sport.days[0].date).toBe('2026-09-26');
    expect(sport.days.map((d) => d.future)).toEqual([false, false, false, true, true, true, true]);
    expect(sport.weekTotal).toBe(3);
    expect(sport.lastWeekTotal).toBe(1);
    expect(core.stats('study').weekTotal).toBe(1);
    expect(core.stats('all').weekTotal).toBe(4);
    expect(core.stats(null).weekTotal).toBe(0);
  });

  it('counts the days in a row, and keeps the streak alive until the day is over', () => {
    finish('الف', 'study', '2026-09-24');
    finish('ب', 'study', '2026-09-25');
    finish('ج', 'study', '2026-09-26');
    clock.set(day('2026-09-27'));
    expect(core.stats('study').streak).toBe(3);
    finish('د', 'study', '2026-09-27');
    expect(core.stats('study').streak).toBe(4);
    clock.set(day('2026-09-29'));
    expect(core.stats('study').streak).toBe(0);
    finish('ه', 'study', '2026-09-30');
    expect(core.stats('study').streak).toBe(1);
  });

  it('takes a completion back when the task is reopened or the completion undone', () => {
    clock.set(day('2026-09-28'));
    const a = core.addTask({ title: 'الف', categoryId: 'sport' });
    core.setDone(a.id, true);
    expect(core.stats('sport').today).toBe(1);
    core.setDone(a.id, false);
    expect(core.stats('sport').today).toBe(0);
    core.setDone(a.id, true);
    core.undo();
    expect(core.stats('sport').today).toBe(0);
  });

  it('keeps the history after the completed tasks are cleared or deleted', () => {
    clock.set(day('2026-09-28'));
    const a = finish('الف', 'sport', '2026-09-28');
    finish('ب', 'sport', '2026-09-28');
    core.deleteTask(a.id);
    core.clearCompleted('sport');
    expect(core.search('')).toEqual([]);
    expect(core.stats('sport').today).toBe(2);
  });

  it('counts a repeating task once per completion', () => {
    clock.set(day('2026-09-28'));
    const r = core.addTask({ title: 'دارو', categoryId: 'sport', due: '2026-09-28', repeat: { kind: 'daily' } });
    core.setDone(r.id, true);
    expect(core.stats('sport').today).toBe(1);
  });

  it('builds history from completed tasks for data saved before it existed', async () => {
    const old = {
      version: 1 as const,
      categories: [{ id: 'sport', name: 'ورزش', emoji: '🏃', color: 'green' as const, order: 0 }],
      settings: {},
      tasks: [
        { id: '1', title: 'الف', categoryId: 'sport', done: true, completedAt: '2026-09-28T09:00:00+04:30', createdAt: '2026-09-27T00:00:00Z' },
        { id: '2', title: 'ب', categoryId: 'sport', done: true, completedAt: '2026-09-26T09:00:00+04:30', createdAt: '2026-09-27T00:00:00Z' },
        { id: '3', title: 'ج', categoryId: 'sport', done: false, createdAt: '2026-09-27T00:00:00Z' },
      ],
    };
    const reopened = await TaskCore.open({ clock, storage: new MemoryStorage(old as never) });
    expect(reopened.stats('sport').days.map((d) => d.count)).toEqual([1, 0, 1, 0, 0, 0, 0]);
  });

  it('keeps the history through export and import', () => {
    finish('الف', 'sport', '2026-09-28');
    const json = core.exportBackup();
    core.importBackup(json);
    clock.set(day('2026-09-28'));
    expect(core.stats('sport').weekTotal).toBe(1);
  });
});

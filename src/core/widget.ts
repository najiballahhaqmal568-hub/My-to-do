import { formatDay, formatTime, MESSAGES } from '../i18n';
import type { TaskCore } from './core';
import type { Task } from './types';

/** Category colours that read well on both a light and a dark widget background. */
const COLORS: Record<string, string> = {
  green: '#23875A',
  orange: '#C06A00',
  indigo: '#4453CC',
  rose: '#C2255C',
  teal: '#0E7C86',
  violet: '#7048C8',
  amber: '#A67C00',
  sky: '#1971C2',
  inbox: '#5B645E',
};

export interface WidgetItem {
  title: string;
  /** Already formatted for the language, or an empty string. */
  time: string;
  color: string;
  overdue: boolean;
}

/** Everything the home screen widget shows, ready to draw. The native widget cannot read the app's database. */
export interface WidgetSnapshot {
  /** The day this snapshot is for (ISO), so the widget can tell when it has gone stale. */
  day: string;
  rtl: boolean;
  title: string;
  summary: string;
  progress: number;
  items: WidgetItem[];
  more: string;
  tomorrow: string;
  staleHint: string;
}

export const WIDGET_ROWS = 6;

export function widgetSnapshot(core: TaskCore): WidgetSnapshot {
  const lang = core.settings.language;
  const t = MESSAGES[lang];
  const d = core.dashboard();
  const open = (tasks: Task[]) => tasks.filter((x) => !x.done);
  const list = [...open(d.overdue), ...open(d.tasks), ...d.undated];
  const items: WidgetItem[] = list.slice(0, WIDGET_ROWS).map((task) => ({
    title: task.title,
    time: task.time ? formatTime(lang, task.time) : '',
    color: COLORS[core.category(task.categoryId)?.color ?? 'inbox'],
    overdue: core.isOverdue(task, d.today),
  }));
  const { done, total } = d.progress;
  return {
    day: d.today,
    rtl: lang === 'fa',
    title: formatDay(lang, d.today),
    summary: total ? t.progress(done, total) : list.length ? t.tasksLeft(list.length) : t.nothingToday.split('.')[0],
    progress: total ? Math.round((done / total) * 100) : 0,
    items,
    more: list.length > WIDGET_ROWS ? t.moreTasks(list.length - WIDGET_ROWS) : '',
    tomorrow: `${t.tomorrow}: ${t.taskCount(d.tomorrowItems.length)}`,
    staleHint: lang === 'fa' ? 'برای به‌روز شدن، اپ را باز کنید' : 'Open the app to refresh',
  };
}

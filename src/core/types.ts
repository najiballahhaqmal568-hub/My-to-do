import type { ISODate, Time } from './dates';

export type Priority = 'none' | 'low' | 'medium' | 'high';
export type ReminderOffset = 'atTime' | '15m' | '1h' | '1d';
export type Language = 'fa' | 'en';

/**
 * How a task repeats. Monthly and yearly repeats follow the Solar Hijri calendar;
 * their anchor day (and month) is taken from the due date when the rule is set.
 */
export type RepeatRule =
  | { kind: 'daily' }
  | { kind: 'weekly' }
  | { kind: 'monthly'; day?: number }
  | { kind: 'yearly'; month?: number; day?: number }
  /** 0 = Sunday … 6 = Saturday */
  | { kind: 'weekdays'; days: number[] }
  | { kind: 'everyN'; n: number };

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  /** `null` means the task is in the Inbox. */
  categoryId: string | null;
  due: ISODate | null;
  time: Time | null;
  priority: Priority;
  repeat: RepeatRule | null;
  reminder: ReminderOffset | null;
  subtasks: Subtask[];
  done: boolean;
  completedAt: string | null;
  createdAt: string;
  /** For a completed repeating occurrence: the id of the next occurrence it created. */
  spawnedId?: string | null;
}

export type CategoryColor = 'green' | 'orange' | 'indigo' | 'rose' | 'teal' | 'violet' | 'amber' | 'sky';
export const CATEGORY_COLORS: CategoryColor[] = ['green', 'orange', 'indigo', 'rose', 'teal', 'violet', 'amber', 'sky'];

export interface Category {
  id: string;
  name: string;
  color: CategoryColor;
  emoji: string;
  order: number;
}

export interface Settings {
  language: Language;
  bedtimeEnabled: boolean;
  bedtimeTime: Time;
  exactAlarmAsked: boolean;
}

export interface Data {
  version: 1;
  tasks: Task[];
  categories: Category[];
  settings: Settings;
}

export interface TaskInput {
  title: string;
  notes?: string;
  categoryId?: string | null;
  due?: ISODate | null;
  time?: Time | null;
  priority?: Priority;
  repeat?: RepeatRule | null;
  reminder?: ReminderOffset | null;
  subtasks?: { id?: string; title: string; done?: boolean }[];
}

/** A task on a given day: either the live task itself or a projected future run of a repeating task. */
export interface Occurrence {
  task: Task;
  date: ISODate;
  projected: boolean;
}

export interface PlannedNotification {
  id: number;
  at: Date;
  title: string;
  body: string;
  /** Where tapping the notification leads: `tomorrow` or `task:<id>`. */
  link: string;
}

export interface Clock {
  now(): Date;
}

export interface StoragePort {
  load(): Promise<Data | null>;
  save(data: Data): Promise<void>;
}

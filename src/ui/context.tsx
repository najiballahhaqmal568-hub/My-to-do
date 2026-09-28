import { createContext, useContext } from 'react';
import type { TaskCore } from '../core/core';
import type { Language, TaskInput } from '../core/types';
import type { Messages } from '../i18n';

export type Route =
  | { name: 'dashboard' }
  | { name: 'upcoming' }
  | { name: 'categories' }
  | { name: 'list'; categoryId: string | null }
  | { name: 'search' }
  | { name: 'settings' };

export interface EditorRequest {
  taskId?: string;
  defaults?: Partial<TaskInput>;
}

export interface ConfirmOption {
  label: string;
  tone?: 'primary' | 'danger';
  value: string;
}

export interface AppContextValue {
  core: TaskCore;
  lang: Language;
  t: Messages;
  dir: 'rtl' | 'ltr';
  /** Changes whenever data changes or the clock ticks over a minute; include in memo deps. */
  tick: number;
  route: Route;
  navigate(route: Route): void;
  back(): void;
  openEditor(req: EditorRequest): void;
  toast(message: string, withUndo?: boolean): void;
  /** Shows an in-app dialog and resolves with the chosen option's value, or null when dismissed. */
  ask(title: string, body: string, options: ConfirmOption[]): Promise<string | null>;
  /** Completes or reopens a task with feedback (haptics, sparks, undo toast, celebration). */
  complete(taskId: string, done: boolean, origin?: DOMRect): void;
  reduceMotion: boolean;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const v = useContext(AppContext);
  if (!v) throw new Error('AppContext missing');
  return v;
}

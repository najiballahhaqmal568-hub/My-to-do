import { MotionConfig, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { addDays } from '../core/dates';
import type { TaskCore } from '../core/core';
import { MESSAGES } from '../i18n';
import { hapticSuccess, hapticTap, onBackButton, onResume } from '../platform/device';
import { notifications } from '../platform/notifications';
import { CategoryEditor } from './components/CategoryEditor';
import { Dialog, Sheet, Toast, type DialogState, type ToastState } from './components/Overlays';
import { TaskEditor } from './components/TaskEditor';
import { refreshUpdate } from './components/UpdateBanner';
import { AppContext, type AppContextValue, type ConfirmOption, type EditorRequest, type Route } from './context';
import { confetti, sparkBurst } from './effects';
import { Icon, type IconName } from './icons';
import { Categories } from './screens/Categories';
import { Dashboard } from './screens/Dashboard';
import { ListScreen } from './screens/ListScreen';
import { Search } from './screens/Search';
import { Settings } from './screens/Settings';
import { Upcoming } from './screens/Upcoming';

const TABS: { route: Route['name']; icon: IconName; label: 'dashboard' | 'upcoming' | 'categories' | 'settings' }[] = [
  { route: 'dashboard', icon: 'home', label: 'dashboard' },
  { route: 'upcoming', icon: 'calendar', label: 'upcoming' },
  { route: 'categories', icon: 'grid', label: 'categories' },
  { route: 'settings', icon: 'gear', label: 'settings' },
];

export function App({ core }: { core: TaskCore }) {
  const version = useSyncExternalStore(core.subscribe, () => core.version);
  const [minute, setMinute] = useState(0);
  const [resumes, setResumes] = useState(0);
  const reduceMotion = useReducedMotion() ?? false;
  const lang = core.settings.language;
  const t = MESSAGES[lang];
  const dir = lang === 'fa' ? 'rtl' : 'ltr';

  const [stack, setStack] = useState<Route[]>([{ name: 'dashboard' }]);
  const [editor, setEditor] = useState<EditorRequest | null>(null);
  const [catEditor, setCatEditor] = useState<string | null | undefined>(undefined);
  const [toastState, setToastState] = useState<ToastState | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const route = stack[stack.length - 1];
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    document.title = t.appName;
  }, [lang, dir, t]);

  // Keep "today" fresh while the app stays open, and after it returns from the background.
  useEffect(() => {
    const id = window.setInterval(() => setMinute((m) => m + 1), 30000);
    onResume(() => {
      setMinute((m) => m + 1);
      setResumes((r) => r + 1);
    });
    return () => window.clearInterval(id);
  }, []);

  // Every change to the data re-plans the scheduled notifications.
  useEffect(() => {
    const id = window.setTimeout(() => notifications.apply(core.notificationPlan()), 250);
    return () => window.clearTimeout(id);
  }, [core, version, resumes]);

  const transition = useCallback(
    (fn: () => void) => {
      const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
      if (!reduceMotion && doc.startViewTransition) doc.startViewTransition(() => flushSync(fn));
      else fn();
    },
    [reduceMotion],
  );

  const navigate = useCallback(
    (r: Route) => {
      const isTab = TABS.some((x) => x.route === r.name);
      transition(() => setStack((s) => (isTab ? (r.name === 'dashboard' ? [r] : [{ name: 'dashboard' }, r]) : [...s, r])));
      window.scrollTo({ top: 0 });
    },
    [transition],
  );

  const back = useCallback(() => {
    transition(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)));
  }, [transition]);

  const toast = useCallback((message: string, withUndo = false) => {
    window.clearTimeout(toastTimer.current);
    setToastState({ id: Date.now(), message, undo: withUndo });
    toastTimer.current = window.setTimeout(() => setToastState(null), 4500);
  }, []);

  const ask = useCallback(
    (title: string, body: string, options: ConfirmOption[]) =>
      new Promise<string | null>((resolve) => {
        setDialog({ title, body, options, resolve: (v) => (setDialog(null), resolve(v)) });
      }),
    [],
  );

  const complete = useCallback(
    (taskId: string, done: boolean, origin?: DOMRect) => {
      const before = core.dashboard().progress;
      core.setDone(taskId, done);
      if (!done) return;
      hapticTap();
      if (!reduceMotion && origin) sparkBurst(origin);
      toast(t.done, true);
      const after = core.dashboard().progress;
      if (after.total > 0 && after.done === after.total && before.done < before.total) {
        hapticSuccess();
        if (!reduceMotion) confetti();
      }
    },
    [core, reduceMotion, toast, t],
  );

  const handleLink = useCallback(
    (link: string) => {
      setEditor(null);
      if (link === 'tomorrow') {
        setStack([{ name: 'dashboard' }]);
        window.setTimeout(() => {
          const el = document.getElementById('tomorrow');
          if (!el) return;
          el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
          el.classList.remove('flash');
          void el.offsetWidth;
          el.classList.add('flash');
        }, 350);
      } else if (link.startsWith('task:') && core.task(link.slice(5))) {
        setEditor({ taskId: link.slice(5) });
      }
    },
    [core, reduceMotion],
  );

  // Deep links: notification taps, and `#tomorrow` in the address (used by tests).
  const linkRef = useRef(handleLink);
  linkRef.current = handleLink;
  useEffect(() => {
    notifications.onOpen((l) => linkRef.current(l));
    if (location.hash.length > 1) linkRef.current(decodeURIComponent(location.hash.slice(1)));
    if (!navigator.webdriver) refreshUpdate();
  }, []);

  // Android back button: close the top layer first.
  const layers = useRef({ dialog, editor, catEditor, stack });
  layers.current = { dialog, editor, catEditor, stack };
  useEffect(() => {
    onBackButton(() => {
      const l = layers.current;
      if (l.dialog) return l.dialog.resolve(null), true;
      if (l.editor) return setEditor(null), true;
      if (l.catEditor !== undefined) return setCatEditor(undefined), true;
      if (l.stack.length > 1) return back(), true;
      return false;
    });
  }, [back]);

  const tick = version * 1_000_000 + minute;
  const ctx = useMemo<AppContextValue>(
    () => ({ core, lang, t, dir, tick, route, navigate, back, openEditor: setEditor, toast, ask, complete, reduceMotion }),
    [core, lang, t, dir, tick, route, navigate, back, toast, ask, complete, reduceMotion],
  );

  const fabDefaults = (): EditorRequest => {
    const today = core.today();
    if (route.name === 'dashboard') return { defaults: { due: today } };
    if (route.name === 'upcoming') return { defaults: { due: addDays(today, 1) } };
    if (route.name === 'list') return { defaults: { categoryId: route.categoryId } };
    return {};
  };

  let screen;
  switch (route.name) {
    case 'dashboard':
      screen = <Dashboard />;
      break;
    case 'upcoming':
      screen = <Upcoming />;
      break;
    case 'categories':
      screen = <Categories onEdit={setCatEditor} />;
      break;
    case 'list':
      screen = <ListScreen key={String(route.categoryId)} categoryId={route.categoryId} />;
      break;
    case 'search':
      screen = <Search />;
      break;
    case 'settings':
      screen = <Settings />;
      break;
  }

  const activeTab = route.name === 'list' || route.name === 'search' ? (stack.find((r) => r.name !== 'dashboard')?.name ?? 'dashboard') : route.name;

  return (
    <MotionConfig reducedMotion="user">
      <AppContext.Provider value={ctx}>
        {screen}
        <nav className="nav" aria-label={t.appName}>
          {TABS.slice(0, 2).map((tab) => (
            <button key={tab.route} aria-current={activeTab === tab.route ? 'page' : undefined} onClick={() => navigate({ name: tab.route } as Route)}>
              <span className="ic">
                <Icon name={tab.icon} />
              </span>
              {t[tab.label]}
            </button>
          ))}
          <button className="fab" aria-label={t.newTask} data-testid="fab" onClick={() => setEditor(fabDefaults())}>
            <Icon name="plus" />
          </button>
          {TABS.slice(2).map((tab) => (
            <button key={tab.route} aria-current={activeTab === tab.route ? 'page' : undefined} onClick={() => navigate({ name: tab.route } as Route)}>
              <span className="ic">
                <Icon name={tab.icon} />
              </span>
              {t[tab.label]}
            </button>
          ))}
        </nav>
        <Sheet open={editor !== null} onClose={() => setEditor(null)} label={t.editTask}>
          {editor && <TaskEditor key={editor.taskId ?? 'new'} request={editor} onClose={() => setEditor(null)} />}
        </Sheet>
        <Sheet open={catEditor !== undefined} onClose={() => setCatEditor(undefined)} label={t.editCategory}>
          {catEditor !== undefined && <CategoryEditor key={catEditor ?? 'new'} categoryId={catEditor} onClose={() => setCatEditor(undefined)} />}
        </Sheet>
        <Toast
          toast={toastState}
          undoLabel={t.undo}
          onUndo={() => {
            core.undo();
            setToastState(null);
          }}
        />
        <Dialog state={dialog} cancelLabel={t.cancel} />
      </AppContext.Provider>
    </MotionConfig>
  );
}

import '@fontsource-variable/vazirmatn';
import './ui/styles.css';
import { createRoot } from 'react-dom/client';
import { TaskCore } from './core/core';
import { DexieStorage } from './platform/storage';
import { followSystemTheme } from './platform/theme';
import { App } from './ui/App';

async function start() {
  followSystemTheme();
  const core = await TaskCore.open({ clock: { now: () => new Date() }, storage: new DexieStorage() });
  createRoot(document.getElementById('root')!).render(<App core={core} />);
}

start();

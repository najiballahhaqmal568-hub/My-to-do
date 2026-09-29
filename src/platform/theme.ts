import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { isNative } from './device';

interface SystemThemePlugin {
  get(): Promise<{ dark: boolean }>;
  addListener(event: 'change', cb: (state: { dark: boolean }) => void): Promise<PluginListenerHandle>;
}

const SystemTheme = registerPlugin<SystemThemePlugin>('SystemTheme');

function apply(dark: boolean) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0e1210' : '#1e6a51');
}

/** On Android, follows the phone's dark mode directly, including changes while the app is open. */
export function followSystemTheme(): void {
  if (!isNative) return;
  SystemTheme.get().then((s) => apply(s.dark), () => undefined);
  SystemTheme.addListener('change', (s) => apply(s.dark)).catch(() => undefined);
}

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { isNewer } from '../core/version';

export const isNative = Capacitor.isNativePlatform();
export const APP_VERSION: string = __APP_VERSION__;
const REPO = 'najiballahhaqmal568-hub/My-to-do';

export function hapticTap(): void {
  if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
  else navigator.vibrate?.(8);
}

export function hapticSuccess(): void {
  if (isNative) Haptics.notification({ type: NotificationType.Success }).catch(() => undefined);
  else navigator.vibrate?.([8, 40, 12]);
}

/** Lets the user save or send a backup file through Android's share sheet (a download in the browser). */
export async function shareFile(name: string, text: string): Promise<void> {
  if (isNative) {
    const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: name, url: uri, dialogTitle: name });
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Quietly keeps a copy of the data inside the app's private storage. */
export async function keepPrivateBackup(name: string, text: string): Promise<void> {
  if (!isNative) return;
  await Filesystem.writeFile({ path: `backups/${name}`, data: text, directory: Directory.Data, encoding: Encoding.UTF8, recursive: true });
}

export interface ReleaseInfo {
  version: string;
  url: string;
}

/** Asks GitHub for the latest release. Only the version is compared; no user data is sent. */
export async function checkForUpdate(): Promise<ReleaseInfo | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    const json = (await res.json()) as { tag_name?: string; html_url?: string };
    if (json.tag_name && json.html_url && isNewer(json.tag_name, APP_VERSION)) return { version: json.tag_name.replace(/^v/, ''), url: json.html_url };
    return null;
  } catch {
    return null;
  }
}

export function onBackButton(handler: () => boolean): void {
  if (!isNative) return;
  App.addListener('backButton', () => {
    if (!handler()) App.minimizeApp();
  });
}

export function onResume(handler: () => void): void {
  if (isNative) App.addListener('resume', handler);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') handler();
  });
}

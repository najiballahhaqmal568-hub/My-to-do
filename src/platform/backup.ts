import { registerPlugin } from '@capacitor/core';
import { isNative } from './device';

export interface BackupResult {
  saved: boolean;
  /** `unsupported` on Android 9 and older. */
  reason?: string;
}

interface BackupPlugin {
  save(options: { name: string; text: string; keep: number }): Promise<BackupResult & { path?: string }>;
}

const KEEP = 14;
const Native = registerPlugin<BackupPlugin>('Backup');

/** Saves a backup file into the phone's Download/My-To-Do folder. In the browser it is only recorded for tests. */
export async function saveBackup(name: string, text: string): Promise<BackupResult> {
  if (isNative) return Native.save({ name, text, keep: KEEP });
  (window as unknown as { __autoBackups?: { name: string; text: string }[] }).__autoBackups ??= [];
  (window as unknown as { __autoBackups: { name: string; text: string }[] }).__autoBackups.push({ name, text });
  return { saved: true };
}

export const backupName = (day: string) => `my-to-do-${day}.json`;

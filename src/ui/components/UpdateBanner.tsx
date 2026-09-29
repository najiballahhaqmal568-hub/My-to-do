import { useSyncExternalStore } from 'react';
import { checkForUpdate, type ReleaseInfo } from '../../platform/device';
import { useApp } from '../context';

let latest: ReleaseInfo | null = null;
let checked = false;
const listeners = new Set<() => void>();

/** Checks GitHub once per launch (and again on demand). Resolves with the newer release, if any. */
export async function refreshUpdate(): Promise<ReleaseInfo | null> {
  latest = await checkForUpdate();
  checked = true;
  listeners.forEach((l) => l());
  return latest;
}

export function useUpdate(): { latest: ReleaseInfo | null; checked: boolean } {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => `${checked}:${latest?.version ?? ''}`,
  );
  return { latest, checked };
}

export function UpdateBanner() {
  const { t } = useApp();
  const { latest } = useUpdate();
  if (!latest) return null;
  return (
    <div className="banner" role="status">
      <span>{t.updateAvailable}</span>
      <a href={latest.url} target="_blank" rel="noreferrer">
        {t.download}
      </a>
    </div>
  );
}

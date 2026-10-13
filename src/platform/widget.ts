import { registerPlugin } from '@capacitor/core';
import type { WidgetSnapshot } from '../core/widget';
import { isNative } from './device';

interface WidgetPlugin {
  update(options: { json: string }): Promise<void>;
  selfTest(): Promise<{ ok: boolean; texts?: string[]; error?: string }>;
}

const Native = registerPlugin<WidgetPlugin>('Widget');
let last = '';

/**
 * Hands today's snapshot to the home screen widget. Does nothing when it has not changed.
 * In the browser it only records the snapshot, for tests.
 */
export function updateWidget(snapshot: WidgetSnapshot): void {
  const json = JSON.stringify(snapshot);
  if (json === last) return;
  last = json;
  if (isNative) {
    // Let the emulator test draw the widget and read what it shows.
    (window as unknown as { __widget?: unknown }).__widget = { selfTest: () => Native.selfTest() };
    Native.update({ json }).catch(() => (last = ''));
  } else (window as unknown as { __widgetSnapshot?: WidgetSnapshot }).__widgetSnapshot = snapshot;
}

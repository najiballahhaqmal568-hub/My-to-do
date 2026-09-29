import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { PlannedNotification } from '../core/types';

export interface NotificationAdapter {
  /** Replaces every scheduled notification with the plan. */
  apply(plan: PlannedNotification[]): Promise<void>;
  /** Asks for notification permission (and, the first time, exact alarms). Returns whether notifications may show. */
  ensurePermission(askExact: boolean): Promise<boolean>;
  exactAllowed(): Promise<boolean>;
  openExactSettings(): Promise<void>;
  onOpen(cb: (link: string) => void): void;
}

const CHANNEL = 'reminders';

class NativeNotifications implements NotificationAdapter {
  private queue: Promise<void> = Promise.resolve();
  private channelReady: Promise<void> | null = null;
  private lastPlan: PlannedNotification[] = [];

  private channel() {
    this.channelReady ??= LocalNotifications.createChannel({
      id: CHANNEL,
      name: 'یادآوری‌ها',
      description: 'Task reminders and the bedtime summary',
      importance: 4,
      visibility: 1,
      vibration: true,
    }).catch(() => undefined);
    return this.channelReady;
  }

  apply(plan: PlannedNotification[]): Promise<void> {
    this.lastPlan = plan;
    this.queue = this.queue
      .then(async () => {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== 'granted') return;
        await this.channel();
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length) {
          await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
        }
        if (!plan.length) return;
        await LocalNotifications.schedule({
          notifications: plan.map((p) => ({
            id: p.id,
            title: p.title,
            body: p.body,
            largeBody: p.body,
            channelId: CHANNEL,
            smallIcon: 'ic_stat_icon',
            iconColor: '#1E6A51',
            schedule: { at: p.at, allowWhileIdle: true },
            extra: { link: p.link },
          })),
        });
      })
      .catch((e) => console.error('notifications', e));
    return this.queue;
  }

  async ensurePermission(askExact: boolean): Promise<boolean> {
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return false;
    if (askExact && !(await this.exactAllowed())) await this.openExactSettings();
    // Anything planned before permission was granted was skipped; schedule it now.
    await this.apply(this.lastPlan);
    return true;
  }

  async exactAllowed(): Promise<boolean> {
    try {
      return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted';
    } catch {
      return true;
    }
  }

  async openExactSettings(): Promise<void> {
    try {
      await LocalNotifications.changeExactNotificationSetting();
    } catch {
      /* older Android: exact alarms are always allowed */
    }
  }

  onOpen(cb: (link: string) => void): void {
    LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
      const link = e.notification.extra?.link;
      if (typeof link === 'string') cb(link);
    });
  }
}

/** In the browser there is nothing to schedule; the plan is exposed for end-to-end tests. */
class WebNotifications implements NotificationAdapter {
  async apply(plan: PlannedNotification[]) {
    (window as unknown as { __notificationPlan: unknown }).__notificationPlan = plan.map((p) => ({ ...p, at: p.at.toISOString() }));
  }
  async ensurePermission() {
    return true;
  }
  async exactAllowed() {
    return true;
  }
  async openExactSettings() {}
  onOpen() {}
}

export const notifications: NotificationAdapter = Capacitor.isNativePlatform() ? new NativeNotifications() : new WebNotifications();

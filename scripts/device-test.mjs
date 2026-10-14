// Drives the real app inside the Android emulator's WebView over the Chrome DevTools protocol.
import { execSync } from 'node:child_process';
import { _android as android } from 'playwright-core';

const PKG = 'app.mytodo.personal';
const OUT = 'device-shots';
const sh = (cmd) => execSync(cmd, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[device]', ...a);
let failures = 0;
const check = (ok, what) => {
  console.log(`[device] ${ok ? 'PASS' : 'FAIL'}: ${what}`);
  if (!ok) failures++;
};
/** Clicks through the DOM, so a moving layout (keyboard opening, springs) cannot misroute the tap. */
const tap = (locator) => locator.evaluate((el) => el.click());
const blur = (p) => p.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
const shot = (name) => sh(`adb exec-out screencap -p > ${OUT}/${name}.png`);

let device;
async function connect() {
  if (!device) [device] = await android.devices({ omitDriverInstall: true });
  let page;
  for (let attempt = 0; attempt < 4 && !page; attempt++) {
    // After the notification shade or the share sheet, make sure the app is in front again.
    sh(`adb shell am start -n ${PKG}/.MainActivity`);
    await sleep(1500);
    try {
      const webview = await device.webView({ pkg: PKG }, { timeout: 30000 });
      const candidate = await webview.page();
      if (!candidate.isClosed()) page = candidate;
    } catch (e) {
      log('reconnect attempt', attempt + 1, String(e).split('\n')[0]);
    }
  }
  if (!page) throw new Error('could not reach the app WebView');
  return { browser: { close: async () => undefined }, page };
}

const errors = [];
let { browser, page } = await connect();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.getByTestId('dashboard').waitFor({ timeout: 30000 });
await sleep(2500);
check(true, 'dashboard renders on the device');
check((await page.getByText('نسخهٔ جدید آماده است').count()) > 0, 'update check finds the newer GitHub release');
shot('1-dashboard');

// A task with a reminder a few minutes from now. The picker offers five-minute steps, so use the
// next step at least two minutes ahead (and wait out midnight, when the date would change).
const nextStep = () =>
  page.evaluate(() => {
    const d = new Date(Date.now() + 2 * 60000);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    const p = (n) => String(n).padStart(2, '0');
    return { hour: p(d.getHours()), minute: p(d.getMinutes()), sameDay: d.getDate() === new Date().getDate() };
  });
let step = await nextStep();
if (!step.sameDay) {
  await sleep(6 * 60000);
  step = await nextStep();
}
await tap(page.getByTestId('fab'));
await page.locator('#task-title').fill('آزمایش یادآوری');
await page.locator('#task-time-hour').selectOption(step.hour);
await page.locator('#task-time-minute').selectOption(step.minute);
await blur(page);
await tap(page.getByRole('dialog').getByRole('button', { name: 'سر وقت', exact: true }));
await tap(page.getByRole('dialog').getByRole('button', { name: '🏃 ورزش' }));
await sleep(800);
shot('2-editor');
await tap(page.getByRole('button', { name: 'ذخیره', exact: true }));
await sleep(4000);
shot('3-dashboard-with-task');

const alarms = sh('adb shell dumpsys alarm');
check(alarms.includes(PKG), 'Android has alarms scheduled for the app');

// The home screen widget: registered with Android, fed by the app, and able to draw itself.
const widgets = sh('adb shell dumpsys appwidget');
check(widgets.includes('app.mytodo.personal/.TodayWidgetProvider') || widgets.includes(`${PKG}.TodayWidgetProvider`), 'the home screen widget is registered with Android');
const stored = sh(`adb shell "run-as ${PKG} cat shared_prefs/widget.xml"`);
check(stored.includes('آزمایش یادآوری') && stored.includes('staleHint'), 'the app stored today\'s snapshot for the widget');
const drawn = await page.evaluate(() => window.__widget?.selfTest());
const drawnText = (drawn?.texts ?? []).join(' | ');
check(drawn?.ok === true && drawnText.includes('آزمایش یادآوری'), `the widget draws in both directions with today's tasks (${drawn?.error ?? drawnText})`);

// The automatic daily backup is written into the public Download/My-To-Do folder.
let files = '';
for (let i = 0; i < 10 && !/my-to-do-\d{4}-\d{2}-\d{2}\.json/.test(files); i++) {
  files = sh('adb shell ls /sdcard/Download/My-To-Do/ 2>&1 || true');
  if (!/my-to-do-/.test(files)) await sleep(2000);
}
check(/my-to-do-\d{4}-\d{2}-\d{2}\.json/.test(files), `automatic backup file saved in Download/My-To-Do (${files.trim()})`);
const backupText = sh('adb shell "cat /sdcard/Download/My-To-Do/my-to-do-*.json | head -c 200"');
check(backupText.includes('"app": "my-to-do"'), 'the backup file holds the app data');

const apk = await page.getByRole('link', { name: 'دانلود' }).first().getAttribute('href').catch(() => null);
check(!!apk && apk.endsWith('.apk'), `the update message links straight to the APK (${apk})`);

// Back button closes an open sheet instead of leaving the app.
await tap(page.getByTestId('fab'));
await page.locator('#task-title').waitFor();
await sleep(800);
await blur(page);
await sleep(800);
sh('adb shell input keyevent KEYCODE_BACK');
await sleep(1500);
check((await page.locator('#task-title').count()) === 0, 'back button closes the task sheet');

// Completing a task (haptics must not break anything).
await tap(page.getByTestId('task-row').filter({ hasText: 'آزمایش یادآوری' }).getByRole('button', { name: /انجام شد/ }));
await sleep(1500);
check(await page.getByText('۱ از ۱ انجام شد').count() > 0, 'completing a task updates progress');
shot('4-completed');
await tap(page.getByRole('status').filter({ hasText: 'برگرداندن' }).getByRole('button', { name: 'برگرداندن' })).catch(() => undefined);
await sleep(1500);
check(await page.getByText('۰ از ۱ انجام شد').count() > 0, 'undo reopens the task');

// Wait for the reminder notification to be posted by Android.
let posted = false;
for (let i = 0; i < 100 && !posted; i++) {
  posted = sh('adb shell dumpsys notification --noredact').includes('آزمایش یادآوری');
  if (!posted) await sleep(5000);
}
check(posted, 'the task reminder notification arrives');

// The reminder carries «done» and «later» buttons, and pressing them reaches the app.
const dump = sh('adb shell dumpsys notification --noredact');
const at = dump.indexOf('آزمایش یادآوری');
const record = dump.slice(Math.max(0, at - 3000), at + 3000);
check(record.includes('انجام شد') && record.includes('۱۵ دقیقه بعد'), 'the reminder shows «انجام شد» and «۱۵ دقیقه بعد» buttons');
const notifId = [...dump.slice(0, at).matchAll(/pkg=app\.mytodo\.personal[^\n]* id=(\d+) tag=/g)].pop()?.[1];
const taskId = await page.getByTestId('task-row').filter({ hasText: 'آزمایش یادآوری' }).first().getAttribute('data-task-id');
if (notifId && taskId) {
  const press = (action) => {
    const json = JSON.stringify({ id: Number(notifId), extra: { link: `task:${taskId}` } }).replace(/"/g, '\\"');
    sh(`adb shell "am start -n ${PKG}/.MainActivity -a android.intent.action.MAIN -c android.intent.category.LAUNCHER --ei LocalNotificationId ${notifId} --es LocalNotificationUserAction ${action} --es LocalNotficationObject '${json}'"`);
  };
  press('later');
  await sleep(2500);
  check((await page.getByTestId('task-row').filter({ hasText: 'آزمایش یادآوری' }).count()) === 1, 'pressing «بعداً» keeps the task');
  press('done');
  await sleep(2500);
  const doneNow = await page.getByTestId('task-row').filter({ hasText: 'آزمایش یادآوری' }).first().evaluate((el) => el.querySelector('.row')?.classList.contains('done'));
  check(doneNow === true, 'pressing «انجام شد» on the notification completes the task');
  ({ browser, page } = await connect());
} else check(false, `could not read the notification id (${notifId}) or task id (${taskId})`);
sh('adb shell cmd statusbar expand-notifications');
await sleep(2000);
shot('5-notification');
sh('adb shell cmd statusbar collapse');
await sleep(1500);
({ browser, page } = await connect());

// Export opens Android's share sheet.
await tap(page.getByRole('navigation').getByRole('button', { name: 'تنظیمات' }));
await sleep(1000);
shot('6-settings');
await tap(page.getByRole('button', { name: 'خروجی گرفتن' }));
await sleep(3500);
shot('7-share-sheet');
const top = sh('adb shell dumpsys activity activities | grep -E "topResumedActivity|mResumedActivity" || true');
check(!top.includes(`${PKG}/.MainActivity`) || /Chooser|Resolver|share/i.test(top), 'export opens the share sheet');
log('top activity:', top.trim());
sh('adb shell input keyevent KEYCODE_BACK');
await sleep(1500);

// Arranging a list by hand with a real finger: Android's own input pipeline, not a mouse in a browser.
({ browser, page } = await connect());
const webViewTop = () => {
  try {
    sh('adb shell uiautomator dump /sdcard/ui.xml');
    const m = sh('adb shell cat /sdcard/ui.xml').match(/class="android\.webkit\.WebView"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 0, y: 0 };
  } catch {
    return { x: 0, y: 0 };
  }
};
const screenPoint = async (locator) => {
  const origin = webViewTop();
  const p = await locator.evaluate((el) => {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = el.getBoundingClientRect();
    return { x: (r.left + r.width / 2) * devicePixelRatio, y: (r.top + r.height / 2) * devicePixelRatio };
  });
  return { x: Math.round(origin.x + p.x), y: Math.round(origin.y + p.y) };
};
await tap(page.getByRole('navigation').getByRole('button', { name: 'داشبورد' }));
await sleep(800);
await tap(page.getByTestId('cat-card-دوکان'));
await page.getByTestId('list-screen').waitFor();
for (const title of ['اول', 'دوم', 'سوم']) {
  await tap(page.getByTestId('fab'));
  await page.locator('#task-title').fill(title);
  await blur(page);
  await tap(page.getByRole('button', { name: 'ذخیره', exact: true }));
  await sleep(1200);
}
const order = () => page.getByTestId('list-screen').getByTestId('task-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-title')));
check(JSON.stringify(await order()) === JSON.stringify(['سوم', 'دوم', 'اول']), `a new task is listed first (${JSON.stringify(await order())})`);
// A finger tap at a computed position first, to prove the coordinates are right.
const modeButton = page.getByTestId('order-manual');
const modePoint = await screenPoint(modeButton);
sh(`adb shell input tap ${modePoint.x} ${modePoint.y}`);
await sleep(1500);
check((await modeButton.getAttribute('aria-pressed')) === 'true', `a finger tap lands where expected (${modePoint.x},${modePoint.y})`);
const handle = (title) => page.getByRole('button', { name: `جابه‌جایی: ${title}` });
const from = await screenPoint(handle('اول'));
const to = await screenPoint(handle('سوم'));
sh(`adb shell input swipe ${from.x} ${from.y} ${to.x} ${to.y - 120} 900`);
await sleep(2000);
shot('7b-manual-order');
const arranged = JSON.stringify(await order());
check(arranged === JSON.stringify(['اول', 'سوم', 'دوم']), `dragging the handle with a finger moves a task to the top (${arranged})`);
// And the arrangement is stored.
await tap(page.getByRole('navigation').getByRole('button', { name: 'داشبورد' }));
await sleep(800);
await tap(page.getByTestId('cat-card-دوکان'));
await page.getByTestId('list-screen').waitFor();
await sleep(800);
check(JSON.stringify(await order()) === JSON.stringify(['اول', 'سوم', 'دوم']), 'the arrangement is kept after leaving the list');
await tap(page.getByRole('navigation').getByRole('button', { name: 'داشبورد' }));
await sleep(800);

// Cancelling the share sheet is reported by Capacitor as an error; that is expected here.
const realErrors = errors.filter((e) => !/Share canceled/i.test(e));
check(realErrors.length === 0, `no JavaScript errors (${realErrors.slice(0, 3).join(' | ')})`);

// Dark mode switched while the app is open.
const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const lightBg = await bg();
sh('adb shell cmd uimode night yes');
await sleep(3000);
const darkBg = await bg();
check(darkBg === 'rgb(14, 18, 16)', `dark mode applies while the app is open (${lightBg} -> ${darkBg})`);
shot('8-dark');
sh('adb shell cmd uimode night no');
await sleep(3000);
check((await bg()) === lightBg, 'light mode comes back when the phone switches back');
await browser.close().catch(() => undefined);

// Dark mode follows the phone.
sh('adb shell cmd uimode night yes');
sh(`adb shell am force-stop ${PKG}`);
sh(`adb shell am start -W -n ${PKG}/.MainActivity`);
await sleep(4000);
({ browser, page } = await connect());
await page.getByTestId('dashboard').waitFor({ timeout: 30000 });
await sleep(2500);
check((await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(14, 18, 16)', 'dark mode applies when the app starts in dark mode');
shot('9-dark-restart');
check((await page.getByTestId('task-row').filter({ hasText: 'آزمایش یادآوری' }).count()) === 1, 'the task survived an app restart');
await browser.close().catch(() => undefined);
sh('adb shell cmd uimode night no');

log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);

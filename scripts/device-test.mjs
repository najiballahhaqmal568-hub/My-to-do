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
  for (let i = 0; i < 20; i++) {
    const webview = await device.webView({ pkg: PKG }, { timeout: 60000 });
    page = await webview.page();
    if (!page.isClosed()) break;
    await sleep(1000);
  }
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

// A task with a reminder three minutes from now.
const when = await page.evaluate(() => {
  const d = new Date(Date.now() + 3 * 60000);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
});
await tap(page.getByTestId('fab'));
await page.locator('#task-title').fill('آزمایش یادآوری');
await page.locator('#task-time').fill(when);
await blur(page);
await tap(page.getByRole('dialog').getByRole('button', { name: 'سر وقت', exact: true }));
await tap(page.getByRole('dialog').getByRole('button', { name: '🏃 ورزش' }));
await sleep(800);
shot('2-editor');
await tap(page.getByRole('button', { name: 'ذخیره' }));
await sleep(4000);
shot('3-dashboard-with-task');

const alarms = sh('adb shell dumpsys alarm');
check(alarms.includes(PKG), 'Android has alarms scheduled for the app');

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
for (let i = 0; i < 60 && !posted; i++) {
  posted = sh('adb shell dumpsys notification --noredact').includes('آزمایش یادآوری');
  if (!posted) await sleep(5000);
}
check(posted, 'the task reminder notification arrives');
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
check((await page.getByTestId('task-row').count()) === 1, 'the task survived an app restart');
await browser.close().catch(() => undefined);
sh('adb shell cmd uimode night no');

log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);

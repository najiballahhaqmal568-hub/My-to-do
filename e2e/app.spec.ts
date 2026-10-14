import { expect, test, type Page } from '@playwright/test';

// Monday 6 Mizan 1405, 09:00 in Kabul.
const NOW = new Date('2026-09-28T09:00:00+04:30');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

async function open(page: Page, hash = '') {
  await page.goto(`/${hash}`);
  await expect(page.getByTestId('dashboard')).toBeVisible();
}

/** Picks a time in the 12-hour picker, given as 24-hour `HH:MM`. */
async function setTime(page: Page, time: string) {
  const [h, m] = time.split(':');
  await page.locator('#task-time-hour').selectOption(h);
  await page.locator('#task-time-minute').selectOption(m);
}

async function addTask(page: Page, title: string, opts: { category?: string; priority?: string; repeat?: string; subtask?: string; time?: string; reminder?: string } = {}) {
  await page.getByTestId('fab').click();
  await page.locator('#task-title').fill(title);
  if (opts.category) await page.getByRole('dialog').getByRole('button', { name: opts.category }).click();
  if (opts.priority) await page.getByRole('dialog').getByRole('button', { name: opts.priority, exact: true }).click();
  if (opts.repeat) await page.getByRole('dialog').getByRole('button', { name: opts.repeat, exact: true }).click();
  if (opts.time) await setTime(page, opts.time);
  if (opts.reminder) await page.getByRole('dialog').getByRole('button', { name: opts.reminder, exact: true }).click();
  if (opts.subtask) await page.getByRole('dialog').getByPlaceholder('زیرکار جدید').fill(opts.subtask);
  await page.getByRole('button', { name: 'ذخیره', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

const row = (page: Page, title: string) => page.getByTestId('task-row').filter({ has: page.getByText(title, { exact: true }) });

test('adds and completes a task, and keeps it after a reload', async ({ page }) => {
  await open(page);
  await addTask(page, 'خرید نان');
  await expect(row(page, 'خرید نان')).toBeVisible();
  await expect(page.getByText('۰ از ۱ انجام شد')).toBeAttached();
  await row(page, 'خرید نان').getByRole('button', { name: /انجام شد/ }).click();
  await expect(page.getByText('۱ از ۱ انجام شد')).toBeAttached();
  await expect(page.getByText('همهٔ کارهای امروز انجام شد. آفرین!')).toBeVisible();
  await page.reload();
  await expect(row(page, 'خرید نان')).toBeVisible();
  await expect(page.getByText('۱ از ۱ انجام شد')).toBeAttached();
});

test('shows today in the Afghan Solar Hijri calendar with Persian digits', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('today-date')).toHaveText('دوشنبه، ۶ میزان');
  await expect(page.getByTestId('tomorrow')).toContainText('سه‌شنبه، ۷ میزان');
});

test('category cards count what is left today', async ({ page }) => {
  await open(page);
  await addTask(page, 'دویدن', { category: '🏃 ورزش' });
  await expect(page.getByTestId('cat-card-ورزش')).toContainText('۱ مانده');
  await row(page, 'دویدن').getByRole('button', { name: /انجام شد/ }).click();
  await expect(page.getByTestId('cat-card-ورزش')).toContainText('تمام شد');
  await page.getByTestId('cat-card-ورزش').click();
  await expect(page.getByTestId('list-screen')).toContainText('ورزش');
});

test('raising the priority moves a task up', async ({ page }) => {
  await open(page);
  await addTask(page, 'اول');
  await addTask(page, 'دوم');
  // The newest task is listed first among tasks that tie.
  await expect(page.getByTestId('task-row').first()).toHaveAttribute('data-title', 'دوم');
  await row(page, 'اول').getByText('اول').click();
  await page.getByRole('dialog').getByRole('button', { name: 'بالا', exact: true }).click();
  await page.getByRole('button', { name: 'ذخیره', exact: true }).click();
  await expect(page.getByTestId('task-row').first()).toHaveAttribute('data-title', 'اول');
});

test('a task just added is listed first, highlighted and scrolled into view', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  // Timed tasks sort before untimed ones, so the new untimed task would sit below a long list.
  for (let h = 5; h <= 14; h++) await addTask(page, `کار ${h}`, { time: `${String(h).padStart(2, '0')}:00` });
  await addTask(page, 'تازه‌ترین');
  const fresh = row(page, 'تازه‌ترین');
  await expect(fresh).toHaveClass(/fresh/);
  await expect(fresh).toBeInViewport();
  // Among untimed tasks it comes before older ones.
  await addTask(page, 'قدیمی‌تر');
  await addTask(page, 'از همه تازه‌تر');
  const untimed = await page.getByTestId('task-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-title')).filter((t) => !t?.startsWith('کار ')));
  expect(untimed).toEqual(['از همه تازه‌تر', 'قدیمی‌تر', 'تازه‌ترین']);
  await expect(row(page, 'از همه تازه‌تر')).toBeInViewport();
});

test('undo brings back a deleted task', async ({ page }) => {
  await open(page);
  await addTask(page, 'پاک‌شدنی');
  await row(page, 'پاک‌شدنی').getByText('پاک‌شدنی').click();
  await page.getByRole('dialog').getByRole('button', { name: 'حذف' }).click();
  await expect(row(page, 'پاک‌شدنی')).toHaveCount(0);
  await page.getByRole('status').getByRole('button', { name: 'برگرداندن' }).click();
  await expect(row(page, 'پاک‌شدنی')).toBeVisible();
});

test('a daily task shows up tomorrow and across the Upcoming week', async ({ page }) => {
  await open(page);
  await addTask(page, 'مرور لغت', { repeat: 'روزانه' });
  await expect(page.getByTestId('tomorrow')).toContainText('مرور لغت');
  await row(page, 'مرور لغت').getByRole('button', { name: /انجام شد/ }).click();
  await expect(page.getByTestId('tomorrow')).toContainText('مرور لغت');
  await page.getByRole('navigation').getByRole('button', { name: 'آینده' }).click();
  await expect(page.getByTestId('day-group')).toHaveCount(7);
  for (const g of await page.getByTestId('day-group').all()) await expect(g).toContainText('مرور لغت');
});

test('search finds a task by a word in its subtask', async ({ page }) => {
  await open(page);
  await addTask(page, 'سفر', { subtask: 'کیف را ببند' });
  await page.getByRole('button', { name: 'جست‌وجو' }).click();
  await page.getByRole('searchbox').fill('كيف');
  await expect(row(page, 'سفر')).toBeVisible();
});

test('switches to English and back', async ({ page }) => {
  await open(page);
  await page.getByRole('navigation').getByRole('button', { name: 'تنظیمات' }).click();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Settings' })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Dashboard' }).click();
  await expect(page.getByTestId('today-date')).toHaveText('Monday, September 28');
  await page.getByRole('navigation').getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'دری / فارسی' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('a reminder and the bedtime summary are planned', async ({ page }) => {
  await open(page);
  await page.getByTestId('fab').click();
  await page.locator('#task-title').fill('کلاس');
  await page.getByTestId('date-field').click();
  await page.getByRole('dialog').getByRole('button', { name: 'فردا', exact: true }).click();
  await setTime(page, '16:00');
  await page.getByRole('dialog').getByRole('button', { name: '۱۵ دقیقه قبل' }).click();
  await page.getByRole('button', { name: 'ذخیره', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __notificationPlan?: { link: string; title: string; at: string }[] }).__notificationPlan ?? []))
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ link: 'tomorrow', title: 'فردا ۱ کار دارید', at: new Date('2026-09-28T22:00:00+04:30').toISOString() }),
        expect.objectContaining({ title: 'کلاس', at: new Date('2026-09-29T15:45:00+04:30').toISOString() }),
      ]),
    );
});

test('the bedtime deep link opens the tomorrow section', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 600 });
  await open(page, '#tomorrow');
  await expect(page.getByTestId('tomorrow')).toBeInViewport();
});

test('exports a backup and imports it again', async ({ page }) => {
  await open(page);
  await addTask(page, 'نگه‌دار');
  await page.getByRole('navigation').getByRole('button', { name: 'تنظیمات' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'خروجی گرفتن' }).click();
  const file = await (await downloadPromise).path();
  await page.getByRole('navigation').getByRole('button', { name: 'داشبورد' }).click();
  await addTask(page, 'اضافی');
  await page.getByRole('navigation').getByRole('button', { name: 'تنظیمات' }).click();
  await page.getByTestId('import-input').setInputFiles(file);
  await page.getByRole('alertdialog').getByRole('button', { name: 'جایگزین کن' }).click();
  await expect(page.getByText('پشتیبان وارد شد.')).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'داشبورد' }).click();
  await expect(row(page, 'نگه‌دار')).toBeVisible();
  await expect(row(page, 'اضافی')).toHaveCount(0);
});

test('works with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await addTask(page, 'بی‌حرکت');
  await row(page, 'بی‌حرکت').getByRole('button', { name: /انجام شد/ }).click();
  await expect(page.getByText('۱ از ۱ انجام شد')).toBeAttached();
});

test('tasks added in a category show on the dashboard', async ({ page }) => {
  await open(page);
  await page.getByTestId('cat-card-دوکان').click();
  await addTask(page, 'سفارش جنس');
  await page.getByRole('navigation').getByRole('button', { name: 'داشبورد' }).click();
  await expect(row(page, 'سفارش جنس')).toBeVisible();
  await expect(page.getByTestId('cat-card-دوکان')).toContainText('۱ مانده');
});

test('tasks without a date appear in their own dashboard section', async ({ page }) => {
  await open(page);
  await page.getByTestId('fab').click();
  await page.locator('#task-title').fill('بی‌تاریخ');
  await page.getByTestId('date-field').click();
  await page.getByRole('dialog').getByRole('button', { name: 'بدون تاریخ', exact: true }).click();
  await page.getByRole('button', { name: 'ذخیره', exact: true }).click();
  await expect(page.getByTestId('undated')).toContainText('بی‌تاریخ');
});

test('shows times on the 12-hour clock in Dari and lets the user pick them that way', async ({ page }) => {
  await open(page);
  await addTask(page, 'صبحانه', { time: '06:30' });
  await addTask(page, 'ناهار', { time: '12:00' });
  await addTask(page, 'بازار', { time: '16:45' });
  await addTask(page, 'حساب', { time: '20:30' });
  await expect(row(page, 'صبحانه')).toContainText('۶:۳۰ صبح');
  await expect(row(page, 'ناهار')).toContainText('۱۲:۰۰ ظهر');
  await expect(row(page, 'بازار')).toContainText('۴:۴۵ بعدازظهر');
  await expect(row(page, 'حساب')).toContainText('۸:۳۰ شب');
  await row(page, 'حساب').getByText('حساب').click();
  await expect(page.locator('#task-time-hour')).toHaveValue('20');
  await expect(page.locator('#task-time-hour').locator('option:checked')).toHaveText('۸ شب');
  await page.getByRole('dialog').getByRole('button', { name: 'ذخیره', exact: true }).click();
});

test('the bedtime time is chosen on the 12-hour clock too', async ({ page }) => {
  await open(page);
  await page.getByRole('navigation').getByRole('button', { name: 'تنظیمات' }).click();
  await page.locator('#bedtime-time-hour').selectOption('21');
  await page.locator('#bedtime-time-minute').selectOption('30');
  await page.getByRole('navigation').getByRole('button', { name: 'داشبورد' }).click();
  await expect(page.getByText('اعلان فردا ۹:۳۰ شب')).toBeVisible();
});

test('save and add another keeps the category and date and clears the rest', async ({ page }) => {
  await open(page);
  await page.getByTestId('cat-card-دوکان').click();
  await page.getByTestId('fab').click();
  await page.locator('#task-title').fill('جنس اول');
  await page.getByRole('dialog').getByRole('button', { name: 'بالا', exact: true }).click();
  await page.getByTestId('save-and-add').click();
  await expect(page.getByTestId('added-note')).toContainText('۱ کار اضافه شد');
  await expect(page.locator('#task-title')).toHaveValue('');
  await expect(page.locator('#task-title')).toBeFocused();
  await expect(page.getByRole('dialog').getByRole('button', { name: '🏪 دوکان' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'بدون', exact: true }).first()).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#task-title').fill('جنس دوم');
  await page.getByTestId('save-and-add').click();
  await expect(page.getByTestId('added-note')).toContainText('۲ کار اضافه شد');
  await page.locator('#task-title').fill('جنس سوم');
  await page.getByRole('dialog').getByRole('button', { name: 'ذخیره', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(row(page, 'جنس اول')).toBeVisible();
  await expect(row(page, 'جنس دوم')).toBeVisible();
  await expect(row(page, 'جنس سوم')).toBeVisible();
  // The high-priority task stays first; among the others the newest comes first.
  const order = await page.getByTestId('task-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-title')));
  expect(order).toEqual(['جنس اول', 'جنس سوم', 'جنس دوم']);
});

test('the update message links straight to the APK', async ({ page }) => {
  await page.route('https://api.github.com/**', (route) =>
    route.fulfill({
      json: {
        tag_name: 'v9.9.9',
        html_url: 'https://github.com/example/releases/tag/v9.9.9',
        assets: [{ name: 'my-to-do-9.9.9.apk', browser_download_url: 'https://github.com/example/releases/download/v9.9.9/my-to-do-9.9.9.apk' }],
      },
    }),
  );
  await open(page);
  await page.getByRole('navigation').getByRole('button', { name: 'تنظیمات' }).click();
  await page.getByRole('button', { name: 'بررسی نسخهٔ جدید' }).click();
  await expect(page.getByRole('link', { name: 'دانلود' })).toHaveAttribute('href', 'https://github.com/example/releases/download/v9.9.9/my-to-do-9.9.9.apk');
});

test('a backup is saved automatically once a day and on demand', async ({ page }) => {
  await open(page);
  await addTask(page, 'نگه‌داشتنی');
  await page.getByRole('navigation').getByRole('button', { name: 'تنظیمات' }).click();
  const backups = () => page.evaluate(() => (window as unknown as { __autoBackups?: { name: string; text: string }[] }).__autoBackups ?? []);
  await expect.poll(async () => (await backups()).length).toBeGreaterThanOrEqual(1);
  const first = (await backups())[0];
  expect(first.name).toBe('my-to-do-2026-09-28.json');
  expect(JSON.parse(first.text)).toMatchObject({ app: 'my-to-do' });
  await expect(page.getByTestId('last-backup')).toHaveText('دوشنبه، ۶ میزان');
  const before = (await backups()).length;
  await page.getByRole('button', { name: 'همین حالا پشتیبان بگیر' }).click();
  await expect(page.getByText('پشتیبان در پوشهٔ Download/My-To-Do ذخیره شد.')).toBeVisible();
  expect((await backups()).length).toBe(before + 1);
  // Turning the daily backup off stops it.
  await page.getByRole('switch', { name: 'پشتیبان خودکار روزانه' }).click();
  await expect(page.getByRole('switch', { name: 'پشتیبان خودکار روزانه' })).toHaveAttribute('aria-checked', 'false');
});

test('the done and later buttons on a reminder work', async ({ page }) => {
  await open(page);
  await addTask(page, 'قرص', { time: '18:00', reminder: 'سر وقت' });
  await addTask(page, 'تلفون', { time: '19:00', reminder: 'سر وقت' });
  const plan = () => page.evaluate(() => (window as unknown as { __notificationPlan?: { link: string; at: string; actions?: boolean }[] }).__notificationPlan ?? []);
  const idOf = async (title: string) => (await row(page, title).getAttribute('data-task-id'))!;
  await expect.poll(async () => (await plan()).filter((p) => p.actions).length).toBe(2);
  const pill = await idOf('قرص');
  const call = await idOf('تلفون');

  await page.evaluate((id) => (window as unknown as { __notificationAction: (l: string, a: string) => void }).__notificationAction(`task:${id}`, 'done'), pill);
  await expect(row(page, 'قرص')).toHaveClass(/swipe/);
  await expect(page.getByText('۱ از ۲ انجام شد')).toBeAttached();

  await page.evaluate((id) => (window as unknown as { __notificationAction: (l: string, a: string) => void }).__notificationAction(`task:${id}`, 'later'), call);
  await expect(row(page, 'تلفون')).toBeVisible();
  await expect
    .poll(async () => (await plan()).filter((p) => p.link === `task:${call}`).map((p) => p.at))
    .toContain(new Date('2026-09-28T09:15:00+04:30').toISOString());
});

test('the home screen widget snapshot follows the tasks', async ({ page }) => {
  await open(page);
  type Snap = { title: string; summary: string; items: { title: string; time: string; overdue: boolean }[]; tomorrow: string };
  const snap = () => page.evaluate(() => (window as unknown as { __widgetSnapshot?: Snap }).__widgetSnapshot);
  await expect.poll(async () => (await snap())?.title).toBe('دوشنبه، ۶ میزان');
  await addTask(page, 'سفارش', { time: '10:00', category: '🏪 دوکان' });
  await addTask(page, 'دویدن', { category: '🏃 ورزش' });
  await expect.poll(async () => (await snap())?.items.map((i) => i.title)).toEqual(['سفارش', 'دویدن']);
  expect((await snap())!.items[0].time).toBe('۱۰:۰۰ صبح');
  await row(page, 'سفارش').getByRole('button', { name: /انجام شد/ }).click();
  await expect.poll(async () => (await snap())?.summary).toBe('۱ از ۲ انجام شد');
  await expect.poll(async () => (await snap())?.items.map((i) => i.title)).toEqual(['دویدن']);
});

test('the weekly stats count completed tasks and the days in a row', async ({ page }) => {
  await open(page);
  await addTask(page, 'دویدن', { category: '🏃 ورزش' });
  await addTask(page, 'تمرین', { category: '🏃 ورزش' });
  await addTask(page, 'کتاب', { category: '📚 مطالعه' });
  for (const title of ['دویدن', 'تمرین', 'کتاب']) await row(page, title).getByRole('button', { name: /انجام شد/ }).click();
  // Clearing the completed tasks must not erase the history.
  await page.getByTestId('open-stats').click();
  await expect(page.getByTestId('stats')).toBeVisible();
  await expect(page.getByTestId('stat-all').getByTestId('week-total')).toHaveText('این هفته: ۳ کار');
  await expect(page.getByTestId('stat-sport').getByTestId('week-total')).toHaveText('این هفته: ۲ کار');
  await expect(page.getByTestId('stat-study').getByTestId('week-total')).toHaveText('این هفته: ۱ کار');
  await expect(page.getByTestId('stat-sport').getByTestId('streak')).toContainText('۱ روز پیاپی');
  await expect(page.getByTestId('stat-shop').getByTestId('streak')).toContainText('امروز شروع کنید');
  // Monday is the third day of a week that starts on Saturday.
  await expect(page.getByTestId('stat-sport').locator('.bar-col').nth(2)).toHaveAttribute('data-count', '2');
  await expect(page.getByTestId('stat-sport').locator('.bar-col').nth(3)).toHaveClass(/future/);
});

test('a list can be arranged by hand with the arrow keys and by dragging', async ({ page }) => {
  await open(page);
  await page.getByTestId('cat-card-دوکان').click();
  for (const title of ['اول', 'دوم', 'سوم']) await addTask(page, title);
  const titles = () => page.getByTestId('task-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-title')));
  expect(await titles()).toEqual(['سوم', 'دوم', 'اول']);

  await page.getByTestId('order-manual').click();
  await expect(page.getByTestId('manual-list')).toBeVisible();
  expect(await titles()).toEqual(['سوم', 'دوم', 'اول']);

  // Keyboard: move «اول» up by one.
  const handle = (title: string) => page.getByRole('button', { name: `جابه‌جایی: ${title}` });
  await handle('اول').focus();
  await page.keyboard.press('ArrowUp');
  await expect.poll(titles).toEqual(['سوم', 'اول', 'دوم']);

  // Dragging: take «دوم» to the top.
  const box = (await handle('دوم').boundingBox())!;
  const top = (await handle('سوم').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i++) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - ((box.y - top.y + 30) * i) / steps);
  await page.mouse.up();
  await expect.poll(titles).toEqual(['دوم', 'سوم', 'اول']);

  // The arrangement is kept, and a new task goes on top of it.
  await page.getByRole('navigation').getByRole('button', { name: 'داشبورد' }).click();
  await page.getByTestId('cat-card-دوکان').click();
  await expect(page.getByTestId('manual-list')).toBeVisible();
  await expect.poll(titles).toEqual(['دوم', 'سوم', 'اول']);
  await addTask(page, 'چهارم');
  await expect.poll(titles).toEqual(['چهارم', 'دوم', 'سوم', 'اول']);

  // Back to automatic order: the newest first again.
  await page.getByTestId('order-time').click();
  await expect.poll(titles).toEqual(['چهارم', 'سوم', 'دوم', 'اول']);
});

test('lists and the dashboard can be sorted by newest, priority or name', async ({ page }) => {
  await open(page);
  await page.getByTestId('cat-card-دوکان').click();
  await addTask(page, 'ب نان');
  await addTask(page, 'الف شیر');
  await addTask(page, 'ج چای', { priority: 'بالا' });
  const titles = (scope: string) => page.getByTestId(scope).getByTestId('task-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-title')));
  await expect(page.getByTestId('order-time')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('order-title').click();
  await expect.poll(() => titles('list-screen')).toEqual(['الف شیر', 'ب نان', 'ج چای']);
  await expect(page.getByTestId('order-title')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('order-newest').click();
  await expect.poll(() => titles('list-screen')).toEqual(['ج چای', 'الف شیر', 'ب نان']);
  // «ج چای» is important, so priority order puts it first.
  await page.getByTestId('order-priority').click();
  await expect.poll(() => titles('list-screen')).toEqual(['ج چای', 'الف شیر', 'ب نان']);

  // The choice is remembered for this list after leaving it.
  await page.getByRole('navigation').getByRole('button', { name: 'داشبورد' }).click();
  await page.getByTestId('cat-card-دوکان').click();
  await expect(page.getByTestId('order-priority')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => titles('list-screen')).toEqual(['ج چای', 'الف شیر', 'ب نان']);

  // The dashboard has its own choice, without manual order since it mixes categories.
  await page.getByRole('navigation').getByRole('button', { name: 'داشبورد' }).click();
  await expect(page.getByTestId('dashboard').getByTestId('order-manual')).toHaveCount(0);
  await page.getByTestId('dashboard').getByTestId('order-title').click();
  await expect.poll(() => titles('dashboard')).toEqual(['الف شیر', 'ب نان', 'ج چای']);
});

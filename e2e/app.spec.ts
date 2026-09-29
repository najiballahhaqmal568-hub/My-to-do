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

async function addTask(page: Page, title: string, opts: { category?: string; priority?: string; repeat?: string; subtask?: string; time?: string; reminder?: string } = {}) {
  await page.getByTestId('fab').click();
  await page.locator('#task-title').fill(title);
  if (opts.category) await page.getByRole('dialog').getByRole('button', { name: opts.category }).click();
  if (opts.priority) await page.getByRole('dialog').getByRole('button', { name: opts.priority, exact: true }).click();
  if (opts.repeat) await page.getByRole('dialog').getByRole('button', { name: opts.repeat, exact: true }).click();
  if (opts.time) await page.locator('#task-time').fill(opts.time);
  if (opts.reminder) await page.getByRole('dialog').getByRole('button', { name: opts.reminder, exact: true }).click();
  if (opts.subtask) await page.getByRole('dialog').getByPlaceholder('زیرکار جدید').fill(opts.subtask);
  await page.getByRole('button', { name: 'ذخیره' }).click();
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
  await expect(page.getByTestId('task-row').first()).toHaveAttribute('data-title', 'اول');
  await row(page, 'دوم').getByText('دوم').click();
  await page.getByRole('dialog').getByRole('button', { name: 'بالا', exact: true }).click();
  await page.getByRole('button', { name: 'ذخیره' }).click();
  await expect(page.getByTestId('task-row').first()).toHaveAttribute('data-title', 'دوم');
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
  await page.locator('#task-time').fill('16:00');
  await page.getByRole('dialog').getByRole('button', { name: '۱۵ دقیقه قبل' }).click();
  await page.getByRole('button', { name: 'ذخیره' }).click();
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
  await page.getByRole('button', { name: 'ذخیره' }).click();
  await expect(page.getByTestId('undated')).toContainText('بی‌تاریخ');
});

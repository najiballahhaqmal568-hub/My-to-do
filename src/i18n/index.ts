import { toSolar, weekday, parseISO, type ISODate, type Time } from '../core/dates';
import type { Language, Priority, RepeatRule } from '../core/types';

export const AFGHAN_MONTHS = ['حمل', 'ثور', 'جوزا', 'سرطان', 'اسد', 'سنبله', 'میزان', 'عقرب', 'قوس', 'جدی', 'دلو', 'حوت'];
const FA_WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
const EN_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function digits(lang: Language, value: string | number): string {
  const s = String(value);
  return lang === 'fa' ? s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]) : s;
}

export function formatTime(lang: Language, time: Time): string {
  return digits(lang, time.replace(/^0(\d)/, '$1'));
}

export function weekdayName(lang: Language, iso: ISODate): string {
  return (lang === 'fa' ? FA_WEEKDAYS : EN_WEEKDAYS)[weekday(iso)];
}

/** «دوشنبه، ۶ میزان» / "Monday, September 28". */
export function formatDay(lang: Language, iso: ISODate): string {
  return lang === 'fa' ? `${weekdayName(lang, iso)}، ${formatDayShort(lang, iso)}` : `${weekdayName(lang, iso)}, ${formatDayShort(lang, iso)}`;
}

/** «۶ میزان» / "September 28". */
export function formatDayShort(lang: Language, iso: ISODate): string {
  if (lang === 'fa') {
    const s = toSolar(iso);
    return `${digits(lang, s.d)} ${AFGHAN_MONTHS[s.m - 1]}`;
  }
  const { m, d } = parseISO(iso);
  return `${EN_MONTHS[m - 1]} ${d}`;
}

export function formatYear(lang: Language, iso: ISODate): string {
  return lang === 'fa' ? digits(lang, toSolar(iso).y) : String(parseISO(iso).y);
}

export function monthTitle(lang: Language, y: number, m: number): string {
  return lang === 'fa' ? `${AFGHAN_MONTHS[m - 1]} ${digits(lang, y)}` : `${EN_MONTHS[m - 1]} ${y}`;
}

/** Weekday initials starting on Saturday. */
export function weekHeader(lang: Language): string[] {
  return lang === 'fa' ? ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] : ['Sa', 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr'];
}

export function shortWeekday(lang: Language, day: number): string {
  return lang === 'fa' ? FA_WEEKDAYS[day] : EN_WEEKDAYS[day].slice(0, 3);
}

/** Folds Arabic letter variants and case so Persian search matches either spelling. */
export function normalizeText(s: string): string {
  return s.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, ' ').toLocaleLowerCase();
}

const fa = {
  appName: 'کارهای من',
  greetingMorning: 'صبح بخیر',
  greetingDay: 'روز بخیر',
  greetingEvening: 'شب بخیر',
  today: 'امروز',
  tomorrow: 'فردا',
  noDate: 'بدون تاریخ',
  dashboard: 'داشبورد',
  upcoming: 'آینده',
  categories: 'کتگوری‌ها',
  settings: 'تنظیمات',
  search: 'جست‌وجو',
  inbox: 'صندوق ورودی',
  newTask: 'کار جدید',
  editTask: 'ویرایش کار',
  todaysTasks: 'کارهای امروز',
  overdue: 'عقب‌مانده',
  completed: 'انجام‌شده',
  clearCompleted: 'پاک کردن انجام‌شده‌ها',
  important: 'مهم',
  dueYesterday: 'سررسید گذشته',
  allDone: 'همهٔ کارهای امروز انجام شد. آفرین!',
  allDoneShort: 'همه انجام شد',
  nothingToday: 'امروز کاری ندارید. با دکمهٔ + کار اضافه کنید.',
  nothingHere: 'اینجا کاری نیست.',
  nothingThatDay: 'کاری برای این روز نیست',
  tomorrowEmpty: 'فردا هنوز کاری ندارید.',
  done: 'انجام شد',
  deleted: 'حذف شد',
  undo: 'برگرداندن',
  save: 'ذخیره',
  cancel: 'لغو',
  delete: 'حذف',
  close: 'بستن',
  add: 'اضافه',
  title: 'عنوان',
  titlePlaceholder: 'چه کاری باید انجام شود؟',
  notes: 'یادداشت',
  notesPlaceholder: 'جزئیات بیشتر…',
  date: 'تاریخ',
  time: 'ساعت',
  noTime: 'بدون ساعت',
  category: 'کتگوری',
  priority: 'اولویت',
  repeat: 'تکرار',
  reminder: 'یادآوری',
  subtasks: 'زیرکارها',
  addSubtask: 'زیرکار جدید',
  skipOccurrence: 'رد کردن این نوبت',
  skipped: 'این نوبت رد شد',
  repeatNeedsDate: 'برای تکرار، تاریخ لازم است.',
  titleRequired: 'عنوان را بنویسید.',
  pickDays: 'روزها را انتخاب کنید.',
  everyNDays: 'هر چند روز',
  priorityNone: 'بدون',
  priorityLow: 'پایین',
  priorityMedium: 'متوسط',
  priorityHigh: 'بالا',
  repeatNone: 'بدون تکرار',
  repeatDaily: 'روزانه',
  repeatWeekly: 'هفتگی',
  repeatMonthly: 'ماهانه',
  repeatYearly: 'سالانه',
  repeatWeekdays: 'روزهای مشخص',
  repeatEveryN: 'هر n روز',
  reminderNone: 'بدون یادآوری',
  reminderAtTime: 'سر وقت',
  reminder15m: '۱۵ دقیقه قبل',
  reminder1h: '۱ ساعت قبل',
  reminder1d: '۱ روز قبل',
  reminderNeedsTime: 'برای یادآوری، ساعت لازم است.',
  newCategory: 'کتگوری جدید',
  editCategory: 'ویرایش کتگوری',
  categoryName: 'نام کتگوری',
  emoji: 'ایموجی',
  color: 'رنگ',
  deleteCategoryTitle: 'حذف کتگوری',
  deleteCategoryBody: 'با کارهای این کتگوری چه شود؟',
  moveToInbox: 'انتقال به صندوق ورودی',
  deleteAll: 'حذف همه',
  searchPlaceholder: 'جست‌وجو در کارها…',
  filterAll: 'همه',
  filterOpen: 'انجام‌نشده',
  filterDone: 'انجام‌شده',
  filterOverdue: 'عقب‌مانده',
  noResults: 'چیزی پیدا نشد.',
  language: 'زبان',
  languageFa: 'دری / فارسی',
  languageEn: 'English',
  bedtime: 'اعلان شب',
  bedtimeHint: 'هر شب فهرست کارهای فردا را می‌فرستد.',
  bedtimeTime: 'ساعت اعلان',
  notifications: 'اعلان‌ها',
  exactAlarmOff: 'اجازهٔ «هشدار دقیق» داده نشده؛ اعلان‌ها ممکن است چند دقیقه دیرتر برسند.',
  openAlarmSettings: 'دادن اجازه',
  backup: 'پشتیبان',
  exportBackup: 'خروجی گرفتن',
  importBackup: 'وارد کردن پشتیبان',
  importTitle: 'وارد کردن پشتیبان',
  importBody: 'همهٔ داده‌های فعلی با فایل پشتیبان جایگزین می‌شوند. قبل از آن، یک پشتیبان از داده‌های فعلی ذخیره می‌شود.',
  importConfirm: 'جایگزین کن',
  importDone: 'پشتیبان وارد شد.',
  importInvalid: 'این فایل پشتیبان معتبر نیست.',
  importNewer: 'این پشتیبان از نسخهٔ جدیدتر اپ است. اول اپ را به‌روز کنید.',
  exportDone: 'پشتیبان ذخیره شد.',
  about: 'دربارهٔ اپ',
  version: 'نسخه',
  updateAvailable: 'نسخهٔ جدید آماده است',
  download: 'دانلود',
  upToDate: 'اپ به‌روز است.',
  checkUpdate: 'بررسی نسخهٔ جدید',
  reminderTitle: 'یادآوری',
  tasksLeft: (n: number) => `${digits('fa', n)} کار مانده`,
  leftCount: (n: number) => (n ? `${digits('fa', n)} مانده` : 'تمام شد'),
  taskCount: (n: number) => `${digits('fa', n)} کار`,
  progress: (done: number, total: number) => `${digits('fa', done)} از ${digits('fa', total)} انجام شد`,
  ofTotal: (total: number) => `از ${digits('fa', total)}`,
  subtaskProgress: (done: number, total: number) => `${digits('fa', done)} از ${digits('fa', total)}`,
  overdueCount: (n: number) => `${digits('fa', n)} عقب‌مانده`,
  bedtimeChip: (t: string) => `اعلان فردا ${t}`,
  everyN: (n: number) => `هر ${digits('fa', n)} روز`,
  bedtimeNotifTitle: (n: number) => `فردا ${digits('fa', n)} کار دارید`,
  bedtimeNotifLeft: (n: number) => `${digits('fa', n)} کار امروز مانده`,
  moreTasks: (n: number) => `+${digits('fa', n)} کار دیگر`,
  dueAt: (day: string, time: string) => `${day}، ساعت ${time}`,
};

export type Messages = typeof fa;

const en: Messages = {
  appName: 'My To-Do',
  greetingMorning: 'Good morning',
  greetingDay: 'Good afternoon',
  greetingEvening: 'Good evening',
  today: 'Today',
  tomorrow: 'Tomorrow',
  noDate: 'No date',
  dashboard: 'Dashboard',
  upcoming: 'Upcoming',
  categories: 'Categories',
  settings: 'Settings',
  search: 'Search',
  inbox: 'Inbox',
  newTask: 'New task',
  editTask: 'Edit task',
  todaysTasks: "Today's tasks",
  overdue: 'Overdue',
  completed: 'Completed',
  clearCompleted: 'Clear completed',
  important: 'Important',
  dueYesterday: 'Overdue',
  allDone: 'Every task for today is done. Well done!',
  allDoneShort: 'All done',
  nothingToday: 'Nothing for today. Add a task with the + button.',
  nothingHere: 'Nothing here.',
  nothingThatDay: 'Nothing on this day',
  tomorrowEmpty: 'Nothing planned for tomorrow yet.',
  done: 'Done',
  deleted: 'Deleted',
  undo: 'Undo',
  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
  close: 'Close',
  add: 'Add',
  title: 'Title',
  titlePlaceholder: 'What needs doing?',
  notes: 'Notes',
  notesPlaceholder: 'More details…',
  date: 'Date',
  time: 'Time',
  noTime: 'No time',
  category: 'Category',
  priority: 'Priority',
  repeat: 'Repeat',
  reminder: 'Reminder',
  subtasks: 'Subtasks',
  addSubtask: 'New subtask',
  skipOccurrence: 'Skip this one',
  skipped: 'Skipped this occurrence',
  repeatNeedsDate: 'A repeating task needs a date.',
  titleRequired: 'Write a title.',
  pickDays: 'Pick at least one day.',
  everyNDays: 'Every how many days',
  priorityNone: 'None',
  priorityLow: 'Low',
  priorityMedium: 'Medium',
  priorityHigh: 'High',
  repeatNone: "Doesn't repeat",
  repeatDaily: 'Daily',
  repeatWeekly: 'Weekly',
  repeatMonthly: 'Monthly',
  repeatYearly: 'Yearly',
  repeatWeekdays: 'Specific days',
  repeatEveryN: 'Every n days',
  reminderNone: 'No reminder',
  reminderAtTime: 'At the time',
  reminder15m: '15 minutes before',
  reminder1h: '1 hour before',
  reminder1d: '1 day before',
  reminderNeedsTime: 'A reminder needs a time.',
  newCategory: 'New category',
  editCategory: 'Edit category',
  categoryName: 'Category name',
  emoji: 'Emoji',
  color: 'Colour',
  deleteCategoryTitle: 'Delete category',
  deleteCategoryBody: 'What should happen to its tasks?',
  moveToInbox: 'Move to Inbox',
  deleteAll: 'Delete them',
  searchPlaceholder: 'Search tasks…',
  filterAll: 'All',
  filterOpen: 'Open',
  filterDone: 'Done',
  filterOverdue: 'Overdue',
  noResults: 'Nothing found.',
  language: 'Language',
  languageFa: 'دری / فارسی',
  languageEn: 'English',
  bedtime: 'Bedtime summary',
  bedtimeHint: "Sends tomorrow's tasks every evening.",
  bedtimeTime: 'Time',
  notifications: 'Notifications',
  exactAlarmOff: 'Exact alarms are not allowed, so notifications may arrive a few minutes late.',
  openAlarmSettings: 'Allow',
  backup: 'Backup',
  exportBackup: 'Export',
  importBackup: 'Import backup',
  importTitle: 'Import backup',
  importBody: 'All current data will be replaced by the backup. A backup of the current data is saved first.',
  importConfirm: 'Replace',
  importDone: 'Backup imported.',
  importInvalid: 'This is not a valid backup file.',
  importNewer: 'This backup comes from a newer version of the app. Update the app first.',
  exportDone: 'Backup saved.',
  about: 'About',
  version: 'Version',
  updateAvailable: 'A new version is available',
  download: 'Download',
  upToDate: 'The app is up to date.',
  checkUpdate: 'Check for updates',
  reminderTitle: 'Reminder',
  tasksLeft: (n) => `${n} ${n === 1 ? 'task' : 'tasks'} left`,
  leftCount: (n) => (n ? `${n} left` : 'All done'),
  taskCount: (n) => `${n} ${n === 1 ? 'task' : 'tasks'}`,
  progress: (done, total) => `${done} of ${total} done`,
  ofTotal: (total) => `of ${total}`,
  subtaskProgress: (done, total) => `${done}/${total}`,
  overdueCount: (n) => `${n} overdue`,
  bedtimeChip: (t) => `Tomorrow's summary ${t}`,
  everyN: (n) => `Every ${n} days`,
  bedtimeNotifTitle: (n) => `You have ${n} ${n === 1 ? 'task' : 'tasks'} tomorrow`,
  bedtimeNotifLeft: (n) => `${n} left from today`,
  moreTasks: (n) => `+${n} more`,
  dueAt: (day, time) => `${day}, ${time}`,
};

export const MESSAGES: Record<Language, Messages> = { fa, en };

export function priorityLabel(t: Messages, p: Priority): string {
  return { none: t.priorityNone, low: t.priorityLow, medium: t.priorityMedium, high: t.priorityHigh }[p];
}

/** Days ordered from Saturday, the first day of the week. */
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];

export function repeatLabel(lang: Language, r: RepeatRule): string {
  const t = MESSAGES[lang];
  switch (r.kind) {
    case 'daily':
      return t.repeatDaily;
    case 'weekly':
      return t.repeatWeekly;
    case 'monthly':
      return t.repeatMonthly;
    case 'yearly':
      return t.repeatYearly;
    case 'weekdays':
      return WEEK_ORDER.filter((d) => r.days.includes(d))
        .map((d) => shortWeekday(lang, d))
        .join(lang === 'fa' ? '، ' : ', ');
    case 'everyN':
      return t.everyN(r.n);
  }
}

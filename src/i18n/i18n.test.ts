import { describe, expect, it } from 'vitest';
import { MESSAGES, digits, formatDay, formatDayShort, formatTime, hourLabel, repeatLabel } from '.';

describe('Persian dates', () => {
  it('uses Afghan month names and Persian digits', () => {
    expect(formatDay('fa', '2026-09-28')).toBe('دوشنبه، ۶ میزان');
    expect(formatDayShort('fa', '2026-09-22')).toBe('۳۱ سنبله');
    expect(formatDayShort('fa', '2026-09-23')).toBe('۱ میزان');
    expect(formatDayShort('fa', '2027-03-20')).toBe('۲۹ حوت');
    expect(formatDayShort('fa', '2027-03-21')).toBe('۱ حمل');
  });

  it('formats English dates in Gregorian', () => {
    expect(formatDay('en', '2026-09-28')).toBe('Monday, September 28');
  });

  it('shows times on the 12-hour clock with the Dari part of the day', () => {
    expect(formatTime('fa', '06:30')).toBe('۶:۳۰ صبح');
    expect(formatTime('fa', '12:00')).toBe('۱۲:۰۰ ظهر');
    expect(formatTime('fa', '13:15')).toBe('۱:۱۵ بعدازظهر');
    expect(formatTime('fa', '17:45')).toBe('۵:۴۵ شام');
    expect(formatTime('fa', '20:30')).toBe('۸:۳۰ شب');
    expect(formatTime('fa', '23:59')).toBe('۱۱:۵۹ شب');
    expect(formatTime('fa', '00:05')).toBe('۱۲:۰۵ شب');
    expect(digits('fa', 1405)).toBe('۱۴۰۵');
  });

  it('shows English times with AM and PM', () => {
    expect(formatTime('en', '20:05')).toBe('8:05 PM');
    expect(formatTime('en', '00:30')).toBe('12:30 AM');
    expect(formatTime('en', '12:00')).toBe('12:00 PM');
  });

  it('labels whole hours for the picker', () => {
    expect(hourLabel('fa', 4)).toBe('۴ صبح');
    expect(hourLabel('fa', 0)).toBe('۱۲ شب');
    expect(hourLabel('en', 15)).toBe('3 PM');
  });

  it('names weekday repeats starting from Saturday', () => {
    expect(repeatLabel('fa', { kind: 'weekdays', days: [2, 6] })).toBe('شنبه، سه‌شنبه');
    expect(repeatLabel('en', { kind: 'everyN', n: 3 })).toBe('Every 3 days');
  });
});

describe('translations', () => {
  it('has the same keys in fa and en', () => {
    expect(Object.keys(MESSAGES.en).sort()).toEqual(Object.keys(MESSAGES.fa).sort());
    for (const [k, v] of Object.entries(MESSAGES.en)) expect(typeof v, k).toBe(typeof MESSAGES.fa[k as keyof typeof MESSAGES.fa]);
  });
});

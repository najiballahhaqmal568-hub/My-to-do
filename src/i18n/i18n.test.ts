import { describe, expect, it } from 'vitest';
import { MESSAGES, digits, formatDay, formatDayShort, formatTime, repeatLabel } from '.';

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

  it('formats times without a leading zero', () => {
    expect(formatTime('fa', '06:30')).toBe('۶:۳۰');
    expect(formatTime('en', '20:05')).toBe('20:05');
    expect(digits('fa', 1405)).toBe('۱۴۰۵');
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

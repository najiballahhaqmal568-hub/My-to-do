import { jalaaliMonthLength, toGregorian, toJalaali } from 'jalaali-js';

/** A calendar-neutral local date, `YYYY-MM-DD`. */
export type ISODate = string;
/** A local time of day, `HH:MM` (24h). */
export type Time = string;

export interface YMD {
  y: number;
  m: number;
  d: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function parseISO(iso: ISODate): YMD {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

export function toISO({ y, m, d }: YMD): ISODate {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** The local calendar date of a moment. */
export function localISO(date: Date): ISODate {
  return toISO({ y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() });
}

export function localTime(date: Date): Time {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function addDays(iso: ISODate, days: number): ISODate {
  const { y, m, d } = parseISO(iso);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return toISO({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(iso: ISODate): number {
  const { y, m, d } = parseISO(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function daysBetween(a: ISODate, b: ISODate): number {
  const pa = parseISO(a);
  const pb = parseISO(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 864e5);
}

/** The local moment of a date and time. */
export function atLocal(iso: ISODate, time: Time): Date {
  const { y, m, d } = parseISO(iso);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

/* ---------- Solar Hijri (the arithmetic is shared by Iran and Afghanistan) ---------- */

export function toSolar(iso: ISODate): YMD {
  const { y, m, d } = parseISO(iso);
  const j = toJalaali(y, m, d);
  return { y: j.jy, m: j.jm, d: j.jd };
}

export function fromSolar({ y, m, d }: YMD): ISODate {
  const g = toGregorian(y, m, d);
  return toISO({ y: g.gy, m: g.gm, d: g.gd });
}

export function solarMonthLength(y: number, m: number): number {
  return jalaaliMonthLength(y, m);
}

export function gregorianMonthLength(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

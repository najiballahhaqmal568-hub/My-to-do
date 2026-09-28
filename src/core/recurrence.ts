import { addDays, fromSolar, solarMonthLength, toSolar, weekday, type ISODate } from './dates';
import type { RepeatRule } from './types';

/** Fills in the anchors a rule needs from the task's due date, and validates it. */
export function normalizeRule(rule: RepeatRule, due: ISODate): RepeatRule {
  const s = toSolar(due);
  switch (rule.kind) {
    case 'monthly':
      return { kind: 'monthly', day: rule.day ?? s.d };
    case 'yearly':
      return { kind: 'yearly', month: rule.month ?? s.m, day: rule.day ?? s.d };
    case 'weekdays': {
      const days = [...new Set(rule.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
      if (!days.length) throw new Error('weekdays-empty');
      return { kind: 'weekdays', days };
    }
    case 'everyN': {
      const n = Math.floor(rule.n);
      if (!(n >= 1)) throw new Error('every-n-invalid');
      return { kind: 'everyN', n };
    }
    default:
      return { kind: rule.kind };
  }
}

/** The next date after `from` on which the rule fires. */
export function nextDate(rule: RepeatRule, from: ISODate): ISODate {
  switch (rule.kind) {
    case 'daily':
      return addDays(from, 1);
    case 'weekly':
      return addDays(from, 7);
    case 'everyN':
      return addDays(from, rule.n);
    case 'weekdays': {
      for (let i = 1; i <= 7; i++) {
        const d = addDays(from, i);
        if (rule.days.includes(weekday(d))) return d;
      }
      return addDays(from, 7);
    }
    case 'monthly': {
      const s = toSolar(from);
      const y = s.m === 12 ? s.y + 1 : s.y;
      const m = s.m === 12 ? 1 : s.m + 1;
      const day = Math.min(rule.day ?? s.d, solarMonthLength(y, m));
      return fromSolar({ y, m, d: day });
    }
    case 'yearly': {
      const s = toSolar(from);
      const m = rule.month ?? s.m;
      const y = s.y + 1;
      const day = Math.min(rule.day ?? s.d, solarMonthLength(y, m));
      return fromSolar({ y, m, d: day });
    }
  }
}

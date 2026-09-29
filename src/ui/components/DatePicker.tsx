import { useState } from 'react';
import { addDays, fromSolar, gregorianMonthLength, parseISO, solarMonthLength, toISO, toSolar, weekday, type ISODate } from '../../core/dates';
import { digits, monthTitle, weekHeader } from '../../i18n';
import { useApp } from '../context';
import { Icon } from '../icons';

interface Props {
  value: ISODate | null;
  onChange(value: ISODate | null): void;
}

/** A month grid in the Solar Hijri calendar (Persian) or Gregorian (English), weeks starting on Saturday. */
export function DatePicker({ value, onChange }: Props) {
  const { core, lang, t } = useApp();
  const today = core.today();
  const solar = lang === 'fa';
  const start = value ?? today;
  const [view, setView] = useState(() => (solar ? { y: toSolar(start).y, m: toSolar(start).m } : { y: parseISO(start).y, m: parseISO(start).m }));

  const first = solar ? fromSolar({ y: view.y, m: view.m, d: 1 }) : toISO({ y: view.y, m: view.m, d: 1 });
  const length = solar ? solarMonthLength(view.y, view.m) : gregorianMonthLength(view.y, view.m);
  const lead = (weekday(first) + 1) % 7; // Saturday = column 0
  const cells: (ISODate | null)[] = [...Array(lead).fill(null), ...Array.from({ length }, (_, i) => addDays(first, i))];

  const shift = (delta: number) => {
    let m = view.m + delta;
    let y = view.y;
    if (m < 1) (m = 12), y--;
    if (m > 12) (m = 1), y++;
    setView({ y, m });
  };

  return (
    <div>
      <div className="quick seg">
        <button type="button" aria-pressed={value === today} onClick={() => onChange(today)}>
          {t.today}
        </button>
        <button type="button" aria-pressed={value === addDays(today, 1)} onClick={() => onChange(addDays(today, 1))}>
          {t.tomorrow}
        </button>
        <button type="button" aria-pressed={value === null} onClick={() => onChange(null)}>
          {t.noDate}
        </button>
      </div>
      <div className="cal">
        <div className="cal-h">
          <button type="button" aria-label="‹" onClick={() => shift(-1)}>
            <Icon name="back" className="flip" small />
          </button>
          <span>{monthTitle(lang, view.y, view.m)}</span>
          <button type="button" aria-label="›" onClick={() => shift(1)}>
            <Icon name="forward" className="flip" small />
          </button>
        </div>
        <div className="cal-grid" role="grid">
          {weekHeader(lang).map((w, i) => (
            <span key={w} className={`wd${solar && i === 6 ? ' fri' : ''}`}>
              {w}
            </span>
          ))}
          {cells.map((iso, i) =>
            iso ? (
              <button
                type="button"
                key={iso}
                className={`day${iso === today ? ' today' : ''}${solar && weekday(iso) === 5 ? ' fri' : ''}`}
                aria-pressed={iso === value}
                onClick={() => onChange(iso)}
              >
                {digits(lang, solar ? toSolar(iso).d : parseISO(iso).d)}
              </button>
            ) : (
              <span key={`e${i}`} />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

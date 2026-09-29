import { digits, hourLabel } from '../../i18n';
import { useApp } from '../context';

interface Props {
  id: string;
  /** `HH:MM` on the 24-hour clock, or an empty string for no time. */
  value: string;
  onChange(value: string): void;
  /** Adds a «بدون ساعت» choice, for tasks whose time is optional. */
  allowEmpty?: boolean;
  disabled?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A time picker that always uses the 12-hour clock, whatever the phone's own 24-hour setting is:
 * an hour list («۶ صبح» … «۱۱ شب») and a minute list in steps of five.
 */
export function TimeField({ id, value, onChange, allowEmpty, disabled }: Props) {
  const { lang, t } = useApp();
  const [hh, mm] = value ? value.split(':') : ['', '00'];
  const current = Number(mm);
  const minutes = [...new Set([...Array.from({ length: 12 }, (_, i) => i * 5), current])].sort((a, b) => a - b);

  return (
    <div className="timefield">
      <select
        id={`${id}-hour`}
        className="input"
        aria-label={t.time}
        value={hh}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value ? `${e.target.value}:${mm}` : '')}
      >
        {allowEmpty && <option value="">{t.noTime}</option>}
        {Array.from({ length: 24 }, (_, h) => (
          <option key={h} value={pad(h)}>
            {hourLabel(lang, h)}
          </option>
        ))}
      </select>
      <select id={`${id}-minute`} className="input" aria-label={t.minute} value={mm} disabled={disabled || !hh} onChange={(e) => onChange(`${hh}:${e.target.value}`)}>
        {minutes.map((m) => (
          <option key={m} value={pad(m)}>
            {digits(lang, pad(m))}
          </option>
        ))}
      </select>
    </div>
  );
}

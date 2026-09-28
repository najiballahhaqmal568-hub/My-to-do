import { animate, motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { digits } from '../../i18n';
import { useApp } from '../context';
import { SPRING } from './TaskRow';

/** A number that counts from its previous value to the new one. */
export function CountUp({ value }: { value: number }) {
  const { lang, reduceMotion } = useApp();
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(reduceMotion ? value : 0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = prev.current;
    prev.current = value;
    if (reduceMotion || from === value) {
      el.textContent = digits(lang, value);
      return;
    }
    const c = animate(from, value, { duration: 0.7, ease: 'easeOut', onUpdate: (v) => (el.textContent = digits(lang, Math.round(v))) });
    return () => c.stop();
  }, [value, lang, reduceMotion]);
  return (
    <span ref={ref} className="num">
      {digits(lang, value)}
    </span>
  );
}

const R = 40;
const C = 2 * Math.PI * R;

export function ProgressRing({ done, total }: { done: number; total: number }) {
  const { t } = useApp();
  const p = total ? done / total : 0;
  return (
    <div className="ring" role="img" aria-label={t.progress(done, total)}>
      <svg viewBox="0 0 100 100">
        <circle className="trk" cx="50" cy="50" r={R} />
        <motion.circle
          className="val"
          cx="50"
          cy="50"
          r={R}
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - p) }}
          transition={{ ...SPRING, stiffness: 120, damping: 18 }}
        />
      </svg>
      <div className="n">
        <span>
          <b>
            <CountUp value={done} />
          </b>
          <small>{t.ofTotal(total)}</small>
        </span>
      </div>
    </div>
  );
}

export function Bar({ ratio }: { ratio: number }) {
  return (
    <span className="bar">
      <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: ratio }} transition={{ ...SPRING, stiffness: 160, damping: 20 }} />
    </span>
  );
}

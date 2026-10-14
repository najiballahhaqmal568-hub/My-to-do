import { useEffect, useRef } from 'react';
import type { ListOrder } from '../../core/types';
import { useApp } from '../context';
import { Icon } from '../icons';

/** A row of chips that picks how a list is arranged. */
export function OrderBar({ value, options, onChange }: { value: ListOrder; options: ListOrder[]; onChange(order: ListOrder): void }) {
  const { t } = useApp();
  const bar = useRef<HTMLDivElement>(null);
  // On a narrow phone the row scrolls sideways; keep the chosen chip in sight.
  useEffect(() => {
    const chip = bar.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    const row = bar.current;
    if (!chip || !row) return;
    const r = chip.getBoundingClientRect();
    const box = row.getBoundingClientRect();
    if (r.left < box.left || r.right > box.right) row.scrollLeft += r.left < box.left ? r.left - box.left - 16 : r.right - box.right + 16;
  }, [value]);
  const label: Record<ListOrder, string> = {
    time: t.orderTime,
    newest: t.orderNewest,
    priority: t.orderPriority,
    title: t.orderTitle,
    manual: t.orderManual,
  };
  return (
    <div ref={bar} className="order-bar" role="group" aria-label={t.orderLabel} data-testid="order-bar">
      <span className="order-label" aria-hidden="true">
        <Icon name="sort" />
      </span>
      {options.map((o) => (
        <button key={o} className="seg-btn" data-testid={`order-${o}`} aria-pressed={value === o} onClick={() => onChange(o)}>
          {o === 'manual' && <Icon name="grip" small />}
          {label[o]}
        </button>
      ))}
    </div>
  );
}

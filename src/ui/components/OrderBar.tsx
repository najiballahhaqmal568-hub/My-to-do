import type { ListOrder } from '../../core/types';
import { useApp } from '../context';
import { Icon } from '../icons';

/** A row of chips that picks how a list is arranged. */
export function OrderBar({ value, options, onChange }: { value: ListOrder; options: ListOrder[]; onChange(order: ListOrder): void }) {
  const { t } = useApp();
  const label: Record<ListOrder, string> = {
    time: t.orderTime,
    newest: t.orderNewest,
    priority: t.orderPriority,
    title: t.orderTitle,
    manual: t.orderManual,
  };
  return (
    <div className="order-bar" role="group" aria-label={t.orderLabel} data-testid="order-bar">
      <span className="order-label" aria-hidden="true">
        <Icon name="sort" small />
        {t.orderLabel}
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

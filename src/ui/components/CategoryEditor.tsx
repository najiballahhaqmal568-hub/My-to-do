import { useState } from 'react';
import { CATEGORY_COLORS, type CategoryColor } from '../../core/types';
import { useApp } from '../context';
import { Icon } from '../icons';

const EMOJIS = ['🏃', '🏪', '📚', '🏠', '💼', '🛒', '💰', '🧘', '🍎', '💊', '🚗', '✈️', '🎓', '👨‍👩‍👧', '🕌', '🎯', '📌', '💡'];

export function CategoryEditor({ categoryId, onClose }: { categoryId: string | null; onClose(): void }) {
  const { core, t, ask } = useApp();
  const existing = categoryId ? core.category(categoryId) : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [emoji, setEmoji] = useState(existing?.emoji ?? '📌');
  const [color, setColor] = useState<CategoryColor>(existing?.color ?? 'teal');
  const [error, setError] = useState(false);

  function save() {
    if (!name.trim()) return setError(true);
    if (existing) core.updateCategory(existing.id, { name, emoji, color });
    else core.addCategory({ name, emoji, color });
    onClose();
  }

  async function remove() {
    if (!existing) return;
    const hasTasks = core.search('').some((x) => x.categoryId === existing.id);
    if (!hasTasks) {
      core.deleteCategory(existing.id, 'moveToInbox');
      return onClose();
    }
    const choice = await ask(t.deleteCategoryTitle, t.deleteCategoryBody, [
      { value: 'moveToInbox', label: t.moveToInbox, tone: 'primary' },
      { value: 'deleteTasks', label: t.deleteAll, tone: 'danger' },
    ]);
    if (choice === 'moveToInbox' || choice === 'deleteTasks') {
      core.deleteCategory(existing.id, choice);
      onClose();
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="sheet-h">
        <h2>{existing ? t.editCategory : t.newCategory}</h2>
        <button type="button" className="icon-btn" aria-label={t.close} onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <div className="field">
        <label htmlFor="cat-name">{t.categoryName}</label>
        <input id="cat-name" className="input big" value={name} autoFocus={!existing} onChange={(e) => (setName(e.target.value), setError(false))} />
      </div>
      {error && <div className="error">{t.titleRequired}</div>}
      <div className="field">
        <span className="label">{t.emoji}</span>
        <div className="emojis">
          {EMOJIS.map((e) => (
            <button type="button" key={e} aria-pressed={emoji === e} onClick={() => setEmoji(e)}>
              {e}
            </button>
          ))}
          <input className="input" style={{ width: 70, textAlign: 'center' }} value={emoji} maxLength={4} aria-label={t.emoji} onChange={(e) => setEmoji(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <span className="label">{t.color}</span>
        <div className="swatches">
          {CATEGORY_COLORS.map((c) => (
            <button type="button" key={c} className={`c-${c}`} aria-label={c} aria-pressed={color === c} onClick={() => setColor(c)} />
          ))}
        </div>
      </div>
      <div className="actions">
        <button type="submit" className="btn primary">
          {t.save}
        </button>
        {existing && (
          <button type="button" className="btn danger" onClick={remove}>
            <Icon name="trash" small />
            {t.delete}
          </button>
        )}
      </div>
    </form>
  );
}

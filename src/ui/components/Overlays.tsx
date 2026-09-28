import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import type { ConfirmOption } from '../context';
import { SPRING } from './TaskRow';

export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="scrim" className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            key="sheet"
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%', transition: { duration: 0.22, ease: 'easeIn' } }}
            transition={{ ...SPRING, stiffness: 340, damping: 34 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            dragListener={false}
          >
            <div className="sheet-grip" />
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export interface DialogState {
  title: string;
  body: string;
  options: ConfirmOption[];
  resolve(value: string | null): void;
}

export function Dialog({ state, cancelLabel }: { state: DialogState | null; cancelLabel: string }) {
  return (
    <AnimatePresence>
      {state && (
        <>
          <motion.div key="scrim" className="scrim" style={{ zIndex: 50 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => state.resolve(null)} />
          <motion.div
            key="dialog"
            className="dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={SPRING}
          >
            <h2 id="dialog-title">{state.title}</h2>
            <p>{state.body}</p>
            <div className="actions">
              {state.options.map((o) => (
                <button key={o.value} className={`btn ${o.tone === 'danger' ? 'danger' : o.tone === 'primary' ? 'primary' : ''}`} onClick={() => state.resolve(o.value)}>
                  {o.label}
                </button>
              ))}
              <button className="btn" onClick={() => state.resolve(null)}>
                {cancelLabel}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export interface ToastState {
  id: number;
  message: string;
  undo: boolean;
}

export function Toast({ toast, undoLabel, onUndo }: { toast: ToastState | null; undoLabel: string; onUndo: () => void }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          className="toast"
          role="status"
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20 }}
          transition={SPRING}
        >
          <span>{toast.message}</span>
          {toast.undo && <button onClick={onUndo}>{undoLabel}</button>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

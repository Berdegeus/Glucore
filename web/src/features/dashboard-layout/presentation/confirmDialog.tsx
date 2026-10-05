import { useEffect, useId, useRef } from 'react';
import styles from './confirmDialog.module.css';

export const CANCEL_LABEL = 'Cancelar';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm(): void;
  onCancel(): void;
}

/**
 * A question that must be answered before going on (an `alertdialog`). The
 * focus starts on "Cancelar", the safe answer, stays between the two buttons
 * while the question is open, and goes back to the control that opened it
 * when the question closes. Esc cancels.
 */
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const root = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancel.current?.focus();
    return () => opener?.focus();
  }, []);

  // A native listener: the dialog is not an interactive element, but it does own its keys.
  useEffect(() => {
    const dialog = root.current;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;
      // Two buttons make the whole tab order: stepping past either end wraps around.
      const edge = event.shiftKey ? cancel.current : confirm.current;
      if (document.activeElement === edge) {
        event.preventDefault();
        (event.shiftKey ? confirm.current : cancel.current)?.focus();
      }
    }
    dialog?.addEventListener('keydown', onKeyDown);
    return () => dialog?.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div className={styles.backdrop}>
      <div ref={root} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId} className={styles.dialog}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <p id={messageId} className={styles.message}>
          {message}
        </p>
        <div className={styles.actions}>
          <button ref={cancel} type="button" className={styles.button} onClick={onCancel}>
            {CANCEL_LABEL}
          </button>
          <button ref={confirm} type="button" className={`${styles.button} ${styles.danger}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { ErrorState } from '../../../shared/presentation/ui/states';
import { ConfirmDialog } from './confirmDialog';
import { useLayoutEditorContext } from './layoutEditorContext';
import styles from './layoutToolbar.module.css';
import { useLayoutActions } from './useLayoutActions';

export const CUSTOMIZE_LABEL = 'Personalizar';
export const SAVE_LABEL = 'Salvar';
export const CANCEL_EDIT_LABEL = 'Cancelar';
export const RESTORE_LABEL = 'Restaurar padrão';
export const RESTORE_TITLE = 'Restaurar o layout padrão?';
export const RESTORE_MESSAGE = 'O layout salvo será apagado e o padrão do seu perfil voltará a valer. Esta ação não pode ser desfeita.';
export const RESTORE_CONFIRM_LABEL = 'Sim, restaurar';

/**
 * Keeps the keyboard focus on something real when the buttons change: it goes
 * to "Cancelar" when editing starts and to "Personalizar" when it ends, instead
 * of falling to the top of the page when the button just used leaves.
 */
function useEditFocus(editing: boolean) {
  const customize = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const was = useRef(false);
  useEffect(() => {
    if (was.current !== editing) (editing ? cancel : customize).current?.focus();
    was.current = editing;
  }, [editing]);
  return [customize, cancel] as const;
}

/**
 * "Personalizar", then "Salvar", "Cancelar" and "Restaurar padrão" (LAY-03,
 * LAY-07, LAY-09, LAY-13). "Restaurar padrão" asks first; saving or restoring
 * says what happened ("Layout salvo"), and a failure keeps the draft on
 * screen with the error and "Tentar novamente".
 */
export function LayoutToolbar() {
  const { role, loading, editor } = useLayoutEditorContext();
  const actions = useLayoutActions(role, editor);
  const [asking, setAsking] = useState(false);
  const [customizeRef, cancelRef] = useEditFocus(editor.editing);
  if (loading) return null;

  const { failure } = actions;
  const idle = !actions.busy;
  return (
    <div className={styles.toolbar}>
      {editor.editing ? (
        <>
          <button type="button" className={`${styles.button} ${styles.primary}`} disabled={!editor.dirty || !idle} onClick={() => void actions.save()}>
            {SAVE_LABEL}
          </button>
          <button ref={cancelRef} type="button" className={styles.button} disabled={!idle} onClick={editor.cancel}>
            {CANCEL_EDIT_LABEL}
          </button>
          <button type="button" className={styles.button} disabled={!idle} onClick={() => setAsking(true)}>
            {RESTORE_LABEL}
          </button>
        </>
      ) : (
        <button
          ref={customizeRef}
          type="button"
          className={styles.button}
          onClick={() => {
            actions.clear();
            editor.start();
          }}
        >
          {CUSTOMIZE_LABEL}
        </button>
      )}
      <p className={styles.status} role="status">
        {actions.message}
      </p>
      <p className={styles.notice} role="alert">
        {editor.notice}
      </p>
      {failure && <ErrorState message={failure.text} onRetry={() => void actions[failure.action]()} />}
      {asking && (
        <ConfirmDialog
          title={RESTORE_TITLE}
          message={RESTORE_MESSAGE}
          confirmLabel={RESTORE_CONFIRM_LABEL}
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            void actions.restore();
          }}
        />
      )}
    </div>
  );
}

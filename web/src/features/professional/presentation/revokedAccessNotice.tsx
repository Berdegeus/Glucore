import styles from './revokedAccessNotice.module.css';
import { useRevokedAccessNotice } from './revokedAccess';

export const DISMISS_LABEL = 'Dispensar aviso';

/** "O paciente revogou o acesso", shown while the professional has not dismissed it (PRO-13). */
export function RevokedAccessNotice() {
  const { notice, dismiss } = useRevokedAccessNotice();
  if (notice === null) return null;
  return (
    <div className={styles.notice} role="status">
      <span>{notice}</span>
      <button type="button" className={styles.dismiss} onClick={dismiss}>
        {DISMISS_LABEL}
      </button>
    </div>
  );
}

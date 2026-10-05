import styles from './states.module.css';

export const LOADING_LABEL = 'Carregando';
export const FORBIDDEN_MESSAGE = 'Você não tem acesso a este conteúdo';
export const ERROR_MESSAGE = 'Não foi possível carregar este conteúdo.';
export const EMPTY_TITLE = 'Sem dados';
export const RETRY_LABEL = 'Tentar novamente';

interface SkeletonProps {
  /** Height of the placeholder, so the layout does not jump when data arrives (LAY-16). */
  height?: number | string;
}

/** Placeholder with the size of the content it stands for. */
export function Skeleton({ height }: SkeletonProps) {
  return <div className={styles.skeleton} role="status" aria-label={LOADING_LABEL} style={{ height }} />;
}

interface EmptyStateProps {
  /** Why there is nothing to show, e.g. "Não há leituras neste período" (LAY-16). */
  cause: string;
  title?: string;
}

export function EmptyState({ cause, title = EMPTY_TITLE }: EmptyStateProps) {
  return (
    <div className={styles.state} role="status">
      <p className={styles.title}>{title}</p>
      <p className={styles.cause}>{cause}</p>
    </div>
  );
}

interface ErrorStateProps {
  onRetry: () => void;
  message?: string;
}

export function ErrorState({ onRetry, message = ERROR_MESSAGE }: ErrorStateProps) {
  return (
    <div className={`${styles.state} ${styles.error}`} role="alert">
      <p className={styles.title}>{message}</p>
      <button type="button" className={styles.retry} onClick={onRetry}>
        {RETRY_LABEL}
      </button>
    </div>
  );
}

/** Shown on `403 FORBIDDEN_ROLE`; it offers no retry because the answer will not change (ACC-05). */
export function Forbidden() {
  return (
    <div className={styles.state} role="alert">
      <p className={styles.title}>{FORBIDDEN_MESSAGE}</p>
    </div>
  );
}

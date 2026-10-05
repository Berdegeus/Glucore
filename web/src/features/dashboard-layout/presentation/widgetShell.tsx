import { Component, useId, type ReactNode } from 'react';
import { EmptyState, ErrorState, Skeleton } from '../../../shared/presentation/ui/states';
import type { WidgetSize } from '../domain/layout';
import styles from './widgetShell.module.css';

/** Height of the skeleton per widget size, close to what the loaded widget takes (LAY-16). */
export const SKELETON_HEIGHT: Readonly<Record<WidgetSize, string>> = { S: '6rem', M: '12rem', L: '18rem' };

/** What a widget's data is doing. Only `ready` renders the widget itself. */
export type WidgetState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  /** No data in the period; `cause` says why (LAY-16). */
  | { kind: 'empty'; cause: string }
  /** The data source failed; the widget offers "Tentar novamente" (LAY-15). */
  | { kind: 'error'; onRetry: () => void; message?: string };

export interface BoundaryProps {
  children: ReactNode;
  render(retry: () => void): ReactNode;
}

interface BoundaryState {
  failed: boolean;
}

/** Catches a widget that throws while rendering, so it takes down only its own cell (LAY-15). */
export class WidgetErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  private readonly retry = () => {
    this.setState({ failed: false });
  };

  override render(): ReactNode {
    return this.state.failed ? this.props.render(this.retry) : this.props.children;
  }
}

interface WidgetShellProps {
  /** Already resolved text, not a key. */
  title: string;
  state: WidgetState;
  /** Sizes the skeleton so the grid does not jump when data arrives. */
  size?: WidgetSize;
  children?: ReactNode;
}

/**
 * The frame every widget sits in: a titled card showing a skeleton while
 * loading, the cause when there is no data, an error with "Tentar novamente"
 * when the source fails, and the widget once ready. An error boundary inside
 * keeps a widget that throws from taking the page or its neighbors down.
 */
export function WidgetShell({ title, state, size = 'M', children }: WidgetShellProps) {
  const titleId = useId();
  return (
    <section className={styles.shell} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      <div className={styles.body}>
        <WidgetBody state={state} size={size}>
          {children}
        </WidgetBody>
      </div>
    </section>
  );
}

function WidgetBody({ state, size, children }: { state: WidgetState; size: WidgetSize; children: ReactNode }) {
  switch (state.kind) {
    case 'loading':
      return <Skeleton height={SKELETON_HEIGHT[size]} />;
    case 'empty':
      return <EmptyState cause={state.cause} />;
    case 'error':
      return <ErrorState onRetry={state.onRetry} message={state.message} />;
    case 'ready':
      return <WidgetErrorBoundary render={(retry) => <ErrorState onRetry={retry} />}>{children}</WidgetErrorBoundary>;
  }
}

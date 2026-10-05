import { Suspense } from 'react';
import { Skeleton } from '../../../shared/presentation/ui/states';
import type { WidgetSize } from '../domain/layout';
import type { WidgetComponent } from './widgetRegistry';
import { SKELETON_HEIGHT, WidgetErrorBoundary, WidgetShell } from './widgetShell';

export const UNAVAILABLE_WIDGET_TITLE = 'Item indisponível';
export const UNAVAILABLE_WIDGET_MESSAGE = 'Não foi possível carregar este item do painel.';

interface WidgetSlotProps {
  /** What the registry gave for the layout item's id. */
  component: WidgetComponent;
  size: WidgetSize;
}

/**
 * The cell a registered widget renders in. The widget's code loads when it
 * first renders, so the cell shows a skeleton of its size until then. If the
 * code cannot load (a deploy replaced the file, the network dropped) only this
 * cell fails, and it offers a reload: `React.lazy` keeps a rejected load, so
 * trying the same component again would fail the same way (LAY-15).
 */
export function WidgetSlot({ component: Widget, size }: WidgetSlotProps) {
  return (
    <WidgetErrorBoundary
      render={() => (
        <WidgetShell
          title={UNAVAILABLE_WIDGET_TITLE}
          size={size}
          state={{ kind: 'error', message: UNAVAILABLE_WIDGET_MESSAGE, onRetry: () => window.location.reload() }}
        />
      )}
    >
      <Suspense fallback={<Skeleton height={SKELETON_HEIGHT[size]} />}>
        <Widget size={size} />
      </Suspense>
    </WidgetErrorBoundary>
  );
}

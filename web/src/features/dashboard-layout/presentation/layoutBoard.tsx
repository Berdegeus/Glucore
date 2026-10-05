import { lazy, Suspense } from 'react';
import { Skeleton } from '../../../shared/presentation/ui/states';
import { DashboardGrid, GridItem } from './dashboardGrid';
import { useLayoutEditorContext } from './layoutEditorContext';
import { WidgetContent } from './widgetContent';
import { componentFor } from './widgetRegistry';

// The editor, with the drag library, is its own chunk: it loads when "Personalizar" is first used.
const EditMode = lazy(() => import('./editMode'));

const BOARD_FALLBACK_HEIGHT = '12rem';

/**
 * The grid of the role's layout (LAY-02, LAY-10): one cell per widget the
 * registry knows, in the saved order and sizes. While the person is customizing
 * it becomes the editor over the draft. It is generic: it asks the registry for
 * each widget and never names one (ARQ-10).
 */
export function LayoutBoard() {
  const { loading, layout, editor } = useLayoutEditorContext();
  if (loading || !layout) return <Skeleton height={BOARD_FALLBACK_HEIGHT} />;
  if (editor.editing) {
    return (
      <Suspense fallback={<Skeleton height={BOARD_FALLBACK_HEIGHT} />}>
        <EditMode />
      </Suspense>
    );
  }
  return (
    <DashboardGrid>
      {layout.widgets
        .filter((item) => componentFor(item.id))
        .map((item) => (
          <GridItem key={item.id} size={item.size}>
            <WidgetContent item={item} />
          </GridItem>
        ))}
    </DashboardGrid>
  );
}

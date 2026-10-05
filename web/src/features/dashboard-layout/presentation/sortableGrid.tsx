import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import type { CSSProperties, ReactNode } from 'react';
import type { LayoutItem } from '../domain/layout';
import { DashboardGrid, GridItem } from './dashboardGrid';
import styles from './sortableGrid.module.css';

export const DRAG_LABEL = 'Arrastar';
const DRAG_INSTRUCTIONS =
  'Para reordenar, pressione Espaço, mova com as setas e pressione Espaço para soltar. Esc cancela. Também é possível usar os botões Mover para antes e Mover para depois.';

/** A pointer drag starts after a few pixels, so a click on the controls is not a drag; touch waits for a short press, so scrolling still works. */
const POINTER = { activationConstraint: { distance: 8 } };
const TOUCH = { activationConstraint: { delay: 250, tolerance: 8 } };

function transformOf(transform: { x: number; y: number; scaleX: number; scaleY: number } | null): string | undefined {
  if (!transform) return undefined;
  return `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`;
}

interface SortableCellProps {
  item: LayoutItem;
  /** Already resolved text of the widget, for the handle and the announcements. */
  title: string;
  controls: ReactNode;
  children: ReactNode;
}

/** One widget of the grid in edit mode: a bar with the drag handle and the controls, above the widget. */
function SortableCell({ item, title, controls, children }: SortableCellProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    attributes: { roleDescription: 'item reordenável' },
  });
  const style: CSSProperties = { transform: transformOf(transform), transition };
  return (
    <GridItem ref={setNodeRef} size={item.size} style={style} className={isDragging ? `${styles.cell} ${styles.dragging}` : styles.cell}>
      <div className={styles.bar}>
        {/* Only the handle starts a drag, so Space and Enter on the other buttons stay plain clicks. */}
        <button type="button" ref={setActivatorNodeRef} className={styles.handle} aria-label={`${DRAG_LABEL} ${title}`} {...attributes} {...listeners}>
          <span aria-hidden="true">⠿</span>
        </button>
        {controls}
      </div>
      <div className={styles.content}>{children}</div>
    </GridItem>
  );
}

interface SortableGridProps {
  items: readonly LayoutItem[];
  /** Already resolved text of a widget, by id. */
  titleOf(id: string): string;
  /** Called with the widget and the position (0 is first) where a drag dropped it. */
  onMove(id: string, toIndex: number): void;
  /** The buttons next to the drag handle of a widget: move, resize, remove. */
  renderControls(item: LayoutItem, index: number): ReactNode;
  renderContent(item: LayoutItem): ReactNode;
}

function announcementsFor(ids: readonly string[], titleOf: (id: string) => string): Announcements {
  const place = (id: UniqueIdentifier) => `posição ${ids.indexOf(String(id)) + 1} de ${ids.length}`;
  const name = (id: UniqueIdentifier) => titleOf(String(id));
  return {
    onDragStart: ({ active }) => `${name(active.id)} pego, na ${place(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${name(active.id)} sobre a ${place(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) => `${name(active.id)} solto na ${place(over?.id ?? active.id)}.`,
    onDragCancel: ({ active }) => `Movimento cancelado: ${name(active.id)} voltou para a ${place(active.id)}.`,
  };
}

/**
 * The grid in "Personalizar" mode (LAY-04): the widgets sit in the same cells
 * as always and can be reordered with the mouse, a finger or the keyboard
 * (handle, Space, arrow keys, Space). A drop ends in `onMove`, the same call the
 * "Mover para antes/depois" buttons make. This module and the rest of the
 * editor are the only code that knows `@dnd-kit`.
 */
export function SortableGrid({ items, titleOf, onMove, renderControls, renderContent }: SortableGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, POINTER),
    useSensor(TouchSensor, TOUCH),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map((item) => item.id);

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onMove(String(active.id), ids.indexOf(String(over.id)));
  }

  return (
    <DndContext
      id="layout-editor"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{ announcements: announcementsFor(ids, titleOf), screenReaderInstructions: { draggable: DRAG_INSTRUCTIONS } }}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <DashboardGrid>
          {items.map((item, index) => (
            <SortableCell key={item.id} item={item} title={titleOf(item.id)} controls={renderControls(item, index)}>
              {renderContent(item)}
            </SortableCell>
          ))}
        </DashboardGrid>
      </SortableContext>
    </DndContext>
  );
}

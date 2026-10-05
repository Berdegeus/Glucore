import type { LayoutItem, WidgetDefinition } from '../domain/layout';
import styles from './editMode.module.css';
import { useLayoutEditorContext } from './layoutEditorContext';
import { MoveButtons } from './moveButtons';
import { SizeControl } from './sizeControl';
import { SortableGrid } from './sortableGrid';
import type { LayoutEditor } from './useLayoutEditor';
import { WidgetContent } from './widgetContent';
import { RemoveWidgetButton, WidgetPicker } from './widgetPicker';
import { definitionFor } from './widgetRegistry';
import { widgetTitle } from './widgetTitles';

const titleOf = (id: string): string => {
  const definition = definitionFor(id);
  return definition ? widgetTitle(definition) : id;
};

interface CellControlsProps {
  item: LayoutItem;
  index: number;
  count: number;
  editor: LayoutEditor;
  onMove: (id: string, toIndex: number) => void;
}

/** What sits beside the drag handle of one widget: move, resize and remove. */
function CellControls({ item, index, count, editor, onMove }: CellControlsProps) {
  const definition: WidgetDefinition | null = definitionFor(item.id);
  const title = titleOf(item.id);
  return (
    <>
      <MoveButtons title={title} index={index} count={count} onMove={(to) => onMove(item.id, to)} />
      {definition && <SizeControl definition={definition} title={title} value={item.size} onChange={(size) => editor.resize(definition, size)} />}
      <RemoveWidgetButton title={title} onRemove={() => editor.remove(item.id)} />
    </>
  );
}

/**
 * The dashboard in "Personalizar" mode (LAY-03 to LAY-06): the widgets to add
 * and the widgets of the draft, each with its move, size and remove controls
 * and a handle to drag it. It works from the registry of the role, so any role's
 * page gets it unchanged. It is loaded on demand: the drag library only
 * downloads when someone starts customizing.
 */
export default function EditMode() {
  const { role, editor } = useLayoutEditorContext();
  // An id the registry does not know has no widget to show or edit (a role's default may list widgets not built yet),
  // so it gets no cell; the draft keeps it, and a move maps a position among the cells to its place in the draft.
  const cells = editor.draft.widgets.filter((item) => definitionFor(item.id));
  const count = cells.length;
  const moveCell = (id: string, toIndex: number) => editor.move(id, editor.draft.widgets.findIndex((item) => item.id === cells[toIndex]?.id));
  return (
    <div className={styles.editor}>
      <WidgetPicker forRole={role} draft={editor.draft} onAdd={editor.add} />
      <SortableGrid
        items={cells}
        titleOf={titleOf}
        onMove={moveCell}
        renderControls={(item, index) => <CellControls item={item} index={index} count={count} editor={editor} onMove={moveCell} />}
        renderContent={(item) => <WidgetContent item={item} />}
      />
    </div>
  );
}

import { useId } from 'react';
import type { Role } from '../../../shared/domain/role';
import type { DashboardLayout, WidgetDefinition } from '../domain/layout';
import styles from './widgetPicker.module.css';
import { definitionsForRole } from './widgetRegistry';
import { widgetTitle } from './widgetTitles';

export const PICKER_TITLE = 'Adicionar ao painel';
export const PICKER_EMPTY = 'Todos os itens já estão no painel.';
export const ADD_LABEL = 'Adicionar';
export const REMOVE_LABEL = 'Remover';

interface WidgetPickerProps {
  forRole: Role;
  /** The layout being edited: widgets already on it are not offered. */
  draft: DashboardLayout;
  onAdd(definition: WidgetDefinition): void;
}

/**
 * The widgets of the role's catalog that are not on the dashboard yet (LAY-03),
 * each with an "Adicionar" button. It reads the registry, never a fixed list,
 * so a widget registered later shows up here without changing this file.
 */
export function WidgetPicker({ forRole, draft, onAdd }: WidgetPickerProps) {
  const titleId = useId();
  const placed = new Set(draft.widgets.map((item) => item.id));
  const available = definitionsForRole(forRole).filter((definition) => !placed.has(definition.id));
  return (
    <section className={styles.picker} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        {PICKER_TITLE}
      </h2>
      {available.length === 0 ? (
        <p className={styles.empty}>{PICKER_EMPTY}</p>
      ) : (
        <ul className={styles.list}>
          {available.map((definition) => (
            <li key={definition.id} className={styles.entry}>
              <span>{widgetTitle(definition)}</span>
              <button type="button" className={styles.action} aria-label={`${ADD_LABEL} ${widgetTitle(definition)}`} onClick={() => onAdd(definition)}>
                {ADD_LABEL}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface RemoveWidgetButtonProps {
  /** Already resolved text of the widget, for the accessible name. */
  title: string;
  onRemove(): void;
}

/** "Remover" on one widget of the dashboard (LAY-03); the name says which widget. */
export function RemoveWidgetButton({ title, onRemove }: RemoveWidgetButtonProps) {
  return (
    <button type="button" className={styles.action} aria-label={`${REMOVE_LABEL} ${title}`} onClick={onRemove}>
      {REMOVE_LABEL}
    </button>
  );
}

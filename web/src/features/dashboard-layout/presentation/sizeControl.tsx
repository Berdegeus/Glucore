import { useId } from 'react';
import { WIDGET_SIZES, type WidgetDefinition, type WidgetSize } from '../domain/layout';
import styles from './sizeControl.module.css';

export const SIZE_LEGEND = 'Tamanho';

interface SizeControlProps {
  definition: WidgetDefinition;
  /** Already resolved text of the widget, for the group's name. */
  title: string;
  value: WidgetSize;
  onChange(size: WidgetSize): void;
}

/**
 * S, M and L as a group of radio buttons (LAY-06), offering only the sizes the
 * widget declares, so the person cannot pick one the widget cannot take. The
 * arrow keys move between the sizes, as in any radio group.
 */
export function SizeControl({ definition, title, value, onChange }: SizeControlProps) {
  const group = useId();
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{`${SIZE_LEGEND}: ${title}`}</legend>
      {WIDGET_SIZES.filter((size) => definition.sizes.includes(size)).map((size) => (
        <span key={size} className={styles.option}>
          <input
            id={`${group}-${size}`}
            type="radio"
            name={group}
            className={styles.input}
            checked={value === size}
            onChange={() => onChange(size)}
          />
          <label htmlFor={`${group}-${size}`} className={styles.label}>
            {size}
          </label>
        </span>
      ))}
    </fieldset>
  );
}

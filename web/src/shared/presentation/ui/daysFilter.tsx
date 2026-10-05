import styles from './daysFilter.module.css';

interface DaysFilterProps {
  /** The periods on offer, in days, in the order they are shown. */
  options: readonly number[];
  /** The period in force; it is the pressed chip. */
  value: number;
  onChange: (days: number) => void;
  /** The accessible name of the group, e.g. "Período". */
  label: string;
}

const chipLabel = (days: number) => `${days} dias`;

/**
 * A row of chips to pick a period counted in days. Each chip is a button that
 * says whether it is pressed, so the choice is never carried by color alone,
 * and the controls take their minimum size from the global tokens (RSP-04).
 */
export function DaysFilter({ options, value, onChange, label }: DaysFilterProps) {
  return (
    <div role="group" aria-label={label} className={styles.chips}>
      {options.map((days) => (
        <button key={days} type="button" className={styles.chip} aria-pressed={days === value} onClick={() => onChange(days)}>
          {chipLabel(days)}
        </button>
      ))}
    </div>
  );
}

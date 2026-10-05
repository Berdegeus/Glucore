import { useId, useState, type FormEvent } from 'react';
import { PERIOD_PRESETS, toRange, validateCustom, type DateRange, type PeriodPreset } from '../domain/period';
import styles from './periodFilter.module.css';

export const PERIOD_GROUP_LABEL = 'Período';
export const CUSTOM_LABEL = 'Personalizado';
export const FROM_LABEL = 'Início';
export const TO_LABEL = 'Fim';
export const APPLY_LABEL = 'Aplicar';

const presetLabel = (preset: PeriodPreset) => `${preset} dias`;

interface PeriodFilterProps {
  /** The period the dashboard shows now. */
  value: DateRange;
  /** Today as `YYYY-MM-DD` in the patient's zone; the presets count back from it. */
  today: string;
  /** Called with the new period, only ever a valid one (PAC-02, PAC-03). */
  onChange: (range: DateRange) => void;
}

const sameRange = (a: DateRange, b: DateRange) => a.from === b.from && a.to === b.to;

interface CustomPeriodFormProps {
  initial: DateRange;
  onApply: (range: DateRange) => void;
}

/** From and to dates with the check of PAC-04 shown inline; an invalid period is never sent up. */
function CustomPeriodForm({ initial, onApply }: CustomPeriodFormProps) {
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [message, setMessage] = useState<string | null>(null);
  const errorId = useId();

  function submit(event: FormEvent) {
    event.preventDefault();
    const checked = validateCustom(from, to);
    setMessage(checked.ok ? null : checked.message);
    if (checked.ok) onApply(checked.range);
  }

  const described = message === null ? undefined : errorId;
  return (
    <form className={styles.custom} onSubmit={submit} noValidate>
      <label className={styles.field}>
        <span className={styles.label}>{FROM_LABEL}</span>
        <input
          className={styles.input}
          type="date"
          value={from}
          aria-invalid={message !== null}
          aria-describedby={described}
          onChange={(event) => setFrom(event.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>{TO_LABEL}</span>
        <input
          className={styles.input}
          type="date"
          value={to}
          aria-invalid={message !== null}
          aria-describedby={described}
          onChange={(event) => setTo(event.target.value)}
        />
      </label>
      <button type="submit" className={styles.apply}>
        {APPLY_LABEL}
      </button>
      {message !== null && (
        <p id={errorId} className={styles.error} role="alert">
          {message}
        </p>
      )}
    </form>
  );
}

/**
 * The period filter of the dashboard: the 7, 14, 30 and 90 day chips and a
 * custom range (PAC-02, PAC-03). A chip is a button that says whether it is
 * pressed, so state is never carried by color alone. The controls take their
 * minimum size from the global tokens, 44 px below 1024 px (RSP-04).
 */
export function PeriodFilter({ value, today, onChange }: PeriodFilterProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const activePreset = PERIOD_PRESETS.find((preset) => sameRange(toRange(preset, today), value));
  const showCustom = customOpen || activePreset === undefined;

  function choose(preset: PeriodPreset) {
    setCustomOpen(false);
    onChange(toRange(preset, today));
  }

  return (
    <div className={styles.filter}>
      <div role="group" aria-label={PERIOD_GROUP_LABEL} className={styles.chips}>
        {PERIOD_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={styles.chip}
            aria-pressed={!showCustom && activePreset === preset}
            onClick={() => choose(preset)}
          >
            {presetLabel(preset)}
          </button>
        ))}
        <button type="button" className={styles.chip} aria-pressed={showCustom} onClick={() => setCustomOpen(true)}>
          {CUSTOM_LABEL}
        </button>
      </div>
      {showCustom && <CustomPeriodForm initial={value} onApply={onChange} />}
    </div>
  );
}

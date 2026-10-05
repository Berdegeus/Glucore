import { EMPTY_VALUE, formatNumber } from '../format';
import styles from './kpiCard.module.css';

export const TARGET_MET_TEXT = 'Dentro da meta';
export const TARGET_MISSED_TEXT = 'Fora da meta';

const NBSP = ' ';

/** `atLeast`: the value must reach `value` (time in range); `atMost`: it must stay under it (variability). */
export interface KpiTarget {
  kind: 'atLeast' | 'atMost';
  value: number;
  unit: string;
}

interface KpiCardProps {
  /** The number as the API gives it; `null` shows `—` and no verdict on the target. */
  value: number | null;
  /** Shown beside the number: `%`, `mg/dL`. */
  unit: string;
  /** Digits after the decimal comma; glucose is whole, percentages have one. */
  fractionDigits?: number;
  target?: KpiTarget;
  /** A line of context under the value, e.g. why the figure is thin. */
  note?: string;
}

/** The target met is at the limit inclusive: 70 % meets "at least 70 %", 36 % meets "up to 36 %". */
function meetsTarget(value: number, target: KpiTarget): boolean {
  return target.kind === 'atLeast' ? value >= target.value : value <= target.value;
}

function targetText({ kind, value, unit }: KpiTarget): string {
  const limit = `${formatNumber(value, 0)}${NBSP}${unit}`;
  return kind === 'atLeast' ? `Meta: ${limit}` : `Meta: até ${limit}`;
}

function TargetStatus({ met }: { met: boolean }) {
  return (
    <p className={styles.status} data-met={met}>
      <span className={styles.icon} aria-hidden="true">
        {met ? '✓' : '!'}
      </span>
      {met ? TARGET_MET_TEXT : TARGET_MISSED_TEXT}
    </p>
  );
}

/**
 * A figure with its unit and, when it has one, its target and whether the
 * value meets it. The verdict is an icon plus words, never color alone
 * (RSP-08); figures are formatted pt-BR (RSP-09). It carries no title: the
 * widget shell around it names it.
 */
export function KpiCard({ value, unit, fractionDigits = 1, target, note }: KpiCardProps) {
  const missing = value === null || !Number.isFinite(value);
  return (
    <div className={styles.card}>
      <p className={styles.value}>
        <span>{missing ? EMPTY_VALUE : formatNumber(value, fractionDigits)}</span>
        {!missing && <span className={styles.unit}>{unit}</span>}
      </p>
      {target && <p className={styles.target}>{targetText(target)}</p>}
      {target && !missing && <TargetStatus met={meetsTarget(value, target)} />}
      {note && <p className={styles.note}>{note}</p>}
    </div>
  );
}

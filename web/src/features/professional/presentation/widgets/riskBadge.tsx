import type { RiskLevel } from '../../domain/risk';
import { RISK_ICONS, RISK_LABELS } from './patientsTableModel';
import styles from './riskBadge.module.css';

/** The risk of a patient in words, a shape and a hue: never the hue alone (PRO-03, RSP-08). */
export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return (
    <span className={styles.badge} data-risk={risk}>
      <span aria-hidden="true">{RISK_ICONS[risk]}</span>
      {RISK_LABELS[risk]}
    </span>
  );
}

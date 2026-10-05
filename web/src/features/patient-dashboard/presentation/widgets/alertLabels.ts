/**
 * The alert types the backend records (`AlertType` enum names) in the words the
 * patient reads in the app. A type this table does not know is shown as sent.
 */
const ALERT_LABELS: Readonly<Record<string, string>> = {
  HYPO_RISK: 'Risco de hipoglicemia',
  HYPER_RISK: 'Risco de hiperglicemia',
  FAST_DROP: 'Queda rápida',
  FAST_RISE: 'Subida rápida',
  SENSOR_RECONNECTED: 'Sensor reconectado',
  SYNC_FAILURE: 'Falha de sincronização',
};

export function alertLabel(alertType: string): string {
  // Own keys only: a type named like an Object method must not read as a label.
  return Object.hasOwn(ALERT_LABELS, alertType) ? (ALERT_LABELS[alertType] ?? alertType) : alertType;
}

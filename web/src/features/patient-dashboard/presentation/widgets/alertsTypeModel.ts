import type { ChartRow } from '../../../../shared/presentation/charts/chartTypes';
import { formatNumber } from '../../../../shared/presentation/format';
import type { AlertsByType } from '../../domain/summary';
import { alertLabel } from './alertLabels';
import type { ChartAlternative } from './chartWidget';
import { countOf } from './summaryText';

export const ALERTS_TYPE_COLUMNS = ['Tipo', 'Alertas'] as const;

/** One bar per alert type, named in words. */
export function alertsTypeRows(byType: readonly AlertsByType[]): ChartRow[] {
  return byType.map((entry) => ({ type: alertLabel(entry.alertType), count: entry.count }));
}

/** The sentence for screen readers and the table behind "Ver como tabela". */
export function alertsTypeAlternative(byType: readonly AlertsByType[]): ChartAlternative {
  const total = byType.reduce((sum, entry) => sum + entry.count, 0);
  const parts = byType.map((entry) => `${alertLabel(entry.alertType)} ${entry.count}`);
  return {
    summary: `Alertas por tipo, ${countOf(total, 'alerta', 'alertas')} no período: ${parts.join('; ')}.`,
    columns: ALERTS_TYPE_COLUMNS,
    rows: byType.map((entry) => [alertLabel(entry.alertType), formatNumber(entry.count, 0)]),
  };
}

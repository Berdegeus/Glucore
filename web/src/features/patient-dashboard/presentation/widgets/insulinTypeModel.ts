import { formatNumber } from '../../../../shared/presentation/format';
import type { ChartRow } from '../../../../shared/presentation/charts/chartTypes';
import type { InsulinByType } from '../../domain/summary';
import type { ChartAlternative } from './chartWidget';
import { countOf, formatUnits } from './summaryText';

export const INSULIN_TYPE_COLUMNS = ['Tipo', 'Total', 'Registros'] as const;

/** One bar per insulin type: the total units logged. The type is the name the app recorded. */
export function insulinTypeRows(byType: readonly InsulinByType[]): ChartRow[] {
  return byType.map((entry) => ({ type: entry.insulinType, units: entry.totalUnits }));
}

/** The sentence for screen readers and the table behind "Ver como tabela", which adds the count of records. */
export function insulinTypeAlternative(byType: readonly InsulinByType[]): ChartAlternative {
  const parts = byType.map((entry) => `${entry.insulinType} ${formatUnits(entry.totalUnits)} em ${countOf(entry.count, 'registro', 'registros')}`);
  return {
    summary: `Insulina total por tipo: ${parts.length === 0 ? 'nenhum registro' : parts.join('; ')}.`,
    columns: INSULIN_TYPE_COLUMNS,
    rows: byType.map((entry) => [entry.insulinType, formatUnits(entry.totalUnits), formatNumber(entry.count, 0)]),
  };
}

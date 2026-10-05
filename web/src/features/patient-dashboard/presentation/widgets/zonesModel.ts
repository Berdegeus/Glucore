import { formatPercent } from '../../../../shared/presentation/format';
import { ZONE_COLORS } from '../../../../shared/presentation/charts/palette';
import type { ChartRow } from '../../../../shared/presentation/charts/chartTypes';
import type { GlucoseSummary } from '../../domain/summary';
import { GLUCOSE_ZONES, type GlucoseZone } from '../../domain/zones';
import type { ChartAlternative } from './chartWidget';

export const ZONE_LABELS: Readonly<Record<GlucoseZone, string>> = {
  veryLow: 'Muito baixa',
  low: 'Baixa',
  target: 'No alvo',
  high: 'Alta',
  veryHigh: 'Muito alta',
};

export const ZONES_COLUMNS = ['Zona', 'Percentual'] as const;

/** One segment per zone, from very low to very high, each in the hue of its zone. */
export const ZONE_SEGMENTS = GLUCOSE_ZONES.map((zone, index) => ({
  key: zone,
  label: ZONE_LABELS[zone],
  color: ZONE_COLORS[index] as string,
}));

/** The single row the stacked bar draws: a share per zone. */
export function zonesRow(distribution: GlucoseSummary['zoneDistribution']): ChartRow {
  return { period: 'Período', ...distribution };
}

/** The sentence for screen readers and the table behind "Ver como tabela". */
export function zonesAlternative(distribution: GlucoseSummary['zoneDistribution']): ChartAlternative {
  const shares = GLUCOSE_ZONES.map((zone) => `${ZONE_LABELS[zone].toLowerCase()} ${formatPercent(distribution[zone])}`);
  return {
    summary: `Distribuição do tempo em cinco zonas de glicose: ${shares.join(', ')}.`,
    columns: ZONES_COLUMNS,
    rows: GLUCOSE_ZONES.map((zone) => [ZONE_LABELS[zone], formatPercent(distribution[zone])]),
  };
}

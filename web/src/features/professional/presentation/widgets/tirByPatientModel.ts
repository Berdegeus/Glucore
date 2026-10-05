import { ZONE_COLORS } from '../../../../shared/presentation/charts/palette';
import type { ChartRow } from '../../../../shared/presentation/charts/chartTypes';
import { formatNumber, formatPercent } from '../../../../shared/presentation/format';
import type { CohortPatient, CohortSummary } from '../../domain/cohort';
import type { ZoneShares } from '../../domain/risk';
import type { CohortChartAlternative } from './cohortChartWidget';

type Zone = keyof ZoneShares;

/** The five zones from very low to very high, the order of the stacked bar and of the table. */
const ZONES: readonly Zone[] = ['veryLow', 'low', 'target', 'high', 'veryHigh'];

export const ZONE_LABELS: Readonly<Record<Zone, string>> = {
  veryLow: 'Muito baixa',
  low: 'Baixa',
  target: 'No alvo',
  high: 'Alta',
  veryHigh: 'Muito alta',
};

export const TIR_BY_PATIENT_COLUMNS = ['Paciente', ...ZONES.map((zone) => ZONE_LABELS[zone])] as const;

/** One segment per zone, each in the hue of its zone. */
export const ZONE_SEGMENTS = ZONES.map((zone, index) => ({ key: zone, label: ZONE_LABELS[zone], color: ZONE_COLORS[index] as string }));

const BAR_HEIGHT = 32;
const FRAME_HEIGHT = 96;
const MIN_HEIGHT = 160;
const MAX_LABEL_LENGTH = 11;

/** Room for one bar per patient, so a long list grows the chart instead of squeezing the bars. */
export const chartHeightFor = (patients: number): number => Math.max(MIN_HEIGHT, patients * BAR_HEIGHT + FRAME_HEIGHT);

/** The category axis has room for a short name; the table behind "Ver como tabela" has the whole one. */
export const shortLabel = (name: string): string => (name.length > MAX_LABEL_LENGTH ? `${name.slice(0, MAX_LABEL_LENGTH - 1)}…` : name);

/** Names with a repeated one told apart ("Ana", "Ana (2)"), because the axis would put two bars on one category. */
export function uniqueLabels(patients: readonly CohortPatient[]): string[] {
  const seen = new Map<string, number>();
  return patients.map(({ displayName }) => {
    const times = (seen.get(displayName) ?? 0) + 1;
    seen.set(displayName, times);
    return times === 1 ? displayName : `${displayName} (${times})`;
  });
}

/** One row per patient: the label and a share per zone. */
export function tirByPatientRows(patients: readonly CohortPatient[]): ChartRow[] {
  const labels = uniqueLabels(patients);
  return patients.map((patient, index) => ({ patient: labels[index] ?? patient.displayName, ...patient.zoneDistribution }));
}

/** The sentence for screen readers and the table behind "Ver como tabela". */
export function tirByPatientAlternative({ perPatient }: CohortSummary): CohortChartAlternative {
  const labels = uniqueLabels(perPatient);
  const count = perPatient.length;
  return {
    summary: `Distribuição do tempo nas cinco zonas de glicose de cada um dos ${formatNumber(count, 0)} ${count === 1 ? 'paciente' : 'pacientes'}.`,
    columns: TIR_BY_PATIENT_COLUMNS,
    rows: perPatient.map((patient, index) => [labels[index] ?? patient.displayName, ...ZONES.map((zone) => formatPercent(patient.zoneDistribution[zone]))]),
  };
}

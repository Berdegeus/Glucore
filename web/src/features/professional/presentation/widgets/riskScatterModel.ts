import type { QuadrantAxis, ScatterPoint } from '../../../../shared/presentation/charts/scatterQuadrantChart';
import { formatPercent } from '../../../../shared/presentation/format';
import type { CohortSummary } from '../../domain/cohort';
import { ATTENTION_CV_ABOVE, ATTENTION_TIR_BELOW } from '../../domain/risk';
import type { CohortChartAlternative } from './cohortChartWidget';
import { patientCountText } from './cohortText';

export const RISK_SCATTER_COLUMNS = ['Paciente', 'Tempo no alvo', 'CV'] as const;

const formatTick = (value: number) => formatPercent(value, 0);
const CV_STEP = 10;
const MIN_CV_TOP = 60;

/** TIR across, with the split at the limit where the risk rule starts to flag a patient. */
export const TIR_AXIS: QuadrantAxis = { label: 'Tempo no alvo (%)', threshold: ATTENTION_TIR_BELOW, domain: [0, 100], format: formatTick };

/** CV up, tall enough for the most variable patient, with the split at the limit of the risk rule. */
export function cvAxisFor(points: readonly ScatterPoint[]): QuadrantAxis {
  const tallest = Math.max(0, ...points.map((point) => point.y));
  const top = Math.max(MIN_CV_TOP, Math.ceil(tallest / CV_STEP) * CV_STEP);
  return { label: 'Variabilidade (CV, %)', threshold: ATTENTION_CV_ABOVE, domain: [0, top], format: formatTick };
}

/** One point per patient that has both a TIR and a CV; a patient missing either is left out of the chart. */
export function scatterPointsOf({ perPatient }: CohortSummary): ScatterPoint[] {
  return perPatient.flatMap(({ displayName, timeInRangePercent: x, cvPercent: y }) => (x === null || y === null ? [] : [{ label: displayName, x, y }]));
}

/** How many patients the chart leaves out for want of a TIR or a CV. */
export const omittedCount = (cohort: CohortSummary): number => cohort.perPatient.length - scatterPointsOf(cohort).length;

/** The sentence for screen readers, which says how many patients are missing, and the table behind "Ver como tabela". */
export function riskScatterAlternative(cohort: CohortSummary): CohortChartAlternative {
  const points = scatterPointsOf(cohort);
  const omitted = omittedCount(cohort);
  const lines = `TIR ${formatPercent(TIR_AXIS.threshold, 0)} e CV ${formatPercent(ATTENTION_CV_ABOVE, 0)}`;
  const base = `Dispersão do tempo no alvo (TIR) contra a variabilidade (CV) de ${patientCountText(points.length)}, com linhas em ${lines}.`;
  return {
    summary: omitted === 0 ? base : `${base} ${patientCountText(omitted)} sem TIR ou CV no período não ${omitted === 1 ? 'aparece' : 'aparecem'}.`,
    columns: RISK_SCATTER_COLUMNS,
    rows: points.map((point) => [point.label, formatPercent(point.x), formatPercent(point.y)]),
  };
}

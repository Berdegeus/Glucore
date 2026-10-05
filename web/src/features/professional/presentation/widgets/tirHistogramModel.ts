import type { ChartRow } from '../../../../shared/presentation/charts/chartTypes';
import { formatNumber } from '../../../../shared/presentation/format';
import type { CohortSummary, TirBucket } from '../../domain/cohort';
import type { CohortChartAlternative } from './cohortChartWidget';
import { patientCountText } from './cohortText';

/** The bands from the worst time in range to the goal: below 50 %, 50 to 70 % and 70 % or more. */
const BUCKETS: readonly TirBucket[] = ['lt50', '50to70', 'gte70'];

export const BUCKET_LABELS: Readonly<Record<TirBucket, string>> = {
  lt50: '< 50 %',
  '50to70': '50–70 %',
  gte70: '≥ 70 %',
};

export const TIR_HISTOGRAM_COLUMNS = ['Faixa de TIR', 'Pacientes'] as const;

/** How many patients each band has, in band order; a band the gateway left out has none. */
function countsOf({ tirHistogram }: CohortSummary): [TirBucket, number][] {
  return BUCKETS.map((bucket) => [bucket, tirHistogram.find((band) => band.bucket === bucket)?.count ?? 0]);
}

/** One row per band: its label and the number of patients. */
export function tirHistogramRows(cohort: CohortSummary): ChartRow[] {
  return countsOf(cohort).map(([bucket, count]) => ({ band: BUCKET_LABELS[bucket], count }));
}

/** The sentence for screen readers and the table behind "Ver como tabela". */
export function tirHistogramAlternative(cohort: CohortSummary): CohortChartAlternative {
  const counts = countsOf(cohort);
  const shares = counts.map(([bucket, count]) => `${BUCKET_LABELS[bucket]}: ${patientCountText(count)}`);
  return {
    summary: `Pacientes por faixa de tempo no alvo (TIR): ${shares.join('; ')}.`,
    columns: TIR_HISTOGRAM_COLUMNS,
    rows: counts.map(([bucket, count]) => [BUCKET_LABELS[bucket], formatNumber(count, 0)]),
  };
}

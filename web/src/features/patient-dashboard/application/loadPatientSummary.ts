import type { TimeZoneProvider } from '../../../shared/domain/ports';
import { validateCustom, type DateRange } from '../domain/period';
import type { GlucoseSummary, SummaryRepository } from '../domain/summary';

export interface LoadPatientSummaryDeps {
  summaries: SummaryRepository;
  /** The browser's zone: the days of the summary are cut in it (API-01). */
  timeZone: TimeZoneProvider;
}

export interface LoadPatientSummaryInput {
  range: DateRange;
  /** Set to read a linked patient's summary instead of the signed-in patient's. */
  patientId?: string;
}

export type LoadPatientSummary = (input: LoadPatientSummaryInput) => Promise<GlucoseSummary>;

/** What the summary hooks need; the app passes `container.useCases.summary`. */
export interface SummaryUseCases {
  loadPatientSummary: LoadPatientSummary;
}

/**
 * Loads the summary of a period (PAC-01 to PAC-03). The period is checked by
 * the domain rule first: one that is refused (PAC-04) fails with the
 * `validation` error and the repository is never called. The browser zone
 * always goes along; `patientId` switches the scope to a linked patient.
 */
export function createLoadPatientSummary({ summaries, timeZone }: LoadPatientSummaryDeps): LoadPatientSummary {
  return async ({ range, patientId }) => {
    const checked = validateCustom(range.from, range.to);
    if (!checked.ok) throw checked.error;
    const query = { range: checked.range, timeZone: timeZone.timeZone() };
    return summaries.load(patientId === undefined ? query : { ...query, patientId });
  };
}

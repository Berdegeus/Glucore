import type { FetchHttpClient } from '../../../shared/infrastructure/http/fetchHttpClient';
import { parseDto } from '../../../shared/infrastructure/http/parseDto';
import type { GlucoseSummary, SummaryQuery, SummaryRepository } from '../domain/summary';
import { toSummary } from './mappers';
import { SummaryDtoSchema } from './schemas';

const OWN_PATH = '/dashboard/summary';
const professionalPath = (patientId: string) => `/professional/patients/${encodeURIComponent(patientId)}/summary`;

/**
 * `GET /dashboard/summary` for the signed-in patient, or `GET
 * /professional/patients/:id/summary` for a linked patient (PAC-01). Both take
 * `from`, `to` and `tz` and answer the same shape. `tz` always goes along, so
 * the days are the patient's local days and not UTC's (API-01). `400
 * INVALID_DASHBOARD_RANGE` and `INVALID_TIMEZONE` surface as `validation`
 * errors that carry the code.
 */
export class HttpSummaryRepository implements SummaryRepository {
  constructor(private readonly http: Pick<FetchHttpClient, 'request'>) {}

  async load({ range, timeZone, patientId }: SummaryQuery): Promise<GlucoseSummary> {
    const path = patientId === undefined ? OWN_PATH : professionalPath(patientId);
    const query = new URLSearchParams({ from: range.from, to: range.to, tz: timeZone });
    const payload = await this.http.request({ path: `${path}?${query.toString()}` });
    // The endpoint label leaves the id and the query out: they name a patient.
    const label = patientId === undefined ? OWN_PATH : '/professional/patients/:id/summary';
    return toSummary(parseDto(SummaryDtoSchema, payload, `GET ${label}`));
  }
}

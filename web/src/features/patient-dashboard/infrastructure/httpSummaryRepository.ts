import { createRepository, type HttpGateway, type RepositoryHttp } from '../../../shared/infrastructure/http/createRepository';
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
  private readonly api: RepositoryHttp;

  constructor(http: HttpGateway) {
    this.api = createRepository(http);
  }

  async load({ range, timeZone, patientId }: SummaryQuery): Promise<GlucoseSummary> {
    const path = patientId === undefined ? OWN_PATH : professionalPath(patientId);
    const query = new URLSearchParams({ from: range.from, to: range.to, tz: timeZone });
    // The endpoint label leaves the id out: it names a patient.
    const label = patientId === undefined ? OWN_PATH : '/professional/patients/:id/summary';
    return toSummary(await this.api.fetchDto({ path: `${path}?${query.toString()}` }, SummaryDtoSchema, `GET ${label}`));
  }
}

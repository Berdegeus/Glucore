import { createRepository, type HttpGateway, type RepositoryHttp } from '../../../shared/infrastructure/http/createRepository';
import type { CohortQuery, CohortSummary, PatientPage, PatientsQuery, ProfessionalRepository } from '../domain/cohort';
import { toCohortSummary, toPatientPage } from './mappers';
import { CohortSummaryDtoSchema, PatientPageDtoSchema } from './schemas';

/**
 * `GET /professional/patients` and `GET /professional/cohort/summary` (PRO-03,
 * PRO-09, PRO-10). A patient the gateway could not name comes with `fullName:
 * null` and its initials (PRO-15). `403 NO_ACTIVE_GRANT` surfaces as a
 * `forbidden` error that carries the code, so the caller can drop the patient
 * (PRO-13); `FORBIDDEN_ROLE` is the same kind with another code.
 */
export class HttpProfessionalRepository implements ProfessionalRepository {
  private readonly api: RepositoryHttp;

  constructor(http: HttpGateway) {
    this.api = createRepository(http);
  }

  async listPatients({ days, page, limit, timeZone }: PatientsQuery): Promise<PatientPage> {
    const query = new URLSearchParams({ days: String(days), page: String(page), limit: String(limit), tz: timeZone });
    return toPatientPage(await this.api.fetchDto({ path: `/professional/patients?${query.toString()}` }, PatientPageDtoSchema));
  }

  async cohort({ days, timeZone }: CohortQuery): Promise<CohortSummary> {
    const query = new URLSearchParams({ days: String(days), tz: timeZone });
    return toCohortSummary(await this.api.fetchDto({ path: `/professional/cohort/summary?${query.toString()}` }, CohortSummaryDtoSchema));
  }
}

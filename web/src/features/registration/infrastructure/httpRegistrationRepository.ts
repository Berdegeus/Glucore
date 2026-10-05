import { createRepository, type HttpGateway, type RepositoryHttp } from '../../../shared/infrastructure/http/createRepository';
import type { ProfessionalRegistration, RegistrationRepository, RegistrationResult } from '../domain/registration';
import { RegistrationDtoSchema } from './schemas';

/**
 * `POST /auth/register/professional` (REG-01). Public: it needs no bearer.
 * The client turns `400` into `validation` (`WEAK_PASSWORD` or a bad field),
 * `409 EMAIL_TAKEN` into `conflict` and `429` into `rate-limited` (REG-03,
 * REG-07); each carries the API's `code`.
 */
export class HttpRegistrationRepository implements RegistrationRepository {
  private readonly api: RepositoryHttp;

  constructor(http: HttpGateway) {
    this.api = createRepository(http);
  }

  async registerProfessional(registration: ProfessionalRegistration): Promise<RegistrationResult> {
    const { userId, token } = await this.api.fetchDto(
      { method: 'POST', path: '/auth/register/professional', body: registration },
      RegistrationDtoSchema,
    );
    return { userId, token };
  }
}

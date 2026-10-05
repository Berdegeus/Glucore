import { createRepository, type HttpGateway, type RepositoryHttp } from '../../../shared/infrastructure/http/createRepository';
import type { Credentials, SessionRepository } from '../domain/ports';
import { toAccessToken } from './mappers';
import { TokenDtoSchema } from './schemas';

/**
 * Token endpoints over HTTP (ACC-01, ACC-10). Paths are relative to the base
 * URL, which already carries `/api/v1`. Status codes become `AppError`s in the
 * client (`401` -> `invalid-credentials`, `429` -> `rate-limited`).
 */
export class HttpSessionRepository implements SessionRepository {
  private readonly api: RepositoryHttp;

  constructor(http: HttpGateway) {
    this.api = createRepository(http);
  }

  async login(credentials: Credentials): Promise<string> {
    const dto = await this.api.fetchDto(
      { method: 'POST', path: '/auth/login', body: { email: credentials.email, password: credentials.password } },
      TokenDtoSchema,
    );
    return toAccessToken(dto);
  }

  async refresh(): Promise<string> {
    return toAccessToken(await this.api.fetchDto({ method: 'POST', path: '/auth/refresh' }, TokenDtoSchema));
  }
}

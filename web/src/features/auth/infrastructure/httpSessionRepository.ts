import type { FetchHttpClient } from '../../../shared/infrastructure/http/fetchHttpClient';
import { parseDto } from '../../../shared/infrastructure/http/parseDto';
import type { Credentials, SessionRepository } from '../domain/ports';
import { toAccessToken } from './mappers';
import { TokenDtoSchema } from './schemas';

/**
 * Token endpoints over HTTP (ACC-01, ACC-10). Paths are relative to the base
 * URL, which already carries `/api/v1`. Status codes become `AppError`s in the
 * client (`401` -> `invalid-credentials`, `429` -> `rate-limited`).
 */
export class HttpSessionRepository implements SessionRepository {
  constructor(private readonly http: Pick<FetchHttpClient, 'request'>) {}

  async login(credentials: Credentials): Promise<string> {
    const payload = await this.http.request({
      method: 'POST',
      path: '/auth/login',
      body: { email: credentials.email, password: credentials.password },
    });
    return toAccessToken(parseDto(TokenDtoSchema, payload, 'POST /auth/login'));
  }

  async refresh(): Promise<string> {
    const payload = await this.http.request({ method: 'POST', path: '/auth/refresh' });
    return toAccessToken(parseDto(TokenDtoSchema, payload, 'POST /auth/refresh'));
  }
}

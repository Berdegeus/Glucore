import { createRepository, type HttpGateway, type RepositoryHttp } from '../../../shared/infrastructure/http/createRepository';
import type { PasswordRecoveryRepository } from '../domain/passwordRecovery';

/**
 * `POST /auth/forgot-password` and `POST /auth/reset-password`. Both are public
 * and answer with a message nobody reads. The client turns `400` into
 * `validation` (a refused token carries no `code`; a weak password carries
 * `WEAK_PASSWORD`) and `429` into `rate-limited`.
 */
export class HttpPasswordRecoveryRepository implements PasswordRecoveryRepository {
  private readonly api: RepositoryHttp;

  constructor(http: HttpGateway) {
    this.api = createRepository(http);
  }

  requestReset(email: string): Promise<void> {
    return this.api.send({ method: 'POST', path: '/auth/forgot-password', body: { email } });
  }

  resetPassword({ token, password }: { token: string; password: string }): Promise<void> {
    return this.api.send({ method: 'POST', path: '/auth/reset-password', body: { token, password } });
  }
}

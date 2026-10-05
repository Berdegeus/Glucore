import { createRepository, type HttpGateway, type RepositoryHttp } from '../../../shared/infrastructure/http/createRepository';
import type { Account } from '../domain/account';
import type { AccountRepository } from '../domain/ports';
import { toAccount } from './mappers';
import { AccountDtoSchema } from './schemas';

/** `GET /me` over HTTP (ACC-01): the account and its role, whatever extra blocks come with it. */
export class HttpAccountRepository implements AccountRepository {
  private readonly api: RepositoryHttp;

  constructor(http: HttpGateway) {
    this.api = createRepository(http);
  }

  async current(): Promise<Account> {
    return toAccount(await this.api.fetchDto({ path: '/me' }, AccountDtoSchema));
  }
}

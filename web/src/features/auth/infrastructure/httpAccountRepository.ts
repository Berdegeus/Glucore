import type { FetchHttpClient } from '../../../shared/infrastructure/http/fetchHttpClient';
import { parseDto } from '../../../shared/infrastructure/http/parseDto';
import type { Account } from '../domain/account';
import type { AccountRepository } from '../domain/ports';
import { toAccount } from './mappers';
import { AccountDtoSchema } from './schemas';

/** `GET /me` over HTTP (ACC-01): the account and its role, whatever extra blocks come with it. */
export class HttpAccountRepository implements AccountRepository {
  constructor(private readonly http: Pick<FetchHttpClient, 'request'>) {}

  async current(): Promise<Account> {
    const payload = await this.http.request({ path: '/me' });
    return toAccount(parseDto(AccountDtoSchema, payload, 'GET /me'));
  }
}

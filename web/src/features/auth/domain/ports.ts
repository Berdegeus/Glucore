// Ports of the auth feature (ARQ-05). The use cases depend on these; the
// `infrastructure` folder implements them over HTTP.

import type { Account } from './account';

export interface Credentials {
  email: string;
  password: string;
}

/** The token endpoints. Both answer with the new access token. */
export interface SessionRepository {
  /** Rejects with `invalid-credentials` on a wrong e-mail or password (ACC-07). */
  login(credentials: Credentials): Promise<string>;
  /** Trades the current token (sent as the bearer) for a fresh one (ACC-10). */
  refresh(): Promise<string>;
}

export interface AccountRepository {
  /** The account behind the stored token, including its role (ACC-01). */
  current(): Promise<Account>;
}

/** Reads when a token expires. It authorizes nothing. */
export interface TokenExpiryReader {
  expiresAt(token: string): Date | null;
}

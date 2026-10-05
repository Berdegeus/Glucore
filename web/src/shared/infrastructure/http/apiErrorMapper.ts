import { AppError, type AppErrorKind } from '../../domain/appError';

/** The only code that ends a session; any other 401 keeps the user signed in. */
export const TOKEN_INVALID = 'TOKEN_INVALID';

const KIND_BY_STATUS: Readonly<Record<number, AppErrorKind>> = {
  400: 'validation',
  403: 'forbidden',
  404: 'not-found',
  409: 'conflict',
  502: 'unavailable',
  503: 'unavailable',
  504: 'unavailable',
};

/** The backend answers errors as `{ error, code }`; `code` is optional. */
function codeOf(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const { code } = body as { code?: unknown };
  return typeof code === 'string' ? code : undefined;
}

/** `Retry-After` in delta-seconds; anything else is treated as absent. */
function retryAfterSecondsOf(headers: Headers): number | undefined {
  const raw = headers.get('Retry-After')?.trim();
  return raw && /^\d+$/.test(raw) ? Number(raw) : undefined;
}

function kindOf(status: number, code: string | undefined): AppErrorKind {
  if (status === 401) return code === TOKEN_INVALID ? 'unauthenticated' : 'invalid-credentials';
  if (status === 429) return 'rate-limited';
  return KIND_BY_STATUS[status] ?? 'unknown';
}

/** Translates a failed HTTP response into the app's single error type (ARQ-06). */
export function mapApiError(status: number, body: unknown, headers: Headers): AppError {
  const code = codeOf(body);
  const kind = kindOf(status, code);
  const retryAfterSeconds = kind === 'rate-limited' ? retryAfterSecondsOf(headers) : undefined;
  return new AppError(kind, { code, retryAfterSeconds });
}

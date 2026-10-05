import { AppError } from '../../domain/appError';
import type { SessionEvents, TokenStore } from '../../domain/ports';
import { mapApiError } from './apiErrorMapper';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface HttpRequest {
  method?: HttpMethod;
  /** Path below the base URL, query string included, e.g. `/me`; the base URL already carries `/api/v1`. */
  path: string;
  /** Serialized as JSON when present. */
  body?: unknown;
}

export interface FetchHttpClientDeps {
  baseUrl: string;
  tokenStore: TokenStore;
  sessionEvents: SessionEvents;
}

/** Reads a body that may be empty or not JSON (a proxy's HTML error page). */
async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * Adapter over `fetch` (ARQ-06): adds the bearer token, speaks JSON and turns
 * every failure into an `AppError`. A `401 TOKEN_INVALID` clears the token and
 * publishes the expiry; the bus makes simultaneous failures notify once (ACC-09).
 * The payload comes back unvalidated: repositories check it with `parseDto`.
 */
export class FetchHttpClient {
  private readonly baseUrl: string;

  constructor(private readonly deps: FetchHttpClientDeps) {
    this.baseUrl = deps.baseUrl.replace(/\/+$/, '');
  }

  async request({ method = 'GET', path, body }: HttpRequest): Promise<unknown> {
    const response = await this.send(method, path, body);
    const payload = await readBody(response);
    if (response.ok) return payload;
    throw this.fail(response, payload);
  }

  private async send(method: HttpMethod, path: string, body: unknown): Promise<Response> {
    const init: RequestInit = { method, headers: this.headers(body !== undefined) };
    if (body !== undefined) init.body = JSON.stringify(body);
    try {
      return await fetch(`${this.baseUrl}${path}`, init);
    } catch {
      // The gateway is down or the network dropped: nothing answered.
      throw new AppError('unavailable');
    }
  }

  private headers(hasBody: boolean): Headers {
    const headers = new Headers({ Accept: 'application/json' });
    if (hasBody) headers.set('Content-Type', 'application/json');
    const token = this.deps.tokenStore.read();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }

  private fail(response: Response, payload: unknown): AppError {
    const error = mapApiError(response.status, payload, response.headers);
    if (error.kind === 'unauthenticated') {
      this.deps.tokenStore.clear();
      this.deps.sessionEvents.emitExpired();
    }
    return error;
  }
}

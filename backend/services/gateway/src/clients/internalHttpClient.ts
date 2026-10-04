import { signInternalToken, type InternalTokenClaims, type ServiceRegistry } from '@glucore/shared';

import { UpstreamHttpError, UpstreamUnavailableError } from './errors';

/**
 * Every call to `/internal/*` on a downstream service, in one place: resolves
 * the target through the registry, signs a fresh internal token per call (its
 * 60s TTL means one signed for a slow retry could expire before it lands),
 * and turns a non-2xx response into an error the shared error handler already
 * knows how to answer, via `upstreamClassifier`.
 */
export class InternalHttpClient {
  constructor(
    private readonly registry: ServiceRegistry,
    private readonly serviceName: string,
    private readonly internalJwtSecret: string,
  ) {}

  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    identity: InternalTokenClaims,
    body?: unknown,
  ): Promise<T> {
    const baseUrl = await this.registry.resolve(this.serviceName);
    const token = signInternalToken(identity, this.internalJwtSecret);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          'x-internal-token': token,
          // Observability only — the receiving service must never trust these
          // over the verified token (see requireInternalAuth).
          'x-user-id': identity.sub,
          'x-user-role': identity.role,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new UpstreamUnavailableError(`${this.serviceName} is unreachable`);
    }

    if (response.status === 204) return undefined as T;

    const text = await response.text();
    const json: unknown = text.length > 0 ? JSON.parse(text) : undefined;

    if (!response.ok) {
      const errorBody = json as { error?: string; code?: string } | undefined;
      throw new UpstreamHttpError(
        response.status,
        errorBody?.code,
        errorBody?.error ?? 'Upstream request failed',
      );
    }

    return json as T;
  }
}

import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../domain/appError';
import { server } from '../../../test/server';
import { SessionEventBus } from '../events/sessionEventBus';
import { SessionTokenStore } from '../storage/sessionTokenStore';
import { FetchHttpClient } from './fetchHttpClient';

const API = 'http://api.test';
const TOKEN = 'header.payload.signature';

function setup(token: string | null = TOKEN) {
  const tokenStore = new SessionTokenStore();
  if (token) tokenStore.save(token);
  const sessionEvents = new SessionEventBus();
  const onExpired = vi.fn();
  sessionEvents.subscribe(onExpired);
  // The trailing slash checks that the base URL and the path join cleanly.
  const client = new FetchHttpClient({ baseUrl: `${API}/`, tokenStore, sessionEvents });
  return { client, tokenStore, onExpired };
}

/** Awaits a request expected to fail and returns its AppError. */
async function failureOf(promise: Promise<unknown>): Promise<AppError> {
  const error: unknown = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(AppError);
  return error as AppError;
}

afterEach(() => window.sessionStorage.clear());

describe('FetchHttpClient: requests (ARQ-06)', () => {
  it('sends the bearer token and a JSON body, and returns the JSON answer', async () => {
    let seen: { authorization: string | null; contentType: string | null; body: unknown } | undefined;
    server.use(
      http.post(`${API}/api/v1/carbs`, async ({ request }) => {
        seen = {
          authorization: request.headers.get('Authorization'),
          contentType: request.headers.get('Content-Type'),
          body: await request.json(),
        };
        return HttpResponse.json({ id: 'c1' }, { status: 201 });
      }),
    );
    const { client } = setup();

    const result = await client.request({ method: 'POST', path: '/api/v1/carbs', body: { grams: 30 } });

    expect(seen).toEqual({
      authorization: `Bearer ${TOKEN}`,
      contentType: 'application/json',
      body: { grams: 30 },
    });
    expect(result).toEqual({ id: 'c1' });
  });

  it('sends no Authorization header when there is no token', async () => {
    let authorization: string | null = 'unset';
    server.use(
      http.get(`${API}/api/v1/public`, ({ request }) => {
        authorization = request.headers.get('Authorization');
        return HttpResponse.json({});
      }),
    );

    await setup(null).client.request({ path: '/api/v1/public' });

    expect(authorization).toBeNull();
  });

  it('resolves a 204 with no body to undefined', async () => {
    server.use(http.delete(`${API}/api/v1/preferences/dashboard`, () => new HttpResponse(null, { status: 204 })));

    const result = await setup().client.request({ method: 'DELETE', path: '/api/v1/preferences/dashboard' });

    expect(result).toBeUndefined();
  });
});

describe('FetchHttpClient: failures', () => {
  it('turns a network failure into unavailable', async () => {
    server.use(http.get(`${API}/api/v1/me`, () => HttpResponse.error()));

    const error = await failureOf(setup().client.request({ path: '/api/v1/me' }));

    expect(error.kind).toBe('unavailable');
  });

  it('maps an error whose body is not JSON without breaking', async () => {
    server.use(
      http.get(`${API}/api/v1/me`, () =>
        HttpResponse.html('<html><body>Bad Gateway</body></html>', { status: 502 }),
      ),
    );

    const error = await failureOf(setup().client.request({ path: '/api/v1/me' }));

    expect(error.kind).toBe('unavailable');
    expect(error.code).toBeUndefined();
  });

  it('exposes Retry-After of a 429 as retryAfterSeconds', async () => {
    server.use(
      http.get(`${API}/api/v1/dashboard/summary`, () =>
        HttpResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': '60' } }),
      ),
    );

    const error = await failureOf(setup().client.request({ path: '/api/v1/dashboard/summary' }));

    expect(error.kind).toBe('rate-limited');
    expect(error.retryAfterSeconds).toBe(60);
  });

  it('turns a 503 into unavailable', async () => {
    server.use(
      http.get(`${API}/api/v1/dashboard/summary`, () =>
        HttpResponse.json({ error: 'Database unavailable', code: 'DATABASE_UNAVAILABLE' }, { status: 503 }),
      ),
    );

    const error = await failureOf(setup().client.request({ path: '/api/v1/dashboard/summary' }));

    expect(error.kind).toBe('unavailable');
  });
});

describe('FetchHttpClient: session expiry (ACC-09)', () => {
  it('clears the token and publishes expired once when three calls get 401 TOKEN_INVALID together', async () => {
    server.use(
      http.get(`${API}/api/v1/*`, () =>
        HttpResponse.json({ error: 'Invalid token', code: 'TOKEN_INVALID' }, { status: 401 }),
      ),
    );
    const { client, tokenStore, onExpired } = setup();

    const errors = await Promise.all(
      ['/api/v1/me', '/api/v1/dashboard/summary', '/api/v1/preferences/dashboard'].map((path) =>
        failureOf(client.request({ path })),
      ),
    );

    expect(errors.map((error) => error.kind)).toEqual(['unauthenticated', 'unauthenticated', 'unauthenticated']);
    expect(tokenStore.read()).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('keeps the session on a 401 with any other code', async () => {
    server.use(
      http.put(`${API}/api/v1/auth/profile`, () =>
        HttpResponse.json({ error: 'Invalid password', code: 'INVALID_CURRENT_PASSWORD' }, { status: 401 }),
      ),
    );
    const { client, tokenStore, onExpired } = setup();

    const error = await failureOf(client.request({ method: 'PUT', path: '/api/v1/auth/profile', body: {} }));

    expect(error.kind).toBe('invalid-credentials');
    expect(tokenStore.read()).toBe(TOKEN);
    expect(onExpired).not.toHaveBeenCalled();
  });
});

import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../shared/domain/appError';
import { API_BASE, createTestHttpClient, rejectionOf } from '../../../test/httpClient';
import { server } from '../../../test/server';
import { HttpSessionRepository } from './httpSessionRepository';

const CREDENTIALS = { email: 'ana@example.com', password: 'Senha123!' };
const LOGIN_URL = `${API_BASE}/auth/login`;
const REFRESH_URL = `${API_BASE}/auth/refresh`;

function setup(token: string | null = null) {
  const { client, tokenStore, sessionEvents } = createTestHttpClient(token);
  const onExpired = vi.fn();
  sessionEvents.subscribe(onExpired);
  return { repository: new HttpSessionRepository(client), tokenStore, onExpired };
}

afterEach(() => window.sessionStorage.clear());

describe('HttpSessionRepository.login (ACC-01, ACC-07, ACC-08)', () => {
  it('posts the credentials without a bearer and turns { token } into the access token', async () => {
    let seen: { authorization: string | null; body: unknown } | undefined;
    server.use(
      http.post(LOGIN_URL, async ({ request }) => {
        seen = { authorization: request.headers.get('Authorization'), body: await request.json() };
        return HttpResponse.json({ token: 'tok-1', ignored: true });
      }),
    );

    const token = await setup().repository.login(CREDENTIALS);

    expect(token).toBe('tok-1');
    expect(seen).toEqual({ authorization: null, body: CREDENTIALS });
  });

  it('turns 401 into invalid-credentials without ending any session', async () => {
    server.use(http.post(LOGIN_URL, () => HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })));
    const { repository, onExpired } = setup();

    const error = await rejectionOf(repository.login(CREDENTIALS));

    expect(error).toMatchObject({ kind: 'invalid-credentials' });
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('turns 429 into rate-limited and reads Retry-After', async () => {
    server.use(
      http.post(LOGIN_URL, () =>
        HttpResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': '42' } }),
      ),
    );

    const error = await rejectionOf(setup().repository.login(CREDENTIALS));

    expect(error).toMatchObject({ kind: 'rate-limited', retryAfterSeconds: 42 });
  });

  it('turns 400 into validation', async () => {
    server.use(http.post(LOGIN_URL, () => HttpResponse.json({ error: 'Invalid input' }, { status: 400 })));

    expect(await rejectionOf(setup().repository.login(CREDENTIALS))).toMatchObject({ kind: 'validation' });
  });

  it('turns an unreachable gateway into unavailable', async () => {
    server.use(http.post(LOGIN_URL, () => HttpResponse.error()));

    expect(await rejectionOf(setup().repository.login(CREDENTIALS))).toMatchObject({ kind: 'unavailable' });
  });

  it.each([
    ['without a token', {}],
    ['with an empty token', { token: '' }],
    ['with a non-string token', { token: 123 }],
  ])('turns a body %s into unknown, naming the endpoint', async (_label, body) => {
    server.use(http.post(LOGIN_URL, () => HttpResponse.json(body)));

    const error = await rejectionOf(setup().repository.login(CREDENTIALS));

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ kind: 'unknown' });
    expect((error as AppError).message).toContain('POST /auth/login');
  });

  it('turns a non-JSON body into unknown', async () => {
    server.use(http.post(LOGIN_URL, () => new HttpResponse('<html>bad gateway</html>')));

    expect(await rejectionOf(setup().repository.login(CREDENTIALS))).toMatchObject({ kind: 'unknown' });
  });
});

describe('HttpSessionRepository.refresh (ACC-10)', () => {
  it('posts with the current bearer and returns the new token', async () => {
    let authorization: string | null = null;
    server.use(
      http.post(REFRESH_URL, ({ request }) => {
        authorization = request.headers.get('Authorization');
        return HttpResponse.json({ token: 'tok-2' });
      }),
    );

    const token = await setup('tok-1').repository.refresh();

    expect(token).toBe('tok-2');
    expect(authorization).toBe('Bearer tok-1');
  });

  it('turns 401 TOKEN_INVALID into unauthenticated and ends the session once', async () => {
    server.use(
      http.post(REFRESH_URL, () => HttpResponse.json({ error: 'Invalid token', code: 'TOKEN_INVALID' }, { status: 401 })),
    );
    const { repository, tokenStore, onExpired } = setup('tok-1');

    expect(await rejectionOf(repository.refresh())).toMatchObject({ kind: 'unauthenticated', code: 'TOKEN_INVALID' });

    expect(tokenStore.read()).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('turns a body without a token into unknown', async () => {
    server.use(http.post(REFRESH_URL, () => HttpResponse.json({})));

    expect(await rejectionOf(setup('tok-1').repository.refresh())).toMatchObject({ kind: 'unknown' });
  });
});

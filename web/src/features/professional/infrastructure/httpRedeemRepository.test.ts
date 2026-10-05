import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { API_BASE, createTestHttpClient, rejectionOf } from '../../../test/httpClient';
import { server } from '../../../test/server';
import { HttpRedeemRepository } from './httpRedeemRepository';

const URL_REDEEM = `${API_BASE}/sharing/redeem`;
const LINK = { patientId: 'p1', grantId: 'g1' };

const repository = (token: string | null = 'tok-1') => new HttpRedeemRepository(createTestHttpClient(token).client);

afterEach(() => window.sessionStorage.clear());

describe('HttpRedeemRepository.redeem (CON-04)', () => {
  it.each([
    [201, 'a new link'],
    [200, 'a patient already linked'],
  ])('turns %i (%s) into the link', async (status) => {
    server.use(http.post(URL_REDEEM, () => HttpResponse.json({ ...LINK, ignored: true }, { status })));

    expect(await repository().redeem('AB12CD34')).toEqual(LINK);
  });

  it('posts the code as given, with the bearer token', async () => {
    let seen: { body: unknown; authorization: string | null } | undefined;
    server.use(
      http.post(URL_REDEEM, async ({ request }) => {
        seen = { body: await request.json(), authorization: request.headers.get('Authorization') };
        return HttpResponse.json(LINK, { status: 201 });
      }),
    );

    await repository().redeem('AB12CD34');

    expect(seen).toEqual({ body: { code: 'AB12CD34' }, authorization: 'Bearer tok-1' });
  });
});

describe('HttpRedeemRepository errors (CON-05, CON-06)', () => {
  it('turns 400 INVALID_INVITE into validation with the code', async () => {
    server.use(http.post(URL_REDEEM, () => HttpResponse.json({ error: 'Código inválido ou expirado', code: 'INVALID_INVITE' }, { status: 400 })));

    expect(await rejectionOf(repository().redeem('NOPE'))).toMatchObject({ kind: 'validation', code: 'INVALID_INVITE' });
  });

  it('turns 429 into rate-limited and reads Retry-After', async () => {
    server.use(http.post(URL_REDEEM, () => HttpResponse.json({ error: 'Too many' }, { status: 429, headers: { 'Retry-After': '900' } })));

    expect(await rejectionOf(repository().redeem('AB12CD34'))).toMatchObject({ kind: 'rate-limited', retryAfterSeconds: 900 });
  });

  it('turns 403 into forbidden with the code', async () => {
    server.use(http.post(URL_REDEEM, () => HttpResponse.json({ error: 'Wrong role', code: 'FORBIDDEN_ROLE' }, { status: 403 })));

    expect(await rejectionOf(repository().redeem('AB12CD34'))).toMatchObject({ kind: 'forbidden', code: 'FORBIDDEN_ROLE' });
  });

  it('turns an unreachable gateway into unavailable', async () => {
    server.use(http.post(URL_REDEEM, () => HttpResponse.error()));

    expect(await rejectionOf(repository().redeem('AB12CD34'))).toMatchObject({ kind: 'unavailable' });
  });

  it.each([
    ['a missing grant id', { patientId: 'p1' }],
    ['an empty patient id', { patientId: '', grantId: 'g1' }],
  ])('rejects %s as an unexpected response without echoing the code', async (_label, payload) => {
    server.use(http.post(URL_REDEEM, () => HttpResponse.json(payload, { status: 201 })));

    const error = await rejectionOf(repository().redeem('SECRET99'));

    expect(error).toMatchObject({ kind: 'unknown' });
    expect((error as Error).message).toContain('POST /sharing/redeem');
    expect((error as Error).message).not.toContain('SECRET99');
  });
});

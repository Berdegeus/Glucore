import { http, HttpResponse, type JsonBodyType } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '../../../shared/domain/role';
import { API_BASE, createTestHttpClient, rejectionOf } from '../../../test/httpClient';
import { server } from '../../../test/server';
import { HttpAccountRepository } from './httpAccountRepository';

const ME_URL = `${API_BASE}/me`;

const ACCOUNT_BASE = {
  id: 'u1',
  email: 'ana@example.com',
  fullName: 'Ana Souza',
  phone: '(11) 98888-7777',
  status: 'ACTIVE',
  createdAt: '2026-05-03T19:08:32.000Z',
};

/** What the gateway sends per role: the account block plus the role's own block. */
const ME_BY_ROLE: Record<Role, Record<string, unknown>> = {
  PATIENT: {
    ...ACCOUNT_BASE,
    role: 'PATIENT',
    patient: { birthDate: '1990-04-23', diabetesType: 'TYPE_1', weightKg: 68.5, targetRangeMin: 80, targetRangeMax: 180 },
  },
  HEALTH_PROFESSIONAL: {
    ...ACCOUNT_BASE,
    role: 'HEALTH_PROFESSIONAL',
    professional: { licenseNumber: 'CRM-123456', specialty: 'Endocrinology' },
  },
  ADMINISTRATOR: { ...ACCOUNT_BASE, role: 'ADMINISTRATOR' },
};

function setup(token: string | null = 'tok-1') {
  const { client, tokenStore, sessionEvents } = createTestHttpClient(token);
  const onExpired = vi.fn();
  sessionEvents.subscribe(onExpired);
  return { repository: new HttpAccountRepository(client), tokenStore, onExpired };
}

const respondWith = (body: JsonBodyType, init?: ResponseInit) => server.use(http.get(ME_URL, () => HttpResponse.json(body, init)));

afterEach(() => window.sessionStorage.clear());

describe('HttpAccountRepository.current (ACC-01, ARQ-06)', () => {
  it.each<Role>(['PATIENT', 'HEALTH_PROFESSIONAL', 'ADMINISTRATOR'])('turns a %s response into an Account with that role', async (role) => {
    respondWith(ME_BY_ROLE[role]);

    const account = await setup().repository.current();

    expect(account).toEqual({ ...ACCOUNT_BASE, role });
  });

  it('sends the bearer token', async () => {
    let authorization: string | null = null;
    server.use(
      http.get(ME_URL, ({ request }) => {
        authorization = request.headers.get('Authorization');
        return HttpResponse.json(ME_BY_ROLE.PATIENT);
      }),
    );

    await setup('tok-1').repository.current();

    expect(authorization).toBe('Bearer tok-1');
  });

  it.each([
    ['null', { ...ACCOUNT_BASE, phone: null, role: 'PATIENT' }],
    ['absent', { ...ACCOUNT_BASE, phone: undefined, role: 'PATIENT' }],
  ])('maps a %s phone to null', async (_label, body) => {
    respondWith(body);

    expect((await setup().repository.current()).phone).toBeNull();
  });

  it('rejects an unknown role as unknown, naming the endpoint and not the value', async () => {
    respondWith({ ...ACCOUNT_BASE, role: 'NURSE' });

    const error = await rejectionOf(setup().repository.current());

    expect(error).toMatchObject({ kind: 'unknown' });
    expect((error as Error).message).toContain('GET /me');
    expect((error as Error).message).not.toContain('NURSE');
  });

  it.each(['id', 'email', 'fullName', 'status', 'role', 'createdAt'])('rejects a response without %s', async (field) => {
    respondWith({ ...ME_BY_ROLE.PATIENT, [field]: undefined });

    expect(await rejectionOf(setup().repository.current())).toMatchObject({ kind: 'unknown' });
  });

  it('turns 401 TOKEN_INVALID into unauthenticated and ends the session once', async () => {
    respondWith({ error: 'Invalid token', code: 'TOKEN_INVALID' }, { status: 401 });
    const { repository, tokenStore, onExpired } = setup();

    expect(await rejectionOf(repository.current())).toMatchObject({ kind: 'unauthenticated' });

    expect(tokenStore.read()).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('turns 503 into unavailable and keeps the token', async () => {
    respondWith({ error: 'Service unavailable' }, { status: 503 });
    const { repository, tokenStore } = setup();

    expect(await rejectionOf(repository.current())).toMatchObject({ kind: 'unavailable' });

    expect(tokenStore.read()).toBe('tok-1');
  });
});

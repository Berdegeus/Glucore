import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { API_BASE, createTestHttpClient, rejectionOf } from '../../../test/httpClient';
import { server } from '../../../test/server';
import type { ProfessionalRegistration } from '../domain/registration';
import { HttpRegistrationRepository } from './httpRegistrationRepository';

const URL = `${API_BASE}/auth/register/professional`;

const REGISTRATION: ProfessionalRegistration = {
  fullName: 'Ana Souza',
  email: 'ana@clinica.com',
  password: 'Senha123!',
  phone: '+55 11 99999-0000',
  licenseNumber: 'CRM-SP 123456',
  specialty: 'Endocrinologia',
};

const repository = () => new HttpRegistrationRepository(createTestHttpClient().client);

afterEach(() => window.sessionStorage.clear());

/** Answers the registration with `201`, and records the body it was sent. */
function answerCreated(extra: Record<string, unknown> = {}) {
  const received: { body?: unknown } = {};
  server.use(
    http.post(URL, async ({ request }) => {
      received.body = await request.json();
      return HttpResponse.json({ userId: 'u1', token: 'tok-1', ...extra }, { status: 201 });
    }),
  );
  return received;
}

describe('HttpRegistrationRepository.registerProfessional (REG-01)', () => {
  it('posts the registration and turns 201 { userId, token } into the result', async () => {
    const received = answerCreated({ ignored: true });

    const result = await repository().registerProfessional(REGISTRATION);

    expect(result).toEqual({ userId: 'u1', token: 'tok-1' });
    expect(received.body).toEqual(REGISTRATION);
  });

  it('leaves the phone out of the body when there is none', async () => {
    const received = answerCreated();
    const withoutPhone: ProfessionalRegistration = { ...REGISTRATION };
    delete withoutPhone.phone;

    await repository().registerProfessional(withoutPhone);

    expect(received.body).toEqual(withoutPhone);
    expect(received.body).not.toHaveProperty('phone');
  });
});

describe('HttpRegistrationRepository errors (REG-02, REG-03, REG-05, REG-07)', () => {
  it.each([
    [409, { error: 'Email already registered', code: 'EMAIL_TAKEN' }, { kind: 'conflict', code: 'EMAIL_TAKEN' }],
    [400, { error: 'Weak password', code: 'WEAK_PASSWORD' }, { kind: 'validation', code: 'WEAK_PASSWORD' }],
    [400, { error: 'Invalid input' }, { kind: 'validation', code: undefined }],
    [503, { error: 'Unavailable' }, { kind: 'unavailable' }],
  ])('turns %i into the matching error', async (status, body, expected) => {
    server.use(http.post(URL, () => HttpResponse.json(body, { status })));

    expect(await rejectionOf(repository().registerProfessional(REGISTRATION))).toMatchObject(expected);
  });

  it('turns 429 into rate-limited and reads Retry-After', async () => {
    server.use(
      http.post(URL, () => HttpResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': '900' } })),
    );

    expect(await rejectionOf(repository().registerProfessional(REGISTRATION))).toMatchObject({
      kind: 'rate-limited',
      retryAfterSeconds: 900,
    });
  });

  it('turns an unreachable gateway into unavailable', async () => {
    server.use(http.post(URL, () => HttpResponse.error()));

    expect(await rejectionOf(repository().registerProfessional(REGISTRATION))).toMatchObject({ kind: 'unavailable' });
  });

  it.each([
    ['a missing token', { userId: 'u1' }],
    ['an empty token', { userId: 'u1', token: '' }],
    ['a missing user id', { token: 'tok-1' }],
  ])('rejects %s as an unexpected response without echoing the body', async (_label, payload) => {
    server.use(http.post(URL, () => HttpResponse.json(payload, { status: 201 })));

    const error = await rejectionOf(repository().registerProfessional(REGISTRATION));

    expect(error).toMatchObject({ kind: 'unknown' });
    expect((error as Error).message).toContain('POST /auth/register/professional');
  });
});

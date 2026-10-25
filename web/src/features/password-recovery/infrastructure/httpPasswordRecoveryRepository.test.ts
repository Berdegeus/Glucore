import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../../shared/domain/appError';
import { API_BASE, createTestHttpClient, rejectionOf } from '../../../test/httpClient';
import { server } from '../../../test/server';
import { HttpPasswordRecoveryRepository } from './httpPasswordRecoveryRepository';

const repository = () => new HttpPasswordRecoveryRepository(createTestHttpClient().client);

describe('HttpPasswordRecoveryRepository', () => {
  it('posts the e-mail to /auth/forgot-password', async () => {
    let body: unknown;
    server.use(
      http.post(`${API_BASE}/auth/forgot-password`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ message: 'If the email is registered, instructions were sent.' });
      }),
    );
    await repository().requestReset('ana@clinica.com');
    expect(body).toEqual({ email: 'ana@clinica.com' });
  });

  it('posts the token and password to /auth/reset-password', async () => {
    let body: unknown;
    server.use(
      http.post(`${API_BASE}/auth/reset-password`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ message: 'Password reset successful.' });
      }),
    );
    await repository().resetPassword({ token: 'tok', password: 'Senha123!' });
    expect(body).toEqual({ token: 'tok', password: 'Senha123!' });
  });

  it('turns a refused token (400) into a validation error and 429 into rate-limited', async () => {
    server.use(http.post(`${API_BASE}/auth/reset-password`, () => HttpResponse.json({ error: 'Invalid or expired token' }, { status: 400 })));
    const refused = await rejectionOf(repository().resetPassword({ token: 'x', password: 'Senha123!' }));
    expect(refused).toBeInstanceOf(AppError);
    expect(refused).toMatchObject({ kind: 'validation' });

    server.use(http.post(`${API_BASE}/auth/forgot-password`, () => new HttpResponse(null, { status: 429 })));
    expect(await rejectionOf(repository().requestReset('ana@clinica.com'))).toMatchObject({ kind: 'rate-limited' });
  });
});

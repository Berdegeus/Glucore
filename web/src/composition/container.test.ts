import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '../test/server';
import { SessionEventBus } from '../shared/infrastructure/events/sessionEventBus';
import { createContainer } from './container';

// The gateway host comes from the environment; `/api/v1` is added in exactly
// one place, the container, so repositories only know paths like `/me`.
const HOST = 'http://gateway.test';
const API = `${HOST}/api/v1`;

const ME = {
  id: 'u1',
  email: 'ana@example.com',
  fullName: 'Ana Souza',
  phone: null,
  status: 'ACTIVE',
  role: 'HEALTH_PROFESSIONAL',
  createdAt: '2026-05-03T19:08:32.000Z',
};

function tokenExpiringAt(isoDate: string): string {
  const payload = btoa(JSON.stringify({ exp: Date.parse(isoDate) / 1000 }));
  return `header.${payload}.signature`;
}

afterEach(() => window.sessionStorage.clear());

describe('createContainer (ARQ-08)', () => {
  it('exposes the four auth use cases', () => {
    const { useCases } = createContainer({ apiUrl: HOST });

    expect(Object.keys(useCases.auth).sort()).toEqual(['login', 'logout', 'refreshSession', 'restoreSession']);
    for (const useCase of Object.values(useCases.auth)) expect(useCase).toBeTypeOf('function');
  });

  it('exposes the layout use cases, wired to /api/v1/preferences/dashboard', async () => {
    server.use(http.get(`${API}/preferences/dashboard`, () => HttpResponse.json({ widgets: null })));
    const { useCases } = createContainer({ apiUrl: HOST });

    expect(Object.keys(useCases.layout).sort()).toEqual(['loadLayout', 'resetLayout', 'saveLayout']);

    const loaded = await useCases.layout.loadLayout('PATIENT');

    expect(loaded.degraded).toBe(false);
    expect(loaded.layout.widgets.length).toBeGreaterThan(0);
  });

  it('builds one SessionEventBus, shared with the HTTP client', async () => {
    server.use(http.get(`${API}/me`, () => HttpResponse.json({ error: 'x', code: 'TOKEN_INVALID' }, { status: 401 })));
    const container = createContainer({ apiUrl: HOST });
    expect(container.sessionEvents).toBeInstanceOf(SessionEventBus);
    const onExpired = vi.fn();
    container.sessionEvents.subscribe(onExpired);
    container.tokenStore.save('stale-token');

    await container.useCases.auth.restoreSession();

    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('does not share the bus or the use cases between containers', () => {
    const first = createContainer({ apiUrl: HOST });
    const second = createContainer({ apiUrl: HOST });

    expect(first.sessionEvents).not.toBe(second.sessionEvents);
    expect(first.useCases.auth).not.toBe(second.useCases.auth);
  });

  it.each([HOST, `${HOST}/`])('logs in against the host %s, adding /api/v1 once, and keeps the token in the store', async (apiUrl) => {
    const token = tokenExpiringAt('2026-05-03T12:30:00.000Z');
    let meAuthorization: string | null = null;
    server.use(
      http.post(`${API}/auth/login`, () => HttpResponse.json({ token })),
      http.get(`${API}/me`, ({ request }) => {
        meAuthorization = request.headers.get('Authorization');
        return HttpResponse.json(ME);
      }),
    );
    const container = createContainer({ apiUrl });

    const session = await container.useCases.auth.login({ email: ME.email, password: 'Senha123!' });

    expect(session.account.role).toBe('HEALTH_PROFESSIONAL');
    expect(session.expiresAt).toEqual(new Date('2026-05-03T12:30:00.000Z'));
    expect(container.tokenStore.read()).toBe(token);
    expect(meAuthorization).toBe(`Bearer ${token}`);
  });

  it('runs registered session cleaners on logout until they unregister', () => {
    const container = createContainer({ apiUrl: HOST });
    const kept = vi.fn();
    const dropped = vi.fn();
    container.registerSessionCleaner(kept);
    container.registerSessionCleaner(dropped)();
    container.tokenStore.save('tok-1');

    container.useCases.auth.logout();

    expect(container.tokenStore.read()).toBeNull();
    expect(kept).toHaveBeenCalledTimes(1);
    expect(dropped).not.toHaveBeenCalled();
  });
});

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { SESSION_EXPIRED_MESSAGE } from '../features/auth';
import type { Role } from '../shared/domain/role';
import { mockApi } from '../test/apiMocks';
import { renderApp, where } from '../test/appHarness';
import { stubChartContainer } from '../test/chartContainer';
import { API_BASE } from '../test/httpClient';
import { server } from '../test/server';
import { NOT_FOUND_LINK, NOT_FOUND_TITLE } from './notFoundPage';

stubChartContainer();
// The first render of the page loads its chunks, which can pass the default 5 s on a busy machine.
vi.setConfig({ testTimeout: 30_000 });
const SLOW = { timeout: 10_000 };

/** One widget is enough to prove the page renders; the page's own tests cover all 16. */
const mockPatient = (role: Role | null = 'PATIENT') => mockApi({ role, layout: [{ id: 'kpi-tir', size: 'S' }] });

const dashboardHeading = () => screen.findByRole('heading', { level: 1, name: 'Meu painel' }, SLOW);

async function signIn(user = userEvent.setup()) {
  await user.type(await screen.findByLabelText('E-mail'), 'ana@example.com');
  await user.type(screen.getByLabelText('Senha'), 'secret-pass');
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('routes: sign in (ACC-02, ACC-04)', () => {
  it('lands a patient on /paciente with the dashboard', async () => {
    mockPatient();
    renderApp('/login');
    await signIn();

    expect(await dashboardHeading()).toBeInTheDocument();
    expect(where()).toBe('/paciente');
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });

  it('takes an anonymous visitor of /paciente to the login and back after signing in', async () => {
    mockPatient();
    renderApp('/paciente');

    expect(await screen.findByLabelText('E-mail')).toBeInTheDocument();
    expect(where()).toBe('/login?next=%2Fpaciente');
    expect(screen.queryByRole('heading', { name: 'Meu painel' })).not.toBeInTheDocument();

    await signIn();
    expect(await dashboardHeading()).toBeInTheDocument();
    expect(where()).toBe('/paciente');
  });

  it('opens the dashboard at once when a token is already stored', async () => {
    mockPatient();
    renderApp('/paciente', { token: 'token-1' });
    expect(await dashboardHeading()).toBeInTheDocument();
    expect(where()).toBe('/paciente');
  });
});

describe('routes: the home of each role (ACC-02, ACC-03)', () => {
  it.each<[Role, string]>([
    ['HEALTH_PROFESSIONAL', '/profissional'],
    ['ADMINISTRATOR', '/admin'],
  ])('redirects %s from /paciente to %s without drawing the patient dashboard', async (role, home) => {
    const api = mockPatient(role);
    renderApp('/paciente', { token: 'token-1' });

    await waitFor(() => expect(where()).toBe(home));
    expect(screen.queryByRole('heading', { name: 'Meu painel' })).not.toBeInTheDocument();
    // No widget of the route asked for was rendered, so none called the API (ACC-03).
    expect(api.summaryRequests).toHaveLength(0);
  });

  it('sends / to the login for an anonymous visitor', async () => {
    mockPatient();
    renderApp('/');
    expect(await screen.findByLabelText('E-mail')).toBeInTheDocument();
    expect(where()).toBe('/login');
  });

  it('sends / on to the home of a signed-in patient', async () => {
    mockPatient();
    renderApp('/', { token: 'token-1' });
    expect(await dashboardHeading()).toBeInTheDocument();
    expect(where()).toBe('/paciente');
  });
});

describe('routes: sign out and expiry (ACC-09, ACC-11)', () => {
  it('"Sair" returns to the plain /login', async () => {
    mockPatient();
    renderApp('/paciente', { token: 'token-1' });
    await dashboardHeading();

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

    expect(await screen.findByLabelText('E-mail')).toBeInTheDocument();
    expect(where()).toBe('/login');
    expect(screen.queryByText(SESSION_EXPIRED_MESSAGE)).not.toBeInTheDocument();
  });

  it('shows the expiry notice once on the login when several calls answer 401 TOKEN_INVALID', async () => {
    mockPatient();
    const expired = () => HttpResponse.json({ error: 'Invalid token', code: 'TOKEN_INVALID' }, { status: 401 });
    server.use(
      http.get(`${API_BASE}/dashboard/summary`, expired),
      http.get(`${API_BASE}/readings`, expired),
      http.get(`${API_BASE}/carbs`, expired),
    );
    renderApp('/paciente', { token: 'token-1' });

    expect(await screen.findByText(SESSION_EXPIRED_MESSAGE, undefined, SLOW)).toBeInTheDocument();
    expect(where()).toMatch(/^\/login/);
    expect(screen.getAllByText(SESSION_EXPIRED_MESSAGE)).toHaveLength(1);
  });
});

describe('routes: unknown path', () => {
  it('shows a not-found page that leads back to the start', async () => {
    mockPatient();
    renderApp('/nao-existe');

    expect(screen.getByRole('heading', { level: 1, name: NOT_FOUND_TITLE })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: NOT_FOUND_LINK }));
    expect(await screen.findByLabelText('E-mail')).toBeInTheDocument();
    expect(where()).toBe('/login');
  });
});

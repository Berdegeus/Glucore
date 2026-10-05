import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { SESSION_EXPIRED_MESSAGE } from '../features/auth';
import type { Role } from '../shared/domain/role';
import { mockAdmin } from '../test/adminHarness';
import { mockApi } from '../test/apiMocks';
import { renderApp, where } from '../test/appHarness';
import { stubChartContainer } from '../test/chartContainer';
import { API_BASE } from '../test/httpClient';
import { mockLayoutStore } from '../test/layoutStore';
import { mockLinkedPatientSummary, mockPortfolio } from '../test/professionalHarness';
import { server } from '../test/server';
import { NOT_FOUND_LINK, NOT_FOUND_TITLE } from './notFoundPage';

stubChartContainer();
// The first render of the page loads its chunks, which can pass the default 5 s on a busy machine.
vi.setConfig({ testTimeout: 30_000 });
const SLOW = { timeout: 10_000 };

/** One widget is enough to prove the page renders; the page's own tests cover all 16. */
const mockPatient = (role: Role | null = 'PATIENT') => mockApi({ role, layout: [{ id: 'kpi-tir', size: 'S' }] });

/** A professional's account over the gateway: one widget is enough to prove the page renders. */
function mockProfessional(role: Role | null = 'HEALTH_PROFESSIONAL') {
  mockApi({ role });
  mockLayoutStore([{ id: 'pro-kpi-patients', size: 'S' }]);
  return mockPortfolio();
}

const PATIENT_ID = '3f2b8c1e-5d4a-4e6f-9a7b-0c1d2e3f4a5b';
const PATIENT_PATH = `/profissional/pacientes/${PATIENT_ID}`;
const portfolioHeading = () => screen.findByRole('heading', { level: 1, name: 'Meus pacientes' }, SLOW);

const adminHeading = () => screen.findByRole('heading', { level: 1, name: 'Painel da plataforma' }, SLOW);

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
  it.skip.each<[Role, string, string]>([
    ['HEALTH_PROFESSIONAL', '/profissional', 'Meus pacientes'],
    ['ADMINISTRATOR', '/admin', 'Painel da plataforma'],
  ])('redirects %s from /paciente to %s without drawing the patient dashboard', async (role, home, landing) => {
    const api = mockPatient(role);
    mockPortfolio();
    mockAdmin();
    renderApp('/paciente', { token: 'token-1' });

    expect(await screen.findByRole('heading', { level: 1, name: landing }, SLOW)).toBeInTheDocument();
    expect(where()).toBe(home);
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

describe('routes: the professional area (ACC-02, ACC-03, PRO-08)', () => {
  it('lands a professional on /profissional with the portfolio', async () => {
    mockProfessional();
    renderApp('/login');
    await signIn();

    expect(await portfolioHeading()).toBeInTheDocument();
    expect(where()).toBe('/profissional');
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });

  it.skip('takes a patient from /profissional to /paciente without asking the portfolio anything', async () => {
    const portfolio = mockProfessional('PATIENT');
    renderApp('/profissional', { token: 'token-1' });

    expect(await dashboardHeading()).toBeInTheDocument();
    expect(where()).toBe('/paciente');
    expect(screen.queryByRole('heading', { name: 'Meus pacientes' })).not.toBeInTheDocument();
    expect(portfolio.cohortRequests).toHaveLength(0);
    expect(portfolio.listRequests).toHaveLength(0);
  });

  it.each(['/profissional', PATIENT_PATH])('takes an anonymous visitor of %s to the login, remembering the page', async (path) => {
    mockProfessional();
    renderApp(path);

    expect(await screen.findByLabelText('E-mail')).toBeInTheDocument();
    expect(where()).toBe(`/login?next=${encodeURIComponent(path)}`);
  });

  it('opens a linked patient on /profissional/pacientes/:id inside the shell, with the way back', async () => {
    mockProfessional();
    const summary = mockLinkedPatientSummary();
    renderApp(PATIENT_PATH, { token: 'token-1' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Paciente 3F' }, SLOW)).toBeInTheDocument();
    expect(where()).toBe(PATIENT_PATH);
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
    await waitFor(() => expect(summary.requests).toHaveLength(1), SLOW);

    await userEvent.click(screen.getByRole('link', { name: 'Voltar à carteira' }));

    expect(await portfolioHeading()).toBeInTheDocument();
    expect(where()).toBe('/profissional');
  });

  it('takes a patient from a linked patient page to /paciente without asking for that patient', async () => {
    mockProfessional('PATIENT');
    const summary = mockLinkedPatientSummary();
    renderApp(PATIENT_PATH, { token: 'token-1' });

    expect(await dashboardHeading()).toBeInTheDocument();
    expect(where()).toBe('/paciente');
    expect(summary.requests).toHaveLength(0);
  });

  it('shows the not-found heading for an id that is no patient, still inside the shell', async () => {
    mockProfessional();
    const summary = mockLinkedPatientSummary();
    renderApp('/profissional/pacientes/not-a-uuid', { token: 'token-1' });

    expect(await screen.findByRole('heading', { level: 1, name: NOT_FOUND_TITLE }, SLOW)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
    expect(summary.requests).toHaveLength(0);
  });

  it('keeps the revoked-access notice when the patient page sends the professional back to the portfolio (PRO-13)', async () => {
    mockProfessional();
    mockLinkedPatientSummary(() => HttpResponse.json({ error: 'Acesso revogado', code: 'NO_ACTIVE_GRANT' }, { status: 403 }));
    renderApp(PATIENT_PATH, { token: 'token-1' });

    expect(await portfolioHeading()).toBeInTheDocument();
    expect(where()).toBe('/profissional');
    expect(screen.getByText('O paciente revogou o acesso')).toBeInTheDocument();
  });
});

describe('routes: the professional registration (ACC-02)', () => {
  it('is reachable by an anonymous visitor, with no redirect to the login', async () => {
    mockApi({ role: null });
    renderApp('/cadastro-profissional');

    expect(await screen.findByRole('heading', { level: 1, name: 'Criar conta de profissional' }, SLOW)).toBeInTheDocument();
    expect(where()).toBe('/cadastro-profissional');
  });

  it('is where the link of the login page leads', async () => {
    mockApi({ role: null });
    renderApp('/login');

    await userEvent.click(await screen.findByRole('link', { name: 'Sou profissional de saúde — criar conta' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Criar conta de profissional' }, SLOW)).toBeInTheDocument();
    expect(where()).toBe('/cadastro-profissional');
  });
});

/** An administrator's account over the gateway: one widget is enough to prove the page renders. */
function mockAdministrator(role: Role | null = 'ADMINISTRATOR') {
  mockApi({ role });
  mockLayoutStore([{ id: 'adm-kpi-accounts', size: 'S' }]);
  return mockAdmin();
}

describe('routes: the administrator area (ACC-02, ACC-03)', () => {
  it('lands an administrator on /admin with the dashboard', async () => {
    const admin = mockAdministrator();
    renderApp('/login');
    await signIn();

    expect(await adminHeading()).toBeInTheDocument();
    expect(where()).toBe('/admin');
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
    await waitFor(() => expect(admin.overviewRequests).toHaveLength(1), SLOW);
  });

  it.each<[Role, string, () => Promise<HTMLElement>]>([
    ['PATIENT', '/paciente', dashboardHeading],
    ['HEALTH_PROFESSIONAL', '/profissional', portfolioHeading],
  ])('takes a %s from /admin to %s without asking the platform anything', async (role, home, heading) => {
    const admin = mockAdministrator(role);
    mockPortfolio();
    renderApp('/admin', { token: 'token-1' });

    expect(await heading()).toBeInTheDocument();
    expect(where()).toBe(home);
    expect(screen.queryByRole('heading', { name: 'Painel da plataforma' })).not.toBeInTheDocument();
    expect(admin.overviewRequests).toHaveLength(0);
    expect(admin.usersRequests).toHaveLength(0);
  });

  it('takes an anonymous visitor of /admin to the login, remembering the page', async () => {
    mockAdministrator();
    renderApp('/admin');

    expect(await screen.findByLabelText('E-mail')).toBeInTheDocument();
    expect(where()).toBe('/login?next=%2Fadmin');
  });
});

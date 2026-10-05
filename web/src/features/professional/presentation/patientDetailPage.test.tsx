import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { pinSaoPauloNoon } from '../../../test/browserTimeZone';
import { stubChartContainer } from '../../../test/chartContainer';
import { mockLayoutStore } from '../../../test/layoutStore';
import { testQueryClient } from '../../../test/pageHarness';
import { patientPageOf, patientRowOf } from '../../../test/professionalFakes';
import { mockLinkedPatientSummary, mockPortfolio } from '../../../test/professionalHarness';
import { LOCATION_TEST_ID, renderProfessionalPage } from '../../../test/professionalPageHarness';
import { ERROR_MESSAGE } from '../../../shared/presentation/ui/states';
import { BACK_LABEL, PATIENT_NOT_FOUND_TITLE, PatientDetailPage } from './patientDetailPage';
import { PAGE_TITLE, ProfessionalDashboardPage } from './professionalDashboardPage';
import { patientsQueryKey } from './professionalQueryKeys';
import { REVOKED_ACCESS_MESSAGE } from './revokedAccess';

stubChartContainer();
// The first test to render all the cards loads every chunk, which can pass the default 5 s on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

/** The widgets lazy-load their chunks, which takes longer than the default wait on a busy machine. */
const SLOW = { timeout: 10_000 };

const PATIENT_ID = '3f2b8c1e-5d4a-4e6f-9a7b-0c1d2e3f4a5b';
const PATH = '/profissional/pacientes/:id';

const NO_ACTIVE_GRANT = () => HttpResponse.json({ error: 'Acesso revogado', code: 'NO_ACTIVE_GRANT' }, { status: 403 });
const UNAVAILABLE = () => HttpResponse.json({ error: 'Indisponível' }, { status: 503 });

pinSaoPauloNoon();

/** The titles of the cards on the page, in the order they sit. */
const regionNames = () => screen.getAllByRole('region').flatMap((region) => region.querySelector(':scope > h2')?.textContent ?? []);

const renderDetail = (id = PATIENT_ID, options: Parameters<typeof renderProfessionalPage>[1] = {}) =>
  renderProfessionalPage(<PatientDetailPage />, { path: PATH, initialEntry: `/profissional/pacientes/${id}`, ...options });

describe('PatientDetailPage (PRO-08)', () => {
  it('loads the summary of the linked patient once for every card, over the last 14 days in the browser zone', async () => {
    const summary = mockLinkedPatientSummary();
    renderDetail();

    await waitFor(() => expect(regionNames()).toHaveLength(15), SLOW);
    expect(summary.requests.map((url) => url.pathname)).toEqual([`/api/v1/professional/patients/${PATIENT_ID}/summary`]);
    expect(Object.fromEntries(summary.requests[0]?.searchParams ?? [])).toEqual({ from: '2026-07-24', to: '2026-08-06', tz: 'America/Sao_Paulo' });
    expect(screen.getByRole('button', { name: '14 dias' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the patient widgets but the day detail, whose diary only answers for the signed-in person', async () => {
    mockLinkedPatientSummary();
    renderDetail();

    await waitFor(() => expect(regionNames()).toHaveLength(15), SLOW);
    expect(regionNames()).toContain('Tempo no alvo');
    expect(regionNames()).not.toContain('Dia detalhado');
  });

  it('is not customizable: no "Personalizar", and the saved layout of the professional is not read', async () => {
    mockLinkedPatientSummary();
    const store = mockLayoutStore([{ id: 'pro-kpi-patients', size: 'S' }]);
    renderDetail();

    await waitFor(() => expect(regionNames()).toHaveLength(15), SLOW);
    expect(screen.queryByRole('button', { name: 'Personalizar' })).not.toBeInTheDocument();
    expect(store.puts).toHaveLength(0);
    expect(regionNames()).not.toContain('Pacientes vinculados');
  });

  it('asks the summary of the other period, once, when the professional picks 30 days', async () => {
    const summary = mockLinkedPatientSummary();
    renderDetail();
    await waitFor(() => expect(regionNames()).toHaveLength(15), SLOW);

    await userEvent.setup().click(screen.getByRole('button', { name: '30 dias' }));

    await waitFor(() => expect(summary.requests).toHaveLength(2), SLOW);
    expect(Object.fromEntries(summary.requests[1]?.searchParams ?? [])).toMatchObject({ from: '2026-07-08', to: '2026-08-06' });
  });

  it('goes back to the portfolio from "Voltar à carteira"', async () => {
    mockLinkedPatientSummary();
    mockPortfolio();
    mockLayoutStore([]);
    renderDetail(PATIENT_ID, { routes: { '/profissional': <ProfessionalDashboardPage /> } });

    const back = screen.getByRole('link', { name: BACK_LABEL });
    expect(BACK_LABEL).toBe('Voltar à carteira');
    expect(back).toHaveAttribute('href', '/profissional');
    await userEvent.setup().click(back);

    expect(await screen.findByRole('heading', { level: 1, name: PAGE_TITLE })).toBeInTheDocument();
    expect(screen.getByTestId(LOCATION_TEST_ID)).toHaveTextContent('/profissional');
  });
});

describe('PatientDetailPage heading', () => {
  it('names the patient with "Paciente" and the first letters of the id when no list is cached', () => {
    mockLinkedPatientSummary(() => new Promise<Response>(() => undefined) as unknown as Response);
    renderDetail();

    expect(screen.getByRole('heading', { level: 1, name: 'Paciente 3F' })).toBeInTheDocument();
  });

  it('names the patient as the cached list does', () => {
    mockLinkedPatientSummary(() => new Promise<Response>(() => undefined) as unknown as Response);
    const client = testQueryClient();
    client.setQueryData(patientsQueryKey(14, 1, 50), patientPageOf([patientRowOf({ patientId: PATIENT_ID, displayName: 'Ana Souza' })]));
    renderDetail(PATIENT_ID, { client });

    expect(screen.getByRole('heading', { level: 1, name: 'Ana Souza' })).toBeInTheDocument();
  });
});

describe('PatientDetailPage when the access ends (PRO-13)', () => {
  it('goes back to the portfolio and says the patient revoked the access', async () => {
    mockLinkedPatientSummary(NO_ACTIVE_GRANT);
    mockPortfolio();
    mockLayoutStore([]);
    renderDetail(PATIENT_ID, { routes: { '/profissional': <ProfessionalDashboardPage /> } });

    expect(await screen.findByRole('heading', { level: 1, name: PAGE_TITLE }, SLOW)).toBeInTheDocument();
    expect(screen.getByTestId(LOCATION_TEST_ID)).toHaveTextContent('/profissional');
    expect(screen.getByText(REVOKED_ACCESS_MESSAGE)).toBeInTheDocument();
    expect(REVOKED_ACCESS_MESSAGE).toBe('O paciente revogou o acesso');
  });

  it('stays on the patient, with an error in each card and no notice, when the summary is only unavailable', async () => {
    mockLinkedPatientSummary(UNAVAILABLE);
    renderDetail();

    const card = await screen.findByRole('region', { name: 'Tempo no alvo' }, SLOW);
    expect(await within(card).findByRole('alert')).toHaveTextContent(ERROR_MESSAGE);
    expect(screen.getByTestId(LOCATION_TEST_ID)).toHaveTextContent(`/profissional/pacientes/${PATIENT_ID}`);
    expect(screen.queryByText(REVOKED_ACCESS_MESSAGE)).not.toBeInTheDocument();
  });
});

describe('PatientDetailPage with an id that is no patient', () => {
  it.each(['not-a-uuid', '3f2b8c1e', `${PATIENT_ID}-x`, 'p1'])('says the page was not found for "%s", with no request', (id) => {
    const summary = mockLinkedPatientSummary();
    renderDetail(id);

    expect(screen.getByRole('heading', { level: 1, name: PATIENT_NOT_FOUND_TITLE })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: BACK_LABEL })).toHaveAttribute('href', '/profissional');
    expect(summary.requests).toHaveLength(0);
  });

  it('accepts a UUID in capitals', async () => {
    mockLinkedPatientSummary();
    renderDetail(PATIENT_ID.toUpperCase());

    await screen.findByRole('region', { name: 'Tempo no alvo' }, SLOW);
    expect(screen.queryByRole('heading', { name: PATIENT_NOT_FOUND_TITLE })).not.toBeInTheDocument();
  });
});

describe('PatientDetailPage accessibility', () => {
  it('has no axe violations with the patient loaded', async () => {
    mockLinkedPatientSummary();
    const { container } = renderDetail();
    await waitFor(() => expect(regionNames()).toHaveLength(15), SLOW);
    await within(await screen.findByRole('region', { name: 'Tempo no alvo' }, SLOW)).findByText('23,5', undefined, SLOW);

    expect(await axe(container)).toHaveNoViolations();
  });
});

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { stubChartContainer } from '../../../test/chartContainer';
import { API_BASE } from '../../../test/httpClient';
import { mockLayoutStore } from '../../../test/layoutStore';
import { cohortDto } from '../../../test/professionalFakes';
import { mockPortfolio } from '../../../test/professionalHarness';
import { renderProfessionalPage } from '../../../test/professionalPageHarness';
import { server } from '../../../test/server';
import { catalogIdsOf } from '../../../test/widgetHarness';
import { defaultLayoutFor, widgetTitle } from '../../dashboard-layout';
import { HOW_TO_GET_CODE, NO_LINKS_TITLE } from './noLinksPanel';
import { PAGE_TITLE, ProfessionalDashboardPage } from './professionalDashboardPage';
import { REVOKED_ACCESS_MESSAGE } from './revokedAccess';
import { DISMISS_LABEL } from './revokedAccessNotice';
import { CODE_LABEL } from './widgets/proRedeemCode';
import { PRO_KPI_GMI_TITLE, PRO_KPI_PATIENTS_TITLE, PRO_KPI_TIR_TITLE } from './widgets/widgetTitles';

stubChartContainer();
// The first test to render all 11 widgets loads every chunk, which can pass the default 5 s on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

/** The widgets lazy-load their chunks, which takes longer than the default wait on a busy machine. */
const SLOW = { timeout: 10_000 };

const EMPTY_COHORT = { patientCount: 0, avgTimeInRangePercent: null, avgGmiPercent: null, patientsWithHypo: 0, patientsStale: 0, perPatient: [] };
const EMPTY_LIST = { items: [], page: 1, limit: 50, total: 0 };
const NO_ACTIVE_GRANT = () => HttpResponse.json({ error: 'Acesso revogado', code: 'NO_ACTIVE_GRANT' }, { status: 403 });
const NO_LINKS = { cohort: () => HttpResponse.json(cohortDto(EMPTY_COHORT)), list: () => HttpResponse.json(EMPTY_LIST) };

/** The titles of the cards of the grid, in the order they sit; the empty-state panel is not one of them. */
const regionNames = () =>
  screen
    .getAllByRole('region')
    .filter((region) => !region.className.includes('panel'))
    .flatMap((region) => region.querySelector(':scope > h2')?.textContent ?? []);

const card = (title: string) => screen.findByRole('region', { name: title }, SLOW);
const patientCount = async () => within(await card(PRO_KPI_PATIENTS_TITLE)).findByText('2', undefined, SLOW);

describe('ProfessionalDashboardPage opening (PRO-05, LAY-01)', () => {
  it('opens on the last 14 days with one cohort and one list request for every widget', async () => {
    const portfolio = mockPortfolio();
    mockLayoutStore(null);
    renderProfessionalPage(<ProfessionalDashboardPage />);

    expect(screen.getByRole('heading', { level: 1, name: PAGE_TITLE })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '14 dias' })).toHaveAttribute('aria-pressed', 'true');
    expect(await patientCount()).toBeInTheDocument();
    await waitFor(() => expect(regionNames()).toHaveLength(11), SLOW);
    expect(portfolio.cohortRequests.map((url) => url.searchParams.get('days'))).toEqual(['14']);
    expect(portfolio.listRequests.map((url) => url.searchParams.get('days'))).toEqual(['14']);
  });

  it('draws the default layout of the professional, every widget of its role, when none is saved', async () => {
    mockPortfolio();
    mockLayoutStore(null);
    renderProfessionalPage(<ProfessionalDashboardPage />);

    await waitFor(() => expect(regionNames()).toHaveLength(11), SLOW);
    const titleOf = (id: string) => widgetTitle({ id, titleKey: `widget.${id}` });
    expect(regionNames()).toEqual(defaultLayoutFor('HEALTH_PROFESSIONAL').widgets.map((item) => titleOf(item.id)));
    expect(defaultLayoutFor('HEALTH_PROFESSIONAL').widgets.map((item) => item.id).sort()).toEqual([...catalogIdsOf('HEALTH_PROFESSIONAL')].sort());
  });

  it('draws the cells of a saved layout, in its order and sizes, and only those', async () => {
    mockPortfolio();
    mockLayoutStore([
      { id: 'pro-kpi-tir', size: 'S' },
      { id: 'pro-kpi-patients', size: 'L' },
      { id: 'adm-kpi-accounts', size: 'S' },
    ]);
    const { container } = renderProfessionalPage(<ProfessionalDashboardPage />);

    await card(PRO_KPI_TIR_TITLE);
    expect(regionNames()).toEqual([PRO_KPI_TIR_TITLE, PRO_KPI_PATIENTS_TITLE]);
    expect([...container.querySelectorAll('[data-size]')].map((cell) => cell.getAttribute('data-size'))).toEqual(['S', 'L']);
  });
});

describe('ProfessionalDashboardPage period (PRO-05)', () => {
  it('asks the cohort and the list again, once each, when the professional picks another period', async () => {
    const portfolio = mockPortfolio();
    mockLayoutStore([
      { id: 'pro-kpi-patients', size: 'S' },
      { id: 'pro-patients-table', size: 'L' },
    ]);
    renderProfessionalPage(<ProfessionalDashboardPage />);
    await card(PRO_KPI_PATIENTS_TITLE);
    await waitFor(() => expect(portfolio.listRequests).toHaveLength(1), SLOW);
    await waitFor(() => expect(portfolio.cohortRequests).toHaveLength(1), SLOW);

    await userEvent.setup().click(screen.getByRole('button', { name: '30 dias' }));

    await waitFor(() => expect(portfolio.cohortRequests).toHaveLength(2), SLOW);
    await waitFor(() => expect(portfolio.listRequests).toHaveLength(2), SLOW);
    expect(portfolio.cohortRequests[1]?.searchParams.get('days')).toBe('30');
    expect(portfolio.listRequests[1]?.searchParams.get('days')).toBe('30');
    expect(screen.getByRole('button', { name: '30 dias' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '14 dias' })).toHaveAttribute('aria-pressed', 'false');
  });

  it.each([7, 14, 30, 90])('offers %i days', (days) => {
    mockPortfolio();
    mockLayoutStore([]);
    renderProfessionalPage(<ProfessionalDashboardPage />);

    expect(screen.getByRole('button', { name: `${days} dias` })).toBeInTheDocument();
  });
});

describe('ProfessionalDashboardPage without linked patients (PRO-01)', () => {
  it('explains how to get a code and offers the field to enter it, above a grid that keeps working', async () => {
    mockPortfolio(NO_LINKS);
    mockLayoutStore(null);
    renderProfessionalPage(<ProfessionalDashboardPage />);

    const panel = within(await screen.findByRole('region', { name: NO_LINKS_TITLE }, SLOW));
    expect(panel.getByText(HOW_TO_GET_CODE)).toBeInTheDocument();
    expect(HOW_TO_GET_CODE).toBe(
      'Peça ao paciente para abrir o aplicativo, ir em Configurações › Compartilhar com profissional e gerar um código. Informe o código abaixo para vincular.',
    );
    expect(panel.getByRole('textbox', { name: CODE_LABEL })).toBeInTheDocument();
    expect(panel.getByRole('button', { name: 'Vincular paciente' })).toBeEnabled();
    await waitFor(() => expect(regionNames()).toHaveLength(11), SLOW);
  });

  it('shows the widgets and no explanation once the professional has links', async () => {
    mockPortfolio();
    mockLayoutStore(null);
    renderProfessionalPage(<ProfessionalDashboardPage />);

    await patientCount();
    expect(screen.queryByRole('region', { name: NO_LINKS_TITLE })).not.toBeInTheDocument();
    expect(screen.queryByText(HOW_TO_GET_CODE)).not.toBeInTheDocument();
  });

  it('shows no explanation before the cohort arrives', () => {
    mockPortfolio({ cohort: () => new Promise<Response>(() => undefined) as unknown as Response });
    mockLayoutStore([]);
    renderProfessionalPage(<ProfessionalDashboardPage />);

    expect(screen.queryByRole('region', { name: NO_LINKS_TITLE })).not.toBeInTheDocument();
  });

  it('links the patient with the typed code and drops the explanation without a reload', async () => {
    const redeemed: unknown[] = [];
    mockPortfolio({ cohort: (request) => HttpResponse.json(request === 1 ? cohortDto(EMPTY_COHORT) : cohortDto()) });
    mockLayoutStore([{ id: 'pro-kpi-patients', size: 'S' }]);
    server.use(
      http.post(`${API_BASE}/sharing/redeem`, async ({ request }) => {
        redeemed.push(await request.json());
        return HttpResponse.json({ patientId: 'p1', grantId: 'g1' }, { status: 201 });
      }),
    );
    renderProfessionalPage(<ProfessionalDashboardPage />);
    const panel = within(await screen.findByRole('region', { name: NO_LINKS_TITLE }, SLOW));
    const user = userEvent.setup();

    await user.type(panel.getByRole('textbox', { name: CODE_LABEL }), 'ab12cd34');
    await user.click(panel.getByRole('button', { name: 'Vincular paciente' }));

    await waitFor(() => expect(screen.queryByRole('region', { name: NO_LINKS_TITLE })).not.toBeInTheDocument(), SLOW);
    expect(redeemed).toEqual([{ code: 'AB12CD34' }]);
    expect(await patientCount()).toBeInTheDocument();
  });
});

describe('ProfessionalDashboardPage revoked access notice (PRO-13)', () => {
  it('says the patient revoked the access in a status the professional can dismiss', async () => {
    mockPortfolio({ cohort: NO_ACTIVE_GRANT });
    mockLayoutStore([{ id: 'pro-kpi-patients', size: 'S' }]);
    renderProfessionalPage(<ProfessionalDashboardPage />);

    const notice = (await screen.findByText(REVOKED_ACCESS_MESSAGE, undefined, SLOW)).closest('[role="status"]') as HTMLElement;
    expect(notice).toBeInTheDocument();
    expect(REVOKED_ACCESS_MESSAGE).toBe('O paciente revogou o acesso');

    await userEvent.setup().click(within(notice).getByRole('button', { name: DISMISS_LABEL }));

    expect(screen.queryByText(REVOKED_ACCESS_MESSAGE)).not.toBeInTheDocument();
  });

  it('shows no notice while nothing was revoked', async () => {
    mockPortfolio();
    mockLayoutStore([{ id: 'pro-kpi-patients', size: 'S' }]);
    renderProfessionalPage(<ProfessionalDashboardPage />);

    await patientCount();
    expect(screen.queryByText(REVOKED_ACCESS_MESSAGE)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: DISMISS_LABEL })).not.toBeInTheDocument();
  });
});

describe('ProfessionalDashboardPage customizing the layout (LAY-03, LAY-07)', () => {
  const THREE = [
    { id: 'pro-kpi-patients', size: 'S' },
    { id: 'pro-kpi-tir', size: 'S' },
    { id: 'pro-kpi-gmi', size: 'S' },
  ] as const;

  async function customizing() {
    mockPortfolio();
    const store = mockLayoutStore(THREE.map((item) => ({ ...item })));
    renderProfessionalPage(<ProfessionalDashboardPage />);
    const user = userEvent.setup();
    await card(PRO_KPI_PATIENTS_TITLE);
    await user.click(screen.getByRole('button', { name: 'Personalizar' }));
    // The editor is its own chunk: wait for it before touching its controls.
    await screen.findByRole('region', { name: 'Adicionar ao painel' }, SLOW);
    return { user, store };
  }

  it('moves and removes widgets of the professional catalog and saves them with PUT /preferences/dashboard', async () => {
    const { user, store } = await customizing();

    await user.click(screen.getByRole('button', { name: `Mover para antes: ${PRO_KPI_TIR_TITLE}` }));
    await user.click(screen.getByRole('button', { name: `Remover ${PRO_KPI_GMI_TITLE}` }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Layout salvo')).toBeInTheDocument();
    expect(store.puts).toHaveLength(1);
    expect(store.widgets).toEqual([
      { id: 'pro-kpi-tir', size: 'S' },
      { id: 'pro-kpi-patients', size: 'S' },
    ]);
  });

  it('offers only widgets of the professional to add, and restores the default after confirming', async () => {
    const { user, store } = await customizing();

    const picker = within(screen.getByRole('region', { name: 'Adicionar ao painel' }));
    expect(picker.getByRole('button', { name: 'Adicionar Hipos por hora do dia' })).toBeInTheDocument();
    expect(picker.queryByRole('button', { name: 'Adicionar Tempo no alvo' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Restaurar padrão' }));
    await user.click(await screen.findByRole('button', { name: 'Sim, restaurar' }));

    await waitFor(() => expect(store.deletes).toBe(1));
    expect(store.widgets).toBeNull();
  });
});

describe('ProfessionalDashboardPage accessibility', () => {
  it('has no axe violations with linked patients', async () => {
    mockPortfolio();
    mockLayoutStore(null);
    const { container } = renderProfessionalPage(<ProfessionalDashboardPage />);
    await waitFor(() => expect(regionNames()).toHaveLength(11), SLOW);
    await patientCount();

    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations with the explanation panel', async () => {
    mockPortfolio(NO_LINKS);
    mockLayoutStore(null);
    const { container } = renderProfessionalPage(<ProfessionalDashboardPage />);
    await screen.findByRole('region', { name: NO_LINKS_TITLE }, SLOW);

    expect(await axe(container)).toHaveNoViolations();
  });
});

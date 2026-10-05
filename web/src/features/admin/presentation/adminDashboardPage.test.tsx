import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { mockAdmin } from '../../../test/adminHarness';
import { stubChartContainer } from '../../../test/chartContainer';
import { mockLayoutStore } from '../../../test/layoutStore';
import { renderOnContainer } from '../../../test/pageHarness';
import { ERROR_MESSAGE } from '../../../shared/presentation/ui/states';
import { definitionsForRole, widgetTitle } from '../../dashboard-layout';
import { AdminDashboardPage, PAGE_TITLE } from './adminDashboardPage';
import { ADM_KPI_ACCOUNTS_TITLE, ADM_KPI_GRANTS_TITLE, ADM_KPI_REGISTRATIONS_TITLE, ADM_REGISTRATIONS_TITLE } from './widgets/widgetTitles';

stubChartContainer();
// The first test to render every widget loads every chunk, which can pass the default 5 s on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

/** The widgets lazy-load their chunks, which takes longer than the default wait on a busy machine. */
const SLOW = { timeout: 10_000 };

/** The deferred widgets of the contract: the page must never draw, list or name them. */
const DEFERRED_TITLES = ['Pacientes cadastrados e ativos', 'Leituras por dia', 'Vínculos por semana', 'Alertas da plataforma'];

/** The titles of the cards of the grid, in the order they sit. */
const regionNames = () => screen.getAllByRole('region').flatMap((region) => region.querySelector(':scope > h2')?.textContent ?? []);

/** The error messages on screen; the toolbar keeps an empty alert region for its own notices. */
const errors = () => screen.queryAllByRole('alert').filter((alert) => alert.textContent);

const card = (title: string) => screen.findByRole('region', { name: title }, SLOW);
const REGISTERED_TITLES = () => definitionsForRole('ADMINISTRATOR').map((definition) => widgetTitle(definition));

describe('AdminDashboardPage opening (ADM-01, ADM-07)', () => {
  it('opens on 30 days with one overview request for every widget', async () => {
    const admin = mockAdmin();
    mockLayoutStore(null);
    renderOnContainer(<AdminDashboardPage />);

    expect(screen.getByRole('heading', { level: 1, name: PAGE_TITLE })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 dias' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(regionNames()).toHaveLength(7), SLOW);
    await within(await card(ADM_KPI_ACCOUNTS_TITLE)).findByText('42', undefined, SLOW);
    expect(admin.overviewRequests.map((url) => url.searchParams.get('days'))).toEqual(['30']);
  });

  it('draws exactly the seven built widgets of the default layout, no error cell and none of the deferred four', async () => {
    mockAdmin();
    mockLayoutStore(null);
    renderOnContainer(<AdminDashboardPage />);

    await waitFor(() => expect(regionNames()).toHaveLength(7), SLOW);
    expect(regionNames()).toEqual(REGISTERED_TITLES());
    expect(errors()).toHaveLength(0);
    for (const title of DEFERRED_TITLES) expect(screen.queryByText(title)).not.toBeInTheDocument();
  });

  it('draws the cells of a saved layout, in its order and sizes, and only the built ones', async () => {
    mockAdmin();
    mockLayoutStore([
      { id: 'adm-registrations', size: 'L' },
      { id: 'adm-kpi-grants', size: 'S' },
      { id: 'adm-alerts', size: 'M' },
    ]);
    const { container } = renderOnContainer(<AdminDashboardPage />);

    await card(ADM_REGISTRATIONS_TITLE);
    expect(regionNames()).toEqual([ADM_REGISTRATIONS_TITLE, ADM_KPI_GRANTS_TITLE]);
    expect([...container.querySelectorAll('[data-size]')].map((cell) => cell.getAttribute('data-size'))).toEqual(['L', 'S']);
  });
});

describe('AdminDashboardPage period (ADM-07)', () => {
  it.each([7, 90])('offers %i days and asks the overview again, once, when the administrator picks it', async (days) => {
    const admin = mockAdmin();
    mockLayoutStore([{ id: 'adm-kpi-accounts', size: 'S' }]);
    renderOnContainer(<AdminDashboardPage />);
    await card(ADM_KPI_ACCOUNTS_TITLE);
    await waitFor(() => expect(admin.overviewRequests).toHaveLength(1), SLOW);

    await userEvent.setup().click(screen.getByRole('button', { name: `${days} dias` }));

    await waitFor(() => expect(admin.overviewRequests).toHaveLength(2), SLOW);
    expect(admin.overviewRequests[1]?.searchParams.get('days')).toBe(String(days));
    expect(screen.getByRole('button', { name: `${days} dias` })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '30 dias' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('AdminDashboardPage without access (ADM-05)', () => {
  it('shows the usual error, with retry, in every card when the gateway answers 403 FORBIDDEN_ROLE', async () => {
    const forbidden = () => HttpResponse.json({ error: 'Wrong role', code: 'FORBIDDEN_ROLE' }, { status: 403 });
    mockAdmin({ overview: forbidden, users: forbidden });
    mockLayoutStore(null);
    renderOnContainer(<AdminDashboardPage />);

    await waitFor(() => expect(errors()).toHaveLength(7), SLOW);
    for (const alert of errors()) expect(alert).toHaveTextContent(ERROR_MESSAGE);
    expect(screen.getAllByRole('button', { name: 'Tentar novamente' })).toHaveLength(7);
  });
});

describe('AdminDashboardPage customizing the layout (LAY-03, LAY-07)', () => {
  const THREE = [
    { id: 'adm-kpi-accounts', size: 'S' },
    { id: 'adm-kpi-registrations', size: 'S' },
    { id: 'adm-kpi-grants', size: 'S' },
  ] as const;

  async function customizing(saved: readonly { id: string; size: 'S' | 'M' | 'L' }[] | null = THREE) {
    mockAdmin();
    const store = mockLayoutStore(saved && saved.map((item) => ({ ...item })));
    renderOnContainer(<AdminDashboardPage />);
    const user = userEvent.setup();
    await card(ADM_KPI_ACCOUNTS_TITLE);
    await user.click(screen.getByRole('button', { name: 'Personalizar' }));
    // The editor is its own chunk: wait for it before touching its controls.
    await screen.findByRole('region', { name: 'Adicionar ao painel' }, SLOW);
    return { user, store };
  }

  it('moves and removes widgets of the administrator catalog and saves them with PUT /preferences/dashboard', async () => {
    const { user, store } = await customizing();

    await user.click(screen.getByRole('button', { name: 'Mover para antes: Cadastros no período' }));
    await user.click(screen.getByRole('button', { name: 'Remover Vínculos ativos' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Layout salvo')).toBeInTheDocument();
    expect(store.puts).toHaveLength(1);
    expect(store.widgets).toEqual([
      { id: 'adm-kpi-registrations', size: 'S' },
      { id: 'adm-kpi-accounts', size: 'S' },
    ]);
  });

  it('restores the saved layout on the next visit', async () => {
    const { user, store } = await customizing();
    await user.click(screen.getByRole('button', { name: 'Remover Vínculos ativos' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await screen.findByText('Layout salvo');

    cleanup();

    renderOnContainer(<AdminDashboardPage />);

    await card(ADM_KPI_ACCOUNTS_TITLE);
    expect(regionNames()).toEqual([ADM_KPI_ACCOUNTS_TITLE, ADM_KPI_REGISTRATIONS_TITLE]);
    expect(store.puts).toHaveLength(1);
  });

  it('offers none of the deferred four to add, and restores the default after confirming', async () => {
    const { user, store } = await customizing();

    const picker = within(screen.getByRole('region', { name: 'Adicionar ao painel' }));
    expect(picker.getByRole('button', { name: 'Adicionar Contas por papel' })).toBeInTheDocument();
    for (const title of DEFERRED_TITLES) expect(picker.queryByRole('button', { name: `Adicionar ${title}` })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Restaurar padrão' }));
    await user.click(await screen.findByRole('button', { name: 'Sim, restaurar' }));

    await waitFor(() => expect(store.deletes).toBe(1));
    expect(store.widgets).toBeNull();
  });

  it('shows no cell for a deferred widget while editing the default layout', async () => {
    await customizing(null);

    for (const id of ['adm-active-patients', 'adm-readings-volume', 'adm-grants', 'adm-alerts']) expect(screen.queryByText(id)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Remover / })).toHaveLength(7);
  });
});

describe('AdminDashboardPage accessibility', () => {
  it('has no axe violations with every widget loaded', async () => {
    mockAdmin();
    mockLayoutStore(null);
    const { container } = renderOnContainer(<AdminDashboardPage />);
    await waitFor(() => expect(regionNames()).toHaveLength(7), SLOW);
    await within(await card(ADM_KPI_ACCOUNTS_TITLE)).findByText('42', undefined, SLOW);
    await screen.findByRole('table', undefined, SLOW);

    expect(await axe(container)).toHaveNoViolations();
  });
});

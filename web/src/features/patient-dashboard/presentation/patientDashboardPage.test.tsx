import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from '../../../test/apiMocks';
import { stubChartContainer } from '../../../test/chartContainer';
import { withTimeZone } from '../../../test/browserTimeZone';
import { renderOnContainer } from '../../../test/pageHarness';
import { emptyPeriodSummary } from '../../../test/widgetHarness';
import { summaryFixture } from '../../../test/summaryFakes';
import { PatientDashboardPage, NO_READINGS_TITLE, PAGE_TITLE, REFRESH_LABEL, SYNC_GUIDANCE } from './patientDashboardPage';
import { KPI_GMI_TITLE } from './widgets/kpiGmi';
import { KPI_TIR_TITLE } from './widgets/kpiTir';

stubChartContainer();
// The first test to render all 16 widgets loads every chunk, which can pass the default 5 s on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

/** The widgets lazy-load their chunks, which takes longer than the default wait on a busy machine. */
const SLOW = { timeout: 10_000 };

beforeEach(() => {
  withTimeZone('America/Sao_Paulo');
  // 12:00 on 6 August in Sao Paulo. Only the date is faked: timers and promises keep running.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-08-06T15:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const kpi = (title: string) => screen.findByRole('region', { name: title }, SLOW);
/** The titles of the cards on the page, in the order they sit. */
const regionNames = () => screen.getAllByRole('region').flatMap((region) => region.querySelector(':scope > h2')?.textContent ?? []);

describe('PatientDashboardPage opening (PAC-01, PAC-17)', () => {
  it('opens on the last 14 days in the browser zone, with one summary request for every widget', async () => {
    const api = mockApi();
    renderOnContainer(<PatientDashboardPage />);

    expect(screen.getByRole('heading', { level: 1, name: PAGE_TITLE })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '14 dias' })).toHaveAttribute('aria-pressed', 'true');
    expect(await within(await kpi(KPI_TIR_TITLE)).findByText('23,5', undefined, SLOW)).toBeInTheDocument();
    // All 16 cells are on the page, each reading the same summary.
    await waitFor(() => expect(regionNames()).toHaveLength(16), SLOW);
    expect(api.summaryRequests.map((url) => Object.fromEntries(url.searchParams))).toEqual([
      { from: '2026-07-24', to: '2026-08-06', tz: 'America/Sao_Paulo' },
    ]);
  });

  it('draws the cells of a saved layout, in its order and sizes, and only those', async () => {
    mockApi({
      layout: [
        { id: 'kpi-gmi', size: 'S' },
        { id: 'kpi-tir', size: 'L' },
        { id: 'no-such-widget', size: 'S' },
      ],
    });
    const { container } = renderOnContainer(<PatientDashboardPage />);

    await kpi(KPI_TIR_TITLE);
    expect(regionNames()).toEqual([KPI_GMI_TITLE, KPI_TIR_TITLE]);
    expect([...container.querySelectorAll('[data-size]')].map((cell) => cell.getAttribute('data-size'))).toEqual(['S', 'L']);
  });

  it('draws the default layout of the patient when none is saved: every patient widget, KPIs first', async () => {
    mockApi({ layout: null });
    renderOnContainer(<PatientDashboardPage />);

    await waitFor(() => expect(regionNames()).toHaveLength(16), SLOW);
    expect(regionNames().slice(0, 2)).toEqual([KPI_TIR_TITLE, KPI_GMI_TITLE]);
  });
});

describe('PatientDashboardPage without readings (PAC-14)', () => {
  it('says there are no readings in the period and to sync through the app', async () => {
    mockApi({ summary: emptyPeriodSummary() });
    renderOnContainer(<PatientDashboardPage />);

    const notice = await screen.findByRole('region', { name: NO_READINGS_TITLE }, SLOW);
    expect(within(notice).getByText(SYNC_GUIDANCE)).toBeInTheDocument();
    expect(SYNC_GUIDANCE).toBe('Abra o aplicativo para sincronizar os dados.');
  });

  it('keeps the empty states of the widgets next to the notice', async () => {
    mockApi({ summary: emptyPeriodSummary() });
    renderOnContainer(<PatientDashboardPage />);

    const tir = await kpi(KPI_TIR_TITLE);
    expect(await within(tir).findByText('Sem leituras no período', undefined, SLOW)).toBeInTheDocument();
  });

  it('shows no notice while there are readings, nor before the summary arrives', async () => {
    mockApi({ summary: summaryFixture({ totals: { readingsCount: 1, carbEntries: 0, insulinEntries: 0, alertsCount: 0 } }) });
    renderOnContainer(<PatientDashboardPage />);

    expect(screen.queryByRole('region', { name: NO_READINGS_TITLE })).not.toBeInTheDocument();
    await within(await kpi(KPI_TIR_TITLE)).findByText('23,5', undefined, SLOW);
    expect(screen.queryByRole('region', { name: NO_READINGS_TITLE })).not.toBeInTheDocument();
  });
});

describe('PatientDashboardPage "Atualizar" and the period (PAC-15, PAC-17)', () => {
  it('reloads the summary and the diary once, keeping the period and the layout', async () => {
    const api = mockApi({
      layout: [
        { id: 'kpi-gmi', size: 'S' },
        { id: 'kpi-tir', size: 'M' },
        { id: 'chart-day-detail', size: 'L' },
      ],
      summary: (request) => summaryFixture({ timeInRangePercent: request <= 2 ? 23.53 : 61.2 }),
    });
    renderOnContainer(<PatientDashboardPage />);
    const user = userEvent.setup();
    await within(await kpi(KPI_TIR_TITLE)).findByText('23,5', undefined, SLOW);
    await waitFor(() => expect(api.readingsRequests).toHaveLength(1), SLOW);
    await user.click(screen.getByRole('button', { name: '7 dias' }));
    await within(await kpi(KPI_TIR_TITLE)).findByText('23,5', undefined, SLOW);
    const before = api.summaryRequests.length;

    await user.click(screen.getByRole('button', { name: REFRESH_LABEL }));

    await waitFor(() => expect(api.summaryRequests).toHaveLength(before + 1), SLOW);
    await waitFor(() => expect(api.readingsRequests).toHaveLength(2), SLOW);
    const [first, last] = [api.summaryRequests[before - 1], api.summaryRequests[before]];
    expect(last?.search).toBe(first?.search);
    expect(screen.getByRole('button', { name: '7 dias' })).toHaveAttribute('aria-pressed', 'true');
    expect(regionNames()).toEqual([KPI_GMI_TITLE, KPI_TIR_TITLE, 'Dia detalhado']);
    expect(await within(await kpi(KPI_TIR_TITLE)).findByText('61,2', undefined, SLOW)).toBeInTheDocument();
  });

  it('asks again, once, when the person picks another period, without touching the layout', async () => {
    const api = mockApi({ layout: [{ id: 'kpi-tir', size: 'S' }, { id: 'kpi-gmi', size: 'S' }] });
    renderOnContainer(<PatientDashboardPage />);
    await kpi(KPI_TIR_TITLE);
    await waitFor(() => expect(api.summaryRequests).toHaveLength(1), SLOW);

    await userEvent.setup().click(screen.getByRole('button', { name: '30 dias' }));

    await waitFor(() => expect(api.summaryRequests).toHaveLength(2), SLOW);
    expect(Object.fromEntries(api.summaryRequests[1]?.searchParams ?? [])).toMatchObject({ from: '2026-07-08', to: '2026-08-06' });
    expect(regionNames()).toEqual([KPI_TIR_TITLE, KPI_GMI_TITLE]);
  });
});

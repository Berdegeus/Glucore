import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentType, ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { WidgetDefinition, WidgetProps } from '../features/dashboard-layout';
import { AdminServicesProvider } from '../features/admin';
import type { AdminUseCases } from '../features/admin/application/adminUseCases';
import type { AdminOverview } from '../features/admin/domain/overview';
import { AdminPeriodProvider } from '../features/admin/presentation/adminPeriodContext';
import { AppError } from '../shared/domain/appError';
import { accountPageOf, overviewOf, zeroOverviewOf } from './adminFakes';
import { stubChartContainer } from './chartContainer';
import { plainQueryClient } from './professionalHarness';
import { TABLE_TOGGLE_LABEL } from '../shared/presentation/charts/chartFrame';
import {
  describeCatalogDefinition,
  describeChartAlternatives,
  describeWidgetStates,
  type ChartAlternativesSpec,
  type StatesScenario,
} from './widgetHarness';

interface AdminHarnessOptions {
  /** What `loadOverview` answers; the fixture when omitted. */
  overview?: AdminOverview;
  /** Replaces a use case altogether, to fail it, hold it back or watch its calls. */
  services?: Partial<AdminUseCases>;
  /** The period the page puts above the widget; 30 days when omitted. */
  days?: number;
}

/** The admin use cases over fakes: every call is a `vi.fn` the test can inspect. */
export function fakeAdminServices({ overview, services }: AdminHarnessOptions = {}): AdminUseCases {
  return {
    loadOverview: vi.fn<AdminUseCases['loadOverview']>().mockResolvedValue(overview ?? overviewOf()),
    loadUsers: vi.fn<AdminUseCases['loadUsers']>().mockResolvedValue(accountPageOf()),
    ...services,
  };
}

/** Mounts a widget the way the administrator's page does: the period, the use cases and a query client that does not retry. */
export function renderAdminWidget(widget: ReactElement, options: AdminHarnessOptions = {}) {
  const services = fakeAdminServices(options);
  const view = render(
    <QueryClientProvider client={plainQueryClient()}>
      <AdminServicesProvider services={services}>
        <AdminPeriodProvider days={options.days ?? 30}>{widget}</AdminPeriodProvider>
      </AdminServicesProvider>
    </QueryClientProvider>,
  );
  return { ...view, services };
}

/** Mounts a chart widget and waits for its picture: `all` selects inside it, `axisLabels` reads the category axis left to right. */
export async function renderDrawnChart(widget: ReactElement, options: AdminHarnessOptions = {}) {
  const view = renderAdminWidget(widget, options);
  await screen.findByRole('img');
  const all = (selector: string): Element[] => [...view.container.querySelectorAll(selector)];
  const axisLabels = (): (string | null)[] => all('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value').map((label) => label.textContent);
  return { ...view, all, axisLabels };
}

const using = (load: ReturnType<typeof vi.fn>): Partial<AdminUseCases> => ({ loadOverview: load as unknown as AdminUseCases['loadOverview'] });

// No `empty`: a count of zero is a figure the administrator reads, so the KPIs have no empty state; the charts add one.
const overviewScenario: StatesScenario = {
  loading: (widget) => void renderAdminWidget(widget, { services: using(vi.fn(() => new Promise(() => undefined))) }),
  failsOnce: (widget) => {
    const load = vi.fn().mockRejectedValueOnce(new AppError('unavailable')).mockResolvedValue(overviewOf());
    renderAdminWidget(widget, { services: using(load) });
    return { load };
  },
  loaded: (widget) => renderAdminWidget(widget),
};

const chartScenario: StatesScenario = {
  ...overviewScenario,
  empty: (widget) => void renderAdminWidget(widget, { overview: zeroOverviewOf() }),
};

export interface AdminWidgetSpec {
  Widget: ComponentType<WidgetProps>;
  definition: WidgetDefinition;
  title: string;
  /** Text the widget shows once the fixture overview has loaded. */
  shown: string | RegExp;
  /** The cause an empty period shows; absent for a widget that never shows an empty state. */
  emptyCause?: string;
}

/**
 * The behavior every widget of the administrator shares (LAY-01, LAY-15,
 * LAY-16, ADM-07): its definition matches the catalog contract and the
 * administrator's default layout, it shows a skeleton of its size, an isolated
 * error with retry and no axe violation, and it reads the overview of the
 * page's period. Each widget's own test adds what its figure shows.
 */
export function describeAdminWidget(spec: AdminWidgetSpec) {
  describeCatalogDefinition(spec.definition, 'ADMINISTRATOR');
  describeWidgetStates(spec, spec.emptyCause === undefined ? overviewScenario : chartScenario);

  describe(`${spec.definition.id} period (ADM-07)`, () => {
    it.each([7, 90])('asks for the overview of the %i days the page picked', async (days) => {
      const { services } = renderAdminWidget(<spec.Widget size="S" />, { days });

      await waitFor(() => expect(services.loadOverview).toHaveBeenCalledWith(days));
      expect(services.loadOverview).toHaveBeenCalledTimes(1);
    });
  });
}

type AdminChartSpec = Omit<AdminWidgetSpec, 'shown'> & Pick<ChartAlternativesSpec, 'summary' | 'tableName' | 'columns' | 'rows'>;

/**
 * What every chart of the administrator shares (ADM-02, RSP-07): the widget
 * states with the table toggle as proof the chart rendered, the cause of an
 * empty period, a text summary on the chart and the same data as a table.
 */
export function describeAdminChart({ summary, columns, rows, tableName, ...widget }: AdminChartSpec) {
  stubChartContainer();
  describeAdminWidget({ ...widget, shown: TABLE_TOGGLE_LABEL });
  describeChartAlternatives(
    { Widget: widget.Widget, id: widget.definition.id, title: widget.title, summary, tableName, columns, rows },
    (element) => void renderAdminWidget(element),
  );
}

interface AdminFigureSpec {
  Widget: ComponentType<WidgetProps>;
  title: string;
  requirement: string;
  /** Overviews the widget can be fed, and every text the card must show for each. */
  samples: ReadonlyArray<{ name: string; overview: AdminOverview; shown: readonly string[] }>;
}

/** What a KPI of the administrator shows for each sample overview, formatted pt-BR, a zero count as `0`. */
export function describeAdminFigure({ Widget, title, requirement, samples }: AdminFigureSpec) {
  describe(`${title} figure (${requirement})`, () => {
    it.each(samples)('$name', async ({ overview, shown }) => {
      renderAdminWidget(<Widget size="S" />, { overview });

      const region = within(await screen.findByRole('region', { name: title }));
      for (const text of shown) expect(await region.findByText(text)).toBeInTheDocument();
    });
  });
}

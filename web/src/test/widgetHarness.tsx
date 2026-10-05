/// <reference types="node" />
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ComponentType, ReactElement } from 'react';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { axe } from 'vitest-axe';
import type { LoadPatientSummary } from '../features/patient-dashboard/application/loadPatientSummary';
import { defaultLayoutFor } from '../features/dashboard-layout/domain/defaultLayout';
import { SKELETON_HEIGHT, WIDGET_SIZES, type WidgetDefinition, type WidgetProps, type WidgetSize } from '../features/dashboard-layout';
import type { DateRange } from '../features/patient-dashboard/domain/period';
import type { GlucoseSummary } from '../features/patient-dashboard/domain/summary';
import { PeriodProvider } from '../features/patient-dashboard/presentation/periodContext';
import { SummaryServicesProvider } from '../features/patient-dashboard/presentation/summaryServices';
import { NO_READINGS_CAUSE } from '../features/patient-dashboard/presentation/widgets/summaryWidget';
import { AppError } from '../shared/domain/appError';
import type { Role } from '../shared/domain/role';
import { TABLE_TOGGLE_LABEL } from '../shared/presentation/charts/chartFrame';
import { ERROR_MESSAGE, RETRY_LABEL } from '../shared/presentation/ui/states';
import { stubChartContainer } from './chartContainer';
import { summaryFixture } from './summaryFakes';

export const TEST_RANGE: DateRange = { from: '2026-08-05', to: '2026-08-06' };

/** A period with no reading at all: no figure, no day with data, nothing ever synced. */
export function emptyPeriodSummary(): GlucoseSummary {
  return summaryFixture({
    lastReadingAt: null,
    totals: { readingsCount: 0, carbEntries: 0, insulinEntries: 0, alertsCount: 0 },
    timeInRangePercent: null,
    gmiPercent: null,
    coefficientOfVariationPercent: null,
    sensorUsePercent: 0,
    byDay: [],
    agp: [],
    heatmap: [],
    insulinByType: [],
    alertsByType: [],
    excursions: [],
  });
}

interface HarnessOptions {
  /** What the summary use case answers; the fixture when omitted. */
  summary?: GlucoseSummary;
  /** Replaces the use case altogether, to fail it or hold it back. */
  load?: LoadPatientSummary;
  range?: DateRange;
}

/** Mounts a widget the way the page does: the period, the summary use case and a query client that does not retry. */
export function renderWidget(widget: ReactElement, { summary = summaryFixture(), load, range = TEST_RANGE }: HarnessOptions = {}) {
  const loadPatientSummary = load ?? vi.fn<LoadPatientSummary>().mockResolvedValue(summary);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <SummaryServicesProvider services={{ loadPatientSummary }}>
        <PeriodProvider range={range}>{widget}</PeriodProvider>
      </SummaryServicesProvider>
    </QueryClientProvider>,
  );
  return { ...view, loadPatientSummary };
}

// The backend and the web both validate against this file (design.md, "Contrato do catálogo").
const CATALOG_PATH = join(import.meta.dirname, '../../../contracts/widget-catalog.json');
const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as { roles: Record<string, string[]>; sizes: string[] };

/** The sizes `contracts/widget-catalog.json` allows every widget. */
export const CATALOG_SIZES: readonly string[] = catalog.sizes;

/** The widget ids `contracts/widget-catalog.json` lists for `role`, in catalog order. */
export const catalogIdsOf = (role: string): string[] => catalog.roles[role] ?? [];

/** The roles of `contracts/widget-catalog.json` that list `id`. */
export const catalogRolesOf = (id: string): string[] =>
  Object.entries(catalog.roles)
    .filter(([, ids]) => ids.includes(id))
    .map(([role]) => role);

/** The skeleton on screen has the height the grid reserves for a widget of `size` (LAY-16). */
export function expectSkeletonOfSize(size: WidgetSize): void {
  expect(screen.getByRole('status', { name: 'Carregando' })).toHaveStyle({ height: SKELETON_HEIGHT[size] });
}

/** The catalog contract of a widget (LAY-01): its roles and sizes are the ones of the JSON, and its default size is the one the default layout gives it. */
export function describeCatalogDefinition(definition: WidgetDefinition, role: Role = 'PATIENT') {
  describe(`${definition.id} as a catalog widget (LAY-01)`, () => {
    it('declares the roles and sizes of contracts/widget-catalog.json', () => {
      expect(catalogRolesOf(definition.id)).toEqual([...definition.roles]);
      expect([...definition.sizes]).toEqual([...CATALOG_SIZES]);
    });

    it('prefers a size it allows, the one the default layout gives it', () => {
      const placed = defaultLayoutFor(role).widgets.find((item) => item.id === definition.id);

      expect(definition.sizes).toContain(definition.defaultSize);
      expect(placed?.size).toBe(definition.defaultSize);
    });
  });
}

export interface SummaryWidgetSpec {
  Widget: ComponentType<WidgetProps>;
  definition: WidgetDefinition;
  title: string;
  /** Text the widget shows once the fixture summary has loaded. */
  shown: string | RegExp;
  /** Overrides the cause of the empty state when it is not "Sem leituras no período". */
  emptyCause?: string;
}

/** How a family of widgets is mounted over each state of its data, for the state tests they share. */
export interface StatesScenario {
  /** A source that never answers. */
  loading(widget: ReactElement): void;
  /** A source with nothing to show; absent for a family that never shows an empty state (a count of zero is a figure). */
  empty?: (widget: ReactElement) => void;
  /** A source that fails once and then answers; `load` counts its calls. */
  failsOnce(widget: ReactElement): { load: Mock };
  /** A source with the fixture data. */
  loaded(widget: ReactElement): { container: HTMLElement };
}

type StatesSpec = Pick<SummaryWidgetSpec, 'Widget' | 'definition' | 'title' | 'shown'> & { emptyCause?: string };

/**
 * The states every widget shares (LAY-15, LAY-16): a skeleton of the height
 * of its size, the cause of an empty source (when the family has one), an
 * isolated error with retry and no axe violation. `scenario` feeds the family.
 */
export function describeWidgetStates({ Widget, definition, title, shown, emptyCause }: StatesSpec, scenario: StatesScenario) {
  const card = () => screen.findByRole('region', { name: title });

  describe(`${definition.id} states (LAY-15, LAY-16)`, () => {
    it.each(WIDGET_SIZES)('shows the skeleton at the height of size %s while the data loads', (size) => {
      scenario.loading(<Widget size={size} />);

      expectSkeletonOfSize(size);
    });

    const { empty } = scenario;
    if (empty && emptyCause !== undefined) {
      it('shows the cause, not a figure, when there is nothing to show', async () => {
        empty(<Widget size="S" />);
        expect(await within(await card()).findByText(emptyCause)).toBeInTheDocument();
        expect(screen.queryByText(shown)).not.toBeInTheDocument();
      });
    }

    it('keeps an error inside its own card and reloads on "Tentar novamente"', async () => {
      const { load } = scenario.failsOnce(<Widget size="S" />);

      const region = await card();
      expect(await within(region).findByRole('alert')).toHaveTextContent(ERROR_MESSAGE);

      await userEvent.setup().click(within(region).getByRole('button', { name: RETRY_LABEL }));

      expect(await within(region).findByText(shown)).toBeInTheDocument();
      expect(load).toHaveBeenCalledTimes(2);
    });

    it('has no axe violations with data', async () => {
      const { container } = scenario.loaded(<Widget size="S" />);
      await screen.findByText(shown);

      expect(await axe(container)).toHaveNoViolations();
    });
  });
}

const summaryScenario: StatesScenario = {
  loading: (widget) => void renderWidget(widget, { load: () => new Promise(() => undefined) }),
  empty: (widget) => void renderWidget(widget, { summary: emptyPeriodSummary() }),
  failsOnce: (widget) => {
    const load = vi.fn<LoadPatientSummary>().mockRejectedValueOnce(new AppError('unavailable')).mockResolvedValue(summaryFixture());
    renderWidget(widget, { load });
    return { load };
  },
  loaded: (widget) => renderWidget(widget),
};

/**
 * The behavior every widget that reads the page's summary shares (LAY-01,
 * LAY-15, LAY-16): its definition matches the catalog contract, and it shows a
 * skeleton, the cause of an empty period and an isolated error with retry.
 * Each widget's own test adds what its figure shows.
 */
export function describeSummaryWidget({ definition, emptyCause = NO_READINGS_CAUSE, ...spec }: SummaryWidgetSpec) {
  describeCatalogDefinition(definition);
  describeWidgetStates({ ...spec, definition, emptyCause }, summaryScenario);
}

interface ChartWidgetSpec extends Omit<SummaryWidgetSpec, 'shown'> {
  /** The sentence the chart carries for screen readers, for the fixture summary. */
  summary: string | RegExp;
  /** The accessible name of the table, when it is not the title. */
  tableName?: string;
  /** The "Ver como tabela" header cells. */
  columns: readonly string[];
  /** The table body for the fixture summary, formatted as shown. */
  rows: ReadonlyArray<readonly string[]>;
}

export type ChartAlternativesSpec = Pick<ChartWidgetSpec, 'Widget' | 'title' | 'summary' | 'tableName' | 'columns' | 'rows'> & { id: string };

/**
 * What every chart widget says besides its picture (RSP-07): a one-sentence
 * summary for screen readers and the same data as a table. `mount` renders the
 * widget the way its family is fed.
 */
export function describeChartAlternatives({ Widget, id, title, summary, tableName, columns, rows }: ChartAlternativesSpec, mount: (widget: ReactElement) => void) {
  describe(`${id} alternatives (RSP-07)`, () => {
    it('labels the chart with a one-sentence summary for screen readers', async () => {
      mount(<Widget size="M" />);

      const region = within(await screen.findByRole('region', { name: title }));
      expect(await region.findByRole('img', { name: summary })).toBeInTheDocument();
    });

    it('offers "Ver como tabela" with the same data, formatted in pt-BR', async () => {
      mount(<Widget size="M" />);

      await userEvent.setup().click(await screen.findByRole('button', { name: TABLE_TOGGLE_LABEL }));

      const table = screen.getByRole('table', { name: tableName ?? title });
      const [header = [], ...body] = within(table)
        .getAllByRole('row')
        .map((row) => [...row.querySelectorAll('th, td')].map((cell) => cell.textContent));
      expect(header).toEqual(columns);
      expect(body).toEqual(rows);
    });
  });
}

/**
 * What every chart widget shares (RSP-07): the summary widget states, with the
 * table toggle as proof the chart rendered, a text summary on the chart, and
 * the same data as a table.
 */
export function describeChartWidget({ summary, columns, rows, tableName, ...widget }: ChartWidgetSpec) {
  stubChartContainer();
  describeSummaryWidget({ ...widget, shown: TABLE_TOGGLE_LABEL });
  describeChartAlternatives(
    { Widget: widget.Widget, id: widget.definition.id, title: widget.title, summary, tableName, columns, rows },
    (element) => void renderWidget(element),
  );
}

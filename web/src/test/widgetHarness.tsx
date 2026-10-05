/// <reference types="node" />
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ComponentType, ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import type { LoadPatientSummary } from '../features/patient-dashboard/application/loadPatientSummary';
import { defaultLayoutFor } from '../features/dashboard-layout/domain/defaultLayout';
import { SKELETON_HEIGHT, type WidgetDefinition, type WidgetProps } from '../features/dashboard-layout';
import type { DateRange } from '../features/patient-dashboard/domain/period';
import type { GlucoseSummary } from '../features/patient-dashboard/domain/summary';
import { PeriodProvider } from '../features/patient-dashboard/presentation/periodContext';
import { SummaryServicesProvider } from '../features/patient-dashboard/presentation/summaryServices';
import { NO_READINGS_CAUSE } from '../features/patient-dashboard/presentation/widgets/summaryWidget';
import { AppError } from '../shared/domain/appError';
import { ERROR_MESSAGE, RETRY_LABEL } from '../shared/presentation/ui/states';
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

/** The roles of `contracts/widget-catalog.json` that list `id`. */
export const catalogRolesOf = (id: string): string[] =>
  Object.entries(catalog.roles)
    .filter(([, ids]) => ids.includes(id))
    .map(([role]) => role);

interface SummaryWidgetSpec {
  Widget: ComponentType<WidgetProps>;
  definition: WidgetDefinition;
  title: string;
  /** Text the widget shows once the fixture summary has loaded. */
  shown: string | RegExp;
  /** Overrides the cause of the empty state when it is not "Sem leituras no período". */
  emptyCause?: string;
}

/**
 * The behavior every widget that reads the page's summary shares (LAY-01,
 * LAY-15, LAY-16): its definition matches the catalog contract, and it shows a
 * skeleton, the cause of an empty period and an isolated error with retry.
 * Each widget's own test adds what its figure shows.
 */
export function describeSummaryWidget({ Widget, definition, title, shown, emptyCause = NO_READINGS_CAUSE }: SummaryWidgetSpec) {
  const card = () => screen.findByRole('region', { name: title });

  describe(`${definition.id} as a catalog widget (LAY-01)`, () => {
    it('declares the roles and sizes of contracts/widget-catalog.json', () => {
      expect(catalogRolesOf(definition.id)).toEqual([...definition.roles]);
      expect([...definition.sizes]).toEqual(catalog.sizes);
    });

    it('prefers a size it allows, the one the default layout gives it', () => {
      const placed = defaultLayoutFor('PATIENT').widgets.find((item) => item.id === definition.id);

      expect(definition.sizes).toContain(definition.defaultSize);
      expect(placed?.size).toBe(definition.defaultSize);
    });
  });

  describe(`${definition.id} states (LAY-15, LAY-16)`, () => {
    it('shows the skeleton at the height of its size while the summary loads', () => {
      renderWidget(<Widget size="L" />, { load: () => new Promise(() => undefined) });

      expect(screen.getByRole('status', { name: 'Carregando' })).toHaveStyle({ height: SKELETON_HEIGHT.L });
    });

    it('shows the cause, not a number, when the period has no readings', async () => {
      renderWidget(<Widget size="S" />, { summary: emptyPeriodSummary() });

      expect(await within(await card()).findByText(emptyCause)).toBeInTheDocument();
      expect(screen.queryByText(shown)).not.toBeInTheDocument();
    });

    it('keeps an error inside its own card and reloads on "Tentar novamente"', async () => {
      const load = vi.fn<LoadPatientSummary>().mockRejectedValueOnce(new AppError('unavailable')).mockResolvedValue(summaryFixture());
      renderWidget(<Widget size="S" />, { load });

      const region = await card();
      expect(await within(region).findByRole('alert')).toHaveTextContent(ERROR_MESSAGE);

      await userEvent.setup().click(within(region).getByRole('button', { name: RETRY_LABEL }));

      expect(await within(region).findByText(shown)).toBeInTheDocument();
      expect(load).toHaveBeenCalledTimes(2);
    });

    it('has no axe violations with data', async () => {
      const { container } = renderWidget(<Widget size="S" />);
      await screen.findByText(shown);

      expect(await axe(container)).toHaveNoViolations();
    });
  });
}

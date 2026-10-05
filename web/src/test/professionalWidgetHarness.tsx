import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import type { ComponentType, ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { WidgetDefinition, WidgetProps } from '../features/dashboard-layout';
import type { ProfessionalUseCases } from '../features/professional/application/professionalUseCases';
import type { CohortSummary, PatientPage } from '../features/professional/domain/cohort';
import { ProfessionalPeriodProvider } from '../features/professional/presentation/periodContext';
import { ProfessionalServicesProvider } from '../features/professional/presentation/professionalServices';
import { RevokedAccessProvider } from '../features/professional/presentation/revokedAccess';
import { TABLE_TOGGLE_LABEL } from '../shared/presentation/charts/chartFrame';
import { NO_PATIENTS_CAUSE } from '../features/professional/presentation/widgets/cohortWidget';
import { AppError } from '../shared/domain/appError';
import { cohortSummaryOf, patientPageOf } from './professionalFakes';
import { stubChartContainer } from './chartContainer';
import { describeCatalogDefinition, describeChartAlternatives, describeWidgetStates, type ChartAlternativesSpec, type StatesScenario } from './widgetHarness';

/** The period the harness puts above a widget unless a test picks another. */
export const TEST_DAYS = 30;

interface ProfessionalHarnessOptions {
  /** What `loadCohort` answers; the fixture when omitted. */
  cohort?: CohortSummary;
  /** What `loadPatients` answers; the fixture when omitted. */
  patients?: PatientPage;
  /** Replaces a use case altogether, to fail it, hold it back or watch its calls. */
  services?: Partial<ProfessionalUseCases>;
  days?: number;
  client?: QueryClient;
}

/** The professional use cases over fakes: every call is a `vi.fn` the test can inspect. */
export function fakeProfessionalServices({ cohort, patients, services }: ProfessionalHarnessOptions = {}): ProfessionalUseCases {
  return {
    loadCohort: vi.fn<ProfessionalUseCases['loadCohort']>().mockResolvedValue(cohort ?? cohortSummaryOf()),
    loadPatients: vi.fn<ProfessionalUseCases['loadPatients']>().mockResolvedValue(patients ?? patientPageOf()),
    redeemInvite: vi.fn<ProfessionalUseCases['redeemInvite']>().mockResolvedValue({ patientId: 'p9', grantId: 'g9' }),
    ...services,
  };
}

/**
 * Mounts a widget the way the page does: the period, the use cases, the
 * revoked-access notice, a router (the table links to a patient) and a query
 * client that does not retry.
 */
export function renderProfessionalWidget(widget: ReactElement, options: ProfessionalHarnessOptions = {}) {
  const { days = TEST_DAYS, client = new QueryClient({ defaultOptions: { queries: { retry: false } } }) } = options;
  const services = fakeProfessionalServices(options);
  const view = render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ProfessionalServicesProvider services={services}>
          <RevokedAccessProvider>
            <ProfessionalPeriodProvider days={days}>{widget}</ProfessionalPeriodProvider>
          </RevokedAccessProvider>
        </ProfessionalServicesProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { ...view, services, client };
}

/** A portfolio with no linked patient: no figure, no chart point, nothing to list. */
export function emptyCohortOf(): CohortSummary {
  return cohortSummaryOf({
    patientCount: 0,
    avgTimeInRangePercent: null,
    avgGmiPercent: null,
    patientsWithHypo: 0,
    patientsStale: 0,
    perPatient: [],
    tirHistogram: [
      { bucket: 'lt50', count: 0 },
      { bucket: '50to70', count: 0 },
      { bucket: 'gte70', count: 0 },
    ],
    hypoByHour: [],
  });
}

type Load = ReturnType<typeof vi.fn>;

/** What differs between the two queries a professional widget can be fed by. */
const SOURCES = {
  cohort: {
    fixture: () => cohortSummaryOf(),
    empty: (): ProfessionalHarnessOptions => ({ cohort: emptyCohortOf() }),
    using: (load: Load): Partial<ProfessionalUseCases> => ({ loadCohort: load as unknown as ProfessionalUseCases['loadCohort'] }),
  },
  patients: {
    fixture: () => patientPageOf(),
    empty: (): ProfessionalHarnessOptions => ({ patients: { ...patientPageOf([]), total: 0 } }),
    using: (load: Load): Partial<ProfessionalUseCases> => ({ loadPatients: load as unknown as ProfessionalUseCases['loadPatients'] }),
  },
} as const;

export interface CohortWidgetSpec {
  Widget: ComponentType<WidgetProps>;
  definition: WidgetDefinition;
  title: string;
  /** Text the widget shows once the fixture has loaded. */
  shown: string | RegExp;
  /** The query that feeds the widget: the cohort summary (default) or the list of patients. */
  source?: keyof typeof SOURCES;
  /** Overrides the cause of the empty state when it is not "Nenhum paciente vinculado". */
  emptyCause?: string;
}

/** How a widget of the portfolio is mounted over each state of the query that feeds it. */
function scenarioOf(source: keyof typeof SOURCES): StatesScenario {
  const { fixture, empty, using } = SOURCES[source];
  return {
    loading: (widget) => void renderProfessionalWidget(widget, { services: using(vi.fn(() => new Promise(() => undefined))) }),
    empty: (widget) => void renderProfessionalWidget(widget, empty()),
    failsOnce: (widget) => {
      const load = vi.fn().mockRejectedValueOnce(new AppError('unavailable')).mockResolvedValue(fixture());
      renderProfessionalWidget(widget, { services: using(load) });
      return { load };
    },
    loaded: (widget) => renderProfessionalWidget(widget),
  };
}

/**
 * The behavior every widget of the portfolio shares (LAY-01, LAY-15, LAY-16):
 * its definition matches the catalog contract and the professional's default
 * layout, and it shows a skeleton of its size, the cause when no patient is
 * linked, an isolated error with retry and no axe violation. Each widget's own
 * test adds what its figure shows.
 */
export function describeCohortWidget({ definition, source = 'cohort', emptyCause = NO_PATIENTS_CAUSE, ...spec }: CohortWidgetSpec) {
  describeCatalogDefinition(definition, 'HEALTH_PROFESSIONAL');
  describeWidgetStates({ ...spec, definition, emptyCause }, scenarioOf(source));
}

interface CohortFigureSpec {
  Widget: ComponentType<WidgetProps>;
  title: string;
  /** The fixture cohort with the widget's own figure set to `value`. */
  withValue: (value: number | null) => CohortSummary;
  /** Values the figure can take, and how each reads once formatted. */
  samples: ReadonlyArray<{ value: number | null; shown: string }>;
  /** The line of context under the figure, when the card has one. */
  note?: string;
  requirement: string;
}

/** What a KPI of the portfolio shows: its figure, formatted pt-BR, for each sample, `—` for a missing average and a real zero as `0`. */
export function describeCohortFigure({ Widget, title, withValue, samples, note, requirement }: CohortFigureSpec) {
  describe(`${title} figure (${requirement})`, () => {
    it.each(samples)('shows $shown for $value', async ({ value, shown }) => {
      renderProfessionalWidget(<Widget size="S" />, { cohort: withValue(value) });

      const region = within(await screen.findByRole('region', { name: title }));
      expect(await region.findByText(shown)).toBeInTheDocument();
    });

    if (note === undefined) return;
    it('says what the figure counts under it', async () => {
      renderProfessionalWidget(<Widget size="S" />);

      const region = within(await screen.findByRole('region', { name: title }));
      expect(await region.findByText(note)).toBeInTheDocument();
    });
  });
}

type CohortChartSpec = Omit<CohortWidgetSpec, 'shown' | 'source'> & Pick<ChartAlternativesSpec, 'summary' | 'tableName' | 'columns' | 'rows'>;

/**
 * What every chart widget of the portfolio shares (RSP-07): the cohort widget
 * states, with the table toggle as proof the chart rendered, a text summary on
 * the chart and the same data as a table.
 */
export function describeCohortChart({ summary, columns, rows, tableName, ...widget }: CohortChartSpec) {
  stubChartContainer();
  describeCohortWidget({ ...widget, shown: TABLE_TOGGLE_LABEL });
  describeChartAlternatives(
    { Widget: widget.Widget, id: widget.definition.id, title: widget.title, summary, tableName, columns, rows },
    (element) => void renderProfessionalWidget(element),
  );
}

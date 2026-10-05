import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import type { ProfessionalUseCases } from '../features/professional/application/professionalUseCases';
import type { CohortSummary, PatientPage } from '../features/professional/domain/cohort';
import { ProfessionalPeriodProvider } from '../features/professional/presentation/periodContext';
import { ProfessionalServicesProvider } from '../features/professional/presentation/professionalServices';
import { RevokedAccessProvider } from '../features/professional/presentation/revokedAccess';
import { cohortSummaryOf, patientPageOf } from './professionalFakes';

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

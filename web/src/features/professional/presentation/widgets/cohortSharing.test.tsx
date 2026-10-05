import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { mockPortfolio, professionalWrapper } from '../../../../test/professionalHarness';
import { ProfessionalPeriodProvider } from '../periodContext';
import ProKpiPatients from './proKpiPatients';
import ProKpiTir from './proKpiTir';

describe('widgets of one page share their cohort request (PRO-05)', () => {
  it('asks the gateway once for the period, however many widgets read the cohort', async () => {
    const mock = mockPortfolio();
    const { wrapper } = professionalWrapper();

    render(
      <MemoryRouter>
        <ProfessionalPeriodProvider days={14}>
          <ProKpiPatients size="S" />
          <ProKpiTir size="S" />
        </ProfessionalPeriodProvider>
      </MemoryRouter>,
      { wrapper },
    );

    expect(await screen.findByText('64,0')).toBeInTheDocument();
    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(mock.cohortRequests).toHaveLength(1);
    expect(mock.cohortRequests[0]?.searchParams.get('days')).toBe('14');
    expect(mock.listRequests).toHaveLength(0);
  });
});

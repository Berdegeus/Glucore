import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cohortSummaryOf } from '../../../../test/professionalFakes';
import { describeCohortFigure, describeCohortWidget, renderProfessionalWidget } from '../../../../test/professionalWidgetHarness';
import { TARGET_MET_TEXT, TARGET_MISSED_TEXT } from '../../../../shared/presentation/ui/kpiCard';
import ProKpiTir, { PRO_KPI_TIR_TITLE, proKpiTirDefinition } from './proKpiTir';

const withTir = (value: number | null) => cohortSummaryOf({ avgTimeInRangePercent: value });

describeCohortWidget({ Widget: ProKpiTir, definition: proKpiTirDefinition, title: PRO_KPI_TIR_TITLE, shown: '64,0' });

describeCohortFigure({
  Widget: ProKpiTir,
  title: PRO_KPI_TIR_TITLE,
  withValue: withTir,
  samples: [
    { value: 82.34, shown: '82,3' },
    { value: 0, shown: '0,0' },
    { value: null, shown: '—' },
  ],
  requirement: 'PRO-09',
});

describe('pro-kpi-tir goal of 70 % (PRO-09)', () => {
  it('shows the figure in percent with the goal line', async () => {
    renderProfessionalWidget(<ProKpiTir size="S" />, { cohort: withTir(82.34) });

    const card = within(await screen.findByRole('region', { name: PRO_KPI_TIR_TITLE }));
    expect(await card.findByText('82,3')).toBeInTheDocument();
    expect(card.getByText('%')).toBeInTheDocument();
    expect(card.getByText('Meta: 70 %')).toBeInTheDocument();
  });

  it.each([
    { value: 69.9, met: false },
    { value: 70, met: true },
    { value: 70.1, met: true },
  ])('says the goal is met: $met, for $value', async ({ value, met }) => {
    renderProfessionalWidget(<ProKpiTir size="S" />, { cohort: withTir(value) });

    expect(await screen.findByText(met ? TARGET_MET_TEXT : TARGET_MISSED_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(met ? TARGET_MISSED_TEXT : TARGET_MET_TEXT)).not.toBeInTheDocument();
  });

  it('gives no verdict when no patient has an average yet', async () => {
    renderProfessionalWidget(<ProKpiTir size="S" />, { cohort: withTir(null) });

    expect(await screen.findByText('—')).toBeInTheDocument();
    expect(screen.queryByText(TARGET_MET_TEXT)).not.toBeInTheDocument();
    expect(screen.queryByText(TARGET_MISSED_TEXT)).not.toBeInTheDocument();
  });
});

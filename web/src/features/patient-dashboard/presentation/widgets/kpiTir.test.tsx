import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TARGET_MET_TEXT, TARGET_MISSED_TEXT } from '../../../../shared/presentation/ui/kpiCard';
import { describeSummaryWidget, renderWidget } from '../../../../test/widgetHarness';
import { summaryFixture } from '../../../../test/summaryFakes';
import KpiTir, { kpiTirDefinition, KPI_TIR_TITLE } from './kpiTir';

describeSummaryWidget({ Widget: KpiTir, definition: kpiTirDefinition, title: KPI_TIR_TITLE, shown: '23,5' });

describe('kpi-tir figure (PAC-05)', () => {
  it('shows the time in range in percent, with the 70 % goal, from summary.timeInRangePercent', async () => {
    renderWidget(<KpiTir size="S" />, { summary: summaryFixture({ timeInRangePercent: 82.34 }) });

    const card = within(await screen.findByRole('region', { name: 'Tempo no alvo' }));
    expect(await card.findByText('82,3')).toBeInTheDocument();
    expect(card.getByText('%')).toBeInTheDocument();
    expect(card.getByText('Meta: 70 %')).toBeInTheDocument();
    expect(card.getByText(TARGET_MET_TEXT)).toBeInTheDocument();
  });

  it.each([
    { value: 69.9, verdict: TARGET_MISSED_TEXT },
    { value: 70, verdict: TARGET_MET_TEXT },
  ])('says "$verdict" for $value %, the goal being at least 70 %', async ({ value, verdict }) => {
    renderWidget(<KpiTir size="S" />, { summary: summaryFixture({ timeInRangePercent: value }) });

    expect(await screen.findByText(verdict)).toBeInTheDocument();
  });
});

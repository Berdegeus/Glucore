import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TARGET_MET_TEXT, TARGET_MISSED_TEXT } from '../../../../shared/presentation/ui/kpiCard';
import { summaryFixture } from '../../../../test/summaryFakes';
import { describeSummaryWidget, renderWidget } from '../../../../test/widgetHarness';
import KpiCv, { kpiCvDefinition, KPI_CV_TITLE } from './kpiCv';

describeSummaryWidget({ Widget: KpiCv, definition: kpiCvDefinition, title: KPI_CV_TITLE, shown: '41,2' });

describe('kpi-cv figure (PAC-05)', () => {
  it('shows the CV in percent from summary.coefficientOfVariationPercent, with the target of up to 36 %', async () => {
    renderWidget(<KpiCv size="S" />, { summary: summaryFixture({ coefficientOfVariationPercent: 30.26 }) });

    const card = within(await screen.findByRole('region', { name: 'Variabilidade (CV)' }));
    expect(await card.findByText('30,3')).toBeInTheDocument();
    expect(card.getByText('%')).toBeInTheDocument();
    expect(card.getByText('Meta: até 36 %')).toBeInTheDocument();
    expect(card.getByText(TARGET_MET_TEXT)).toBeInTheDocument();
  });

  it.each([
    { value: 36, verdict: TARGET_MET_TEXT },
    { value: 36.1, verdict: TARGET_MISSED_TEXT },
  ])('says "$verdict" for $value %, the ceiling being 36 %', async ({ value, verdict }) => {
    renderWidget(<KpiCv size="S" />, { summary: summaryFixture({ coefficientOfVariationPercent: value }) });

    expect(await screen.findByText(verdict)).toBeInTheDocument();
  });
});

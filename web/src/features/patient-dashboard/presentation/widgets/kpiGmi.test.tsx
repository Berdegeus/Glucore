import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { daysWithReadings, dayBucket, summaryFixture } from '../../../../test/summaryFakes';
import { describeSummaryWidget, renderWidget } from '../../../../test/widgetHarness';
import KpiGmi, { kpiGmiDefinition, KPI_GMI_TITLE } from './kpiGmi';

// The wording is fixed by PAC-05, so the tests spell it out.
const FEW_DAYS_NOTE = 'Poucos dados no período';

describeSummaryWidget({ Widget: KpiGmi, definition: kpiGmiDefinition, title: KPI_GMI_TITLE, shown: '6,9' });

describe('kpi-gmi figure (PAC-05)', () => {
  it('shows the GMI in percent from summary.gmiPercent, with no target', async () => {
    renderWidget(<KpiGmi size="S" />, { summary: summaryFixture({ gmiPercent: 7.26, byDay: daysWithReadings(14) }) });

    expect(await screen.findByText('7,3')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
    expect(screen.queryByText(/Meta/)).not.toBeInTheDocument();
  });

  it.each([
    { days: 13, note: true },
    { days: 14, note: false },
  ])('with $days days of readings the few-days note is shown: $note', async ({ days, note }) => {
    renderWidget(<KpiGmi size="S" />, { summary: summaryFixture({ byDay: daysWithReadings(days) }) });

    expect(await screen.findByText('6,9')).toBeInTheDocument();
    expect(screen.queryByText(FEW_DAYS_NOTE) !== null).toBe(note);
  });

  it('counts only days that have readings toward the 14', async () => {
    const byDay = [...daysWithReadings(13), dayBucket({ day: '2026-07-20', avgGlucose: null, readingsCount: 0 })];
    renderWidget(<KpiGmi size="S" />, { summary: summaryFixture({ byDay }) });

    expect(await screen.findByText(FEW_DAYS_NOTE)).toBeInTheDocument();
  });

  it('says the note is "Poucos dados no período"', () => {
    expect(FEW_DAYS_NOTE).toBe('Poucos dados no período');
  });
});

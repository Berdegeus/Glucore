import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cohortSummaryOf } from '../../../../test/professionalFakes';
import { describeCohortChart, renderProfessionalWidget } from '../../../../test/professionalWidgetHarness';
import ProTirHistogram, { PRO_TIR_HISTOGRAM_TITLE, proTirHistogramDefinition } from './proTirHistogram';
import { tirHistogramRows } from './tirHistogramModel';

describeCohortChart({
  Widget: ProTirHistogram,
  definition: proTirHistogramDefinition,
  title: PRO_TIR_HISTOGRAM_TITLE,
  summary: 'Pacientes por faixa de tempo no alvo (TIR): < 50 %: 0 pacientes; 50–70 %: 1 paciente; ≥ 70 %: 1 paciente.',
  columns: ['Faixa de TIR', 'Pacientes'],
  rows: [
    ['< 50 %', '0'],
    ['50–70 %', '1'],
    ['≥ 70 %', '1'],
  ],
});

describe('pro-tir-histogram figure (PRO-10)', () => {
  it('draws the three bands, left to right, labelled "< 50 %", "50–70 %" and "≥ 70 %"', async () => {
    const { container } = renderProfessionalWidget(<ProTirHistogram size="M" />);
    await screen.findByRole('button', { name: 'Ver como tabela' });

    const labels = [...container.querySelectorAll('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value')].map((label) => label.textContent);
    expect(labels).toEqual(['< 50 %', '50–70 %', '≥ 70 %']);
  });

  it('puts the bands in order even when the gateway lists them in another', () => {
    const cohort = cohortSummaryOf({
      tirHistogram: [
        { bucket: 'gte70', count: 5 },
        { bucket: 'lt50', count: 2 },
        { bucket: '50to70', count: 3 },
      ],
    });

    expect(tirHistogramRows(cohort)).toEqual([
      { band: '< 50 %', count: 2 },
      { band: '50–70 %', count: 3 },
      { band: '≥ 70 %', count: 5 },
    ]);
  });

  it('counts a band the gateway left out as no patient', () => {
    const cohort = cohortSummaryOf({ tirHistogram: [{ bucket: 'gte70', count: 4 }] });

    expect(tirHistogramRows(cohort)).toEqual([
      { band: '< 50 %', count: 0 },
      { band: '50–70 %', count: 0 },
      { band: '≥ 70 %', count: 4 },
    ]);
  });

  it('reads "paciente" in the singular and the plural in the summary', async () => {
    const cohort = cohortSummaryOf({
      tirHistogram: [
        { bucket: 'lt50', count: 1 },
        { bucket: '50to70', count: 12 },
        { bucket: 'gte70', count: 0 },
      ],
    });
    renderProfessionalWidget(<ProTirHistogram size="M" />, { cohort });

    expect(
      await screen.findByRole('img', { name: 'Pacientes por faixa de tempo no alvo (TIR): < 50 %: 1 paciente; 50–70 %: 12 pacientes; ≥ 70 %: 0 pacientes.' }),
    ).toBeInTheDocument();
  });
});

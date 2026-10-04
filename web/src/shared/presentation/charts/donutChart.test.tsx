import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { stubChartContainer } from '../../../test/chartContainer';
import { expectResponsive, renderChart } from '../../../test/chartQueries';
import { axe } from 'vitest-axe';
import { ChartFrame } from './chartFrame';
import { DONUT_EMPTY_CAUSE, DonutChart, type DonutChartProps } from './donutChart';

stubChartContainer({ width: 600, height: 280 });

const SLICES = [
  { label: 'Pacientes', value: 60 },
  { label: 'Profissionais', value: 30 },
  { label: 'Administradores', value: 10 },
];

const draw = (props: Partial<DonutChartProps> = {}) => renderChart(<DonutChart slices={SLICES} {...props} />);

describe('DonutChart', () => {
  it('draws inside a ResponsiveContainer, at the container width (RSP-05)', () => {
    expectResponsive(draw().container);
  });

  it('draws one slice per entry, in series colors (ADM-02)', () => {
    const slices = draw().all('.recharts-pie-sector path');
    expect(slices).toHaveLength(SLICES.length);
    expect(slices.map((slice) => slice.getAttribute('fill'))).toEqual(['var(--series-1)', 'var(--series-2)', 'var(--series-3)']);
  });

  it('labels each slice with its share in pt-BR (ADM-02)', () => {
    const labels = draw().all('svg.recharts-surface text').map((label) => label.textContent);
    expect(labels).toEqual(['60,0 %', '30,0 %', '10,0 %']);
  });

  it('names every slice in the legend and honours a color given by the caller', () => {
    const { all } = draw({ slices: SLICES.map((slice) => ({ ...slice, color: 'var(--zone-target)' })) });
    expect(all('li').map((item) => item.textContent)).toEqual(['Pacientes', 'Profissionais', 'Administradores']);
    expect(all('.recharts-pie-sector path').map((slice) => slice.getAttribute('fill'))).toEqual(Array(3).fill('var(--zone-target)'));
  });

  it('shows the empty state, with its cause, when the total is zero (ADM-02)', () => {
    const { container } = draw({ slices: SLICES.map((slice) => ({ ...slice, value: 0 })) });
    expect(screen.getByRole('status')).toHaveTextContent(DONUT_EMPTY_CAUSE);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('shows the empty state for no slices, with the cause the caller gave', () => {
    draw({ slices: [], emptyCause: 'Nenhuma conta ainda' });
    expect(screen.getByRole('status')).toHaveTextContent('Nenhuma conta ainda');
  });

  it('has no axe violations inside the chart frame (ADM-02)', async () => {
    const { container } = render(
      <ChartFrame title="Contas por papel" summary="Contas por papel." columns={['Papel', 'Contas']} rows={[['Pacientes', '60']]}>
        <DonutChart slices={SLICES} />
      </ChartFrame>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

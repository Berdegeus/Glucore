import { describe, expect, it } from 'vitest';
import { expectAccessibleInFrame } from '../../../test/chartA11y';
import { stubChartContainer } from '../../../test/chartContainer';
import { expectResponsive, renderChart } from '../../../test/chartQueries';
import { ScatterQuadrantChart, quadrantsOf, type ScatterQuadrantChartProps } from './scatterQuadrantChart';

stubChartContainer({ width: 600, height: 280 });

const PROPS: ScatterQuadrantChartProps = {
  points: [
    { label: 'Ana', x: 55, y: 30 },
    { label: 'Bia', x: 82, y: 28 },
    { label: 'Caio', x: 91, y: 40 },
  ],
  x: { label: 'Tempo no alvo (%)', threshold: 70, domain: [0, 100] },
  y: { label: 'CV (%)', threshold: 36, domain: [0, 60] },
};

const draw = (props: Partial<ScatterQuadrantChartProps> = {}) =>
  renderChart(<ScatterQuadrantChart {...PROPS} {...props} />);

describe('ScatterQuadrantChart', () => {
  it('draws inside a ResponsiveContainer, at the container width (RSP-05)', () => {
    expectResponsive(draw().container);
  });

  it('draws one point per patient and labels each with its name (PRO-10)', () => {
    const { all } = draw();
    expect(all('.recharts-scatter-symbol')).toHaveLength(PROPS.points.length);
    expect(all('.recharts-label-list text').map((label) => label.textContent)).toEqual(['Ana', 'Bia', 'Caio']);
  });

  it('draws the reference lines at the thresholds received: TIR 70 and CV 36 (PRO-10)', () => {
    const lines = draw().all('.recharts-reference-line-line');
    expect(lines.map((line) => [line.getAttribute('x'), line.getAttribute('y')])).toEqual([
      ['70', null],
      [null, '36'],
    ]);
  });

  it('shades four quadrants cut at the thresholds, and only the favorable one in the target color (PRO-10)', () => {
    const areas = draw().all('.recharts-reference-area-rect');
    expect(areas.map((area) => ['x1', 'x2', 'y1', 'y2'].map((name) => area.getAttribute(name)))).toEqual([
      ['0', '70', '0', '36'],
      ['0', '70', '36', '60'],
      ['70', '100', '0', '36'],
      ['70', '100', '36', '60'],
    ]);
    expect(areas.map((area) => area.getAttribute('fill'))).toEqual([
      'var(--color-border)',
      'var(--color-border)',
      'var(--zone-target)',
      'var(--color-border)',
    ]);
  });

  it('titles both axes', () => {
    const titles = draw().all('.recharts-label').map((label) => label.textContent);
    expect(titles).toEqual(expect.arrayContaining(['Tempo no alvo (%)', 'CV (%)']));
  });

  it('has no axe violations inside the chart frame (PRO-10)', async () => {
    await expectAccessibleInFrame(<ScatterQuadrantChart {...PROPS} />);
  });
});

describe('quadrantsOf', () => {
  const { x, y } = PROPS;

  it('marks the quadrant chosen as favorable, and no other', () => {
    const favorable = quadrantsOf(x, y, { x: 'below', y: 'above' }).filter((quadrant) => quadrant.favorable);
    expect(favorable).toEqual([{ x1: 0, x2: 70, y1: 36, y2: 60, favorable: true }]);
  });

  it('covers the whole domain without overlap', () => {
    const area = quadrantsOf(x, y, { x: 'above', y: 'below' }).reduce((sum, q) => sum + (q.x2 - q.x1) * (q.y2 - q.y1), 0);
    expect(area).toBe(100 * 60);
  });
});

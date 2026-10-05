import { describe, expect, it } from 'vitest';
import { expectAccessibleInFrame } from '../../../test/chartA11y';
import { stubChartContainer } from '../../../test/chartContainer';
import { renderChart } from '../../../test/chartQueries';
import { EMPTY_VALUE, formatMgdl } from '../format';
import { HeatmapChart, type HeatmapChartProps } from './heatmapChart';
import { buildGrid, cellSize, intensity, showHourLabel, valueRange } from './heatmapModel';

stubChartContainer({ width: 600, height: 280 });

const CELLS = [
  { day: 1, hour: 8, value: 100 },
  { day: 1, hour: 9, value: 150 },
  { day: 6, hour: 23, value: 200 },
  { day: 0, hour: 0, value: null },
];

const draw = (props: Partial<HeatmapChartProps> = {}) => renderChart(<HeatmapChart cells={CELLS} {...props} />);
const cellAt = (all: (selector: string) => Element[], day: number, hour: number) =>
  all(`rect[data-day="${day}"][data-hour="${hour}"]`)[0] as Element;

describe('HeatmapChart', () => {
  it('draws the 7 x 24 grid: 168 cells when given a few, and never more (PAC-10)', () => {
    expect(draw().all('rect')).toHaveLength(168);
    const flood = Array.from({ length: 400 }, (_, index) => ({ day: index % 9, hour: index % 30, value: index }));
    expect(draw({ cells: flood }).all('rect')).toHaveLength(168);
  });

  it('leaves a cell empty where there is no data: no fill, marked empty, value shown as a dash (PAC-10)', () => {
    const { all } = draw();
    const empty = all('rect[data-empty="true"]');
    expect(empty).toHaveLength(168 - 3);
    expect(cellAt(all, 0, 0)).toHaveAttribute('fill', 'none');
    expect(cellAt(all, 0, 0).querySelector('title')?.textContent).toBe(`dom, 0h: ${EMPTY_VALUE}`);
    expect(cellAt(all, 3, 12).querySelector('title')?.textContent).toBe(`qua, 12h: ${EMPTY_VALUE}`);
  });

  it('gives each cell a title with its day, hour and value (PAC-10)', () => {
    const { all } = draw({ formatValue: formatMgdl });
    expect(cellAt(all, 1, 8).querySelector('title')?.textContent).toBe('seg, 8h: 142 mg/dL'.replace('142', '100'));
    expect(cellAt(all, 6, 23).querySelector('title')?.textContent).toBe('sáb, 23h: 200 mg/dL');
  });

  it('uses the day labels received', () => {
    const labels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    const { all } = draw({ dayLabels: labels });
    expect(cellAt(all, 2, 5).querySelector('title')?.textContent).toBe(`T, 5h: ${EMPTY_VALUE}`);
  });

  it('shades filled cells darker as the value rises (PAC-10)', () => {
    const { all } = draw();
    const opacities = [cellAt(all, 1, 8), cellAt(all, 1, 9), cellAt(all, 6, 23)].map((cell) =>
      Number(cell.getAttribute('fill-opacity')),
    );
    expect(opacities[0]).toBeLessThan(opacities[1] as number);
    expect(opacities[1]).toBeLessThan(opacities[2] as number);
    expect(opacities[2]).toBe(1);
    expect(cellAt(all, 1, 8)).toHaveAttribute('fill', 'var(--color-brand)');
  });

  it('shows the color scale with the lowest and the highest value, and none without data', () => {
    const scale = draw().all('span').filter((span) => span.children.length === 0 && span.textContent);
    expect(scale.map((span) => span.textContent)).toEqual(['100', '200']);
    expect(draw({ cells: [] }).all('span')).toHaveLength(0);
  });

  it('has no axe violations inside the chart frame (PAC-10)', async () => {
    await expectAccessibleInFrame(<HeatmapChart cells={CELLS} />);
  });
});

describe('buildGrid', () => {
  it('lists every day and hour, day by day', () => {
    const grid = buildGrid([]);
    expect(grid).toHaveLength(168);
    expect(grid[0]).toEqual({ day: 0, hour: 0, value: null });
    expect(grid[24]).toEqual({ day: 1, hour: 0, value: null });
    expect(grid[167]).toEqual({ day: 6, hour: 23, value: null });
  });

  it.each([
    ['day 7', { day: 7, hour: 0, value: 1 }],
    ['day -1', { day: -1, hour: 0, value: 1 }],
    ['hour 24', { day: 0, hour: 24, value: 1 }],
    ['a fractional hour', { day: 0, hour: 1.5, value: 1 }],
  ])('ignores %s', (_, cell) => {
    expect(buildGrid([cell]).every((item) => item.value === null)).toBe(true);
  });

  it('accepts the last day and hour, and keeps the last of two values for a pair', () => {
    const grid = buildGrid([
      { day: 6, hour: 23, value: 5 },
      { day: 2, hour: 3, value: 1 },
      { day: 2, hour: 3, value: 2 },
    ]);
    expect(grid[167]?.value).toBe(5);
    expect(grid[2 * 24 + 3]?.value).toBe(2);
  });

  it('treats a value that is not a number as no data', () => {
    expect(buildGrid([{ day: 0, hour: 0, value: Number.NaN }])[0]?.value).toBeNull();
  });
});

describe('color scale and sizing', () => {
  it('reads the range from the cells that have data', () => {
    expect(valueRange(buildGrid(CELLS))).toEqual([100, 200]);
    expect(valueRange(buildGrid([]))).toBeNull();
  });

  it('maps the lowest value to 0.18, the highest to 1, clamps outside, and a flat range to 1', () => {
    expect(intensity(100, [100, 200])).toBeCloseTo(0.18, 5);
    expect(intensity(200, [100, 200])).toBe(1);
    expect(intensity(50, [100, 200])).toBeCloseTo(0.18, 5);
    expect(intensity(300, [100, 200])).toBe(1);
    expect(intensity(7, [7, 7])).toBe(1);
  });

  it('sizes the cells from the width, with a floor of 10 px', () => {
    expect(cellSize(36 + 24 * 25, 36)).toBe(25);
    expect(cellSize(36 + 24 * 25 - 1, 36)).toBe(24);
    expect(cellSize(100, 36)).toBe(10);
  });

  it('labels every hour from 22 px cells and every third hour below', () => {
    expect(showHourLabel(1, 22)).toBe(true);
    expect(showHourLabel(1, 21)).toBe(false);
    expect(showHourLabel(3, 21)).toBe(true);
  });
});

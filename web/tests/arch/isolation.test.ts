import { describe, expect, it } from 'vitest';
import { violationsIn } from './cruise';

// ARQ-11 / ARQ-15 and the design's isolation rows: chart and drag libraries
// stay behind their adapters, features meet only through a public index.ts,
// and no module cycle exists.

describe('library isolation, feature boundaries and cycles (dependency-cruiser)', () => {
  it('rejects recharts outside shared/presentation/charts', async () => {
    expect(await violationsIn('isolation/recharts-outside-charts')).toEqual([
      {
        rule: 'recharts-only-in-chart-adapters',
        from: 'src/features/demo/presentation/TrendChart.ts',
        to: 'recharts',
      },
    ]);
  });

  it('rejects @dnd-kit outside features/dashboard-layout/presentation', async () => {
    expect(await violationsIn('isolation/dnd-kit-outside-layout')).toEqual([
      {
        rule: 'dnd-kit-only-in-layout-editor',
        from: 'src/features/demo/presentation/DragList.ts',
        to: '@dnd-kit/core',
      },
    ]);
  });

  it('rejects a feature importing an internal file of another feature', async () => {
    expect(await violationsIn('isolation/feature-internal-import')).toEqual([
      {
        rule: 'feature-public-api-only',
        from: 'src/features/beta/presentation/useThing.ts',
        to: 'src/features/alpha/domain/thing.ts',
      },
    ]);
  });

  it('rejects the dashboard grid importing a widget', async () => {
    expect(await violationsIn('isolation/grid-imports-widget')).toEqual([
      {
        rule: 'grid-knows-no-widgets',
        from: 'src/features/dashboard-layout/presentation/dashboardGrid.ts',
        to: 'src/features/dashboard-layout/presentation/widgets/KpiTir.ts',
      },
    ]);
  });

  it('rejects a cycle A -> B -> A', async () => {
    // dependency-cruiser reports a cycle once, on whichever edge it meets first.
    const violations = await violationsIn('isolation/cycle');
    expect(violations).toHaveLength(1);
    const [cycle] = violations;
    expect(cycle?.rule).toBe('no-circular');
    expect([cycle?.from, cycle?.to].sort()).toEqual(['src/shared/domain/a.ts', 'src/shared/domain/b.ts']);
  });

  it('accepts the public index.ts and each library inside its own folder', async () => {
    expect(await violationsIn('isolation/conformant')).toEqual([]);
  });
});

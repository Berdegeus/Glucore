import { screen, within } from '@testing-library/react';
import type { ComponentType } from 'react';
import { describe, expect, it } from 'vitest';
import type { WidgetProps } from '../features/dashboard-layout';
import type { GlucoseSummary } from '../features/patient-dashboard/domain/summary';
import { TARGET_MET_TEXT, TARGET_MISSED_TEXT } from '../shared/presentation/ui/kpiCard';
import { summaryFixture } from './summaryFakes';
import { renderWidget } from './widgetHarness';

interface TargetKpiSpec {
  Widget: ComponentType<WidgetProps>;
  title: string;
  /** The fixture summary with the widget's own figure set to `value`. */
  withValue: (value: number) => GlucoseSummary;
  /** A value that meets the target, and how it reads once formatted. */
  sample: { value: number; shown: string };
  /** The target line, e.g. `Meta: 70 %`. */
  targetText: string;
  /** Values around the limit and whether each meets the target; the limit itself must be one of them. */
  boundaries: ReadonlyArray<{ value: number; met: boolean }>;
  requirement: string;
}

/**
 * What a KPI widget with a target shows (PAC-05): the figure in percent, the
 * target line and a verdict in words, with the limit counted as met.
 */
export function describeTargetKpi({ Widget, title, withValue, sample, targetText, boundaries, requirement }: TargetKpiSpec) {
  describe(`${title} figure (${requirement})`, () => {
    it('shows the figure in percent with its target and a met verdict', async () => {
      renderWidget(<Widget size="S" />, { summary: withValue(sample.value) });

      const card = within(await screen.findByRole('region', { name: title }));
      expect(await card.findByText(sample.shown)).toBeInTheDocument();
      expect(card.getByText('%')).toBeInTheDocument();
      expect(card.getByText(targetText)).toBeInTheDocument();
      expect(card.getByText(TARGET_MET_TEXT)).toBeInTheDocument();
    });

    it.each(boundaries)('says the target is met: $met, for $value', async ({ value, met }) => {
      renderWidget(<Widget size="S" />, { summary: withValue(value) });

      expect(await screen.findByText(met ? TARGET_MET_TEXT : TARGET_MISSED_TEXT)).toBeInTheDocument();
      expect(screen.queryByText(met ? TARGET_MISSED_TEXT : TARGET_MET_TEXT)).not.toBeInTheDocument();
    });
  });
}

/** The fixture summary with one field of it replaced; the shape `withValue` takes for a plain numeric field. */
export const withField =
  (field: 'timeInRangePercent' | 'coefficientOfVariationPercent' | 'sensorUsePercent') =>
  (value: number): GlucoseSummary =>
    summaryFixture({ [field]: value });

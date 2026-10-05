import { BarChart } from '../../../../shared/presentation/charts/barChart';
import type { WidgetProps } from '../../../dashboard-layout';
import {
  carbsInsulinAlternative,
  carbsInsulinRows,
  CARBS_SERIES,
  formatQuantity,
  hasNoDiary,
  INSULIN_SERIES,
} from './carbsInsulinModel';
import { ChartWidget } from './chartWidget';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { chartCarbsInsulinDefinition } from './chartCarbsInsulin.definition';

export const CHART_CARBS_INSULIN_TITLE = 'Carboidratos e insulina por dia';

/** The cause when the diary has neither carbohydrate nor insulin in the period: readings do not matter to this card. */
export const NO_DIARY_CAUSE = 'Nenhum registro de carboidrato ou insulina no período';

const SERIES = [CARBS_SERIES, INSULIN_SERIES];

/** Grams of carbohydrate and units of insulin logged each day, as grouped bars on one axis (PAC-10). */
export default function ChartCarbsInsulin({ size }: WidgetProps) {
  return (
    <ChartWidget
      title={CHART_CARBS_INSULIN_TITLE}
      size={size}
      isEmpty={(summary) => hasNoDiary(summary.byDay)}
      emptyCause={NO_DIARY_CAUSE}
      alternative={(summary) => carbsInsulinAlternative(summary.byDay)}
    >
      {(summary) => <BarChart data={carbsInsulinRows(summary.byDay)} categoryKey="day" series={SERIES} formatValue={formatQuantity} />}
    </ChartWidget>
  );
}

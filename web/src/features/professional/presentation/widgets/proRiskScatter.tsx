import { ScatterQuadrantChart } from '../../../../shared/presentation/charts/scatterQuadrantChart';
import { defineCohortChartWidget } from './defineCohortWidget';
import { cvAxisFor, riskScatterAlternative, scatterPointsOf, TIR_AXIS } from './riskScatterModel';
import { PRO_RISK_SCATTER_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { proRiskScatterDefinition } from './proRiskScatter.definition';

export { PRO_RISK_SCATTER_TITLE };

/** Each patient as a point of time in range against variability, split at TIR 70 and CV 36 (PRO-10). */
export default defineCohortChartWidget({
  title: PRO_RISK_SCATTER_TITLE,
  alternative: riskScatterAlternative,
  chart: (cohort) => {
    const points = scatterPointsOf(cohort);
    return <ScatterQuadrantChart points={points} x={TIR_AXIS} y={cvAxisFor(points)} />;
  },
});

import { registerWidget } from '../../dashboard-layout';
import { cardFreshnessDefinition } from './widgets/cardFreshness.definition';
import { chartAgpDefinition } from './widgets/chartAgp.definition';
import { chartAlertsTypeDefinition } from './widgets/chartAlertsType.definition';
import { chartCarbsInsulinDefinition } from './widgets/chartCarbsInsulin.definition';
import { chartDailyTirDefinition } from './widgets/chartDailyTir.definition';
import { chartDayDetailDefinition } from './widgets/chartDayDetail.definition';
import { chartHeatmapDefinition } from './widgets/chartHeatmap.definition';
import { chartInsulinTypeDefinition } from './widgets/chartInsulinType.definition';
import { chartTrendDefinition } from './widgets/chartTrend.definition';
import { chartZonesDefinition } from './widgets/chartZones.definition';
import { kpiCvDefinition } from './widgets/kpiCv.definition';
import { kpiGmiDefinition } from './widgets/kpiGmi.definition';
import { kpiMeanDefinition } from './widgets/kpiMean.definition';
import { kpiSensorUseDefinition } from './widgets/kpiSensorUse.definition';
import { kpiTirDefinition } from './widgets/kpiTir.definition';
import { tableExcursionsDefinition } from './widgets/tableExcursions.definition';

// The patient's widgets, in the order of `contracts/widget-catalog.json`. A new
// widget is one module under `widgets/` and one line here (ARQ-10); the grid
// and the page never learn which widgets exist.
registerWidget(kpiTirDefinition, () => import('./widgets/kpiTir'));
registerWidget(kpiGmiDefinition, () => import('./widgets/kpiGmi'));
registerWidget(kpiMeanDefinition, () => import('./widgets/kpiMean'));
registerWidget(kpiCvDefinition, () => import('./widgets/kpiCv'));
registerWidget(kpiSensorUseDefinition, () => import('./widgets/kpiSensorUse'));
registerWidget(cardFreshnessDefinition, () => import('./widgets/cardFreshness'));
registerWidget(chartTrendDefinition, () => import('./widgets/chartTrend'));
registerWidget(chartDailyTirDefinition, () => import('./widgets/chartDailyTir'));
registerWidget(chartZonesDefinition, () => import('./widgets/chartZones'));
registerWidget(chartAgpDefinition, () => import('./widgets/chartAgp'));
registerWidget(chartHeatmapDefinition, () => import('./widgets/chartHeatmap'));
registerWidget(tableExcursionsDefinition, () => import('./widgets/tableExcursions'));
registerWidget(chartInsulinTypeDefinition, () => import('./widgets/chartInsulinType'));
registerWidget(chartAlertsTypeDefinition, () => import('./widgets/chartAlertsType'));
registerWidget(chartCarbsInsulinDefinition, () => import('./widgets/chartCarbsInsulin'));
registerWidget(chartDayDetailDefinition, () => import('./widgets/chartDayDetail'));

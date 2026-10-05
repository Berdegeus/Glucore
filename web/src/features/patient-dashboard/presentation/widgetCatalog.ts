import { registerWidget } from '../../dashboard-layout';
import { cardFreshnessDefinition } from './widgets/cardFreshness';
import { chartAgpDefinition } from './widgets/chartAgp';
import { chartAlertsTypeDefinition } from './widgets/chartAlertsType';
import { chartCarbsInsulinDefinition } from './widgets/chartCarbsInsulin';
import { chartDailyTirDefinition } from './widgets/chartDailyTir';
import { chartDayDetailDefinition } from './widgets/chartDayDetail';
import { chartHeatmapDefinition } from './widgets/chartHeatmap';
import { chartInsulinTypeDefinition } from './widgets/chartInsulinType';
import { chartTrendDefinition } from './widgets/chartTrend';
import { chartZonesDefinition } from './widgets/chartZones';
import { kpiCvDefinition } from './widgets/kpiCv';
import { kpiGmiDefinition } from './widgets/kpiGmi';
import { kpiMeanDefinition } from './widgets/kpiMean';
import { kpiSensorUseDefinition } from './widgets/kpiSensorUse';
import { kpiTirDefinition } from './widgets/kpiTir';
import { tableExcursionsDefinition } from './widgets/tableExcursions';

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

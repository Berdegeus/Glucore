import { registerWidget, registerWidgetTitles } from '../../dashboard-layout';
import { proHypoByHourDefinition } from './widgets/proHypoByHour.definition';
import { proKpiGmiDefinition } from './widgets/proKpiGmi.definition';
import { proKpiHypoDefinition } from './widgets/proKpiHypo.definition';
import { proKpiPatientsDefinition } from './widgets/proKpiPatients.definition';
import { proKpiStaleDefinition } from './widgets/proKpiStale.definition';
import { proKpiTirDefinition } from './widgets/proKpiTir.definition';
import { proPatientsTableDefinition } from './widgets/proPatientsTable.definition';
import { proRedeemCodeDefinition } from './widgets/proRedeemCode.definition';
import { proRiskScatterDefinition } from './widgets/proRiskScatter.definition';
import { proTirByPatientDefinition } from './widgets/proTirByPatient.definition';
import { proTirHistogramDefinition } from './widgets/proTirHistogram.definition';
import { PROFESSIONAL_WIDGET_TITLES } from './widgets/widgetTitles';

// The professional's widgets, in the order of `contracts/widget-catalog.json`. A new
// widget is one module under `widgets/` and one line here (ARQ-10); the grid
// and the page never learn which widgets exist. The title of a widget is one
// entry in `widgets/widgetTitles.ts`.
registerWidgetTitles(PROFESSIONAL_WIDGET_TITLES);
registerWidget(proRedeemCodeDefinition, () => import('./widgets/proRedeemCode'));
registerWidget(proKpiPatientsDefinition, () => import('./widgets/proKpiPatients'));
registerWidget(proKpiTirDefinition, () => import('./widgets/proKpiTir'));
registerWidget(proKpiGmiDefinition, () => import('./widgets/proKpiGmi'));
registerWidget(proKpiHypoDefinition, () => import('./widgets/proKpiHypo'));
registerWidget(proKpiStaleDefinition, () => import('./widgets/proKpiStale'));
registerWidget(proPatientsTableDefinition, () => import('./widgets/proPatientsTable'));
registerWidget(proTirByPatientDefinition, () => import('./widgets/proTirByPatient'));
registerWidget(proRiskScatterDefinition, () => import('./widgets/proRiskScatter'));
registerWidget(proTirHistogramDefinition, () => import('./widgets/proTirHistogram'));
registerWidget(proHypoByHourDefinition, () => import('./widgets/proHypoByHour'));

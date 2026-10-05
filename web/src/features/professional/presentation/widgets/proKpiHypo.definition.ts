import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const proKpiHypoDefinition: WidgetDefinition = {
  id: 'pro-kpi-hypo',
  titleKey: 'widget.pro-kpi-hypo',
  roles: ['HEALTH_PROFESSIONAL'],
  sizes: WIDGET_SIZES,
  defaultSize: 'S',
};

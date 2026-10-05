import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const proKpiStaleDefinition: WidgetDefinition = {
  id: 'pro-kpi-stale',
  titleKey: 'widget.pro-kpi-stale',
  roles: ['HEALTH_PROFESSIONAL'],
  sizes: WIDGET_SIZES,
  defaultSize: 'S',
};

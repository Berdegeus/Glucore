import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const proKpiGmiDefinition: WidgetDefinition = {
  id: 'pro-kpi-gmi',
  titleKey: 'widget.pro-kpi-gmi',
  roles: ['HEALTH_PROFESSIONAL'],
  sizes: WIDGET_SIZES,
  defaultSize: 'S',
};

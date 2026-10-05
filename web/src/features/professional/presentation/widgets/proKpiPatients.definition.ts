import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const proKpiPatientsDefinition: WidgetDefinition = {
  id: 'pro-kpi-patients',
  titleKey: 'widget.pro-kpi-patients',
  roles: ['HEALTH_PROFESSIONAL'],
  sizes: WIDGET_SIZES,
  defaultSize: 'S',
};

import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const admKpiRegistrationsDefinition: WidgetDefinition = {
  id: 'adm-kpi-registrations',
  titleKey: 'widget.adm-kpi-registrations',
  roles: ['ADMINISTRATOR'],
  sizes: WIDGET_SIZES,
  defaultSize: 'S',
};

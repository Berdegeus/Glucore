import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const admKpiGrantsDefinition: WidgetDefinition = {
  id: 'adm-kpi-grants',
  titleKey: 'widget.adm-kpi-grants',
  roles: ['ADMINISTRATOR'],
  sizes: WIDGET_SIZES,
  defaultSize: 'S',
};

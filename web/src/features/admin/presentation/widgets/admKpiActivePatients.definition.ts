import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const admKpiActivePatientsDefinition: WidgetDefinition = {
  id: 'adm-kpi-active-patients',
  titleKey: 'widget.adm-kpi-active-patients',
  roles: ['ADMINISTRATOR'],
  sizes: WIDGET_SIZES,
  defaultSize: 'S',
};

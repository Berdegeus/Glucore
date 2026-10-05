import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const admKpiAccountsDefinition: WidgetDefinition = {
  id: 'adm-kpi-accounts',
  titleKey: 'widget.adm-kpi-accounts',
  roles: ['ADMINISTRATOR'],
  sizes: WIDGET_SIZES,
  defaultSize: 'S',
};

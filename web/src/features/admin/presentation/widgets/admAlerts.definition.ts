import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const admAlertsDefinition: WidgetDefinition = {
  id: 'adm-alerts',
  titleKey: 'widget.adm-alerts',
  roles: ['ADMINISTRATOR'],
  sizes: WIDGET_SIZES,
  defaultSize: 'M',
};

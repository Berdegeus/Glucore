import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const admRegistrationsDefinition: WidgetDefinition = {
  id: 'adm-registrations',
  titleKey: 'widget.adm-registrations',
  roles: ['ADMINISTRATOR'],
  sizes: WIDGET_SIZES,
  defaultSize: 'M',
};

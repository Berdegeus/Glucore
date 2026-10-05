import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const admUsersTableDefinition: WidgetDefinition = {
  id: 'adm-users-table',
  titleKey: 'widget.adm-users-table',
  roles: ['ADMINISTRATOR'],
  sizes: WIDGET_SIZES,
  defaultSize: 'L',
};

import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const admUsersRoleDefinition: WidgetDefinition = {
  id: 'adm-users-role',
  titleKey: 'widget.adm-users-role',
  roles: ['ADMINISTRATOR'],
  sizes: WIDGET_SIZES,
  defaultSize: 'M',
};

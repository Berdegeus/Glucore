import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const admGrantsDefinition: WidgetDefinition = {
  id: 'adm-grants',
  titleKey: 'widget.adm-grants',
  roles: ['ADMINISTRATOR'],
  sizes: WIDGET_SIZES,
  defaultSize: 'M',
};

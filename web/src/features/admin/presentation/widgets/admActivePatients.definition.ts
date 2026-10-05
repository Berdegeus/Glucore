import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const admActivePatientsDefinition: WidgetDefinition = {
  id: 'adm-active-patients',
  titleKey: 'widget.adm-active-patients',
  roles: ['ADMINISTRATOR'],
  sizes: WIDGET_SIZES,
  defaultSize: 'M',
};

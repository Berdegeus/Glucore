import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const proPatientsTableDefinition: WidgetDefinition = {
  id: 'pro-patients-table',
  titleKey: 'widget.pro-patients-table',
  roles: ['HEALTH_PROFESSIONAL'],
  sizes: WIDGET_SIZES,
  defaultSize: 'L',
};

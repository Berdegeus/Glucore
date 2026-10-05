import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const proHypoByHourDefinition: WidgetDefinition = {
  id: 'pro-hypo-by-hour',
  titleKey: 'widget.pro-hypo-by-hour',
  roles: ['HEALTH_PROFESSIONAL'],
  sizes: WIDGET_SIZES,
  defaultSize: 'M',
};

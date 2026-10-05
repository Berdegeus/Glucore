import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const cardFreshnessDefinition: WidgetDefinition = {
  id: 'card-freshness',
  titleKey: 'widget.card-freshness',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'S',
};

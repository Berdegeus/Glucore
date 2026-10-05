import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const kpiMeanDefinition: WidgetDefinition = {
  id: 'kpi-mean',
  titleKey: 'widget.kpi-mean',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'S',
};

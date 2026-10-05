import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const kpiTirDefinition: WidgetDefinition = {
  id: 'kpi-tir',
  titleKey: 'widget.kpi-tir',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'S',
};

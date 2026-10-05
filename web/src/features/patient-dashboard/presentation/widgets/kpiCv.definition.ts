import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const kpiCvDefinition: WidgetDefinition = {
  id: 'kpi-cv',
  titleKey: 'widget.kpi-cv',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'S',
};

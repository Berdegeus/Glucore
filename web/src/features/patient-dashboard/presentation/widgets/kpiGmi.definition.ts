import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const kpiGmiDefinition: WidgetDefinition = {
  id: 'kpi-gmi',
  titleKey: 'widget.kpi-gmi',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'S',
};

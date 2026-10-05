import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const chartHeatmapDefinition: WidgetDefinition = {
  id: 'chart-heatmap',
  titleKey: 'widget.chart-heatmap',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'L',
};

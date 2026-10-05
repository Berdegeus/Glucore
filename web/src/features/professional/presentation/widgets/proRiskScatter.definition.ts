import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const proRiskScatterDefinition: WidgetDefinition = {
  id: 'pro-risk-scatter',
  titleKey: 'widget.pro-risk-scatter',
  roles: ['HEALTH_PROFESSIONAL'],
  sizes: WIDGET_SIZES,
  defaultSize: 'M',
};

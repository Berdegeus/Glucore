import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const proRedeemCodeDefinition: WidgetDefinition = {
  id: 'pro-redeem-code',
  titleKey: 'widget.pro-redeem-code',
  roles: ['HEALTH_PROFESSIONAL'],
  sizes: WIDGET_SIZES,
  defaultSize: 'M',
};

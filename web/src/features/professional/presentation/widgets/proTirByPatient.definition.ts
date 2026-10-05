import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const proTirByPatientDefinition: WidgetDefinition = {
  id: 'pro-tir-by-patient',
  titleKey: 'widget.pro-tir-by-patient',
  roles: ['HEALTH_PROFESSIONAL'],
  sizes: WIDGET_SIZES,
  defaultSize: 'M',
};

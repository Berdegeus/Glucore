import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const tableExcursionsDefinition: WidgetDefinition = {
  id: 'table-excursions',
  titleKey: 'widget.table-excursions',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'L',
};

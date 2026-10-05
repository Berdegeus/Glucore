import { WIDGET_SIZES, type WidgetDefinition } from '../../../dashboard-layout';

export const admReadingsVolumeDefinition: WidgetDefinition = {
  id: 'adm-readings-volume',
  titleKey: 'widget.adm-readings-volume',
  roles: ['ADMINISTRATOR'],
  sizes: WIDGET_SIZES,
  defaultSize: 'M',
};

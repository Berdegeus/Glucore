import { LineBandChart } from '../../../../shared/presentation/charts/lineBandChart';
import { defineOverviewChartWidget } from './defineOverviewChartWidget';
import { allZero, dayAlternative, dayRows } from './overviewChartModels';
import { ADM_READINGS_VOLUME_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { admReadingsVolumeDefinition } from './admReadingsVolume.definition';

export { ADM_READINGS_VOLUME_TITLE };

const LINES = [{ key: 'count', label: 'Leituras' }];

/** How many readings the platform took in on each day of the period, as a filled area (ADM-02). */
export default defineOverviewChartWidget({
  title: ADM_READINGS_VOLUME_TITLE,
  isEmpty: ({ readingsByDay }) => allZero(readingsByDay),
  alternative: ({ readingsByDay }) => dayAlternative('Leituras ingeridas por dia', 'Leituras', readingsByDay),
  chart: ({ readingsByDay }) => <LineBandChart data={dayRows(readingsByDay)} xKey="day" lines={LINES} filled />,
});

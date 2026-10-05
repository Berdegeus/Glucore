import { useState } from 'react';
import { ChartFrame } from '../../../../shared/presentation/charts/chartFrame';
import { LineBandChart } from '../../../../shared/presentation/charts/lineBandChart';
import { WidgetShell, type WidgetProps, type WidgetState } from '../../../dashboard-layout';
import type { DiaryDays } from '../../application/loadDayDetail';
import { useDayDetail } from '../useDayDetail';
import styles from './chartDayDetail.module.css';
import { CARBS_MARKER_SERIES, dayDetailAlternative, dayDetailRows, GLUCOSE_SERIES, INSULIN_MARKER_SERIES } from './dayDetailModel';
import { fullDay } from './dayLabel';
import { CHART_DAY_DETAIL_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its chart code.
export { chartDayDetailDefinition } from './chartDayDetail.definition';

export { CHART_DAY_DETAIL_TITLE };

/** The cause when the API has no reading to choose a day from: the period filter does not apply to this card. */
export const NO_DAYS_CAUSE = 'Nenhuma leitura disponível para escolher um dia';

export const DAY_SELECT_LABEL = 'Dia';

const LINES = [GLUCOSE_SERIES, CARBS_MARKER_SERIES, INSULIN_MARKER_SERIES];

function DayDetailBody({ source }: { source: DiaryDays }) {
  const [chosen, setChosen] = useState<string | null>(null);
  // A reload can drop the chosen day from the window; the newest day stands in.
  const day = chosen !== null && source.days.includes(chosen) ? chosen : (source.days[0] as string);
  const detail = source.detailOf(day);
  return (
    <>
      <label className={styles.picker}>
        <span className={styles.label}>{DAY_SELECT_LABEL}</span>
        <select className={styles.select} value={day} onChange={(event) => setChosen(event.target.value)}>
          {source.days.map((option) => (
            <option key={option} value={option}>
              {fullDay(option)}
            </option>
          ))}
        </select>
      </label>
      <ChartFrame title={CHART_DAY_DETAIL_TITLE} {...dayDetailAlternative(detail)}>
        <LineBandChart data={dayDetailRows(detail)} xKey="time" lines={LINES} />
      </ChartFrame>
    </>
  );
}

/**
 * The glucose line of one day with the carbohydrate and insulin entries
 * marked on it (PAC-11). The day is chosen among the days that have readings
 * and cut in the browser's zone. It is read from the diary (`/readings`,
 * `/carbs`, `/insulin`), not from the summary, and the period filter does not
 * change it.
 */
export default function ChartDayDetail({ size }: WidgetProps) {
  const query = useDayDetail();
  const source = query.data;
  let state: WidgetState = { kind: 'loading' };
  if (source) state = source.days.length === 0 ? { kind: 'empty', cause: NO_DAYS_CAUSE } : { kind: 'ready' };
  else if (query.isError) state = { kind: 'error', onRetry: () => void query.refetch() };
  return (
    <WidgetShell title={CHART_DAY_DETAIL_TITLE} size={size} state={state}>
      {source && source.days.length > 0 && <DayDetailBody source={source} />}
    </WidgetShell>
  );
}

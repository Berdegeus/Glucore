import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { browserTimeZone } from '../../../shared/presentation/browserTimeZone';
import { LayoutBoard, LayoutEditorProvider, LayoutToolbar } from '../../dashboard-layout';
import { localDayOf } from '../application/loadDayDetail';
import { DEFAULT_PRESET, toRange, type DateRange } from '../domain/period';
import { PeriodProvider } from './periodContext';
import styles from './patientDashboardPage.module.css';
import { PeriodFilter } from './periodFilter';
import { diaryQueryKey } from './useDayDetail';
import { useSummary } from './useSummary';

export const PAGE_TITLE = 'Meu painel';
export const REFRESH_LABEL = 'Atualizar';
export const NO_READINGS_TITLE = 'Sem leituras no período';
export const SYNC_GUIDANCE = 'Abra o aplicativo para sincronizar os dados.';

/** Every summary, whatever its period; the prefix of `summaryQueryKey`. */
const SUMMARIES = ['summary'] as const;

/**
 * Says a period without readings has nothing to draw and where the data comes
 * from (PAC-14). It reads the same summary as the widgets, so it costs no
 * request of its own (PAC-17); the widgets still show their own empty states.
 */
function NoReadingsNotice({ range }: { range: DateRange }) {
  const { data } = useSummary(range);
  const titleId = useId();
  if (data?.totals.readingsCount !== 0) return null;
  return (
    <section className={styles.notice} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.noticeTitle}>
        {NO_READINGS_TITLE}
      </h2>
      <p className={styles.noticeText}>{SYNC_GUIDANCE}</p>
    </section>
  );
}

/** Reloads the summary and the diary in place: the period and the layout stay where they are (PAC-15). */
function RefreshButton() {
  const client = useQueryClient();
  const busy = useIsFetching({ queryKey: SUMMARIES }) + useIsFetching({ queryKey: diaryQueryKey }) > 0;

  function refresh() {
    // A reload already running is the refresh; starting another would cancel and repeat it.
    if (busy) return;
    void client.invalidateQueries({ queryKey: SUMMARIES });
    void client.invalidateQueries({ queryKey: diaryQueryKey });
  }

  return (
    <button type="button" className={styles.refresh} aria-busy={busy} onClick={refresh}>
      {REFRESH_LABEL}
    </button>
  );
}

const todayInBrowserZone = (): string => localDayOf(Date.now(), browserTimeZone());

/**
 * The patient's dashboard (PAC-01): the period filter, "Atualizar", "Personalizar"
 * and the grid of the widgets the layout lists. It opens on the last 14 days; the
 * period lives here and reaches the widgets through `PeriodProvider`, so all of
 * them share one summary request per period (PAC-17).
 */
export function PatientDashboardPage() {
  const [today] = useState(todayInBrowserZone);
  const [range, setRange] = useState<DateRange>(() => toRange(DEFAULT_PRESET, today));
  return (
    <PeriodProvider range={range}>
      <LayoutEditorProvider forRole="PATIENT">
        <div className={styles.page}>
          <h1 className={styles.title}>{PAGE_TITLE}</h1>
          <div className={styles.toolbar}>
            <PeriodFilter value={range} today={today} onChange={setRange} />
            <RefreshButton />
            <LayoutToolbar />
          </div>
          <NoReadingsNotice range={range} />
          <LayoutBoard />
        </div>
      </LayoutEditorProvider>
    </PeriodProvider>
  );
}

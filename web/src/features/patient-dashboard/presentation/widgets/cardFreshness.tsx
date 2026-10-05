import { browserTimeZone } from '../../../../shared/presentation/browserTimeZone';
import { formatDateTime } from '../../../../shared/presentation/format';
import { useNow } from '../../../../shared/presentation/useNow';
import { WIDGET_SIZES, type WidgetDefinition, type WidgetProps } from '../../../dashboard-layout';
import { isStale, STALE_MESSAGE } from '../../domain/freshness';
import styles from './cardFreshness.module.css';
import { SummaryWidget } from './summaryWidget';

export const CARD_FRESHNESS_TITLE = 'Última leitura';

/** The cause when the app has never synced a reading: this card is not tied to the period. */
export const NO_SYNC_CAUSE = 'Nenhuma leitura sincronizada pelo app';

export const cardFreshnessDefinition: WidgetDefinition = {
  id: 'card-freshness',
  titleKey: 'widget.card-freshness',
  roles: ['PATIENT'],
  sizes: WIDGET_SIZES,
  defaultSize: 'S',
};

function Freshness({ lastReadingAt, stale }: { lastReadingAt: string | null; stale: boolean }) {
  return (
    <div className={styles.card}>
      <p className={styles.caption}>Sincronizada pelo app</p>
      <time className={styles.time} dateTime={lastReadingAt ?? undefined}>
        {formatDateTime(lastReadingAt, browserTimeZone())}
      </time>
      {stale && (
        <p className={styles.stale}>
          <span className={styles.icon} aria-hidden="true">
            !
          </span>
          {STALE_MESSAGE}
        </p>
      )}
    </div>
  );
}

/**
 * When the app last synced a reading (PAC-12), with a warning once it is more
 * than 60 minutes old (PAC-13). The age is judged against a clock that moves
 * every minute, so the warning appears without a reload.
 */
export default function CardFreshness({ size }: WidgetProps) {
  const now = useNow();
  return (
    <SummaryWidget title={CARD_FRESHNESS_TITLE} size={size} isEmpty={(summary) => summary.lastReadingAt === null} emptyCause={NO_SYNC_CAUSE}>
      {(summary) => <Freshness lastReadingAt={summary.lastReadingAt} stale={isStale(summary.lastReadingAt, now)} />}
    </SummaryWidget>
  );
}

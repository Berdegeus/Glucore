import { browserTimeZone } from '../../../shared/presentation/browserTimeZone';
import { localDayOf } from '../application/loadDayDetail';

/** Today as `YYYY-MM-DD` on the browser's calendar, the day the period presets count back from. */
export const todayInBrowserZone = (): string => localDayOf(Date.now(), browserTimeZone());

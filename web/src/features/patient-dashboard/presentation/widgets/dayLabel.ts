import { formatDate } from '../../../../shared/presentation/format';

/**
 * A summary day is already a calendar day of the patient's zone (`YYYY-MM-DD`),
 * so it is formatted as the UTC date it spells and no zone can move it.
 */
export const fullDay = (day: string): string => formatDate(day, 'UTC');

/** `05/08`: enough to tell the days of one period apart on a chart axis. */
export const shortDay = (day: string): string => fullDay(day).slice(0, 5);

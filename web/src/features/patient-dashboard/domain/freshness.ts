/** A last reading older than this many minutes counts as stale (PAC-13). */
export const STALE_AFTER_MINUTES = 60;

/** The warning shown next to a stale last reading (PAC-13). */
export const STALE_MESSAGE = 'Sem dados recentes. Abra o aplicativo para sincronizar.';

const MS_PER_MINUTE = 60 * 1000;

/**
 * True when the last synced reading is more than 60 minutes old, or there is
 * none, or the instant cannot be read (PAC-12, PAC-13). A reading dated after
 * `now` (clock skew) is not stale.
 */
export function isStale(lastReadingAt: string | null, now: Date): boolean {
  if (lastReadingAt === null) return true;
  const readAt = Date.parse(lastReadingAt);
  if (Number.isNaN(readAt)) return true;
  return now.getTime() - readAt > STALE_AFTER_MINUTES * MS_PER_MINUTE;
}

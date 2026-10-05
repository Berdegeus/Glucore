/** The clock the browser shows, so a time on screen matches the person's wall clock (RSP-09). */
export const browserTimeZone = (): string => new Intl.DateTimeFormat().resolvedOptions().timeZone;

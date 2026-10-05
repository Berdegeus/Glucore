import { afterEach, beforeEach, vi } from 'vitest';

/** Makes the browser resolve `timeZone`; undo with `vi.restoreAllMocks()`. */
export const withTimeZone = (timeZone: string) =>
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone } as Intl.ResolvedDateTimeFormatOptions);

/**
 * Pins the clock of the tests that follow to 12:00 on 6 August 2026 in Sao Paulo (the browser zone too), so a
 * period of "the last N days" has fixed ends. Only `Date` is faked: timers and promises keep running.
 */
export function pinSaoPauloNoon() {
  beforeEach(() => {
    withTimeZone('America/Sao_Paulo');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-06T15:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
}

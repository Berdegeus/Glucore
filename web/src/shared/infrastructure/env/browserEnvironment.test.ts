import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserTimeZoneProvider, SystemClock } from './browserEnvironment';

/** Makes `Intl.DateTimeFormat().resolvedOptions().timeZone` answer `timeZone`. */
function browserZone(timeZone: string | undefined) {
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
    () => ({ resolvedOptions: () => ({ timeZone }) }) as Intl.DateTimeFormat,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('BrowserTimeZoneProvider (API-01, RSP-09)', () => {
  it("returns the browser's IANA zone", () => {
    browserZone('America/Sao_Paulo');

    expect(new BrowserTimeZoneProvider().timeZone()).toBe('America/Sao_Paulo');
  });

  it.each([
    ['undefined', undefined],
    ['empty', ''],
  ])('falls back to UTC when the zone is %s', (_label, zone) => {
    browserZone(zone);

    expect(new BrowserTimeZoneProvider().timeZone()).toBe('UTC');
  });
});

describe('SystemClock', () => {
  it('returns the current time', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-04T12:34:56Z'));

    expect(new SystemClock().now()).toEqual(new Date('2026-10-04T12:34:56Z'));
  });
});

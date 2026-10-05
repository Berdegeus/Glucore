import { describe, expect, it } from 'vitest';
import { isStale, STALE_MESSAGE } from './freshness';

const NOW = new Date('2026-08-05T12:00:00.000Z');
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

describe('isStale (PAC-12, PAC-13)', () => {
  it.each([
    ['5 minutes old is fresh', minutesAgo(5), false],
    ['exactly 60 minutes old is not stale', minutesAgo(60), false],
    ['61 minutes old is stale', minutesAgo(61), true],
    ['one second past the limit is stale', new Date(NOW.getTime() - 3_601_000).toISOString(), true],
    ['a reading dated after now is not stale', minutesAgo(-3), false],
    ['no reading at all is stale', null, true],
    ['an unreadable instant is stale', 'not-a-date', true],
  ])('%s', (_label, lastReadingAt, expected) => {
    expect(isStale(lastReadingAt, NOW)).toBe(expected);
  });

  it('words the warning as the spec asks', () => {
    expect(STALE_MESSAGE).toBe('Sem dados recentes. Abra o aplicativo para sincronizar.');
  });
});

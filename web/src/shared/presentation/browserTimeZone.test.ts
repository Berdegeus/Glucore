import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTimeZone } from '../../test/browserTimeZone';
import { browserTimeZone } from './browserTimeZone';

afterEach(() => vi.restoreAllMocks());

describe('browserTimeZone (RSP-09)', () => {
  it.each(['UTC', 'America/Sao_Paulo'])('reports %s when that is the zone the browser resolves', (zone) => {
    withTimeZone(zone);

    expect(browserTimeZone()).toBe(zone);
  });

  it('reports a real zone name by default', () => {
    expect(browserTimeZone()).toMatch(/^[A-Za-z_]+(\/[A-Za-z_+-]+)*$/);
  });
});

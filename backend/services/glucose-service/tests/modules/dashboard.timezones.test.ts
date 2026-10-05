import { afterAll, describe, expect, it, vi } from 'vitest';

import {
  prismaTimeZoneLoader,
  TimeZoneValidator,
} from '../../src/modules/dashboard/dashboard.timezones';
import { disconnect, prisma } from '../helpers/db';

afterAll(async () => {
  await disconnect();
});

describe('TimeZoneValidator — against the real pg_timezone_names', () => {
  it.each([
    ['UTC', true],
    ['America/Sao_Paulo', true],
    ['America/New_York', true],
    ['Mars/Phobos', false],
    ['america/sao_paulo', false],
  ])('%s -> %s', async (name, expected) => {
    const validator = new TimeZoneValidator(prismaTimeZoneLoader(prisma));

    expect(await validator.isValid(name)).toBe(expected);
  });

  it('does not query the database again on the second call', async () => {
    const validator = new TimeZoneValidator(prismaTimeZoneLoader(prisma));
    const spy = vi.spyOn(prisma, '$queryRaw');

    try {
      await validator.isValid('America/Sao_Paulo');
      await validator.isValid('Mars/Phobos');
      await validator.isValid('UTC');

      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('TimeZoneValidator — loading behavior', () => {
  it('shares one load between concurrent first calls', async () => {
    const load = vi.fn().mockResolvedValue(['UTC']);
    const validator = new TimeZoneValidator(load);

    const answers = await Promise.all([validator.isValid('UTC'), validator.isValid('UTC')]);

    expect(answers).toEqual([true, true]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('retries after a failed load instead of caching the failure', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValue(['UTC']);
    const validator = new TimeZoneValidator(load);

    await expect(validator.isValid('UTC')).rejects.toThrow('db down');
    expect(await validator.isValid('UTC')).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

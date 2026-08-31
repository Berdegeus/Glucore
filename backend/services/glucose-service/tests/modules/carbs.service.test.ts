import { describe, expect, it } from 'vitest';
import { BadRequestError, NotFoundError } from '@glucore/shared';

import { CarbsService } from '../../src/modules/carbs/carbs.service';
import { parseCarbBody } from '../../src/modules/carbs/carbs.schema';
import { FakeCarbRepository, FakePatientRepository, RecordedAudit } from '../helpers/fakes';

const USER = 'user-1';
const CONTEXT = { ipAddress: null, userAgent: null };
const ENTRY = { grams: 45, description: 'almoço', timeMs: 1756000000000 };

function build() {
  const carbs = new FakeCarbRepository();
  const patients = new FakePatientRepository();
  const audit = new RecordedAudit();
  return { carbs, audit, service: new CarbsService(carbs, patients, audit.record) };
}

describe('parseCarbBody', () => {
  it('reports the first failing field, in declaration order', () => {
    expect(() => parseCarbBody({})).toThrow('grams must be a number');
    expect(() => parseCarbBody({ grams: 1 })).toThrow('description must be a string');
    expect(() => parseCarbBody({ grams: 1, description: 'x' })).toThrow(
      'timeMs must be a number (epoch ms)',
    );
  });

  it('rejects a non-finite amount', () => {
    expect(() => parseCarbBody({ grams: NaN, description: 'x', timeMs: 1 })).toThrow(
      BadRequestError,
    );
  });

  it('accepts a complete body', () => {
    expect(parseCarbBody(ENTRY)).toEqual(ENTRY);
  });
});

describe('CarbsService', () => {
  it('keeps a client-minted id', async () => {
    const { carbs, service } = build();
    const id = '11111111-1111-4111-8111-111111111111';
    expect(await service.createForUser(USER, { ...ENTRY, id }, CONTEXT)).toBe(id);
    expect(carbs.rows[0].id).toBe(id);
  });

  it('answers 404 when the entry belongs to someone else', async () => {
    const { carbs, service } = build();
    carbs.affected = 0;
    await expect(service.updateForUser(USER, 'other', ENTRY, CONTEXT)).rejects.toThrow(
      NotFoundError,
    );
    await expect(service.deleteForUser(USER, 'other', CONTEXT)).rejects.toThrow('not found');
  });

  it('does not record an audit entry for a write that touched nothing', async () => {
    const { carbs, audit, service } = build();
    carbs.affected = 0;
    await service.deleteForUser(USER, 'other', CONTEXT).catch(() => undefined);
    expect(audit.entries).toEqual([]);
  });

  describe('deprecated replace-all', () => {
    it('drops an id that is not a UUID instead of rejecting the batch', async () => {
      const { carbs, service } = build();
      await service.replaceAllForUser(USER, [{ ...ENTRY, id: 'not-a-uuid' }], CONTEXT);
      expect(carbs.lastReplace[0].id).toBeUndefined();
    });

    it('truncates to the diary page but audits the count that was sent', async () => {
      const { carbs, audit, service } = build();
      const batch = Array.from({ length: 150 }, () => ({ ...ENTRY }));
      await service.replaceAllForUser(USER, batch, CONTEXT);
      expect(carbs.lastReplace).toHaveLength(100);
      // The gap between the two numbers is the symptom to look for when a
      // diary comes back short.
      expect(audit.entries[0].metadata).toEqual({ count: 150 });
    });
  });
});

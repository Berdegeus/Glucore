import { describe, expect, it } from 'vitest';
import { NotFoundError } from '@glucore/shared';

import { InsulinService } from '../../src/modules/insulin/insulin.service';
import { parseInsulinBody } from '../../src/modules/insulin/insulin.schema';
import { FakeInsulinRepository, FakePatientRepository, RecordedAudit } from '../helpers/fakes';

const USER = 'user-1';
const CONTEXT = { ipAddress: null, userAgent: null };
const ENTRY = { units: 6, type: 'bolus', timeMs: 1756000000000 };

function build() {
  const insulin = new FakeInsulinRepository();
  const patients = new FakePatientRepository();
  const audit = new RecordedAudit();
  return { insulin, audit, service: new InsulinService(insulin, patients, audit.record) };
}

describe('parseInsulinBody', () => {
  it('reports the first failing field, in declaration order', () => {
    expect(() => parseInsulinBody({})).toThrow('units must be a number');
    expect(() => parseInsulinBody({ units: 1 })).toThrow('type must be a non-empty string');
    expect(() => parseInsulinBody({ units: 1, type: 'bolus' })).toThrow(
      'timeMs must be a number (epoch ms)',
    );
    expect(() => parseInsulinBody({ ...ENTRY, dayOfWeek: 3 })).toThrow(
      'dayOfWeek must be a string',
    );
  });

  it('rejects a blank type', () => {
    expect(() => parseInsulinBody({ ...ENTRY, type: '   ' })).toThrow(
      'type must be a non-empty string',
    );
  });

  it('leaves dayOfWeek absent rather than defaulting it', () => {
    expect(parseInsulinBody(ENTRY).dayOfWeek).toBeUndefined();
  });
});

describe('InsulinService', () => {
  it('stores an absent day of week as the empty string the column expects', async () => {
    const { insulin, service } = build();
    await service.createForUser(USER, ENTRY, CONTEXT);
    expect(insulin.rows[0].dayOfWeek).toBe('');
  });

  it('answers 404 when the dose belongs to someone else', async () => {
    const { insulin, service } = build();
    insulin.affected = 0;
    await expect(service.updateForUser(USER, 'other', ENTRY, CONTEXT)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('truncates a replace-all but audits the count that was sent', async () => {
    const { insulin, audit, service } = build();
    await service.replaceAllForUser(
      USER,
      Array.from({ length: 150 }, () => ({ ...ENTRY })),
      CONTEXT,
    );
    expect(insulin.lastReplace).toHaveLength(100);
    expect(audit.entries[0].metadata).toEqual({ count: 150 });
  });
});

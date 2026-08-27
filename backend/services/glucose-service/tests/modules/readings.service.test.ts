import { describe, expect, it } from 'vitest';
import { BadRequestError } from '@glucore/shared';

import { ReadingsService } from '../../src/modules/readings/readings.service';
import { parseReadingBatch } from '../../src/modules/readings/readings.schema';
import {
  FakePatientRepository,
  FakeReadingRepository,
  RecordedAudit,
  readingRow,
} from '../helpers/fakes';

const USER = 'user-1';

function build() {
  const readings = new FakeReadingRepository();
  const patients = new FakePatientRepository();
  const audit = new RecordedAudit();
  return { readings, patients, audit, service: new ReadingsService(readings, patients, audit.record) };
}

describe('parseReadingBatch', () => {
  it('accepts an array', () => {
    expect(parseReadingBatch({ readings: [] })).toEqual([]);
  });

  it.each([[{ readings: 'nope' }], [{}], [undefined], [{ readings: null }]])(
    'rejects %j',
    (body) => {
      expect(() => parseReadingBatch(body)).toThrow(BadRequestError);
      expect(() => parseReadingBatch(body)).toThrow('readings must be array');
    },
  );
});

describe('ReadingsService', () => {
  it('maps rows to the shape the app reads', async () => {
    const { readings, service } = build();
    readings.rows = [
      readingRow(USER, { valueMgDl: 143, trend: 'rising', trendRate: 1.5, alarmCode: 2 }),
    ];
    expect(await service.listForUser(USER)).toEqual([
      {
        value: 143,
        timestampMs: new Date('2026-08-25T12:00:00.000Z').getTime(),
        trend: 'rising',
        rate: 1.5,
        alarmCode: 2,
      },
    ]);
  });

  it('asks for one day of samples at the sensor cadence', async () => {
    const { readings, service } = build();
    readings.rows = Array.from({ length: 400 }, () => readingRow(USER));
    expect(await service.listForUser(USER)).toHaveLength(288);
  });

  it('truncates a sync to the same bound', async () => {
    const { readings, service } = build();
    const batch = Array.from({ length: 400 }, (_unused, index) => ({
      value: 100,
      timestampMs: index,
      trend: 'stable',
      rate: 0,
    }));
    await service.syncForUser(USER, batch);
    expect(readings.lastUpsert).toHaveLength(288);
  });

  it('creates the patient row before writing', async () => {
    const { patients, service } = build();
    await service.syncForUser(USER, []);
    expect(patients.ensured).toEqual([USER]);
  });

  it('records an audit entry when the history is cleared', async () => {
    const { readings, audit, service } = build();
    await service.clearForUser(USER, { ipAddress: '10.0.0.1', userAgent: 'vitest' });
    expect(readings.deleted).toBe(1);
    expect(audit.entries).toEqual([
      {
        userId: USER,
        entity: 'GlucoseReading',
        action: 'DELETE',
        entityId: USER,
        ipAddress: '10.0.0.1',
        userAgent: 'vitest',
      },
    ]);
  });
});

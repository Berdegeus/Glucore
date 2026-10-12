import { describe, expect, it } from 'vitest';
import { BadRequestError } from '@glucore/shared';

import { MAX_READ_ROWS, ReadingsService } from '../../src/modules/readings/readings.service';
import { MAX_READING_BATCH, parseReadingBatch } from '../../src/modules/readings/readings.schema';
import {
  FakePatientRepository,
  FakeReadingRepository,
  FakeSummaryRepository,
  RecordedAudit,
  readingRow,
} from '../helpers/fakes';
import { summaryOf } from '../helpers/histogram';

const USER = 'user-1';

function build() {
  const readings = new FakeReadingRepository();
  const summaries = new FakeSummaryRepository();
  const patients = new FakePatientRepository();
  const audit = new RecordedAudit();
  return {
    readings,
    summaries,
    patients,
    audit,
    service: new ReadingsService(readings, summaries, patients, audit.record),
  };
}

describe('parseReadingBatch', () => {
  it('accepts an array', () => {
    expect(parseReadingBatch({ readings: [] })).toEqual([]);
  });

  it('accepts a batch of exactly the maximum size', () => {
    const readings = Array.from({ length: MAX_READING_BATCH }, () => ({}));
    expect(parseReadingBatch({ readings })).toHaveLength(MAX_READING_BATCH);
  });

  it('rejects a batch over the maximum instead of truncating it', () => {
    const readings = Array.from({ length: MAX_READING_BATCH + 1 }, () => ({}));
    expect(() => parseReadingBatch({ readings })).toThrow(BadRequestError);
    expect(() => parseReadingBatch({ readings })).toThrow(
      `readings batch exceeds ${MAX_READING_BATCH} entries`,
    );
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

  it('returns more than a day of samples, up to the safety bound', async () => {
    const { readings, service } = build();
    readings.rows = Array.from({ length: MAX_READ_ROWS + 10 }, () => readingRow(USER));
    expect(await service.listForUser(USER)).toHaveLength(MAX_READ_ROWS);
  });

  it('narrows the listing to [from, before) and keeps newest first', async () => {
    const { readings, service } = build();
    const at = (minute: number) => new Date(Date.UTC(2026, 7, 25, 12, minute));
    readings.rows = [0, 1, 2, 3, 4].map((minute) =>
      readingRow(USER, { recordedAt: at(minute), valueMgDl: 100 + minute }),
    );

    const page = await service.listForUser(USER, {
      from: String(at(1).getTime()),
      before: String(at(4).getTime()),
    });

    expect(page.map((r) => r.value)).toEqual([103, 102, 101]);
  });

  it('rejects a bad cursor before touching the patient', async () => {
    const { patients, service } = build();
    await expect(service.listForUser(USER, { before: 'soon' })).rejects.toThrow(BadRequestError);
    expect(patients.ensured).toEqual([]);
  });

  it('writes a whole batch without dropping any entry', async () => {
    const { readings, service } = build();
    const batch = Array.from({ length: MAX_READING_BATCH }, (_unused, index) => ({
      value: 100,
      timestampMs: index,
      trend: 'stable',
      rate: 0,
    }));
    await service.syncForUser(USER, batch);
    expect(readings.lastUpsert).toHaveLength(MAX_READING_BATCH);
  });

  it('creates the patient row before writing', async () => {
    const { patients, service } = build();
    await service.syncForUser(USER, []);
    expect(patients.ensured).toEqual([USER]);
  });

  it('hands the daily summaries to their repository, creating the patient first', async () => {
    const { summaries, patients, service } = build();
    const days = [summaryOf('2026-10-10')];
    await service.syncSummariesForUser(USER, days);
    expect(patients.ensured).toEqual([USER]);
    expect(summaries.lastUpsert).toBe(days);
  });

  it('records an audit entry when the history is cleared', async () => {
    const { readings, summaries, audit, service } = build();
    await service.clearForUser(USER, { ipAddress: '10.0.0.1', userAgent: 'vitest' });
    expect(readings.deleted).toBe(1);
    expect(summaries.deleted).toBe(1);
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

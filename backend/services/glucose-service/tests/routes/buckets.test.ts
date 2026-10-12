import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app';
import {
  disconnect,
  prisma,
  signedInPatient,
  signedInProfessional,
  truncateAll,
  type SignedInPatient,
} from '../helpers/db';
import { BUCKET_MS, HISTOGRAM_CONTRACT, bucketOf } from '../helpers/histogram';

let app: Express;
let user: SignedInPatient;

beforeAll(() => {
  app = buildApp();
});

beforeEach(async () => {
  await truncateAll();
  user = await signedInPatient();
});

afterAll(async () => {
  await disconnect();
});

const T0 = Date.UTC(2026, 7, 5, 12);
const auth = (who: SignedInPatient = user) => ({ Authorization: `Bearer ${who.token}` });
const put = (buckets: unknown[], who: SignedInPatient = user) =>
  request(app).put('/readings/buckets').set(auth(who)).send({ buckets });
const stored = (patientId = user.userId) =>
  prisma.glucoseBucket.findMany({ where: { patientId }, orderBy: { bucketStart: 'asc' } });

describe('PUT /readings/buckets', () => {
  it('rejects a request with no token', async () => {
    const res = await request(app).put('/readings/buckets').send({ buckets: [] });
    expect(res.status).toBe(401);
  });

  it('stores a bucket exactly as sent and answers 204', async () => {
    const bucket = bucketOf(T0, { 70: 2, 95: 7, 180: 1, 300: 1 }, { coveredSlots: 2 });
    const res = await put([bucket]);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    const [row] = await stored();
    expect(row).toMatchObject({ readingsCount: 11, coveredSlots: 2, mgDl: [70, 95, 180, 300], counts: [2, 7, 1, 1] });
    expect(row.bucketStart.getTime()).toBe(T0);
  });

  it('keeps the instant to the millisecond, in UTC', async () => {
    await put([bucketOf(Date.UTC(2026, 11, 31, 23, 45))]);
    expect((await stored())[0].bucketStart.toISOString()).toBe('2026-12-31T23:45:00.000Z');
  });

  it('creates the patient row first and accepts an empty batch', async () => {
    expect((await put([])).status).toBe(204);
    expect(await stored()).toHaveLength(0);
  });

  it('stores several intervals in one request', async () => {
    await put([bucketOf(T0), bucketOf(T0 + BUCKET_MS), bucketOf(T0 + 2 * BUCKET_MS)]);
    expect((await stored()).map((r) => r.bucketStart.getTime())).toEqual([T0, T0 + BUCKET_MS, T0 + 2 * BUCKET_MS]);
  });

  it('lets an interval grow: a larger count replaces the stored one', async () => {
    await put([bucketOf(T0, { 100: 5 })]);
    await put([bucketOf(T0, { 100: 5, 150: 5 })]);

    const [row] = await stored();
    expect(row.readingsCount).toBe(10);
    expect(row.mgDl).toEqual([100, 150]);
  });

  it('refreshes an interval that has the same count', async () => {
    await put([bucketOf(T0, { 100: 10 })]);
    await put([bucketOf(T0, { 120: 10 })]);

    expect((await stored())[0].mgDl).toEqual([120]);
  });

  it('never shrinks an interval: a smaller count leaves the stored one alone', async () => {
    await put([bucketOf(T0, { 100: 15 })]);
    const res = await put([bucketOf(T0, { 150: 3 })]);

    expect(res.status).toBe(204);
    const [row] = await stored();
    expect(row.readingsCount).toBe(15);
    expect(row.mgDl).toEqual([100]);
  });

  it('rejects an invalid bucket with 400 and stores none of the batch', async () => {
    const res = await put([bucketOf(T0), { ...bucketOf(T0 + BUCKET_MS), readingsCount: 7 }]);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^buckets\[1\]: /);
    expect(await stored()).toHaveLength(0);
  });

  it('accepts a full-size batch of the busiest buckets under the body limit', async () => {
    // 15 distinct three-digit values per bucket is the heaviest bucket a 1/min sensor makes.
    const heavy = Array.from({ length: HISTOGRAM_CONTRACT.maxBucketsPerRequest }, (_, i) =>
      bucketOf(T0 + i * BUCKET_MS, Object.fromEntries(Array.from({ length: 15 }, (_, v) => [100 + v, 1]))),
    );
    const res = await put(heavy);
    expect(res.status).toBe(204);
    expect(await stored()).toHaveLength(HISTOGRAM_CONTRACT.maxBucketsPerRequest);
  });

  it('keeps each patient to their own intervals', async () => {
    const other = await signedInPatient();
    await put([bucketOf(T0, { 100: 10 })], other);
    await put([bucketOf(T0, { 150: 20 })]);

    expect((await stored(other.userId))[0].readingsCount).toBe(10);
    expect((await stored())[0].readingsCount).toBe(20);
  });

  it('is refused to a health professional', async () => {
    const professional = await signedInProfessional();
    const res = await request(app)
      .put('/readings/buckets')
      .set({ Authorization: `Bearer ${professional.token}` })
      .send({ buckets: [] });
    expect(res.status).toBe(403);
  });
});

describe('the table', () => {
  const insert = (overrides: Record<string, unknown>) =>
    prisma.glucoseBucket.create({
      data: {
        patientId: user.userId,
        bucketStart: new Date(T0),
        readingsCount: 10,
        coveredSlots: 2,
        mgDl: [100],
        counts: [10],
        ...overrides,
      } as never,
    });

  it.each([
    ['an interval that is not on a 15-minute boundary', { bucketStart: new Date(T0 + 60_000) }],
    ['a count the values do not add up to', { readingsCount: 11 }],
    ['an empty bucket', { readingsCount: 0, mgDl: [], counts: [] }],
    ['values and counts of different length', { mgDl: [100, 120], counts: [10] }],
    ['a value below 40', { mgDl: [39] }],
    ['a value above 600', { mgDl: [601] }],
    ['a zero count', { mgDl: [100, 120], counts: [10, 0] }],
    ['more slots than readings', { coveredSlots: 3, readingsCount: 2, counts: [2] }],
    ['no slots', { coveredSlots: 0 }],
    ['four slots', { coveredSlots: 4 }],
  ])('refuses %s even when the API is bypassed', async (_label, overrides) => {
    await expect(insert(overrides)).rejects.toThrow();
  });

  it('goes away with the patient', async () => {
    await insert({});
    await prisma.patient.delete({ where: { userId: user.userId } });
    expect(await prisma.glucoseBucket.count()).toBe(0);
  });
});

import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app';
import { disconnect, prisma, signedInPatient, truncateAll, type SignedInPatient } from '../helpers/db';
import { histogramOf, summaryOf } from '../helpers/histogram';

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

const auth = (who: SignedInPatient = user) => ({ Authorization: `Bearer ${who.token}` });
const put = (days: unknown[], who: SignedInPatient = user) =>
  request(app).put('/readings/summaries').set(auth(who)).send({ days });
const stored = (patientId = user.userId) =>
  prisma.glucoseDailySummary.findMany({ where: { patientId }, orderBy: { localDate: 'asc' } });

describe('PUT /readings/summaries', () => {
  it('rejects a request with no token', async () => {
    const res = await request(app).put('/readings/summaries').send({ days: [] });
    expect(res.status).toBe(401);
  });

  it('stores a day exactly as sent and answers 204', async () => {
    const day = summaryOf('2026-10-10', { 70: 30, 95: 400, 180: 20, 300: 4 }, { coveredSlots: 250 });
    const res = await put([day]);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    const [row] = await stored();
    expect(row).toMatchObject({
      utcOffsetMinutes: -180,
      readingsCount: 454,
      coveredSlots: 250,
      histogram: day.histogram,
    });
    expect(row.localDate.toISOString().slice(0, 10)).toBe('2026-10-10');
  });

  it('creates the patient row first and accepts an empty batch', async () => {
    expect((await put([])).status).toBe(204);
    expect(await stored()).toHaveLength(0);
  });

  it('stores several days in one request', async () => {
    await put([summaryOf('2026-10-08'), summaryOf('2026-10-09'), summaryOf('2026-10-10')]);
    expect((await stored()).map((r) => r.localDate.toISOString().slice(0, 10))).toEqual([
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
    ]);
  });

  it('lets a day grow: a larger count replaces the stored day', async () => {
    await put([summaryOf('2026-10-10', { 100: 100 })]);
    await put([summaryOf('2026-10-10', { 100: 100, 150: 50 })]);

    const [row] = await stored();
    expect(row.readingsCount).toBe(150);
    expect(row.histogram[150 - 40]).toBe(50);
  });

  it('refreshes a day that has the same count', async () => {
    await put([summaryOf('2026-10-10', { 100: 100 }, { utcOffsetMinutes: -180 })]);
    await put([summaryOf('2026-10-10', { 120: 100 }, { utcOffsetMinutes: -120 })]);

    const [row] = await stored();
    expect(row).toMatchObject({ utcOffsetMinutes: -120 });
    expect(row.histogram[120 - 40]).toBe(100);
  });

  it('never shrinks a day: a smaller count leaves the stored one alone', async () => {
    await put([summaryOf('2026-10-10', { 100: 1000 })]);
    const res = await put([summaryOf('2026-10-10', { 150: 288 })]);

    expect(res.status).toBe(204);
    const [row] = await stored();
    expect(row.readingsCount).toBe(1000);
    expect(row.histogram[100 - 40]).toBe(1000);
  });

  it('rejects an invalid day with 400 and stores none of the batch', async () => {
    const res = await put([summaryOf('2026-10-09'), { ...summaryOf('2026-10-10'), readingsCount: 7 }]);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^days\[1\]: /);
    expect(await stored()).toHaveLength(0);
  });

  it('keeps each patient to their own days', async () => {
    const other = await signedInPatient();
    await put([summaryOf('2026-10-10', { 100: 10 })], other);
    await put([summaryOf('2026-10-10', { 150: 20 })]);

    expect((await stored(other.userId))[0].readingsCount).toBe(10);
    expect((await stored())[0].readingsCount).toBe(20);
  });

  it('is refused to a health professional', async () => {
    const { signedInProfessional } = await import('../helpers/db');
    const professional = await signedInProfessional();
    const res = await request(app)
      .put('/readings/summaries')
      .set({ Authorization: `Bearer ${professional.token}` })
      .send({ days: [] });
    expect(res.status).toBe(403);
  });
});

describe('the table', () => {
  const insert = (overrides: Record<string, unknown>) =>
    prisma.glucoseDailySummary.create({
      data: {
        patientId: user.userId,
        localDate: new Date('2026-10-10'),
        utcOffsetMinutes: -180,
        readingsCount: 10,
        coveredSlots: 5,
        histogram: histogramOf({ 100: 10 }),
        ...overrides,
      } as never,
    });

  it.each([
    ['a short histogram', { histogram: [10] }],
    ['a negative bin', { histogram: histogramOf({ 100: 11, 120: -1 }) }],
    ['a histogram that does not add up', { readingsCount: 11 }],
    ['an empty day', { readingsCount: 0, histogram: histogramOf({}) }],
    ['more slots than readings', { coveredSlots: 11 }],
    ['an offset beyond 14 hours', { utcOffsetMinutes: 900 }],
  ])('refuses %s even when the API is bypassed', async (_label, overrides) => {
    await expect(insert(overrides)).rejects.toThrow();
  });

  it('goes away with the patient', async () => {
    await insert({});
    await prisma.patient.delete({ where: { userId: user.userId } });
    expect(await prisma.glucoseDailySummary.count()).toBe(0);
  });
});

import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp } from '../helpers/app';
import { buildApp } from '../../src/app';
import { disconnect } from '../helpers/db';

let app: Express;

beforeAll(() => {
  app = buildTestApp().app;
});

afterAll(async () => {
  await disconnect();
});

describe('GET /health/live', () => {
  it('answers 200 with no database round-trip', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('GET /health/ready', () => {
  it('answers 200 when the database is reachable', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('answers 503 when the database check fails', async () => {
    const failing = buildApp({ prisma: { $queryRawUnsafe: () => Promise.reject(new Error('down')) } });
    const res = await request(failing).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'error', error: 'Database unavailable' });
  });
});

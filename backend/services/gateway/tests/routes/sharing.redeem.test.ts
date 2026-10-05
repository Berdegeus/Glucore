import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { redeemLimiter } from '../../src/middleware/rateLimiters';
import { startFakeDownstream, type FakeDownstream } from '../helpers/fakeDownstream';
import { bearerFor, buildGatewayApp } from '../helpers/gatewayApp';

/**
 * CON-06: invite redemption is limited to 10 attempts per user per 15 minutes.
 * Each test gets a fresh app, hence a fresh window.
 */

const LIMIT = 10;

let authFake: FakeDownstream;
let glucoseFake: FakeDownstream;
let app: Express;

const redeem = (userId: string, code = 'ABCD-EFGH') =>
  request(app).post('/api/v1/sharing/redeem').set('Authorization', bearerFor(userId, 'HEALTH_PROFESSIONAL')).send({ code });

const redeemMany = async (userId: string, times: number) => {
  const statuses: number[] = [];
  for (let i = 0; i < times; i += 1) statuses.push((await redeem(userId)).status);
  return statuses;
};

beforeAll(async () => {
  authFake = await startFakeDownstream();
  glucoseFake = await startFakeDownstream();
});

beforeEach(() => {
  glucoseFake.requests.length = 0;
  app = buildGatewayApp(authFake, glucoseFake);
});

afterAll(async () => {
  await authFake.close();
  await glucoseFake.close();
});

describe('POST /api/v1/sharing/redeem rate limit', () => {
  it('lets the first 10 attempts of a user through and answers 429 on the 11th', async () => {
    const statuses = await redeemMany('pro-1', LIMIT);
    expect(statuses).not.toContain(429);

    const limited = await redeem('pro-1');
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: 'Too many requests', code: 'RATE_LIMITED' });
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('counts attempts per user, so another user on the same IP is unaffected', async () => {
    await redeemMany('pro-1', LIMIT + 1);

    const other = await redeem('pro-2');

    expect(other.status).not.toBe(429);
  });

  it('answers 401 when there is no token, before any counting', async () => {
    const res = await request(app).post('/api/v1/sharing/redeem').send({ code: 'ABCD-EFGH' });
    expect(res.status).toBe(401);
  });
});

describe('redeemLimiter without an authenticated user', () => {
  it('falls back to the client IP: the 11th attempt is still 429', async () => {
    // Mounted without `authenticate`, so there is no `req.userId` to key on.
    const bare = express();
    bare.post('/redeem', redeemLimiter(), (_req, res) => {
      res.sendStatus(204);
    });

    const statuses: number[] = [];
    for (let i = 0; i <= LIMIT; i += 1) statuses.push((await request(bare).post('/redeem')).status);

    expect(statuses).toEqual([...Array<number>(LIMIT).fill(204), 429]);
  });
});

import type { Express } from 'express';
import request from 'supertest';

import { prisma } from '../../src/lib/prisma';

/**
 * Empties every application table between test cases.
 *
 * The table list is read from the catalogue rather than hardcoded so a new model
 * cannot silently start leaking state across tests. `_prisma_migrations` is kept:
 * dropping it would make globalSetup re-run every migration on the next file.
 */
export async function truncateAll(): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (rows.length === 0) return;

  const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

export interface RegisteredUser {
  token: string;
  userId: string;
  email: string;
  password: string;
}

let sequence = 0;

/**
 * Registers a patient through the public API and returns its bearer token.
 *
 * Going through the route rather than seeding Prisma directly is on purpose:
 * these are characterization tests, so the fixture should exercise the same code
 * path a real client does — including the nested Patient/AlertThresholdConfig
 * creation that the refactor must preserve.
 */
export async function registerUser(
  app: Express,
  overrides: Record<string, unknown> = {},
): Promise<RegisteredUser> {
  sequence += 1;
  const email = `user${sequence}.${Date.now()}@example.com`;
  const password = 'Senha123!';

  const response = await request(app)
    .post('/auth/register')
    .send({ email, password, fullName: 'Paciente Teste', ...overrides });

  if (response.status !== 201) {
    throw new Error(
      `registerUser expected 201, got ${response.status}\n` +
        `headers=${JSON.stringify(response.headers)}\n` +
        `text=${response.text}`,
    );
  }

  const status = await request(app)
    .get('/auth/status')
    .set('Authorization', `Bearer ${response.body.token}`);

  return { token: response.body.token, userId: status.body.userId, email, password };
}

export { prisma };

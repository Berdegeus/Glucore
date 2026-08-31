import type { Express } from 'express';

import { buildApp } from '../../src/app';
import { createContainer } from '../../src/container';
import { loadEnv } from '../../src/lib/env';
import type { Mailer } from '../../src/lib/mailer';

/**
 * Records what would have been emailed, so the reset flow can be tested without
 * a relay and without reading it back out of the log.
 *
 * The monolith's tests had to scrape the console, because the token only
 * surfaced through the catch-and-log fallback. Injecting a mailer is what makes
 * that unnecessary — and it only became possible once the mailer stopped being
 * chosen by exception.
 */
export class RecordingMailer implements Mailer {
  readonly sent: { email: string; token: string }[] = [];

  async sendPasswordReset(email: string, token: string): Promise<void> {
    this.sent.push({ email, token });
  }

  lastTokenFor(email: string): string | undefined {
    return [...this.sent].reverse().find((m) => m.email === email)?.token;
  }
}

export interface TestApp {
  app: Express;
  mailer: RecordingMailer;
}

/**
 * Builds the app the way production does, except for two injected decisions:
 * a recording mailer, and rate limiting off.
 *
 * Rate limiting has to be off because supertest drives every request from the
 * same loopback address — a shared per-IP counter would exhaust itself a few
 * cases in and turn the rest of the suite into 429s. It is off by construction
 * here rather than by the application asking whether NODE_ENV is 'test'.
 *
 * The bcrypt work factor comes from BCRYPT_ROUNDS, which vitest.config.ts sets
 * to 4 for the same reason: a realistic factor costs ~300 ms per password and
 * would dominate the run.
 */
export function buildTestApp(): TestApp {
  const mailer = new RecordingMailer();
  const app = buildApp({ container: createContainer(loadEnv(), { mailer, rateLimiting: false }) });
  return { app, mailer };
}

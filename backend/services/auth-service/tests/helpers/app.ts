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
 * Builds the app the way production does, except for one injected decision:
 * a recording mailer. Rate limiting lives in the gateway now (phase 4.4), not
 * in this service, so there is nothing left here to turn off for the suite.
 *
 * The bcrypt work factor comes from BCRYPT_ROUNDS, which vitest.config.ts sets
 * to 4 for the same reason a limiter would have needed disabling: a realistic
 * factor costs ~300 ms per password and would dominate the run.
 */
export function buildTestApp(): TestApp {
  const mailer = new RecordingMailer();
  const app = buildApp({ container: createContainer(loadEnv(), { mailer }) });
  return { app, mailer };
}

import 'dotenv/config';
import { deregisterService, registerService } from '@glucore/shared';

import { buildApp } from './app';
import { createContainer } from './container';
import { loadEnv } from './lib/env';
import { prisma } from './lib/prisma';

const SERVICE_NAME = 'auth';

/**
 * Only set in the compose/Consul stack (phase 5). Local `npm run dev` leaves
 * it unset, so the gateway keeps resolving this service via
 * `EnvServiceRegistry` and nothing here runs.
 */
function consulUrl(): string | undefined {
  return process.env.CONSUL_HTTP_ADDR?.trim() || undefined;
}

/**
 * Process bootstrap. Everything that assembles the application lives in
 * `app.ts`; this file only reads the environment and binds the port.
 *
 * `loadEnv` throws on bad configuration rather than exiting, so the exit code is
 * decided here — a server with no JWT_SECRET must still refuse to start.
 */
function main(): void {
  const env = loadEnv();
  const app = buildApp({
    corsOrigins: env.corsOrigins,
    requestLogging: true,
    container: createContainer(env),
  });

  const server = app.listen(env.port, () => {
    console.log(`Glucore auth-service running on :${env.port}`);

    const consul = consulUrl();
    if (consul) {
      registerService({
        consulUrl: consul,
        serviceName: SERVICE_NAME,
        address: process.env.SERVICE_HOST?.trim() || 'localhost',
        port: env.port,
        healthPath: '/health/ready',
      })
        .then(() => console.log(`[consul] registered as "${SERVICE_NAME}"`))
        .catch((error: unknown) =>
          console.error(`[consul] registration failed: ${String(error)}`),
        );
    }
  });

  /**
   * Cloud orchestrators send SIGTERM on deploy and scale-down. Without this,
   * in-flight requests die mid-response and the Prisma pool never closes.
   */
  async function shutdown(signal: string): Promise<void> {
    console.log(`[shutdown] received ${signal}`);
    const forceExit = setTimeout(() => {
      console.error('[shutdown] timed out after 10s, forcing exit');
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    const consul = consulUrl();
    if (consul) await deregisterService(consul, SERVICE_NAME);

    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();

    clearTimeout(forceExit);
    process.exit(0);
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

try {
  main();
} catch (error) {
  console.error(`FATAL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

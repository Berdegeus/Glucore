import 'dotenv/config';
import { buildApp } from './app';
import { loadEnv } from './lib/env';
import { prisma } from './lib/prisma';

/**
 * Process bootstrap. Everything that assembles the application lives in
 * `app.ts`; this file only reads the environment and binds the port.
 *
 * `loadEnv` throws on bad configuration rather than exiting, so the exit code is
 * decided here — a server with no JWT_SECRET must still refuse to start.
 */
function main(): void {
  const env = loadEnv();
  const app = buildApp({ corsOrigins: env.corsOrigins, requestLogging: true });

  const server = app.listen(env.port, () => {
    console.log(`Glucore backend running on :${env.port}`);
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

import 'dotenv/config';

import { buildApp } from './app';
import { createContainer } from './container';
import { loadEnv } from './lib/env';

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

  app.listen(env.port, () => {
    console.log(`Glucore auth-service running on :${env.port}`);
  });
}

try {
  main();
} catch (error) {
  console.error(`FATAL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

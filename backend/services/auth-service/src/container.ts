import { Router, type RequestHandler } from 'express';
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import { createRequireInternalAuth } from '@glucore/shared';

import { loadEnv, type Env } from './lib/env';
import { createMailer, type Mailer } from './lib/mailer';
import { BcryptPasswordHasher, type PasswordHasher } from './lib/passwordHasher';
import { prisma as defaultPrisma, type PrismaClient } from './lib/prisma';
import { AccountsController } from './modules/accounts/accounts.controller';
import { PrismaAccountRepository } from './modules/accounts/accounts.repository';
import { createAccountsRouter } from './modules/accounts/accounts.routes';
import { AccountsService } from './modules/accounts/accounts.service';
import { InternalAccountsController } from './modules/internal/internal.controller';
import { createInternalAccountsRouter } from './modules/internal/internal.routes';
import { PasswordController } from './modules/password/password.controller';
import { PrismaPasswordRepository } from './modules/password/password.repository';
import { createPasswordRouter } from './modules/password/password.routes';
import { PasswordService } from './modules/password/password.service';
import { SessionsController } from './modules/sessions/sessions.controller';
import { PrismaSessionRepository } from './modules/sessions/sessions.repository';
import { createSessionsRouter } from './modules/sessions/sessions.routes';
import { SessionsService } from './modules/sessions/sessions.service';

/**
 * Composition root: the one place that knows which implementation satisfies
 * which interface.
 *
 * Wired by hand rather than through a container library, matching
 * glucose-service. At this size explicit wiring is shorter than the decorators
 * and reflection metadata a library needs, and it stays greppable — every
 * dependency of every module is visible in one file.
 *
 * It is also where the two strategies are chosen: which password hasher, which
 * mailer. Both used to be decided inline by asking about NODE_ENV or by
 * catching a failure; deciding here means the modules never learn that a test
 * environment exists.
 */
export interface Container {
  authRouter: Router;
  internalRouter: Router;
}

export interface ContainerOverrides {
  prisma?: PrismaClient;
  hasher?: PasswordHasher;
  mailer?: Mailer;
  /** Off in tests: supertest drives every request from the same loopback
   * address, so a shared per-IP counter would exhaust itself a few cases in and
   * turn the rest of the suite into 429s. The limiters move to the gateway in
   * phase 4.4, where the counter is per-client again. */
  rateLimiting?: boolean;
}

function strictAuthLimiter(enabled: boolean): RateLimitRequestHandler {
  // Credential-sensitive endpoints: login and both halves of the reset flow.
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !enabled,
  });
}

function registerLimiter(enabled: boolean): RateLimitRequestHandler {
  // Looser: account creation is not a credential guess.
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !enabled,
  });
}

export function createContainer(env: Env = loadEnv(), overrides: ContainerOverrides = {}): Container {
  const prisma = overrides.prisma ?? defaultPrisma;
  const hasher = overrides.hasher ?? new BcryptPasswordHasher(env.bcryptRounds);
  const mailer = overrides.mailer ?? createMailer(env.smtp);
  const rateLimiting = overrides.rateLimiting ?? true;

  const sessions = new SessionsService(new PrismaSessionRepository(prisma), hasher);
  const accounts = new AccountsService(new PrismaAccountRepository(prisma), hasher, sessions);
  const passwords = new PasswordService(new PrismaPasswordRepository(prisma), hasher, mailer);

  const strict = strictAuthLimiter(rateLimiting);

  // One router under /auth, assembled from three modules. The split is by what
  // each one writes — accounts owns User and AuthCredential, sessions owns
  // AuthSession, password owns the reset tokens — not by URL shape, which is
  // why /register and /login sit in different modules despite being neighbours
  // in the path.
  const authRouter = Router();
  authRouter.use(createAccountsRouter(new AccountsController(accounts), registerLimiter(rateLimiting)));
  authRouter.use(createSessionsRouter(new SessionsController(sessions), strict));
  authRouter.use(createPasswordRouter(new PasswordController(passwords), strict));

  const requireInternalAuth: RequestHandler = createRequireInternalAuth(() => env.internalJwtSecret);
  const internalRouter = createInternalAccountsRouter(
    new InternalAccountsController(accounts),
    requireInternalAuth,
  );

  return { authRouter, internalRouter };
}

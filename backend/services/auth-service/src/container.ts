import { Router, type RequestHandler } from 'express';
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
}

export function createContainer(env: Env = loadEnv(), overrides: ContainerOverrides = {}): Container {
  const prisma = overrides.prisma ?? defaultPrisma;
  const hasher = overrides.hasher ?? new BcryptPasswordHasher(env.bcryptRounds);
  const mailer = overrides.mailer ?? createMailer(env.smtp);

  const sessions = new SessionsService(new PrismaSessionRepository(prisma), hasher);
  const accounts = new AccountsService(new PrismaAccountRepository(prisma), hasher, sessions);
  const passwords = new PasswordService(new PrismaPasswordRepository(prisma), hasher, mailer);

  // One router under /auth, assembled from three modules. The split is by what
  // each one writes — accounts owns User and AuthCredential, sessions owns
  // AuthSession, password owns the reset tokens — not by URL shape, which is
  // why /register and /login sit in different modules despite being neighbours
  // in the path. Rate limiting moved to the gateway (phase 4.4).
  const authRouter = Router();
  authRouter.use(createAccountsRouter(new AccountsController(accounts)));
  authRouter.use(createSessionsRouter(new SessionsController(sessions)));
  authRouter.use(createPasswordRouter(new PasswordController(passwords)));

  const requireInternalAuth: RequestHandler = createRequireInternalAuth(() => env.internalJwtSecret);
  const internalRouter = createInternalAccountsRouter(
    new InternalAccountsController(accounts),
    requireInternalAuth,
  );

  return { authRouter, internalRouter };
}

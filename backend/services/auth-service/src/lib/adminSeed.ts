import { recordAudit } from '@glucore/shared';

import { isValidEmail, normalizeEmail } from '../modules/accounts/accounts.schema';
import type { PasswordHasher } from './passwordHasher';
import { validatePassword } from './passwordPolicy';
import type { PrismaClient } from './prisma';

/** The variables the seed reads. `process.env` satisfies it as is. */
export interface AdminSeedEnv {
  NODE_ENV?: string;
  ADMIN_SEED_EMAIL?: string;
  ADMIN_SEED_PASSWORD?: string;
}

export type AdminSeedOutcome = 'created' | 'exists' | 'skipped';

const EMAIL_VAR = 'ADMIN_SEED_EMAIL';
const PASSWORD_VAR = 'ADMIN_SEED_PASSWORD';
const SEED_FULL_NAME = 'Administrator';

/**
 * Thrown when the seed configuration cannot be honoured. The message names the
 * offending variable and never its value, so it is safe to print: `index.ts`
 * prints it and exits non-zero, which is how a misconfigured production boot
 * fails (REG-10).
 */
export class AdminSeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminSeedError';
  }
}

/** An exported-but-empty variable (compose's `${VAR:-}`) counts as unset. */
function readVar(env: AdminSeedEnv, name: typeof EMAIL_VAR | typeof PASSWORD_VAR): string | undefined {
  const value = env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

/**
 * Makes sure the platform has an administrator (REG-09). The only way to get an
 * ADMINISTRATOR account is this seed, never a request.
 *
 * Idempotent on every boot: once any administrator exists it returns without
 * touching anything, so it neither duplicates nor resets a password the admin
 * has since changed. It also does not even look at the variables then, so
 * production can drop the password from its environment after the first boot.
 *
 * Variables absent: production refuses to start (REG-10), development logs one
 * info line and moves on. Variables present but unusable (weak password,
 * malformed email, email held by a non-admin account) refuse to start in any
 * environment: someone asked for an admin explicitly and is not getting it.
 */
export async function ensureAdminSeed(
  prisma: PrismaClient,
  env: AdminSeedEnv,
  hasher: PasswordHasher,
): Promise<AdminSeedOutcome> {
  if ((await prisma.user.count({ where: { role: 'ADMINISTRATOR' } })) > 0) return 'exists';

  const rawEmail = readVar(env, EMAIL_VAR);
  const password = readVar(env, PASSWORD_VAR);

  if (rawEmail === undefined || password === undefined) {
    const missing = [rawEmail === undefined && EMAIL_VAR, password === undefined && PASSWORD_VAR].filter(Boolean);
    if (env.NODE_ENV === 'production') {
      throw new AdminSeedError(
        `${missing.join(' and ')} must be set in production: no administrator exists yet and the seed needs both ` +
          `${EMAIL_VAR} and ${PASSWORD_VAR} to create the first one.`,
      );
    }
    if (missing.length === 2) {
      console.log(`[auth] admin seed skipped: ${EMAIL_VAR} and ${PASSWORD_VAR} are not set`);
    } else {
      console.warn(`[auth] admin seed skipped: ${missing[0]} is not set (both variables are needed)`);
    }
    return 'skipped';
  }

  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) throw new AdminSeedError(`${EMAIL_VAR} is not a valid email address.`);

  const weakness = validatePassword(password);
  if (weakness !== null) {
    throw new AdminSeedError(
      `${PASSWORD_VAR} does not satisfy the password policy (${weakness}): ` +
        'at least 8 characters with an uppercase letter, a lowercase letter, a digit and a special character.',
    );
  }

  // No administrator exists, so a holder of this email is a patient or a
  // professional. Promoting them would hand admin to whoever registered it
  // first, so the seed refuses instead.
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new AdminSeedError(`${EMAIL_VAR} belongs to an existing non-administrator account; choose another email.`);
  }

  const passwordHash = await hasher.hash(password);
  const user = await prisma.user.create({
    data: {
      email,
      fullName: SEED_FULL_NAME,
      role: 'ADMINISTRATOR',
      authCredential: { create: { passwordHash } },
    },
    select: { id: true },
  });

  console.log(`[auth] admin seed: created the administrator ${email}`);
  await recordAudit(
    { userId: user.id, entity: 'User', action: 'SEED_ADMIN', entityId: user.id, metadata: { email } },
    prisma,
  );

  return 'created';
}

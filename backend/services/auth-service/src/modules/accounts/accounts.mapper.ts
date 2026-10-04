import type { UserRoleName } from '@glucore/shared';

/**
 * The account half of what used to be one profile payload.
 *
 * The monolith answered `GET /auth/profile` with account and patient blocks
 * together, built by a single `toProfileDto`. Those two halves now live in
 * different databases, so this mapper renders only what this service owns and
 * glucose-service renders the rest. The gateway composes them back into the
 * shape the app knows (phase 6.2) — until then a client talking straight to
 * this service sees the account block alone.
 */
export interface AccountDto {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: string;
  role: UserRoleName;
  createdAt: string;
}

export interface AccountSource {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: string;
  role: string;
  createdAt: Date;
}

export function toAccountDto(user: AccountSource): AccountDto {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    status: user.status,
    role: user.role as UserRoleName,
    createdAt: user.createdAt.toISOString(),
  };
}

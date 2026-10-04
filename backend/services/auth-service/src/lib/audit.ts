import { recordAudit as recordAuditWith, type AuditEntry } from '@glucore/shared';

import { prisma } from './prisma';

export { auditRequestContext } from '@glucore/shared';

/**
 * Binds the shared audit writer to this service's database.
 *
 * Each service has its own AuditLog table, so the shared writer takes the client
 * as a parameter and this is where auth-service supplies its own. The two rules
 * the shared implementation guarantees hold here unchanged: it never throws to
 * the caller — a failed audit write must not fail a login — and it never
 * persists a password, hash or token, because `sanitizeMetadata` strips any key
 * matching /password|token/i at any depth.
 */
export function recordAudit(entry: AuditEntry): Promise<void> {
  return recordAuditWith(entry, prisma);
}

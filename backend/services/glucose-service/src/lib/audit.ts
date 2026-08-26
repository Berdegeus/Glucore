import {
  recordAudit as recordAuditWith,
  type AuditEntry,
} from '@glucore/shared';

import { prisma } from './prisma';

export { auditRequestContext } from '@glucore/shared';

/**
 * Binds the shared audit writer to this service's database.
 *
 * The shared package takes the client as a parameter so it stays free of any one
 * PrismaClient; this is where glucose-service supplies its own. Keeping the
 * call-site signature identical means no route had to change.
 */
export function recordAudit(entry: AuditEntry): Promise<void> {
  return recordAuditWith(entry, prisma);
}

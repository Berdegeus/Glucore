/**
 * Best-effort audit trail writer (checklist item 4.11).
 *
 * Two rules govern this module, both from spec.md "P3: Trilha de auditoria":
 *
 * 1. It never throws to the caller (AD-5). Losing a trail entry is less serious
 *    than losing a patient's insulin record, and the migration may not be
 *    applied on every development machine.
 * 2. It never persists a password, a password hash or a recovery token. Every
 *    metadata payload goes through `sanitizeMetadata` first.
 */

import { prisma } from './prisma';

export interface AuditEntry {
  userId?: string | null;
  entity: string;
  action: string;
  entityId?: string | null;
  metadata?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Minimal surface `recordAudit` needs, so tests can pass a double. */
export interface AuditClient {
  auditLog: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

/**
 * Any key whose name mentions a password or a token is dropped, at every level
 * of nesting. Matching on the name rather than an exact list also covers
 * variants such as `resetToken` or `passwordConfirmation`.
 */
const SENSITIVE_KEY = /password|token/i;

export function sanitizeMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeMetadata);
  if (value instanceof Date) return value.toISOString();
  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(key)) continue;
      sanitized[key] = sanitizeMetadata(nested);
    }
    return sanitized;
  }
  return value;
}

export async function recordAudit(
  entry: AuditEntry,
  client: AuditClient = prisma as unknown as AuditClient,
): Promise<void> {
  try {
    await client.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        entity: entry.entity,
        action: entry.action,
        entityId: entry.entityId ?? null,
        ...(entry.metadata === undefined
          ? {}
          : { metadata: sanitizeMetadata(entry.metadata) }),
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[audit] failed to record ${entry.entity}/${entry.action}: ${reason}`);
  }
}

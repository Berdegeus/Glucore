/**
 * Business rules of the alert history: input validation, patient resolution,
 * audit trail and the deprecated batch truncation.
 *
 * Same construction as `carbService` and `insulinService` — repository,
 * `ensurePatient` and `recordAudit` arrive by constructor, so the service runs
 * without PostgreSQL. Auditing stays best-effort (AD-004).
 */

import type { AuditEntry } from '../lib/audit';
import type { AlertEntry, AlertInput, AlertRepository } from '../repositories/alertRepository';
import type { PageQuery } from './pagination';
import { parsePageQuery } from './pagination';
import type { RequestContext } from './requestContext';
import type { Result } from './result';
import { invalid, notFound, ok } from './result';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_RE.test(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * An unrecognized `type` is not rejected here: the repository maps it to
 * `SYNC_FAILURE`, which is the behaviour the batch endpoint already had.
 */
function validateAlertBody(body: unknown): string | null {
  const b = body as { type?: unknown; timestampMs?: unknown };
  if (typeof b.type !== 'string' || b.type.trim().length === 0) {
    return 'type must be a non-empty string';
  }
  if (!isFiniteNumber(b.timestampMs)) return 'timestampMs must be a number (epoch ms)';
  return null;
}

export type { RequestContext } from './requestContext';

export interface AlertServiceDeps {
  repository: AlertRepository;
  ensurePatient: (userId: string) => Promise<string>;
  recordAudit: (entry: AuditEntry) => Promise<void>;
}

export interface AlertService {
  list(
    userId: string,
    query: { before?: unknown; limit?: unknown },
  ): Promise<Result<AlertEntry[]>>;
  create(context: RequestContext, body: unknown): Promise<Result<{ id: string }>>;
  update(context: RequestContext, id: string, body: unknown): Promise<Result<null>>;
  remove(context: RequestContext, id: string): Promise<Result<null>>;
  replaceAll(context: RequestContext, body: unknown): Promise<Result<null>>;
}

/** Cap kept from the pre-split batch endpoint; the per-item path has none. */
const BATCH_LIMIT = 100;

export function createAlertService(deps: AlertServiceDeps): AlertService {
  const { repository, ensurePatient, recordAudit } = deps;

  return {
    async list(userId, query) {
      const page: Result<PageQuery> = parsePageQuery(query);
      if (!page.ok) return page;
      const patientId = await ensurePatient(userId);
      return ok(await repository.findPage({ patientId, ...page.value }));
    },

    async create(context, body) {
      const message = validateAlertBody(body);
      if (message) return invalid(message);
      const { id, type, timestampMs } = body as AlertInput & { id?: unknown };
      if (id !== undefined && !isUuid(id)) return invalid('id must be a UUID');

      const patientId = await ensurePatient(context.userId);
      const createdId = await repository.create(patientId, {
        ...(id === undefined ? {} : { id: id as string }),
        type,
        timestampMs,
      });
      await recordAudit({
        userId: context.userId,
        entity: 'AlertEvent',
        action: 'CREATE',
        entityId: createdId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      return ok({ id: createdId });
    },

    async update(context, id, body) {
      if (!isUuid(id)) return invalid('id must be a UUID');
      const message = validateAlertBody(body);
      if (message) return invalid(message);
      const { type, timestampMs } = body as AlertInput;

      const patientId = await ensurePatient(context.userId);
      const changed = await repository.update(id, patientId, { type, timestampMs });
      if (!changed) return notFound();
      await recordAudit({
        userId: context.userId,
        entity: 'AlertEvent',
        action: 'UPDATE',
        entityId: id,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      return ok(null);
    },

    async remove(context, id) {
      if (!isUuid(id)) return invalid('id must be a UUID');
      const patientId = await ensurePatient(context.userId);
      const removed = await repository.remove(id, patientId);
      if (!removed) return notFound();
      await recordAudit({
        userId: context.userId,
        entity: 'AlertEvent',
        action: 'DELETE',
        entityId: id,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      return ok(null);
    },

    async replaceAll(context, body) {
      const { alerts } = (body ?? {}) as {
        alerts?: Array<AlertInput & { id?: unknown }>;
      };
      if (!Array.isArray(alerts)) return invalid('alerts must be array');

      const patientId = await ensurePatient(context.userId);
      await repository.replaceAll(
        patientId,
        // The id is carried through now; the pre-split endpoint dropped it, so
        // an alert never kept its identity across a batch push (API-01).
        alerts.slice(0, BATCH_LIMIT).map((entry) => ({
          ...(isUuid(entry.id) ? { id: entry.id } : {}),
          type: entry.type,
          timestampMs: entry.timestampMs,
        })),
      );
      await recordAudit({
        userId: context.userId,
        entity: 'AlertEvent',
        action: 'REPLACE',
        entityId: patientId,
        metadata: { count: alerts.length },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      return ok(null);
    },
  };
}

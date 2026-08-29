/**
 * Business rules of the insulin diary: input validation, patient resolution,
 * audit trail and the deprecated batch truncation.
 *
 * Same construction as `carbService` — repository, `ensurePatient` and
 * `recordAudit` all arrive by constructor, so the service runs without
 * PostgreSQL. Auditing stays best-effort (AD-004).
 */

import type { AuditEntry } from '../lib/audit';
import type {
  InsulinEntry,
  InsulinInput,
  InsulinRepository,
} from '../repositories/insulinRepository';
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

/** Same messages the route answered before the split; the contract is public. */
function validateInsulinBody(body: unknown): string | null {
  const b = body as {
    units?: unknown;
    type?: unknown;
    timeMs?: unknown;
    dayOfWeek?: unknown;
  };
  if (!isFiniteNumber(b.units)) return 'units must be a number';
  if (typeof b.type !== 'string' || b.type.trim().length === 0) {
    return 'type must be a non-empty string';
  }
  if (!isFiniteNumber(b.timeMs)) return 'timeMs must be a number (epoch ms)';
  if (b.dayOfWeek !== undefined && typeof b.dayOfWeek !== 'string') {
    return 'dayOfWeek must be a string';
  }
  return null;
}

export type { RequestContext } from './requestContext';

export interface InsulinServiceDeps {
  repository: InsulinRepository;
  ensurePatient: (userId: string) => Promise<string>;
  recordAudit: (entry: AuditEntry) => Promise<void>;
}

export interface InsulinService {
  list(
    userId: string,
    query: { before?: unknown; limit?: unknown },
  ): Promise<Result<InsulinEntry[]>>;
  create(context: RequestContext, body: unknown): Promise<Result<{ id: string }>>;
  update(context: RequestContext, id: string, body: unknown): Promise<Result<null>>;
  remove(context: RequestContext, id: string): Promise<Result<null>>;
  replaceAll(context: RequestContext, body: unknown): Promise<Result<null>>;
}

/** Cap kept from the pre-split batch endpoint; the per-item path has none. */
const BATCH_LIMIT = 100;

export function createInsulinService(deps: InsulinServiceDeps): InsulinService {
  const { repository, ensurePatient, recordAudit } = deps;

  return {
    async list(userId, query) {
      const page: Result<PageQuery> = parsePageQuery(query);
      if (!page.ok) return page;
      const patientId = await ensurePatient(userId);
      return ok(await repository.findPage({ patientId, ...page.value }));
    },

    async create(context, body) {
      const message = validateInsulinBody(body);
      if (message) return invalid(message);
      const { id, units, type, timeMs, dayOfWeek } = body as InsulinInput & {
        id?: unknown;
      };
      if (id !== undefined && !isUuid(id)) return invalid('id must be a UUID');

      const patientId = await ensurePatient(context.userId);
      const createdId = await repository.create(patientId, {
        ...(id === undefined ? {} : { id: id as string }),
        units,
        type,
        timeMs,
        dayOfWeek,
      });
      await recordAudit({
        userId: context.userId,
        entity: 'InsulinEvent',
        action: 'CREATE',
        entityId: createdId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      return ok({ id: createdId });
    },

    async update(context, id, body) {
      if (!isUuid(id)) return invalid('id must be a UUID');
      const message = validateInsulinBody(body);
      if (message) return invalid(message);
      const { units, type, timeMs, dayOfWeek } = body as InsulinInput;

      const patientId = await ensurePatient(context.userId);
      const changed = await repository.update(id, patientId, {
        units,
        type,
        timeMs,
        dayOfWeek,
      });
      if (!changed) return notFound();
      await recordAudit({
        userId: context.userId,
        entity: 'InsulinEvent',
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
        entity: 'InsulinEvent',
        action: 'DELETE',
        entityId: id,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      return ok(null);
    },

    async replaceAll(context, body) {
      const { insulin } = (body ?? {}) as {
        insulin?: Array<InsulinInput & { id?: unknown }>;
      };
      if (!Array.isArray(insulin)) return invalid('insulin must be array');

      const patientId = await ensurePatient(context.userId);
      await repository.replaceAll(
        patientId,
        insulin.slice(0, BATCH_LIMIT).map((entry) => ({
          ...(isUuid(entry.id) ? { id: entry.id } : {}),
          units: entry.units,
          type: entry.type,
          timeMs: entry.timeMs,
          dayOfWeek: entry.dayOfWeek,
        })),
      );
      await recordAudit({
        userId: context.userId,
        entity: 'InsulinEvent',
        action: 'REPLACE',
        entityId: patientId,
        metadata: { count: insulin.length },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      return ok(null);
    },
  };
}

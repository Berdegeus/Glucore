/**
 * Business rules of the carbohydrate diary: input validation, patient
 * resolution, audit trail and the deprecated batch truncation.
 *
 * Every collaborator arrives by constructor — repository, `ensurePatient` and
 * `recordAudit` — so the service runs without PostgreSQL. Auditing stays
 * best-effort (AD-004): `recordAudit` swallows its own failures, and this
 * service does not treat it as part of the write.
 */

import type { AuditEntry } from '../lib/audit';
import type { CarbEntry, CarbInput, CarbRepository } from '../repositories/carbRepository';
import type { PageQuery } from './pagination';
import { parsePageQuery } from './pagination';
import type { Result } from './result';
import { invalid, notFound, ok } from './result';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_RE.test(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Same messages the route answered before the split; the contract is public. */
function validateCarbBody(body: unknown): string | null {
  const b = body as { grams?: unknown; description?: unknown; timeMs?: unknown };
  if (!isFiniteNumber(b.grams)) return 'grams must be a number';
  if (typeof b.description !== 'string') return 'description must be a string';
  if (!isFiniteNumber(b.timeMs)) return 'timeMs must be a number (epoch ms)';
  return null;
}

/** Who is acting and from where; every audit entry carries it. */
export interface RequestContext {
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface CarbServiceDeps {
  repository: CarbRepository;
  ensurePatient: (userId: string) => Promise<string>;
  recordAudit: (entry: AuditEntry) => Promise<void>;
}

export interface CarbService {
  list(userId: string, query: { before?: unknown; limit?: unknown }): Promise<Result<CarbEntry[]>>;
  create(context: RequestContext, body: unknown): Promise<Result<{ id: string }>>;
  update(context: RequestContext, id: string, body: unknown): Promise<Result<null>>;
  remove(context: RequestContext, id: string): Promise<Result<null>>;
  replaceAll(context: RequestContext, body: unknown): Promise<Result<null>>;
}

/** Cap kept from the pre-split batch endpoint; the per-item path has none. */
const BATCH_LIMIT = 100;

export function createCarbService(deps: CarbServiceDeps): CarbService {
  const { repository, ensurePatient, recordAudit } = deps;

  return {
    async list(userId, query) {
      const page: Result<PageQuery> = parsePageQuery(query);
      if (!page.ok) return page;
      const patientId = await ensurePatient(userId);
      return ok(await repository.findPage({ patientId, ...page.value }));
    },

    async create(context, body) {
      const message = validateCarbBody(body);
      if (message) return invalid(message);
      const { id, grams, description, timeMs } = body as CarbInput & { id?: unknown };
      if (id !== undefined && !isUuid(id)) return invalid('id must be a UUID');

      const patientId = await ensurePatient(context.userId);
      const createdId = await repository.create(patientId, {
        ...(id === undefined ? {} : { id: id as string }),
        grams,
        description,
        timeMs,
      });
      await recordAudit({
        userId: context.userId,
        entity: 'CarbEvent',
        action: 'CREATE',
        entityId: createdId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      return ok({ id: createdId });
    },

    async update(context, id, body) {
      if (!isUuid(id)) return invalid('id must be a UUID');
      const message = validateCarbBody(body);
      if (message) return invalid(message);
      const { grams, description, timeMs } = body as CarbInput;

      const patientId = await ensurePatient(context.userId);
      const changed = await repository.update(id, patientId, { grams, description, timeMs });
      if (!changed) return notFound();
      await recordAudit({
        userId: context.userId,
        entity: 'CarbEvent',
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
        entity: 'CarbEvent',
        action: 'DELETE',
        entityId: id,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      return ok(null);
    },

    async replaceAll(context, body) {
      const { carbs } = (body ?? {}) as {
        carbs?: Array<CarbInput & { id?: unknown }>;
      };
      if (!Array.isArray(carbs)) return invalid('carbs must be array');

      const patientId = await ensurePatient(context.userId);
      await repository.replaceAll(
        patientId,
        carbs.slice(0, BATCH_LIMIT).map((entry) => ({
          ...(isUuid(entry.id) ? { id: entry.id } : {}),
          grams: entry.grams,
          description: entry.description,
          timeMs: entry.timeMs,
        })),
      );
      await recordAudit({
        userId: context.userId,
        entity: 'CarbEvent',
        action: 'REPLACE',
        entityId: patientId,
        metadata: { count: carbs.length },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      return ok(null);
    },
  };
}

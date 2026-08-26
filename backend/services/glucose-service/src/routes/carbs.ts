import { Router, Response } from 'express';
import { verifyJwt, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '@glucore/shared';
import { prisma } from '../lib/prisma';
import { ensurePatient } from '../lib/patient';
import { auditRequestContext, recordAudit } from '../lib/audit';

const router = Router();

router.use(verifyJwt);
router.use(requireRole('PATIENT'));

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_RE.test(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function validateCarbBody(body: unknown): string | null {
  const b = body as { grams?: unknown; description?: unknown; timeMs?: unknown };
  if (!isFiniteNumber(b.grams)) return 'grams must be a number';
  if (typeof b.description !== 'string') return 'description must be a string';
  if (!isFiniteNumber(b.timeMs)) return 'timeMs must be a number (epoch ms)';
  return null;
}

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const patientId = await ensurePatient(req.userId!);
    const rows = await prisma.carbEvent.findMany({
      where: { patientId },
      orderBy: { eventAt: 'desc' },
      take: 100,
    });
    res.json(
      rows.map(c => ({
        id: c.id,
        grams: Number(c.carbsGrams),
        description: c.description,
        timeMs: c.eventAt.getTime(),
      })),
    );
  }),
);

// POST /carbs/item — cria uma entrada. Aceita id (UUID) gerado pelo cliente.
// curl -X POST http://localhost:3001/carbs/item \
//   -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
//   -d '{"id":"a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d","grams":45,"description":"almoço","timeMs":1751800000000}'
router.post(
  '/item',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id, grams, description, timeMs } = req.body as {
      id?: string;
      grams?: number;
      description?: string;
      timeMs?: number;
    };
    const error = validateCarbBody(req.body);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    if (id !== undefined && !isUuid(id)) {
      res.status(400).json({ error: 'id must be a UUID' });
      return;
    }
    const patientId = await ensurePatient(req.userId!);
    const created = await prisma.carbEvent.create({
      data: {
        ...(id ? { id } : {}),
        patientId,
        carbsGrams: grams!,
        description: description!,
        eventAt: new Date(timeMs!),
      },
    });
    await recordAudit({
      userId: req.userId,
      entity: 'CarbEvent',
      action: 'CREATE',
      entityId: created.id,
      ...auditRequestContext(req),
    });
    res.status(201).json({ id: created.id });
  }),
);

// PUT /carbs/item/:id — atualiza uma entrada do próprio paciente (404 se não existir).
// curl -X PUT http://localhost:3001/carbs/item/$ID \
//   -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
//   -d '{"grams":60,"description":"jantar","timeMs":1751803600000}'
router.put(
  '/item/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    if (!isUuid(id)) {
      res.status(400).json({ error: 'id must be a UUID' });
      return;
    }
    const { grams, description, timeMs } = req.body as {
      grams?: number;
      description?: string;
      timeMs?: number;
    };
    const error = validateCarbBody(req.body);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const patientId = await ensurePatient(req.userId!);
    const result = await prisma.carbEvent.updateMany({
      where: { id, patientId },
      data: {
        carbsGrams: grams!,
        description: description!,
        eventAt: new Date(timeMs!),
      },
    });
    if (result.count === 0) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    await recordAudit({
      userId: req.userId,
      entity: 'CarbEvent',
      action: 'UPDATE',
      entityId: id,
      ...auditRequestContext(req),
    });
    res.status(204).send();
  }),
);

// DELETE /carbs/item/:id — remove uma entrada do próprio paciente (404 se não existir).
// curl -X DELETE http://localhost:3001/carbs/item/$ID -H "Authorization: Bearer $TOKEN"
router.delete(
  '/item/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    if (!isUuid(id)) {
      res.status(400).json({ error: 'id must be a UUID' });
      return;
    }
    const patientId = await ensurePatient(req.userId!);
    const result = await prisma.carbEvent.deleteMany({
      where: { id, patientId },
    });
    if (result.count === 0) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    await recordAudit({
      userId: req.userId,
      entity: 'CarbEvent',
      action: 'DELETE',
      entityId: id,
      ...auditRequestContext(req),
    });
    res.status(204).send();
  }),
);

// Deprecated: replace-all em lote — usar POST /carbs/item, PUT/DELETE /carbs/item/:id.
// Mantido para compatibilidade; ids enviados pelo cliente são preservados.
router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { carbs } = req.body as {
      carbs?: Array<{ id?: string; grams: number; description: string; timeMs: number }>;
    };
    if (!Array.isArray(carbs)) {
      res.status(400).json({ error: 'carbs must be array' });
      return;
    }
    const patientId = await ensurePatient(req.userId!);
    await prisma.carbEvent.deleteMany({ where: { patientId } });
    await prisma.carbEvent.createMany({
      data: carbs.slice(0, 100).map(c => ({
        ...(isUuid(c.id) ? { id: c.id } : {}),
        patientId,
        carbsGrams: c.grams,
        description: c.description,
        eventAt: new Date(c.timeMs),
      })),
    });
    await recordAudit({
      userId: req.userId,
      entity: 'CarbEvent',
      action: 'REPLACE',
      entityId: patientId,
      metadata: { count: carbs.length },
      ...auditRequestContext(req),
    });
    res.status(204).send();
  }),
);

export default router;

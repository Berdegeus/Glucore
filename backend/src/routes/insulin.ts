import { Router, Response } from 'express';
import { verifyJwt, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../lib/prisma';
import { ensurePatient } from '../lib/patient';

const router = Router();

router.use(verifyJwt);
router.use(requireRole('PATIENT'));

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_RE.test(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

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

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const patientId = await ensurePatient(req.userId!);
    const rows = await prisma.insulinEvent.findMany({
      where: { patientId },
      orderBy: { eventAt: 'desc' },
      take: 100,
    });
    res.json(
      rows.map(i => ({
        id: i.id,
        units: Number(i.doseUnits),
        type: i.insulinType,
        timeMs: i.eventAt.getTime(),
        dayOfWeek: i.dayOfWeek,
      })),
    );
  }),
);

// POST /insulin/item — cria uma entrada. Aceita id (UUID) gerado pelo cliente.
// curl -X POST http://localhost:3001/insulin/item \
//   -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
//   -d '{"id":"a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d","units":6,"type":"bolus","timeMs":1751800000000,"dayOfWeek":"MONDAY"}'
router.post(
  '/item',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id, units, type, timeMs, dayOfWeek } = req.body as {
      id?: string;
      units?: number;
      type?: string;
      timeMs?: number;
      dayOfWeek?: string;
    };
    const error = validateInsulinBody(req.body);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    if (id !== undefined && !isUuid(id)) {
      res.status(400).json({ error: 'id must be a UUID' });
      return;
    }
    const patientId = await ensurePatient(req.userId!);
    const created = await prisma.insulinEvent.create({
      data: {
        ...(id ? { id } : {}),
        patientId,
        doseUnits: units!,
        insulinType: type!,
        eventAt: new Date(timeMs!),
        dayOfWeek: dayOfWeek ?? '',
      },
    });
    res.status(201).json({ id: created.id });
  }),
);

// PUT /insulin/item/:id — atualiza uma entrada do próprio paciente (404 se não existir).
// curl -X PUT http://localhost:3001/insulin/item/$ID \
//   -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
//   -d '{"units":8,"type":"basal","timeMs":1751803600000,"dayOfWeek":"TUESDAY"}'
router.put(
  '/item/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    if (!isUuid(id)) {
      res.status(400).json({ error: 'id must be a UUID' });
      return;
    }
    const { units, type, timeMs, dayOfWeek } = req.body as {
      units?: number;
      type?: string;
      timeMs?: number;
      dayOfWeek?: string;
    };
    const error = validateInsulinBody(req.body);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const patientId = await ensurePatient(req.userId!);
    const result = await prisma.insulinEvent.updateMany({
      where: { id, patientId },
      data: {
        doseUnits: units!,
        insulinType: type!,
        eventAt: new Date(timeMs!),
        dayOfWeek: dayOfWeek ?? '',
      },
    });
    if (result.count === 0) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.status(204).send();
  }),
);

// DELETE /insulin/item/:id — remove uma entrada do próprio paciente (404 se não existir).
// curl -X DELETE http://localhost:3001/insulin/item/$ID -H "Authorization: Bearer $TOKEN"
router.delete(
  '/item/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    if (!isUuid(id)) {
      res.status(400).json({ error: 'id must be a UUID' });
      return;
    }
    const patientId = await ensurePatient(req.userId!);
    const result = await prisma.insulinEvent.deleteMany({
      where: { id, patientId },
    });
    if (result.count === 0) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.status(204).send();
  }),
);

// Deprecated: replace-all em lote — usar POST /insulin/item, PUT/DELETE /insulin/item/:id.
// Mantido para compatibilidade; ids enviados pelo cliente são preservados.
router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { insulin } = req.body as {
      insulin?: Array<{
        id?: string;
        units: number;
        type: string;
        timeMs: number;
        dayOfWeek?: string;
      }>;
    };
    if (!Array.isArray(insulin)) {
      res.status(400).json({ error: 'insulin must be array' });
      return;
    }
    const patientId = await ensurePatient(req.userId!);
    await prisma.insulinEvent.deleteMany({ where: { patientId } });
    await prisma.insulinEvent.createMany({
      data: insulin.slice(0, 100).map(i => ({
        ...(isUuid(i.id) ? { id: i.id } : {}),
        patientId,
        doseUnits: i.units,
        insulinType: i.type,
        eventAt: new Date(i.timeMs),
        dayOfWeek: i.dayOfWeek ?? '',
      })),
    });
    res.status(204).send();
  }),
);

export default router;

import { Router, Response } from 'express';
import { verifyJwt, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../lib/prisma';
import { ensurePatient } from '../lib/patient';

const router = Router();

router.use(verifyJwt);

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
        units: Number(i.doseUnits),
        type: i.insulinType,
        timeMs: i.eventAt.getTime(),
      })),
    );
  }),
);

router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { insulin } = req.body as {
      insulin?: Array<{ units: number; type: string; timeMs: number }>;
    };
    if (!Array.isArray(insulin)) {
      res.status(400).json({ error: 'insulin must be array' });
      return;
    }
    const patientId = await ensurePatient(req.userId!);
    await prisma.insulinEvent.deleteMany({ where: { patientId } });
    await prisma.insulinEvent.createMany({
      data: insulin.slice(0, 100).map(i => ({
        patientId,
        doseUnits: i.units,
        insulinType: i.type,
        eventAt: new Date(i.timeMs),
      })),
    });
    res.status(204).send();
  }),
);

export default router;

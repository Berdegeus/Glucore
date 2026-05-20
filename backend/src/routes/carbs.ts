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
    const rows = await prisma.carbEvent.findMany({
      where: { patientId },
      orderBy: { eventAt: 'desc' },
      take: 100,
    });
    res.json(
      rows.map(c => ({
        grams: Number(c.carbsGrams),
        description: c.description,
        timeMs: c.eventAt.getTime(),
      })),
    );
  }),
);

router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { carbs } = req.body as {
      carbs?: Array<{ grams: number; description: string; timeMs: number }>;
    };
    if (!Array.isArray(carbs)) {
      res.status(400).json({ error: 'carbs must be array' });
      return;
    }
    const patientId = await ensurePatient(req.userId!);
    await prisma.carbEvent.deleteMany({ where: { patientId } });
    await prisma.carbEvent.createMany({
      data: carbs.slice(0, 100).map(c => ({
        patientId,
        carbsGrams: c.grams,
        description: c.description,
        eventAt: new Date(c.timeMs),
      })),
    });
    res.status(204).send();
  }),
);

export default router;

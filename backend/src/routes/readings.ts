import { Router, Response } from 'express';
import { verifyJwt, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../lib/prisma';
import { ensurePatient } from '../lib/patient';

const router = Router();

router.use(verifyJwt);
router.use(requireRole('PATIENT'));

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const patientId = await ensurePatient(req.userId!);
    const rows = await prisma.glucoseReading.findMany({
      where: { patientId },
      orderBy: { recordedAt: 'desc' },
      take: 288,
    });
    res.json(
      rows.map(r => ({
        value: r.valueMgDl,
        timestampMs: r.recordedAt.getTime(),
        trend: r.trend,
        rate: r.trendRate,
        alarmCode: r.alarmCode,
      })),
    );
  }),
);

router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { readings } = req.body as {
      readings?: Array<{
        value: number;
        timestampMs: number;
        trend: string;
        rate: number;
        alarmCode?: number;
      }>;
    };
    if (!Array.isArray(readings)) {
      res.status(400).json({ error: 'readings must be array' });
      return;
    }
    const patientId = await ensurePatient(req.userId!);
    await prisma.$transaction(
      readings.slice(0, 288).map(r => {
        const recordedAt = new Date(r.timestampMs);
        return prisma.glucoseReading.upsert({
          where: {
            patientId_recordedAt: { patientId, recordedAt },
          },
          update: {
            valueMgDl: Math.round(r.value),
            trend: r.trend,
            trendRate: r.rate,
            alarmCode: r.alarmCode,
          },
          create: {
            patientId,
            valueMgDl: Math.round(r.value),
            recordedAt,
            trend: r.trend,
            trendRate: r.rate ?? 0,
            alarmCode: r.alarmCode,
          },
        });
      }),
    );
    res.status(204).send();
  }),
);

router.delete(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const patientId = await ensurePatient(req.userId!);
    await prisma.glucoseReading.deleteMany({ where: { patientId } });
    res.status(204).send();
  }),
);

export default router;

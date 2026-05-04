import { Router, Response } from 'express';
import { verifyJwt, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../lib/prisma';

const router = Router();

router.use(verifyJwt);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const rows = await prisma.glucoseReading.findMany({
      where: { userId: req.userId! },
      orderBy: { timestampMs: 'desc' },
      take: 288,
    });
    res.json(
      rows.map(r => ({
        value: r.value,
        timestampMs: Number(r.timestampMs),
        trend: r.trend,
        rate: r.rate,
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
    await prisma.$transaction(
      readings.slice(0, 288).map(r =>
        prisma.glucoseReading.upsert({
          where: {
            userId_timestampMs: { userId: req.userId!, timestampMs: BigInt(r.timestampMs) },
          },
          update: { value: r.value, trend: r.trend, rate: r.rate, alarmCode: r.alarmCode },
          create: {
            userId: req.userId!,
            value: r.value,
            timestampMs: BigInt(r.timestampMs),
            trend: r.trend,
            rate: r.rate ?? 0,
            alarmCode: r.alarmCode,
          },
        }),
      ),
    );
    res.status(204).send();
  }),
);

router.delete(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await prisma.glucoseReading.deleteMany({ where: { userId: req.userId! } });
    res.status(204).send();
  }),
);

export default router;

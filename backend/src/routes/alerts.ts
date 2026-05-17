import { Router, Response } from 'express';
import { verifyJwt, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../lib/prisma';

const router = Router();

router.use(verifyJwt);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const rows = await prisma.alert.findMany({
      where: { userId: req.userId! },
      orderBy: { timestampMs: 'desc' },
      take: 100,
    });
    res.json(rows.map(a => ({ type: a.type, timestampMs: Number(a.timestampMs) })));
  }),
);

router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { alerts } = req.body as {
      alerts?: Array<{ type: string; timestampMs: number }>;
    };
    if (!Array.isArray(alerts)) {
      res.status(400).json({ error: 'alerts must be array' });
      return;
    }
    await prisma.alert.deleteMany({ where: { userId: req.userId! } });
    await prisma.alert.createMany({
      data: alerts.slice(0, 100).map(a => ({
        userId: req.userId!,
        type: a.type,
        timestampMs: BigInt(a.timestampMs),
      })),
    });
    res.status(204).send();
  }),
);

export default router;

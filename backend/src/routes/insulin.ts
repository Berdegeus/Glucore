import { Router, Response } from 'express';
import { verifyJwt, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../lib/prisma';

const router = Router();

router.use(verifyJwt);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const rows = await prisma.insulinEntry.findMany({
      where: { userId: req.userId! },
      orderBy: { timeMs: 'desc' },
      take: 100,
    });
    res.json(rows.map(i => ({ units: i.units, type: i.type, timeMs: Number(i.timeMs) })));
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
    await prisma.insulinEntry.deleteMany({ where: { userId: req.userId! } });
    await prisma.insulinEntry.createMany({
      data: insulin.slice(0, 100).map(i => ({
        userId: req.userId!,
        units: i.units,
        type: i.type,
        timeMs: BigInt(i.timeMs),
      })),
    });
    res.status(204).send();
  }),
);

export default router;

import { Router, Response } from 'express';
import { verifyJwt, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../lib/prisma';

const router = Router();

router.use(verifyJwt);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const rows = await prisma.carbEntry.findMany({
      where: { userId: req.userId! },
      orderBy: { timeMs: 'desc' },
      take: 100,
    });
    res.json(
      rows.map(c => ({ grams: c.grams, description: c.description, timeMs: Number(c.timeMs) })),
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
    await prisma.carbEntry.deleteMany({ where: { userId: req.userId! } });
    await prisma.carbEntry.createMany({
      data: carbs.slice(0, 100).map(c => ({
        userId: req.userId!,
        grams: c.grams,
        description: c.description,
        timeMs: BigInt(c.timeMs),
      })),
    });
    res.status(204).send();
  }),
);

export default router;

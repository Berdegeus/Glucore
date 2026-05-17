import { Router, Response } from 'express';
import { verifyJwt, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../lib/prisma';

const router = Router();

router.use(verifyJwt);

router.get(
  '/alerts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const settings = await prisma.alertSettings.findUnique({ where: { userId: req.userId! } });
    res.json(settings ?? { lowThreshold: 80, highThreshold: 180 });
  }),
);

router.put(
  '/alerts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { lowThreshold, highThreshold } = req.body as {
      lowThreshold: number;
      highThreshold: number;
    };
    await prisma.alertSettings.upsert({
      where: { userId: req.userId! },
      update: { lowThreshold, highThreshold },
      create: { userId: req.userId!, lowThreshold, highThreshold },
    });
    res.status(204).send();
  }),
);

export default router;

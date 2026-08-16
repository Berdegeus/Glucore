import { Router, Response } from 'express';
import { verifyJwt, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../lib/prisma';
import { ensurePatient } from '../lib/patient';
import { auditRequestContext, recordAudit } from '../lib/audit';

const router = Router();

router.use(verifyJwt);
router.use(requireRole('PATIENT'));

router.get(
  '/alerts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const patientId = await ensurePatient(req.userId!);
    const settings = await prisma.alertThresholdConfig.findUnique({ where: { patientId } });
    res.json(
      settings
        ? {
            lowThreshold: settings.lowGlucoseMgDl,
            highThreshold: settings.highGlucoseMgDl,
          }
        : { lowThreshold: 80, highThreshold: 180 },
    );
  }),
);

router.put(
  '/alerts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { lowThreshold, highThreshold } = req.body as {
      lowThreshold: number;
      highThreshold: number;
    };
    const patientId = await ensurePatient(req.userId!);
    await prisma.alertThresholdConfig.upsert({
      where: { patientId },
      update: {
        lowGlucoseMgDl: lowThreshold,
        highGlucoseMgDl: highThreshold,
      },
      create: {
        patientId,
        lowGlucoseMgDl: lowThreshold,
        highGlucoseMgDl: highThreshold,
      },
    });
    await recordAudit({
      userId: req.userId,
      entity: 'AlertThresholdConfig',
      action: 'UPDATE',
      entityId: patientId,
      ...auditRequestContext(req),
    });
    res.status(204).send();
  }),
);

export default router;

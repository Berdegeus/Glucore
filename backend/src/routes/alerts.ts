import { Router, Response } from 'express';
import { AlertType } from '@prisma/client';
import { verifyJwt, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../lib/prisma';
import { ensurePatient } from '../lib/patient';
import { auditRequestContext, recordAudit } from '../lib/audit';

const router = Router();

router.use(verifyJwt);
router.use(requireRole('PATIENT'));

function toDbAlertType(type: string): AlertType {
  switch (type) {
    case 'glucoseLow':
    case 'HYPO_RISK':
      return AlertType.HYPO_RISK;
    case 'glucoseHigh':
    case 'HYPER_RISK':
      return AlertType.HYPER_RISK;
    case 'sensorReconnected':
    case 'SENSOR_RECONNECTED':
      return AlertType.SENSOR_RECONNECTED;
    case 'syncFailure':
    case 'SYNC_FAILURE':
      return AlertType.SYNC_FAILURE;
    case 'FAST_DROP':
      return AlertType.FAST_DROP;
    case 'FAST_RISE':
      return AlertType.FAST_RISE;
    default:
      return AlertType.SYNC_FAILURE;
  }
}

function toAppAlertType(type: AlertType): string {
  switch (type) {
    case AlertType.HYPO_RISK:
      return 'glucoseLow';
    case AlertType.HYPER_RISK:
      return 'glucoseHigh';
    case AlertType.SENSOR_RECONNECTED:
      return 'sensorReconnected';
    case AlertType.FAST_DROP:
    case AlertType.FAST_RISE:
    case AlertType.SYNC_FAILURE:
      return 'syncFailure';
  }
}

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const patientId = await ensurePatient(req.userId!);
    const rows = await prisma.alertEvent.findMany({
      where: { patientId },
      orderBy: { triggeredAt: 'desc' },
      take: 100,
    });
    res.json(rows.map(a => ({ type: toAppAlertType(a.alertType), timestampMs: a.triggeredAt.getTime() })));
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
    const patientId = await ensurePatient(req.userId!);
    await prisma.alertEvent.deleteMany({ where: { patientId } });
    await prisma.alertEvent.createMany({
      data: alerts.slice(0, 100).map(a => ({
        patientId,
        alertType: toDbAlertType(a.type),
        triggeredAt: new Date(a.timestampMs),
      })),
    });
    await recordAudit({
      userId: req.userId,
      entity: 'AlertEvent',
      action: 'REPLACE',
      entityId: patientId,
      metadata: { count: alerts.length },
      ...auditRequestContext(req),
    });
    res.status(204).send();
  }),
);

export default router;

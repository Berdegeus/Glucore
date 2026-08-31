import { describe, expect, it } from 'vitest';
import { AlertType } from '@prisma/client';

import { toAppAlertType, toDbAlertType } from '../../src/modules/alerts/alerts.mapper';
import { AlertsService } from '../../src/modules/alerts/alerts.service';
import {
  alertRow,
  FakeAlertRepository,
  FakePatientRepository,
  RecordedAudit,
} from '../helpers/fakes';

const USER = 'user-1';
const CONTEXT = { ipAddress: null, userAgent: null };

function build() {
  const alerts = new FakeAlertRepository();
  const patients = new FakePatientRepository();
  const audit = new RecordedAudit();
  return { alerts, audit, service: new AlertsService(alerts, patients, audit.record) };
}

describe('alert type adapter', () => {
  it.each([
    ['glucoseLow', AlertType.HYPO_RISK],
    ['HYPO_RISK', AlertType.HYPO_RISK],
    ['glucoseHigh', AlertType.HYPER_RISK],
    ['HYPER_RISK', AlertType.HYPER_RISK],
    ['sensorReconnected', AlertType.SENSOR_RECONNECTED],
    ['syncFailure', AlertType.SYNC_FAILURE],
    ['FAST_DROP', AlertType.FAST_DROP],
    ['FAST_RISE', AlertType.FAST_RISE],
  ])('stores %s as %s', (appName, stored) => {
    expect(toDbAlertType(appName)).toBe(stored);
  });

  it('falls back to SYNC_FAILURE for a name it does not know', () => {
    // A device on an older build must not lose its whole alert batch over one
    // unrecognised name.
    expect(toDbAlertType('somethingNew')).toBe(AlertType.SYNC_FAILURE);
  });

  it.each([
    [AlertType.HYPO_RISK, 'glucoseLow'],
    [AlertType.HYPER_RISK, 'glucoseHigh'],
    [AlertType.SENSOR_RECONNECTED, 'sensorReconnected'],
    [AlertType.SYNC_FAILURE, 'syncFailure'],
  ])('reads %s back as %s', (stored, appName) => {
    expect(toAppAlertType(stored)).toBe(appName);
  });

  it.each([AlertType.FAST_DROP, AlertType.FAST_RISE])(
    'does not round-trip %s — it has no app-side name',
    (stored) => {
      expect(toAppAlertType(stored)).toBe('syncFailure');
      expect(toDbAlertType(toAppAlertType(stored))).toBe(AlertType.SYNC_FAILURE);
    },
  );
});

describe('AlertsService', () => {
  it('maps rows through the adapter on the way out', async () => {
    const { alerts, service } = build();
    const triggeredAt = new Date('2026-08-25T09:00:00.000Z');
    alerts.rows = [alertRow(USER, AlertType.HYPO_RISK, triggeredAt)];
    expect(await service.listForUser(USER)).toEqual([
      { type: 'glucoseLow', timestampMs: triggeredAt.getTime() },
    ]);
  });

  it('truncates a replace-all but audits the count that was sent', async () => {
    const { alerts, audit, service } = build();
    await service.replaceAllForUser(
      USER,
      Array.from({ length: 150 }, () => ({ type: 'glucoseLow', timestampMs: 1 })),
      CONTEXT,
    );
    expect(alerts.lastReplace).toHaveLength(100);
    expect(audit.entries[0].metadata).toEqual({ count: 150 });
  });
});

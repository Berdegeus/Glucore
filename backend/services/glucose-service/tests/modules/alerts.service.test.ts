import { describe, expect, it } from 'vitest';
import { AlertType } from '@prisma/client';
import { NotFoundError } from '@glucore/shared';

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
  it('maps rows through the adapter on the way out, id included', async () => {
    const { alerts, service } = build();
    const triggeredAt = new Date('2026-08-25T09:00:00.000Z');
    const row = alertRow(USER, AlertType.HYPO_RISK, triggeredAt);
    alerts.rows = [row];
    expect(await service.listForUser(USER)).toEqual([
      { id: row.id, type: 'glucoseLow', timestampMs: triggeredAt.getTime() },
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

  it('drops an id that is not a UUID instead of rejecting the batch', async () => {
    const { alerts, service } = build();
    await service.replaceAllForUser(
      USER,
      [{ id: 'not-a-uuid', type: 'glucoseLow', timestampMs: 1 }],
      CONTEXT,
    );
    expect(alerts.lastReplace[0].id).toBeUndefined();
  });

  it('creates an entry, converting the app type and keeping a client-minted id', async () => {
    const { alerts, service } = build();
    const id = '11111111-1111-4111-8111-111111111111';
    const created = await service.createForUser(
      USER,
      { id, type: 'glucoseLow', timestampMs: 1000 },
      CONTEXT,
    );
    expect(created).toBe(id);
    expect(alerts.rows[0]).toMatchObject({ id, alertType: AlertType.HYPO_RISK });
  });

  it('records a CREATE audit entry keyed by the new id', async () => {
    const { audit, service } = build();
    const created = await service.createForUser(
      USER,
      { type: 'glucoseLow', timestampMs: 1000 },
      CONTEXT,
    );
    expect(audit.entries).toEqual([
      expect.objectContaining({ entity: 'AlertEvent', action: 'CREATE', entityId: created }),
    ]);
  });

  it('answers 404 when the entry belongs to someone else', async () => {
    const { alerts, service } = build();
    alerts.affected = 0;
    await expect(
      service.updateForUser(USER, 'other', { type: 'glucoseLow', timestampMs: 1 }, CONTEXT),
    ).rejects.toThrow(NotFoundError);
    await expect(service.deleteForUser(USER, 'other', CONTEXT)).rejects.toThrow('not found');
  });

  it('does not record an audit entry for a write that touched nothing', async () => {
    const { alerts, audit, service } = build();
    alerts.affected = 0;
    await service.deleteForUser(USER, 'other', CONTEXT).catch(() => undefined);
    expect(audit.entries).toEqual([]);
  });
});

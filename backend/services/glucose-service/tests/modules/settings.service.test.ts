import { describe, expect, it } from 'vitest';

import { SettingsService } from '../../src/modules/settings/settings.service';
import { FakePatientRepository, FakeSettingsRepository, RecordedAudit } from '../helpers/fakes';

const USER = 'user-1';
const CONTEXT = { ipAddress: null, userAgent: null };

function build() {
  const settings = new FakeSettingsRepository();
  const patients = new FakePatientRepository();
  const audit = new RecordedAudit();
  return { settings, audit, service: new SettingsService(settings, patients, audit.record) };
}

describe('SettingsService', () => {
  it('answers the default range before anything has been saved', async () => {
    const { service } = build();
    expect(await service.getForUser(USER)).toEqual({ lowThreshold: 80, highThreshold: 180 });
  });

  it('answers the stored range once there is one', async () => {
    const { settings, service } = build();
    settings.stored = { lowGlucoseMgDl: 70, highGlucoseMgDl: 200 };
    expect(await service.getForUser(USER)).toEqual({ lowThreshold: 70, highThreshold: 200 });
  });

  it('rejects an inverted range (phase 6: the dashboard cannot compute TIR against one)', async () => {
    const { settings, service } = build();
    await expect(
      service.updateForUser(USER, { lowThreshold: 200, highThreshold: 70 }, CONTEXT),
    ).rejects.toThrow('lowThreshold must be less than highThreshold');
    expect(settings.lastUpsert).toBeNull();
  });

  it('rejects an equal low/high', async () => {
    const { settings, service } = build();
    await expect(
      service.updateForUser(USER, { lowThreshold: 100, highThreshold: 100 }, CONTEXT),
    ).rejects.toThrow('lowThreshold must be less than highThreshold');
    expect(settings.lastUpsert).toBeNull();
  });

  it('records an audit entry on update', async () => {
    const { audit, service } = build();
    await service.updateForUser(USER, { lowThreshold: 80, highThreshold: 180 }, CONTEXT);
    expect(audit.entries).toEqual([
      {
        userId: USER,
        entity: 'AlertThresholdConfig',
        action: 'UPDATE',
        entityId: USER,
        ipAddress: null,
        userAgent: null,
      },
    ]);
  });
});

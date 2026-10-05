import { ForbiddenError } from '@glucore/shared';
import { describe, expect, it } from 'vitest';

import { GrantPolicy } from '../../src/modules/sharing/grantPolicy';
import type { GrantSource } from '../../src/modules/sharing/sharing.repository';
import { FakeSharingRepository, nextId } from '../helpers/fakes';

/** CON-09 and PRO-12: no active grant, no read. */

const NOW = new Date('2026-10-05T12:00:00.000Z');
const PATIENT = nextId();
const PROFESSIONAL = nextId();

const grant = (overrides: Partial<GrantSource> = {}): GrantSource => ({
  id: nextId(),
  patientId: PATIENT,
  healthProfessionalId: PROFESSIONAL,
  grantedAt: new Date('2026-10-01T12:00:00.000Z'),
  expiresAt: null,
  revokedAt: null,
  ...overrides,
});

function build(grants: GrantSource[], now: Date = NOW) {
  const sharing = new FakeSharingRepository();
  sharing.grants = grants;
  return new GrantPolicy(sharing, () => now);
}

const refusal = (policy: GrantPolicy, professionalId = PROFESSIONAL, patientId = PATIENT) =>
  policy.assertActive(professionalId, patientId).catch((error: unknown) => error);

describe('GrantPolicy.assertActive', () => {
  it('passes for an open grant', async () => {
    await expect(build([grant()]).assertActive(PROFESSIONAL, PATIENT)).resolves.toBeUndefined();
  });

  it('refuses a revoked grant with 403 NO_ACTIVE_GRANT', async () => {
    const failure = await refusal(build([grant({ revokedAt: new Date('2026-10-04T12:00:00.000Z') })]));

    expect(failure).toBeInstanceOf(ForbiddenError);
    expect(failure).toMatchObject({ status: 403, code: 'NO_ACTIVE_GRANT', message: 'No active grant' });
  });

  it('refuses an expired grant', async () => {
    const failure = await refusal(build([grant({ expiresAt: new Date(NOW.getTime() - 1) })]));

    expect(failure).toMatchObject({ status: 403, code: 'NO_ACTIVE_GRANT' });
  });

  it('refuses a grant that expires exactly now, and passes one expiring 1 ms later', async () => {
    const atNow = await refusal(build([grant({ expiresAt: NOW })]));
    const justAfter = build([grant({ expiresAt: new Date(NOW.getTime() + 1) })]);

    expect(atNow).toMatchObject({ status: 403, code: 'NO_ACTIVE_GRANT' });
    await expect(justAfter.assertActive(PROFESSIONAL, PATIENT)).resolves.toBeUndefined();
  });

  it('judges expiry by the clock at the moment of the call', async () => {
    const expiresAt = new Date('2026-10-05T12:00:00.000Z');
    const grants = [grant({ expiresAt })];

    await expect(build(grants, new Date(expiresAt.getTime() - 1)).assertActive(PROFESSIONAL, PATIENT)).resolves.toBe(
      undefined,
    );
    expect(await refusal(build(grants, expiresAt))).toMatchObject({ code: 'NO_ACTIVE_GRANT' });
  });

  it('refuses when the professional has no grant at all', async () => {
    expect(await refusal(build([]))).toMatchObject({ status: 403, code: 'NO_ACTIVE_GRANT' });
  });

  it('refuses another patient or another professional than the one granted', async () => {
    const policy = build([grant()]);

    expect(await refusal(policy, PROFESSIONAL, nextId())).toMatchObject({ code: 'NO_ACTIVE_GRANT' });
    expect(await refusal(policy, nextId(), PATIENT)).toMatchObject({ code: 'NO_ACTIVE_GRANT' });
  });
});

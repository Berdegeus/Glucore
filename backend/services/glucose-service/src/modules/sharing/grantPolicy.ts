import { ForbiddenError } from '@glucore/shared';

import type { ISharingRepository } from './sharing.repository';

/**
 * The one rule every professional-side read goes through: no active grant, no
 * data (CON-09, PRO-12). Revoked, expired and never-granted are the same answer,
 * so the caller cannot tell a patient that exists from one that does not.
 *
 * Checked against the database on every call, with no cache, which is what makes
 * a revocation take effect on the very next request.
 */
export class GrantPolicy {
  constructor(
    private readonly sharing: Pick<ISharingRepository, 'isGrantActive'>,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async assertActive(professionalId: string, patientId: string): Promise<void> {
    if (!(await this.sharing.isGrantActive(professionalId, patientId, this.clock()))) {
      throw new ForbiddenError('No active grant', 'NO_ACTIVE_GRANT');
    }
  }
}

import type { AdminRepository, PlatformStats } from './admin.repository';

/**
 * What an administrator sees of the clinical database: platform counts, never a
 * person. Reading them is not audited per call (the trail would be one row per
 * dashboard refresh and carry no subject); the account list is, in auth-service.
 */
export class AdminService {
  constructor(
    private readonly admin: AdminRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Counts over the last `days` UTC days (ADM-01, ADM-02, ADM-03). */
  stats(days: number): Promise<PlatformStats> {
    return this.admin.platformStats(days, this.now());
  }
}

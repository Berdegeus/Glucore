import { createRepository, type HttpGateway, type RepositoryHttp } from '../../../shared/infrastructure/http/createRepository';
import type { RedeemRepository, RedeemResult } from '../domain/cohort';
import { RedeemDtoSchema } from './schemas';

/**
 * `POST /sharing/redeem` (CON-04). `201` is a new link and `200` a patient the
 * professional already had; both answer `{ patientId, grantId }` and both are a
 * link here. `400 INVALID_INVITE` (the same for an unknown, expired, used or
 * invalidated code, CON-05) is a `validation` error that carries the code, `429`
 * is `rate-limited` (CON-06) and `403` means the account is not a professional's.
 */
export class HttpRedeemRepository implements RedeemRepository {
  private readonly api: RepositoryHttp;

  constructor(http: HttpGateway) {
    this.api = createRepository(http);
  }

  async redeem(code: string): Promise<RedeemResult> {
    // The code is a secret the patient shares: the repository sends it and never keeps it in a message or a label.
    const { patientId, grantId } = await this.api.fetchDto(
      { method: 'POST', path: '/sharing/redeem', body: { code } },
      RedeemDtoSchema,
    );
    return { patientId, grantId };
  }
}

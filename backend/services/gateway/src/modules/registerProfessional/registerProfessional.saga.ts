import type { AuthClient, RegisterAccountResult } from '../../clients/authClient';
import type { GlucoseClient } from '../../clients/glucoseClient';

export interface RegisterProfessionalSagaInput {
  account: Record<string, unknown>;
  profile: Record<string, unknown>;
}

/**
 * The professional twin of `RegisterSaga`: account in auth-service first, then
 * the professional profile in glucose-service, compensating by deleting the
 * account when the profile leg fails. Same failure accounting (see
 * `register.saga.ts` FM1-FM4); a failed compensation is logged as
 * `saga.compensation_failed` and the ORIGINAL error is what propagates.
 */
export class RegisterProfessionalSaga {
  constructor(
    private readonly authClient: AuthClient,
    private readonly glucoseClient: GlucoseClient,
  ) {}

  async run(input: RegisterProfessionalSagaInput): Promise<RegisterAccountResult> {
    const account = await this.authClient.registerProfessional({
      email: input.account.email as string,
      password: input.account.password as string,
      fullName: input.account.fullName as string,
      phone: input.account.phone as string | undefined,
    });

    try {
      await this.glucoseClient.createProfessional(account.userId, input.profile);
    } catch (error) {
      try {
        await this.authClient.deleteAccount(account.userId);
      } catch (compensationError) {
        console.error(
          `saga.compensation_failed userId=${account.userId} original=${String(error)} ` +
            `compensation=${String(compensationError)}`,
        );
      }
      throw error;
    }

    return account;
  }
}

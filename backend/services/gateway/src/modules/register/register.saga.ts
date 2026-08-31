import type { AuthClient, RegisterAccountResult } from '../../clients/authClient';
import type { GlucoseClient } from '../../clients/glucoseClient';
import type { RegisterSagaInput } from './register.schema';

/**
 * Saga with compensation, not 2PC — impossible here anyway, since the two
 * legs are two separate `PrismaClient`s in two separate databases.
 *
 * Failure modes, matching the master plan's own accounting:
 *   FM1 auth OK, glucose fails, compensation OK  -> throws, nothing persisted, retry-safe
 *   FM2 compensation ALSO fails                  -> logged as `saga.compensation_failed`,
 *                                                    accepted rather than closed (needs a
 *                                                    transactional outbox to close for real)
 *   FM3 gateway dies before responding           -> client retries, gets 409 EMAIL_TAKEN
 *   FM4 email already taken                      -> 409 before any write reaches glucose
 */
export class RegisterSaga {
  constructor(
    private readonly authClient: AuthClient,
    private readonly glucoseClient: GlucoseClient,
  ) {}

  async run(input: RegisterSagaInput): Promise<RegisterAccountResult> {
    const account = await this.authClient.register({
      email: input.account.email as string,
      password: input.account.password as string,
      fullName: input.account.fullName as string,
      phone: input.account.phone as string | undefined,
    });

    try {
      await this.glucoseClient.createPatient(account.userId, 'PATIENT', input.patient);
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

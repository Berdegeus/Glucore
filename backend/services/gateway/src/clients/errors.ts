/** The downstream never answered — connection refused, timeout, DNS failure. */
export class UpstreamUnavailableError extends Error {}

/**
 * The downstream answered with a non-2xx status. Carries its status/code
 * through unchanged where the body already had them (e.g. auth-service's
 * 409 EMAIL_TAKEN), so the client sees the same contract it would get
 * calling that service directly.
 */
export class UpstreamHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

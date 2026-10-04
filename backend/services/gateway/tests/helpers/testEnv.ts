/**
 * No database here, so no `.env.test` to load — just the fixed secrets the
 * suite signs and verifies tokens with. Same literals the other two
 * services' suites use, so a token minted in one test can verify in another.
 */
export const TEST_JWT_SECRET = 'test-secret-for-integration-tests';
export const TEST_INTERNAL_JWT_SECRET = 'test-internal-secret-for-integration-tests';

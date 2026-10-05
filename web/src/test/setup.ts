import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';
import { server } from './server';

expect.extend(axeMatchers);

// findBy*/waitFor give up after 1 s by default, which a loaded machine (full
// coverage run, parallel workers) can miss while a page is still rendering.
// 5 s absorbs that without hiding a real hang: it stays well under the 15 s
// `testTimeout` of the `dom` project, so a genuinely missing element still
// fails with the Testing Library message rather than a bare test timeout.
configure({ asyncUtilTimeout: 5_000 });

// A request with no handler fails the test instead of reaching the network.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

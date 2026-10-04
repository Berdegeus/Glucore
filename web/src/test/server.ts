import { setupServer } from 'msw/node';

/** Shared MSW server. Tests add their handlers with `server.use(...)`. */
export const server = setupServer();

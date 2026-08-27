/**
 * This service's Prisma client, and the single place that knows where it was
 * generated.
 *
 * The client lives in `services/auth-service/generated/prisma` instead of the
 * workspace-wide `node_modules/.prisma/client`, because that directory is shared
 * and both services generate into it on install — see the note in
 * prisma/schema.prisma. Re-exporting `Prisma` and the model types from here
 * keeps that path in one file: nothing else in the service refers to it.
 */
export { Prisma, PrismaClient } from '../../generated/prisma';

import { PrismaClient } from '../../generated/prisma';

export const prisma = new PrismaClient();

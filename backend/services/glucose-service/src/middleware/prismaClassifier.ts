/**
 * Turns a Prisma failure into the `{ error, code }` contract the app reads.
 *
 * This link of the chain lives in the service rather than in `@glucore/shared`
 * because it is the only part that needs `@prisma/client`: the gateway consumes
 * the same shared handler and has no database, and once the split lands each
 * service generates its own client.
 *
 * See design.md "Contratos de erro (backend -> app)".
 */

import { Prisma } from '@prisma/client';
import type { ErrorClassifier, ErrorContract } from '@glucore/shared';

const UNCLASSIFIED: ErrorContract = {
  status: 500,
  code: 'INTERNAL',
  error: 'Internal server error',
};

const DATABASE_UNAVAILABLE = {
  status: 503,
  code: 'DATABASE_UNAVAILABLE',
  error: 'Database unavailable',
} as const;

export const prismaClassifier: ErrorClassifier = (error) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return {
          status: 409,
          code: 'DUPLICATE_RECORD',
          error: 'Duplicate record',
          prismaCode: error.code,
        };
      case 'P2003':
        return {
          status: 409,
          code: 'RELATED_RECORD_MISSING',
          error: 'Related record missing',
          prismaCode: error.code,
        };
      case 'P2025':
        return {
          status: 404,
          code: 'RECORD_NOT_FOUND',
          error: 'Record not found',
          prismaCode: error.code,
        };
      case 'P1001':
      case 'P1002':
        return { ...DATABASE_UNAVAILABLE, prismaCode: error.code };
      default:
        // An unmapped Prisma code is a bug, not a client error: answer 500 but
        // keep the code in the log so it can be mapped later.
        return { ...UNCLASSIFIED, prismaCode: error.code };
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return { ...DATABASE_UNAVAILABLE, prismaCode: error.errorCode };
  }

  return undefined;
};

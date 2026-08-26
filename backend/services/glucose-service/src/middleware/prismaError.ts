/**
 * Translates thrown errors into the `{ error, code }` contract the app reads.
 *
 * Registered in `index.ts` ahead of the generic handler. It is the single place
 * that decides the HTTP status for a database failure, so no route has to know
 * Prisma error codes. See design.md "Contratos de erro (backend -> app)".
 *
 * The app decides on `code`, never on the status alone.
 */

import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';

/**
 * An error that already carries its own HTTP contract, such as
 * `WeakPasswordError` (400 / `WEAK_PASSWORD`). Both fields must be present so a
 * Prisma error - which has `code` but no `status` - never matches.
 */
interface HttpContractError extends Error {
  status: number;
  code: string;
}

interface ErrorContract {
  status: number;
  code: string;
  error: string;
  prismaCode?: string;
}

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

function isHttpContractError(error: unknown): error is HttpContractError {
  return (
    error instanceof Error &&
    typeof (error as Partial<HttpContractError>).status === 'number' &&
    typeof (error as Partial<HttpContractError>).code === 'string'
  );
}

function classify(error: unknown): ErrorContract {
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
        return { ...UNCLASSIFIED, prismaCode: error.code };
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return { ...DATABASE_UNAVAILABLE, prismaCode: error.errorCode };
  }

  if (isHttpContractError(error)) {
    return { status: error.status, code: error.code, error: error.message };
  }

  return UNCLASSIFIED;
}

export function prismaErrorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const contract = classify(error);
  console.error(
    `[error] ${req.method} ${req.originalUrl} status=${contract.status} ` +
      `code=${contract.code} prismaCode=${contract.prismaCode ?? '-'}`,
  );
  if (
    contract.status >= 500 &&
    process.env.NODE_ENV !== 'production' &&
    error instanceof Error &&
    error.stack
  ) {
    console.error(error.stack);
  }

  res.status(contract.status).json({ error: contract.error, code: contract.code });
}

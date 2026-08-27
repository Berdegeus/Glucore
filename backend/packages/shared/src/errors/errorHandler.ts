import type { ErrorRequestHandler } from 'express';

import { AppError } from './AppError';

/** The HTTP answer a classifier decided on. */
export interface ErrorContract {
  status: number;
  /** Machine-readable code. Omitted for routes that never sent one. */
  code?: string;
  error: string;
  /** Extra detail for the log line only; never reaches the body. */
  prismaCode?: string;
}

/**
 * Inspects an error and either claims it or passes the turn.
 *
 * Returning `undefined` hands the error to the next classifier — Chain of
 * Responsibility. It is what keeps this package free of `@prisma/client`: the
 * Prisma-aware link lives in the service that owns a database, and the gateway
 * plugs in its own upstream classifier instead.
 */
export type ErrorClassifier = (error: unknown) => ErrorContract | undefined;

export const UNCLASSIFIED: ErrorContract = {
  status: 500,
  code: 'INTERNAL',
  error: 'Internal server error',
};

/** Claims anything thrown by a service layer. */
export const appErrorClassifier: ErrorClassifier = (error) =>
  error instanceof AppError
    ? { status: error.status, code: error.code, error: error.message }
    : undefined;

/**
 * Claims a foreign error that already carries a contract, such as
 * `WeakPasswordError` (400 / `WEAK_PASSWORD`).
 *
 * Both fields must be present so an error that has `code` but no `status` — a
 * Prisma error, for one — never matches here. `AppError` is matched by
 * `appErrorClassifier` ahead of this one precisely because it may carry no
 * `code` and would fall through this check.
 */
export const httpContractClassifier: ErrorClassifier = (error) => {
  if (!(error instanceof Error)) return undefined;
  const candidate = error as Partial<ErrorContract> & Error;
  if (typeof candidate.status !== 'number' || typeof candidate.code !== 'string') {
    return undefined;
  }
  return { status: candidate.status, code: candidate.code, error: error.message };
};

/**
 * Builds the terminal error middleware from a chain of classifiers.
 *
 * It is the single place that decides the HTTP status for a failure, so no
 * route has to know database error codes. The app decides on `code`, never on
 * the status alone.
 */
export function createErrorHandler(classifiers: readonly ErrorClassifier[]): ErrorRequestHandler {
  return (error, req, res, next) => {
    // A partially written response cannot be replaced; hand it to express's
    // default handler, which closes the connection.
    if (res.headersSent) {
      next(error);
      return;
    }

    let contract: ErrorContract = UNCLASSIFIED;
    for (const classify of classifiers) {
      const claimed = classify(error);
      if (claimed !== undefined) {
        contract = claimed;
        break;
      }
    }

    console.error(
      `[error] ${req.method} ${req.originalUrl} status=${contract.status} ` +
        `code=${contract.code ?? '-'} prismaCode=${contract.prismaCode ?? '-'}`,
    );
    if (
      contract.status >= 500 &&
      process.env.NODE_ENV !== 'production' &&
      error instanceof Error &&
      error.stack
    ) {
      console.error(error.stack);
    }

    res.status(contract.status).json(
      contract.code === undefined
        ? { error: contract.error }
        : { error: contract.error, code: contract.code },
    );
  };
}

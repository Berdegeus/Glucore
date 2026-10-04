/**
 * The terminal error middleware for this service.
 *
 * Registered in `app.ts` ahead of the generic handler. The behaviour lives in
 * `@glucore/shared`; this file only decides the order of the chain — Prisma
 * first, then errors thrown by the service layer, then foreign errors that
 * already carry a status and a code (`WeakPasswordError`, `MissingEnvError`).
 */

import { appErrorClassifier, createErrorHandler, httpContractClassifier } from '@glucore/shared';

import { prismaClassifier } from './prismaClassifier';

export const prismaErrorHandler = createErrorHandler([
  prismaClassifier,
  appErrorClassifier,
  httpContractClassifier,
]);

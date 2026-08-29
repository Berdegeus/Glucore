/**
 * The one place that turns a service failure into a status code and a body.
 *
 * `invalid` answers 400 and only carries `code` when the spec demands a
 * machine-readable one (AD-002); the pre-existing body-validation errors keep
 * the exact `{ error }` shape the app already parses.
 */

import type { Response } from 'express';
import type { Failure } from '../services/result';

export function sendFailure(res: Response, failure: Failure): void {
  if (failure.kind === 'notFound') {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.status(400).json({
    error: failure.message,
    ...(failure.code ? { code: failure.code } : {}),
  });
}

import type { Request, Response } from 'express';

import type { AuthClient } from '../../clients/authClient';
import type { PortfolioEntry } from '../../clients/glucoseClient';

/** Value of `X-Degraded` when the names leg of a portfolio answer failed (PRO-15). */
export const DEGRADED_PATIENT_NAMES = 'patient-names';

/** The query string the caller sent (`?days=7`), or an empty string; re-serialized, never concatenated raw. */
export function querySuffix(req: Request): string {
  return new URL(req.originalUrl, 'http://gateway.invalid').search;
}

/**
 * Two letters from a name: the first letter of the first and of the last word
 * ("Maria da Silva" is MS), or the first two letters of a single word.
 */
function initialsFromName(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const letters = (word: string) => Array.from(word);
  if (words.length >= 2) return (letters(words[0])[0] + letters(words[words.length - 1])[0]).toUpperCase();
  return letters(words[0] ?? '').slice(0, 2).join('').toUpperCase();
}

/**
 * What stands in for a name nobody could give: a `P` and the first two characters
 * of the id, so two patients in a list stay tellable apart without leaking more
 * than the professional already holds.
 */
function initialsFromId(patientId: string): string {
  return `P${patientId.slice(0, 2).toUpperCase()}`;
}

/**
 * The names leg of the portfolio compositions. It is optional: when the lookup
 * fails the names stay unknown and `X-Degraded` says so, because a portfolio
 * without full names is still the portfolio the professional needs. A patient
 * whose account is gone is just absent from the map: not a degraded answer.
 */
export async function resolvePatientNames(
  authClient: AuthClient,
  entries: readonly PortfolioEntry[],
  req: { userId?: string },
  res: Response,
): Promise<Map<string, string>> {
  try {
    return await authClient.lookupAccounts(entries.map((entry) => entry.patientId));
  } catch (error) {
    console.warn(`[gateway] patient names leg failed for userId=${req.userId}: ${String(error)}`);
    res.set('X-Degraded', DEGRADED_PATIENT_NAMES);
    return new Map();
  }
}

/** The entry with `fullName` (or `null`) and `initials` added next to its own fields. */
export function withPatientName<T extends PortfolioEntry>(
  entry: T,
  names: ReadonlyMap<string, string>,
): T & { fullName: string | null; initials: string } {
  const fullName = names.get(entry.patientId) ?? null;
  return {
    ...entry,
    fullName,
    initials: fullName ? initialsFromName(fullName) : initialsFromId(entry.patientId),
  };
}

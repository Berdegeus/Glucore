import { BadRequestError } from '../errors/httpErrors';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ids are generated on the device so a diary entry survives an offline write
 * and syncs under the same id later, which means the server has to check the
 * shape of an id it did not mint.
 */
export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_RE.test(value);

/**
 * The id in a path segment. A malformed one is a bad request rather than a 404:
 * the route never addressed a real resource.
 */
export function requireUuid(value: unknown): string {
  if (!isUuid(value)) throw new BadRequestError('id must be a UUID');
  return value;
}

/** The optional client-minted id on a create. */
export function optionalUuid(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return requireUuid(value);
}

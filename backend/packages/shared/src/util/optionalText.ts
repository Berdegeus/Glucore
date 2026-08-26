/**
 * Normalises an optional free-text field coming off a request body.
 *
 * The three-way return is the point: `undefined` means "the client did not send
 * this field, leave it alone", while `null` means "the client sent it empty,
 * clear it". Collapsing the two would make a partial update wipe fields it never
 * mentioned.
 *
 * Shared because both the account side (phone) and the clinical side
 * (diabetesType) need it, and they end up in different services.
 */
export function optionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text.length === 0 ? null : text;
}

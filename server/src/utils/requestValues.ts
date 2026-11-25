/**
 * Query strings and multipart fields can arrive as strings, arrays or nested
 * objects. Accept only a single non-empty string and trim it.
 */
export function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

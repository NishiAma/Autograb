/**
 * Runtime configuration, read once from environment variables with safe defaults.
 */

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer, received "${raw}"`);
  }
  return parsed;
}

export const config = {
  port: readPositiveInt('PORT', 3001),
  maxLogbookSizeBytes: readPositiveInt('MAX_LOGBOOK_SIZE_BYTES', 1024 * 1024),
} as const;

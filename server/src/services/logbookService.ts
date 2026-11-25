import { AppError } from '../utils/AppError.js';

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

/**
 * Converts an uploaded logbook buffer into text, rejecting content that is not
 * genuine plain text. The extension and MIME type are client-supplied and can
 * be faked, so the bytes themselves are the final check.
 */
export function decodeLogbook(buffer: Buffer): string {
  if (buffer.length === 0) {
    throw new AppError(400, 'EMPTY_FILE', 'The logbook file is empty.');
  }

  // NUL bytes never appear in real text files but are common in binaries
  // (images, PDFs, executables) and in UTF-16 text.
  if (buffer.includes(0)) {
    throw new AppError(415, 'INVALID_FILE_CONTENT', 'The logbook must be a plain text file (binary content detected).');
  }

  try {
    // The decoder strips a leading UTF-8 BOM if present.
    return utf8Decoder.decode(buffer);
  } catch {
    throw new AppError(415, 'INVALID_FILE_CONTENT', 'The logbook must be UTF-8 encoded plain text.');
  }
}

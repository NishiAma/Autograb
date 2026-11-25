import path from 'node:path';
import multer from 'multer';
import { AppError } from '../utils/AppError.js';

export const LOGBOOK_FIELD_NAME = 'logbook';
const ALLOWED_EXTENSIONS = new Set(['.txt']);
const ALLOWED_MIME_TYPES = new Set(['text/plain']);

/**
 * Multer middleware for a single logbook file.
 *
 * - memoryStorage: the file is held in a Buffer and never written to disk.
 * - limits: caps file size and the number of files/fields to bound memory use.
 * - fileFilter: cheap first-pass check on extension AND MIME type. Content is
 *   checked separately (see logbookService) because both can be faked.
 */
export function createLogbookUpload(maxFileSizeBytes: number) {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxFileSizeBytes,
      files: 1,
      fields: 10,
      fieldSize: 1024,
    },
    fileFilter: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      const mimeType = file.mimetype.split(';')[0]?.trim().toLowerCase() ?? '';

      if (!ALLOWED_EXTENSIONS.has(extension) || !ALLOWED_MIME_TYPES.has(mimeType)) {
        callback(new AppError(415, 'INVALID_FILE_TYPE', 'The logbook must be a plain text (.txt) file.'));
        return;
      }
      callback(null, true);
    },
  }).single(LOGBOOK_FIELD_NAME);
}

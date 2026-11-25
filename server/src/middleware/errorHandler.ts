import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import type { ApiErrorResponse } from '../types/api.js';
import { AppError } from '../utils/AppError.js';

function sendError(
  res: Parameters<RequestHandler>[1],
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, string>,
) {
  const body: ApiErrorResponse = { success: false, error: { code, message, ...(details && { details }) } };
  res.status(statusCode).json(body);
}

/** Converts multer's own errors into our API error shape. */
function fromMulterError(error: multer.MulterError, maxFileSizeBytes: number): AppError {
  switch (error.code) {
    case 'LIMIT_FILE_SIZE': {
      const limitKb = Math.round(maxFileSizeBytes / 1024);
      return new AppError(413, 'FILE_TOO_LARGE', `The logbook file must be ${limitKb} KB or smaller.`);
    }
    case 'LIMIT_UNEXPECTED_FILE':
      return new AppError(400, 'UNEXPECTED_FILE', 'Upload exactly one file in the "logbook" field.');
    default:
      return new AppError(400, 'INVALID_UPLOAD', 'The upload request was invalid.');
  }
}

export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found.`);
};

export function createErrorHandler(maxFileSizeBytes: number): ErrorRequestHandler {
  return (error: unknown, _req, res, _next) => {
    const appError = error instanceof multer.MulterError ? fromMulterError(error, maxFileSizeBytes) : error;

    if (appError instanceof AppError) {
      sendError(res, appError.statusCode, appError.code, appError.message, appError.details);
      return;
    }

    // Malformed request bodies etc. raised by Express/body parsers carry a 4xx status.
    if (isHttpClientError(appError)) {
      sendError(res, appError.status, 'BAD_REQUEST', 'The request could not be processed.');
      return;
    }

    console.error('Unexpected error:', appError);
    sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
  };
}

function isHttpClientError(error: unknown): error is { status: number } {
  if (typeof error !== 'object' || error === null || !('status' in error)) return false;
  const { status } = error;
  return typeof status === 'number' && status >= 400 && status < 500;
}

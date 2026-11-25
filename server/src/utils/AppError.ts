/**
 * An expected, client-facing error. Anything thrown that is NOT an AppError is
 * treated as an unexpected 500 and its message is never leaked to the client.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

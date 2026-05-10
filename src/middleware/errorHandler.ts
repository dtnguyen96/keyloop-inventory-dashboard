import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors.js';

/**
 * Global Express error handler.
 * Must be registered last (after all routes) in app.ts.
 *
 * - AppError instances are returned with their own statusCode/code/message.
 * - Unknown errors are logged with their stack trace and returned as 500 INTERNAL_ERROR.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        statusCode: err.statusCode,
        message: err.message,
      },
    });
    return;
  }

  // Unknown / unexpected error — log the stack and return a generic 500
  const message =
    err instanceof Error ? err.message : 'An unexpected error occurred';
  const stack = err instanceof Error ? err.stack : undefined;

  // Use pino logger attached to the request if available, otherwise fall back to console
  if (req.log) {
    req.log.error({ err, stack }, 'Unhandled error');
  } else {
    console.error('Unhandled error', { message, stack });
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      message,
    },
  });
}

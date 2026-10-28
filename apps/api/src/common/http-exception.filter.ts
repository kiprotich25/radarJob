import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ThrottlerException } from '@nestjs/throttler';

/**
 * Every error leaves the API in the same shape:
 *   { "error": { "code": "...", "message": "...", "details"?: [...] } }
 * Internal details (stack traces, provider responses) are logged, never returned.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ThrottlerException) {
      res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        error: {
          code: 'rate_limited',
          message: 'Too many requests. Please wait a while before trying again.',
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (
        typeof body === 'object' &&
        body &&
        'error' in body &&
        typeof (body as { error: unknown }).error === 'object'
      ) {
        res.status(status).json(body);
        return;
      }
      const raw = typeof body === 'object' && body ? (body as { message?: unknown }).message : body;
      const details = Array.isArray(raw) ? raw.map(String) : undefined;
      const code =
        status === 400
          ? 'invalid_request'
          : status === 404
            ? 'not_found'
            : status === 413
              ? 'payload_too_large'
              : `http_${status}`;
      const message =
        status === 400
          ? 'The request was not valid.'
          : status === 404
            ? 'Not found.'
            : status === 413
              ? 'The request is too large.'
              : typeof raw === 'string'
                ? raw
                : 'The request could not be completed.';
      res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
      return;
    }

    const err = exception as { type?: string; status?: number };
    if (err?.type === 'entity.too.large') {
      res
        .status(413)
        .json({ error: { code: 'payload_too_large', message: 'The request is too large.' } });
      return;
    }
    if (err?.type === 'entity.parse.failed') {
      res
        .status(400)
        .json({ error: { code: 'invalid_json', message: 'The request body is not valid JSON.' } });
      return;
    }

    this.logger.error(
      exception instanceof Error ? `${exception.name}: ${exception.message}` : 'unknown error',
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'internal_error',
        message: 'Something went wrong on our side. Please try again.',
      },
    });
  }
}

import { HttpException, HttpStatus } from '@nestjs/common';

/** Error with a stable machine-readable code and a user-safe message. */
export class ApiException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: string,
    message: string,
    readonly details?: string[],
  ) {
    super({ error: { code, message, ...(details ? { details } : {}) } }, status);
  }
}

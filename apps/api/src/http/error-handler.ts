import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import {
  DomainError,
  HTTP_STATUS_BY_CODE,
  NotFoundError,
  type ErrorCode,
} from '../shared/domain/domain-error';

interface ErrorBody {
  error: { code: ErrorCode; message: string; requestId: string };
}

interface DbErrorLike {
  code?: unknown;
  constraint?: unknown;
}

const PG_UNIQUE_VIOLATION = '23505';
const PG_CHECK_VIOLATION = '23514';

/** Translates Postgres integrity failures (the last line of defence) into stable API errors. */
function fromDatabaseError(error: unknown): { code: ErrorCode; message: string } | null {
  if (typeof error !== 'object' || error === null) return null;
  const { code, constraint } = error as DbErrorLike;
  if (code === PG_CHECK_VIOLATION) {
    if (typeof constraint === 'string' && constraint.startsWith('pools_')) {
      return { code: 'POOL_FULL', message: 'That Tesla has no room for another rider.' };
    }
    return { code: 'CONFLICT', message: 'The change violates a data rule.' };
  }
  if (code === PG_UNIQUE_VIOLATION) {
    switch (constraint) {
      case 'uq_active_request_per_passenger':
        return { code: 'ACTIVE_RIDE_EXISTS', message: 'You already have an active ride.' };
      case 'uq_active_pool_per_vehicle':
        return { code: 'ACTIVE_POOL_EXISTS', message: 'Finish or cancel your active trip first.' };
      case 'uq_active_membership_per_request':
        return { code: 'CONFLICT', message: 'That ride is already in a pool.' };
      default:
        return { code: 'CONFLICT', message: 'That already exists.' };
    }
  }
  return null;
}

function httpStatusOf(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;
  const status = (error as { status?: unknown; statusCode?: unknown }).status;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : null;
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError('Route'));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  let code: ErrorCode;
  let message: string;

  if (error instanceof DomainError) {
    ({ code, message } = error);
  } else if (error instanceof ZodError) {
    code = 'VALIDATION_FAILED';
    message = error.issues
      .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
      .join('; ');
  } else if (fromDatabaseError(error)) {
    ({ code, message } = fromDatabaseError(error)!);
  } else if (httpStatusOf(error) === 413) {
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large.';
  } else if (httpStatusOf(error) !== null) {
    // body-parser and friends: malformed JSON, unsupported charset, ...
    code = 'VALIDATION_FAILED';
    message = 'Request could not be parsed.';
  } else {
    code = 'INTERNAL';
    message = 'Something went wrong on our side.';
  }

  const status = HTTP_STATUS_BY_CODE[code];
  if (status >= 500) req.log.error({ err: error }, 'unhandled error');
  else req.log.debug({ err: error, code }, 'request rejected');

  const body: ErrorBody = { error: { code, message, requestId: req.requestId } };
  res.status(status).json(body);
};

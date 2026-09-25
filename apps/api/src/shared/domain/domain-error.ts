export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'FORBIDDEN',
  'NOT_FOUND',
  'INVALID_TRANSITION',
  'POOL_FULL',
  'POOL_NOT_JOINABLE',
  'INCOMPATIBLE_REQUEST',
  'ACTIVE_RIDE_EXISTS',
  'ACTIVE_POOL_EXISTS',
  'DRIVER_OFFLINE',
  'PHONE_ALREADY_REGISTERED',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** HTTP status for every error code. The domain itself never references HTTP. */
export const HTTP_STATUS_BY_CODE: Readonly<Record<ErrorCode, number>> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_TRANSITION: 409,
  POOL_FULL: 409,
  POOL_NOT_JOINABLE: 409,
  INCOMPATIBLE_REQUEST: 409,
  ACTIVE_RIDE_EXISTS: 409,
  ACTIVE_POOL_EXISTS: 409,
  DRIVER_OFFLINE: 409,
  PHONE_ALREADY_REGISTERED: 409,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationFailedError extends DomainError {
  constructor(message: string) {
    super('VALIDATION_FAILED', message);
  }
}

export class UnauthenticatedError extends DomainError {
  constructor(message = 'Sign in to continue.') {
    super('UNAUTHENTICATED', message);
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('INVALID_CREDENTIALS', 'Phone number or password is incorrect.');
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'You are not allowed to do that.') {
    super('FORBIDDEN', message);
  }
}

/** Also used for "exists but is not yours" so ids cannot be probed. */
export class NotFoundError extends DomainError {
  constructor(what = 'Resource') {
    super('NOT_FOUND', `${what} not found.`);
  }
}

export class InvalidTransitionError extends DomainError {
  constructor(
    readonly machine: string,
    readonly from: string,
    readonly to: string,
  ) {
    super('INVALID_TRANSITION', `${machine} cannot move from ${from} to ${to}.`);
  }
}

export class PoolFullError extends DomainError {
  constructor(poolId: string, seatsLeft: number) {
    super('POOL_FULL', `Pool ${poolId} has only ${seatsLeft} seat(s) left.`);
  }
}

export class PoolNotJoinableError extends DomainError {
  constructor(poolId: string, status: string) {
    super('POOL_NOT_JOINABLE', `Pool ${poolId} is ${status} and cannot take new members.`);
  }
}

export class IncompatibleRequestError extends DomainError {
  constructor(poolId: string, requestId: string) {
    super('INCOMPATIBLE_REQUEST', `Request ${requestId} does not fit pool ${poolId}.`);
  }
}

export class ActiveRideExistsError extends DomainError {
  constructor() {
    super('ACTIVE_RIDE_EXISTS', 'You already have an active ride.');
  }
}

export class ActivePoolExistsError extends DomainError {
  constructor(message = 'Finish or cancel your active trip first.') {
    super('ACTIVE_POOL_EXISTS', message);
  }
}

export class DriverOfflineError extends DomainError {
  constructor() {
    super('DRIVER_OFFLINE', 'Go online in a zone first.');
  }
}

export class PhoneAlreadyRegisteredError extends DomainError {
  constructor() {
    super('PHONE_ALREADY_REGISTERED', 'That phone number is already registered.');
  }
}

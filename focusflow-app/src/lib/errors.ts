// src/lib/errors.ts
// FocusFlow — Application Error Hierarchy
//
// A consistent, typed error model that distinguishes between all
// error categories without leaking internal details to clients.

import { logger } from '@/lib/logger';

// ============================================================
// BASE APPLICATION ERROR
// ============================================================

/** Base class for all FocusFlow application errors */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = this.constructor.name;
    if (cause) this.cause = cause;
  }
}

// ============================================================
// VALIDATION ERRORS (400)
// ============================================================

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';

  constructor(
    message: string,
    public readonly details?: Array<{ field: string; issue: string }>
  ) {
    super(message);
  }
}

// ============================================================
// AUTHENTICATION ERRORS (401)
// ============================================================

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code = 'UNAUTHORIZED';

  constructor(message: string = 'Authentication required') {
    super(message);
  }
}

// ============================================================
// NOT FOUND ERRORS (404)
// ============================================================

/**
 * NotFoundError is returned both for missing resources AND
 * resources that exist but belong to another user (anti-enumeration).
 * Never return 403 Forbidden — that confirms the resource exists.
 */
export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';

  constructor(resource: string = 'Resource') {
    super(`${resource} not found`);
  }
}

// ============================================================
// CONFLICT ERRORS (409)
// ============================================================

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, code: string = 'CONFLICT', details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

/** Thrown when attempting to start a session while one is already active */
export class ActiveSessionConflictError extends ConflictError {
  public readonly activeSession?: unknown;

  constructor(activeSession?: unknown) {
    super(
      'An active focus session already exists. Complete or abandon the current session first.',
      'ACTIVE_SESSION_EXISTS',
      activeSession ? { activeSession } : undefined
    );
    this.activeSession = activeSession;
  }
}

/** Thrown when attempting to register with an already-used email */
export class EmailAlreadyExistsError extends ConflictError {
  constructor() {
    super('An account with this email address already exists.', 'EMAIL_ALREADY_EXISTS');
  }
}

// ============================================================
// DOMAIN INVARIANT ERRORS (422)
// ============================================================

/**
 * DomainError is thrown when a valid payload violates a business rule.
 * For example: attempting an invalid state machine transition.
 */
export class DomainError extends AppError {
  readonly statusCode = 422;
  readonly code: string;

  constructor(message: string, code: string = 'DOMAIN_VIOLATION') {
    super(message);
    this.code = code;
  }
}

/** Thrown when an invalid timer state transition is attempted */
export class InvalidStateTransitionError extends DomainError {
  constructor(fromState: string, event: string) {
    super(
      `Cannot dispatch '${event}' from state '${fromState}'`,
      'INVALID_STATE_TRANSITION'
    );
  }
}

// ============================================================
// RATE LIMITING ERRORS (429)
// ============================================================

export class RateLimitError extends AppError {
  readonly statusCode = 429;
  readonly code = 'RATE_LIMITED';

  constructor(message: string = 'Too many requests. Please try again later.') {
    super(message);
  }
}

// ============================================================
// INTERNAL SERVER ERRORS (500)
// ============================================================

export class InternalError extends AppError {
  readonly statusCode = 500;
  readonly code = 'INTERNAL_ERROR';

  constructor(message: string = 'An unexpected error occurred', cause?: Error) {
    super(message, cause);
  }
}

// ============================================================
// ERROR UTILITIES
// ============================================================

/**
 * Type guard to check if an unknown thrown value is an AppError.
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Converts any thrown value to a structured error response body.
 * Ensures no internal details are leaked to clients in production.
 */
export function toErrorResponse(error: unknown): {
  statusCode: number;
  body: { error: { code: string; message: string; details?: unknown } };
} {
  if (error instanceof ValidationError) {
    return {
      statusCode: 400,
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
    };
  }

  if (isAppError(error)) {
    const details = (error as unknown as { details?: unknown }).details;
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(details !== undefined ? { details } : {}),
        },
      },
    };
  }

  // Unknown/unexpected error — do NOT leak details
  logger.error({ error }, 'Unhandled error in API route');
  return {
    statusCode: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
  };
}

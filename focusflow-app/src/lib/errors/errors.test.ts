// src/lib/errors/errors.test.ts
// FocusFlow — Error Handling & Sanitization Unit Tests

import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  ActiveSessionConflictError,
  DomainError,
  RateLimitError,
  InternalError,
  toErrorResponse,
} from './../errors';

describe('Error Hierarchy & Response Sanitization', () => {
  it('maps ValidationError to 400 with details', () => {
    const error = new ValidationError('Invalid payload', [
      { field: 'email', issue: 'Invalid email address' },
    ]);
    const response = toErrorResponse(error);

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid payload',
      details: [{ field: 'email', issue: 'Invalid email address' }],
    });
  });

  it('maps UnauthorizedError to 401', () => {
    const error = new UnauthorizedError();
    const response = toErrorResponse(error);

    expect(response.statusCode).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('maps NotFoundError to 404', () => {
    const error = new NotFoundError('Task');
    const response = toErrorResponse(error);

    expect(response.statusCode).toBe(404);
    expect(response.body.error).toEqual({
      code: 'NOT_FOUND',
      message: 'Task not found',
    });
  });

  it('maps ActiveSessionConflictError to 409 with specific code', () => {
    const error = new ActiveSessionConflictError();
    const response = toErrorResponse(error);

    expect(response.statusCode).toBe(409);
    expect(response.body.error.code).toBe('ACTIVE_SESSION_EXISTS');
  });

  it('maps ConflictError to 409', () => {
    const error = new ConflictError('Duplicate key', 'CONFLICT');
    const response = toErrorResponse(error);

    expect(response.statusCode).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('maps DomainError to 422', () => {
    const error = new DomainError('State error', 'INVALID_STATE');
    const response = toErrorResponse(error);

    expect(response.statusCode).toBe(422);
    expect(response.body.error.code).toBe('INVALID_STATE');
  });

  it('maps InternalError to 500', () => {
    const error = new InternalError('DB down');
    const response = toErrorResponse(error);

    expect(response.statusCode).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('maps RateLimitError to 429', () => {
    const error = new RateLimitError();
    const response = toErrorResponse(error);

    expect(response.statusCode).toBe(429);
    expect(response.body.error.code).toBe('RATE_LIMITED');
  });

  it('sanitizes unexpected internal runtime errors into generic 500 without stack traces', () => {
    const sensitiveError = new Error('Database password failed at 192.168.1.1:5432');
    const response = toErrorResponse(sensitiveError);

    expect(response.statusCode).toBe(500);
    expect(response.body.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
    // Verifies no sensitive info or stack leaks
    expect(JSON.stringify(response)).not.toContain('192.168.1.1');
  });
});

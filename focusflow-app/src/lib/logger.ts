// src/lib/logger.ts
// FocusFlow — Structured Application Logger
//
// Uses pino (already installed) to provide environment-aware structured logging.
// Sensitive fields are automatically redacted — they never appear in log output.
//
// Design note: pino-pretty is intentionally NOT used here. The `transport`
// option requires resolving the pino-pretty package at module evaluation time,
// which fails inside Next.js's Turbopack/Node.js module resolver when the package
// is not installed. Standard pino JSON output is used for all environments;
// JSON is readable directly in development and is the correct format for
// production log ingestion.
//
// Usage:
//   import { logger } from '@/lib/logger';
//   logger.error({ error }, 'Unhandled error in API route');
//   logger.warn({ key, retryAfterMs }, 'Rate limit exceeded');
//   logger.info({ userId }, 'User registered');

import pino from 'pino';

const isTest = process.env.NODE_ENV === 'test';

/**
 * Fields that must never appear in log output.
 * pino will replace their values with '[Redacted]'.
 */
const REDACTED_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'authorization',
  'cookie',
  'secret',
  'apiKey',
  'api_key',
];

export const logger = pino({
  // Silence all output in test environments — tests should assert on thrown errors,
  // not on side-effect log lines.
  level: isTest ? 'silent' : 'info',

  redact: {
    paths: REDACTED_FIELDS,
    censor: '[Redacted]',
  },

  // Base properties added to every log line
  base: {
    service: 'focusflow',
    env: process.env.NODE_ENV ?? 'development',
  },
});

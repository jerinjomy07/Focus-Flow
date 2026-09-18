// src/lib/rate-limit.ts
// FocusFlow — Application & Distributed Rate Limiting
//
// Provides rate limiting for abuse prevention.
// - In development and test environments: Uses an in-memory sliding-window token bucket.
// - In production environments with UPSTASH_REDIS_REST_URL / KV_REST_API_URL:
//   Uses distributed Redis via standard HTTP REST pipeline (zero native dependencies).
// - Failure mode: Fails open with a structured warning log if Redis is unavailable,
//   ensuring rate limiter infrastructure failure never locks legitimate users out of FocusFlow.

import { logger } from '@/lib/logger';

// ============================================================
// INTERFACE
// ============================================================

export interface RateLimitResult {
  /** Whether the request is within the allowed rate */
  allowed: boolean;
  /** Milliseconds until the client may retry (0 when allowed) */
  retryAfterMs: number;
  /** How many requests remain in the current window */
  remaining: number;
}

export interface RateLimiterOptions {
  /** Duration of the sliding window in milliseconds */
  windowMs: number;
  /** Maximum number of requests permitted per window per key */
  maxRequests: number;
  /** Key prefix to partition namespaces in Redis (e.g., 'auth', 'api') */
  prefix?: string;
  /** Whether to allow requests through if Redis communication fails (default: true) */
  failOpen?: boolean;
}

export interface RateLimiter {
  /**
   * Check and consume a token for the given key.
   * Keys are typically IP addresses or user IDs.
   */
  check(key: string): RateLimitResult | Promise<RateLimitResult>;
}

// ============================================================
// IN-MEMORY SLIDING-WINDOW IMPLEMENTATION
// ============================================================

interface BucketEntry {
  /** UTC timestamp of the start of the current window */
  windowStart: number;
  /** Number of requests consumed in the current window */
  count: number;
}

/**
 * Creates an in-memory sliding-window rate limiter.
 * Thread safety: Node.js is single-threaded so Map operations are atomic.
 * Memory: Stale buckets are lazily cleaned up on each check() call for the key.
 */
export function createInMemoryRateLimiter(options: RateLimiterOptions): {
  check(key: string): RateLimitResult;
} {
  const { windowMs, maxRequests } = options;
  const buckets = new Map<string, BucketEntry>();

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      const existing = buckets.get(key);

      if (!existing || now - existing.windowStart >= windowMs) {
        // New window — reset the bucket
        buckets.set(key, { windowStart: now, count: 1 });
        return { allowed: true, retryAfterMs: 0, remaining: maxRequests - 1 };
      }

      if (existing.count >= maxRequests) {
        const retryAfterMs = windowMs - (now - existing.windowStart);
        return { allowed: false, retryAfterMs, remaining: 0 };
      }

      existing.count += 1;
      return {
        allowed: true,
        retryAfterMs: 0,
        remaining: maxRequests - existing.count,
      };
    },
  };
}

// ============================================================
// DISTRIBUTED REDIS REST IMPLEMENTATION (Upstash / Vercel KV)
// ============================================================

export interface RedisRestConfig {
  url: string;
  token: string;
}

/**
 * Creates a distributed rate limiter backed by Upstash Redis or Vercel KV REST API.
 * Uses atomic Redis commands pipeline: INCR + PEXPIRE NX + PTTL.
 */
export function createDistributedRateLimiter(
  options: RateLimiterOptions,
  config: RedisRestConfig
): RateLimiter {
  const { windowMs, maxRequests, prefix = 'rl', failOpen = true } = options;
  const { url, token } = config;

  return {
    async check(key: string): Promise<RateLimitResult> {
      const redisKey = `ff:${prefix}:${key}`;
      try {
        const pipelineCommands = [
          ['INCR', redisKey],
          ['PEXPIRE', redisKey, windowMs, 'NX'],
          ['PTTL', redisKey],
        ];

        const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(pipelineCommands),
          // Set an explicit 2.5 second timeout to prevent latency spikes during outages
          signal: AbortSignal.timeout(2500),
        });

        if (!res.ok) {
          throw new Error(`Upstash pipeline returned HTTP ${res.status}`);
        }

        const data = (await res.json()) as Array<{ result?: unknown; error?: string }>;
        const count = typeof data[0]?.result === 'number' ? data[0].result : 1;
        const pttl = typeof data[2]?.result === 'number' && data[2].result > 0 ? data[2].result : windowMs;

        if (count > maxRequests) {
          return {
            allowed: false,
            retryAfterMs: pttl,
            remaining: 0,
          };
        }

        return {
          allowed: true,
          retryAfterMs: 0,
          remaining: Math.max(0, maxRequests - count),
        };
      } catch (error) {
        logger.warn(
          { key, error: error instanceof Error ? error.message : 'Unknown' },
          'Distributed rate limiter failure — falling back to failOpen policy'
        );

        if (failOpen) {
          return { allowed: true, retryAfterMs: 0, remaining: 1 };
        }
        return { allowed: false, retryAfterMs: windowMs, remaining: 0 };
      }
    },
  };
}

/**
 * Creates an environment-adaptive rate limiter:
 * Uses distributed Redis REST when configured in environment;
 * otherwise uses in-memory sliding-window limiter.
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (redisUrl && redisToken) {
    return createDistributedRateLimiter(options, { url: redisUrl, token: redisToken });
  }

  return createInMemoryRateLimiter(options);
}

// ============================================================
// PRECONFIGURED APPLICATION LIMITERS
// ============================================================

/**
 * Authentication limiter — applied to registration and login endpoints.
 * 10 requests per 60 seconds per IP.
 */
export const authLimiter = createRateLimiter({
  prefix: 'auth',
  windowMs: 60_000, // 1 minute
  maxRequests: 10,
  failOpen: true, // Preserve login availability during cache outage
});

/**
 * General API mutation limiter — applied to focus session start and completion.
 * 60 requests per 60 seconds per user ID.
 */
export const apiLimiter = createRateLimiter({
  prefix: 'api',
  windowMs: 60_000, // 1 minute
  maxRequests: 60,
  failOpen: true,
});

// ============================================================
// CLIENT IDENTIFIER HELPER
// ============================================================

/**
 * Extracts the best available client identifier from a Request.
 * Prefers x-forwarded-for (set by proxies/Vercel), falls back to 'unknown'.
 */
export function getClientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const firstIp = forwarded.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  return 'unknown';
}

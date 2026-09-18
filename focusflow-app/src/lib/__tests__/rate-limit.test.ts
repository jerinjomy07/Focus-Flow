// src/lib/__tests__/rate-limit.test.ts
// FocusFlow — Rate Limiter Unit Tests

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createInMemoryRateLimiter,
  createDistributedRateLimiter,
  createRateLimiter,
  getClientKey,
} from '../rate-limit';

afterEach(() => {
  vi.useRealTimers();
});

describe('createInMemoryRateLimiter', () => {
  it('allows first request', () => {
    const limiter = createInMemoryRateLimiter({ windowMs: 60_000, maxRequests: 5 });
    const result = limiter.check('user-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.retryAfterMs).toBe(0);
  });

  it('allows up to maxRequests in a window', () => {
    const limiter = createInMemoryRateLimiter({ windowMs: 60_000, maxRequests: 3 });
    expect(limiter.check('user-1').allowed).toBe(true);
    expect(limiter.check('user-1').allowed).toBe(true);
    expect(limiter.check('user-1').allowed).toBe(true);
  });

  it('rejects requests exceeding maxRequests', () => {
    const limiter = createInMemoryRateLimiter({ windowMs: 60_000, maxRequests: 2 });
    limiter.check('user-1');
    limiter.check('user-1');
    const result = limiter.check('user-1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('resets the window after windowMs elapses', () => {
    vi.useFakeTimers();
    const limiter = createInMemoryRateLimiter({ windowMs: 1_000, maxRequests: 1 });

    limiter.check('user-1');
    expect(limiter.check('user-1').allowed).toBe(false);

    // Advance time past the window
    vi.advanceTimersByTime(1_001);

    expect(limiter.check('user-1').allowed).toBe(true);
  });

  it('tracks different keys independently', () => {
    const limiter = createInMemoryRateLimiter({ windowMs: 60_000, maxRequests: 1 });
    expect(limiter.check('user-a').allowed).toBe(true);
    expect(limiter.check('user-b').allowed).toBe(true);

    // Both are now exhausted
    expect(limiter.check('user-a').allowed).toBe(false);
    expect(limiter.check('user-b').allowed).toBe(false);
  });

  it('returns accurate remaining count', () => {
    const limiter = createInMemoryRateLimiter({ windowMs: 60_000, maxRequests: 5 });
    expect(limiter.check('user-1').remaining).toBe(4);
    expect(limiter.check('user-1').remaining).toBe(3);
    expect(limiter.check('user-1').remaining).toBe(2);
  });

  it('retryAfterMs is approximately the remaining window duration', () => {
    vi.useFakeTimers();
    const limiter = createInMemoryRateLimiter({ windowMs: 60_000, maxRequests: 1 });
    limiter.check('user-1');

    vi.advanceTimersByTime(30_000);

    const result = limiter.check('user-1');
    expect(result.allowed).toBe(false);
    // Should be approximately 30s remaining (window started 30s ago)
    expect(result.retryAfterMs).toBeGreaterThan(25_000);
    expect(result.retryAfterMs).toBeLessThanOrEqual(30_000);
  });
});

describe('getClientKey', () => {
  it('returns the first IP from x-forwarded-for', () => {
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' },
    });
    expect(getClientKey(req)).toBe('203.0.113.1');
  });

  it('returns "unknown" when no IP headers are present', () => {
    const req = new Request('http://localhost/api/test');
    expect(getClientKey(req)).toBe('unknown');
  });
});

describe('createDistributedRateLimiter', () => {
  it('allows requests within maxRequests over Redis REST pipeline', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [{ result: 1 }, { result: 1 }, { result: 59000 }],
    });
    vi.stubGlobal('fetch', mockFetch);

    const limiter = createDistributedRateLimiter(
      { windowMs: 60_000, maxRequests: 5, prefix: 'test' },
      { url: 'https://mock-redis.upstash.io', token: 'mock-token' }
    );

    const result = await limiter.check('client-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.retryAfterMs).toBe(0);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://mock-redis.upstash.io/pipeline',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token',
        }),
      })
    );

    vi.unstubAllGlobals();
  });

  it('blocks requests exceeding maxRequests with retryAfterMs from PTTL', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [{ result: 6 }, { result: 0 }, { result: 42000 }],
    });
    vi.stubGlobal('fetch', mockFetch);

    const limiter = createDistributedRateLimiter(
      { windowMs: 60_000, maxRequests: 5, prefix: 'test' },
      { url: 'https://mock-redis.upstash.io', token: 'mock-token' }
    );

    const result = await limiter.check('client-1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBe(42000);

    vi.unstubAllGlobals();
  });

  it('fails open when Redis REST endpoint encounters an outage and failOpen=true', async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error('Connection timeout'));
    vi.stubGlobal('fetch', mockFetch);

    const limiter = createDistributedRateLimiter(
      { windowMs: 60_000, maxRequests: 5, prefix: 'test', failOpen: true },
      { url: 'https://mock-redis.upstash.io', token: 'mock-token' }
    );

    const result = await limiter.check('client-1');
    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBe(0);

    vi.unstubAllGlobals();
  });

  it('fails closed when Redis REST encounters an outage and failOpen=false', async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error('Connection timeout'));
    vi.stubGlobal('fetch', mockFetch);

    const limiter = createDistributedRateLimiter(
      { windowMs: 60_000, maxRequests: 5, prefix: 'test', failOpen: false },
      { url: 'https://mock-redis.upstash.io', token: 'mock-token' }
    );

    const result = await limiter.check('client-1');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(60_000);

    vi.unstubAllGlobals();
  });
});

describe('createRateLimiter factory', () => {
  it('selects in-memory limiter when no Redis env vars are present', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5 });
    // In-memory returns synchronously
    const res = limiter.check('test');
    expect(res).toHaveProperty('allowed');
  });
});


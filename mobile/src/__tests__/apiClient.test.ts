// mobile/src/__tests__/apiClient.test.ts
// FocusFlow Mobile — API Client Unit Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, ApiClientError, getBaseUrl } from '../api/client';

describe('getBaseUrl', () => {
  it('returns environment variable or default fallback', () => {
    const url = getBaseUrl();
    expect(url).toBeDefined();
    expect(typeof url).toBe('string');
  });
});

describe('api request error handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes 400 validation error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: [{ field: 'email', issue: 'Invalid email' }],
          },
        }),
      })
    );

    await expect(api.get('/test-endpoint')).rejects.toThrow(ApiClientError);
    try {
      await api.get('/test-endpoint');
    } catch (err) {
      const apiErr = err as ApiClientError;
      expect(apiErr.code).toBe('VALIDATION_ERROR');
      expect(apiErr.statusCode).toBe(400);
      expect(apiErr.details?.[0].field).toBe('email');
    }
  });

  it('normalizes 401 unauthorized response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Session has expired',
          },
        }),
      })
    );

    try {
      await api.get('/protected-endpoint');
    } catch (err) {
      const apiErr = err as ApiClientError;
      expect(apiErr.code).toBe('UNAUTHORIZED');
      expect(apiErr.statusCode).toBe(401);
    }
  });

  it('handles network failure gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    try {
      await api.get('/network-fail');
    } catch (err) {
      const apiErr = err as ApiClientError;
      expect(apiErr.code).toBe('NETWORK_ERROR');
      expect(apiErr.statusCode).toBe(0);
    }
  });
});

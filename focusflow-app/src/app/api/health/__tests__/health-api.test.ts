// src/app/api/health/__tests__/health-api.test.ts
// FocusFlow — Production Health Check API Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { prisma } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 and healthy payload when database probe succeeds', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ '?column?': 1 }]);

    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.status).toBe('healthy');
    expect(json.version).toBeDefined();
    expect(json.timestamp).toBeDefined();
    expect(typeof json.uptimeSeconds).toBe('number');
    expect(json.database).toEqual({
      status: 'connected',
      latencyMs: expect.any(Number),
    });
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });

  it('returns 503 and unhealthy payload when database probe throws error', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('Connection terminated'));

    const response = await GET();
    expect(response.status).toBe(503);

    const json = await response.json();
    expect(json.status).toBe('unhealthy');
    expect(json.database).toEqual({
      status: 'disconnected',
    });
    expect(json.error).toBe('Database connection failed');
    // Ensure no stack traces or connection strings are leaked
    expect(json).not.toHaveProperty('stack');
    expect(json).not.toHaveProperty('connectionString');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });
});

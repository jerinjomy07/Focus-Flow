// src/app/api/productivity/__tests__/productivity-trend-api.test.ts
// FocusFlow — Productivity Trend API Integration Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getTrendHandler } from '../trend/route';
import * as authModule from '@/lib/auth';
import { ProductivityService } from '@/domain/services';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/domain/services', () => ({
  ProductivityService: {
    getTrend: vi.fn(),
  },
}));

const mockAuth = vi.mocked(authModule.auth as unknown as () => Promise<unknown>);
const mockGetTrend = vi.mocked(ProductivityService.getTrend as unknown as (...args: unknown[]) => Promise<unknown>);

describe('GET /api/productivity/trend', () => {
  const mockUserId = 'usr_trend_api_test';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401 UNAUTHORIZED', async () => {
    mockAuth.mockResolvedValue(null);

    const req = new Request('http://localhost:3000/api/productivity/trend');
    const res = await getTrendHandler(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('defaults to period=week when no query parameters are provided', async () => {
    mockAuth.mockResolvedValue({ user: { id: mockUserId } });
    mockGetTrend.mockResolvedValue({
      period: 'week',
      startDate: '2026-09-14',
      endDate: '2026-09-20',
      totalFocusSeconds: 7200,
      totalFocusMinutes: 120,
      points: [
        { date: '2026-09-14', focusSeconds: 3600, focusMinutes: 60, completedSessions: 2 },
        { date: '2026-09-15', focusSeconds: 3600, focusMinutes: 60, completedSessions: 2 },
        { date: '2026-09-16', focusSeconds: 0, focusMinutes: 0, completedSessions: 0 },
        { date: '2026-09-17', focusSeconds: 0, focusMinutes: 0, completedSessions: 0 },
        { date: '2026-09-18', focusSeconds: 0, focusMinutes: 0, completedSessions: 0 },
        { date: '2026-09-19', focusSeconds: 0, focusMinutes: 0, completedSessions: 0 },
        { date: '2026-09-20', focusSeconds: 0, focusMinutes: 0, completedSessions: 0 },
      ],
    });

    const req = new Request('http://localhost:3000/api/productivity/trend');
    const res = await getTrendHandler(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockGetTrend).toHaveBeenCalledWith(mockUserId, {});
    expect(body.data.points).toHaveLength(7);
    expect(body.data.totalFocusMinutes).toBe(120);
  });

  it('accepts valid period query parameter (e.g. period=month)', async () => {
    mockAuth.mockResolvedValue({ user: { id: mockUserId } });
    mockGetTrend.mockResolvedValue({
      period: 'month',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      totalFocusSeconds: 0,
      totalFocusMinutes: 0,
      points: [],
    });

    const req = new Request('http://localhost:3000/api/productivity/trend?period=month');
    const res = await getTrendHandler(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockGetTrend).toHaveBeenCalledWith(mockUserId, { period: 'month' });
    expect(body.data.period).toBe('month');
  });

  it('accepts valid custom range parameters (startDate and endDate)', async () => {
    mockAuth.mockResolvedValue({ user: { id: mockUserId } });
    mockGetTrend.mockResolvedValue({
      startDate: '2026-09-10',
      endDate: '2026-09-12',
      totalFocusSeconds: 0,
      totalFocusMinutes: 0,
      points: [],
    });

    const req = new Request(
      'http://localhost:3000/api/productivity/trend?startDate=2026-09-10&endDate=2026-09-12'
    );
    const res = await getTrendHandler(req);

    expect(res.status).toBe(200);
    expect(mockGetTrend).toHaveBeenCalledWith(mockUserId, {
      startDate: '2026-09-10',
      endDate: '2026-09-12',
    });
  });

  it('rejects ambiguous conflicting query modes with 400 VALIDATION_ERROR', async () => {
    mockAuth.mockResolvedValue({ user: { id: mockUserId } });

    const req = new Request('http://localhost:3000/api/productivity/trend?period=week&date=2026-09-17');
    const res = await getTrendHandler(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects custom range with missing endDate with 400 VALIDATION_ERROR', async () => {
    mockAuth.mockResolvedValue({ user: { id: mockUserId } });

    const req = new Request('http://localhost:3000/api/productivity/trend?startDate=2026-09-10');
    const res = await getTrendHandler(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

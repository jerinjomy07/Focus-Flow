// src/domain/productivity/__tests__/trend-calculations.test.ts
// FocusFlow — Productivity Trend & Continuous Date Range Unit Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getContinuousLocalDateRange,
  getLocalMidnightUtc,
  getLocalDayBoundsUtc,
} from '../date-range';
import { ProductivityService } from '@/domain/services/productivity-service';
import * as db from '@/lib/db';

vi.mock('@/lib/db', () => ({
  getUserById: vi.fn(),
  getProductivityTrend: vi.fn(),
}));

describe('getContinuousLocalDateRange', () => {
  it('generates a continuous 7-day date sequence for a Monday-to-Sunday week', () => {
    // 2026-09-14 (Mon) 00:00 UTC to 2026-09-21 (Mon) 00:00 UTC
    const startUtc = new Date(Date.UTC(2026, 8, 14, 0, 0, 0));
    const endUtcExclusive = new Date(Date.UTC(2026, 8, 21, 0, 0, 0));

    const dates = getContinuousLocalDateRange(startUtc, endUtcExclusive, 'UTC');

    expect(dates).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ]);
  });

  it('handles month rollover seamlessly (e.g. October 29 to November 3)', () => {
    const startUtc = new Date(Date.UTC(2026, 9, 29, 0, 0, 0));
    const endUtcExclusive = new Date(Date.UTC(2026, 10, 3, 0, 0, 0));

    const dates = getContinuousLocalDateRange(startUtc, endUtcExclusive, 'UTC');

    expect(dates).toEqual([
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });

  it('returns single date for a 1-day interval', () => {
    const bounds = getLocalDayBoundsUtc('2026-09-17', 'UTC');
    const dates = getContinuousLocalDateRange(bounds.startUtc, bounds.endUtcExclusive, 'UTC');

    expect(dates).toEqual(['2026-09-17']);
  });

  it('returns empty array when startUtc >= endUtcExclusive', () => {
    const t = new Date(Date.UTC(2026, 8, 17, 0, 0, 0));
    expect(getContinuousLocalDateRange(t, t, 'UTC')).toEqual([]);
    expect(getContinuousLocalDateRange(new Date(t.getTime() + 1000), t, 'UTC')).toEqual([]);
  });

  it('respects non-UTC timezone offsets', () => {
    // In America/New_York (UTC-4 in Sep), 2026-09-17 00:00 local is 2026-09-17 04:00 UTC
    const startUtc = getLocalMidnightUtc(2026, 9, 17, 'America/New_York');
    const endUtcExclusive = getLocalMidnightUtc(2026, 9, 19, 'America/New_York');

    const dates = getContinuousLocalDateRange(startUtc, endUtcExclusive, 'America/New_York');
    expect(dates).toEqual(['2026-09-17', '2026-09-18']);
  });
});

describe('ProductivityService.getTrend', () => {
  const mockUserId = 'usr_trend_test';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getUserById).mockResolvedValue({
      id: mockUserId,
      email: 'test@example.com',
      timezone: 'UTC',
    } as unknown as Awaited<ReturnType<typeof db.getUserById>>);
  });

  it('pads missing days with zero duration and zero session count for week period', () => {
    // Mock db returning activity only on Mon (2026-09-14) and Thu (2026-09-17)
    vi.mocked(db.getProductivityTrend).mockResolvedValue([
      { date: '2026-09-14', completedFocusSeconds: 3000, completedFocusSessions: 2 },
      { date: '2026-09-17', completedFocusSeconds: 4500, completedFocusSessions: 3 },
    ]);

    return ProductivityService.getTrend(mockUserId, {
      startDate: '2026-09-14',
      endDate: '2026-09-20',
    }).then((res) => {
      expect(res.points).toHaveLength(7);
      expect(res.totalFocusSeconds).toBe(7500);
      expect(res.totalFocusMinutes).toBe(125);

      // Mon (active)
      expect(res.points[0]).toEqual({
        date: '2026-09-14',
        focusSeconds: 3000,
        focusMinutes: 50,
        completedSessions: 2,
      });

      // Tue (zero-padded)
      expect(res.points[1]).toEqual({
        date: '2026-09-15',
        focusSeconds: 0,
        focusMinutes: 0,
        completedSessions: 0,
      });

      // Wed (zero-padded)
      expect(res.points[2]).toEqual({
        date: '2026-09-16',
        focusSeconds: 0,
        focusMinutes: 0,
        completedSessions: 0,
      });

      // Thu (active)
      expect(res.points[3]).toEqual({
        date: '2026-09-17',
        focusSeconds: 4500,
        focusMinutes: 75,
        completedSessions: 3,
      });

      // Sun (zero-padded)
      expect(res.points[6]).toEqual({
        date: '2026-09-20',
        focusSeconds: 0,
        focusMinutes: 0,
        completedSessions: 0,
      });
    });
  });

  it('returns all zero points when user has no completed sessions in period', () => {
    vi.mocked(db.getProductivityTrend).mockResolvedValue([]);

    return ProductivityService.getTrend(mockUserId, {
      startDate: '2026-09-14',
      endDate: '2026-09-16',
    }).then((res) => {
      expect(res.points).toHaveLength(3);
      expect(res.totalFocusSeconds).toBe(0);
      expect(res.totalFocusMinutes).toBe(0);
      for (const pt of res.points) {
        expect(pt.focusSeconds).toBe(0);
        expect(pt.completedSessions).toBe(0);
      }
    });
  });
});

// src/app/api/analytics/__tests__/analytics-api.test.ts
// FocusFlow — Advanced Analytics API Integration Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getOverviewHandler } from '../overview/route';
import { GET as getDistributionsHandler } from '../distributions/route';
import * as authModule from '@/lib/auth';
import * as dbModule from '@/lib/db';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof dbModule>();
  return {
    ...actual,
    getUserById: vi.fn(),
    getAnalyticsOverviewAggregates: vi.fn(),
    getWeekdayFocusAggregates: vi.fn(),
    getHourlyFocusAggregates: vi.fn(),
    getProjectProductivityAggregates: vi.fn(),
    getProjectsByUserId: vi.fn(),
  };
});

const mockAuth = vi.mocked(authModule.auth as unknown as () => Promise<unknown>);
const mockGetUserById = vi.mocked(dbModule.getUserById as unknown as (id: string) => Promise<unknown>);
const mockGetAnalyticsOverviewAggregates = vi.mocked(
  dbModule.getAnalyticsOverviewAggregates as unknown as (...args: unknown[]) => Promise<unknown>
);
const mockGetWeekdayFocusAggregates = vi.mocked(
  dbModule.getWeekdayFocusAggregates as unknown as (...args: unknown[]) => Promise<unknown>
);
const mockGetHourlyFocusAggregates = vi.mocked(
  dbModule.getHourlyFocusAggregates as unknown as (...args: unknown[]) => Promise<unknown>
);
const mockGetProjectProductivityAggregates = vi.mocked(
  dbModule.getProjectProductivityAggregates as unknown as (...args: unknown[]) => Promise<unknown>
);
const mockGetProjectsByUserId = vi.mocked(
  dbModule.getProjectsByUserId as unknown as (userId: string) => Promise<unknown>
);

describe('Analytics API', () => {
  const mockUserId = 'usr_test_analytics_1';
  const mockUserTimezone = 'UTC';

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: mockUserId, email: 'test@example.com' },
      expires: '2026-12-31',
    });

    mockGetUserById.mockResolvedValue({
      id: mockUserId,
      email: 'test@example.com',
      timezone: mockUserTimezone,
    });
  });

  describe('Authentication Enforcement', () => {
    it('returns 401 UNAUTHORIZED on GET /api/analytics/overview when unauthenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const req = new Request('http://localhost:3000/api/analytics/overview');
      const res = await getOverviewHandler(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 UNAUTHORIZED on GET /api/analytics/distributions when unauthenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const req = new Request('http://localhost:3000/api/analytics/distributions');
      const res = await getDistributionsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Mutually Exclusive Query Modes', () => {
    it('returns 400 VALIDATION_ERROR on overview when combining date and period', async () => {
      const req = new Request('http://localhost:3000/api/analytics/overview?date=2026-09-17&period=week');
      const res = await getOverviewHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 VALIDATION_ERROR on distributions when combining period and custom range', async () => {
      const req = new Request(
        'http://localhost:3000/api/analytics/distributions?period=week&startDate=2026-09-01&endDate=2026-09-07'
      );
      const res = await getDistributionsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/analytics/overview', () => {
    it('returns comprehensive overview metrics and comparisons', async () => {
      // Current period aggregates
      mockGetAnalyticsOverviewAggregates.mockResolvedValueOnce({
        completedFocusSeconds: 7200,
        completedFocusSessions: 4,
        abandonedFocusSeconds: 600,
        abandonedFocusSessions: 1,
        longestCompletedSessionSeconds: 2400,
        totalBreakSeconds: 1200,
        totalSessions: 6,
        activeFocusDays: 3,
      });

      // Previous period aggregates
      mockGetAnalyticsOverviewAggregates.mockResolvedValueOnce({
        completedFocusSeconds: 3600,
        completedFocusSessions: 2,
        abandonedFocusSeconds: 0,
        abandonedFocusSessions: 0,
        longestCompletedSessionSeconds: 1800,
        totalBreakSeconds: 600,
        totalSessions: 3,
        activeFocusDays: 2,
      });

      const req = new Request('http://localhost:3000/api/analytics/overview?period=week');
      const res = await getOverviewHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toBeDefined();

      const data = json.data;
      expect(data.completedFocusSeconds).toBe(7200);
      expect(data.completedFocusMinutes).toBe(120);
      expect(data.completedFocusSessions).toBe(4);
      expect(data.abandonedFocusSessions).toBe(1);
      // 4 completed / (4 completed + 1 abandoned) = 80%
      expect(data.completionRate).toBe(80);
      expect(data.averageCompletedSessionSeconds).toBe(1800);
      expect(data.longestCompletedSessionSeconds).toBe(2400);
      expect(data.activeFocusDays).toBe(3);
      expect(data.totalDaysInRange).toBe(7);
      expect(data.consistencyRate).toBeCloseTo((3 / 7) * 100, 3);

      // Period-over-period comparisons
      expect(data.comparisons.focusTime.currentValue).toBe(7200);
      expect(data.comparisons.focusTime.previousValue).toBe(3600);
      expect(data.comparisons.focusTime.percentageDelta).toBe(100);
      expect(data.comparisons.focusTime.direction).toBe('up');

      // Abandoned comparison (previous was 0)
      expect(data.comparisons.abandonedSessions.currentValue).toBe(1);
      expect(data.comparisons.abandonedSessions.previousValue).toBe(0);
      expect(data.comparisons.abandonedSessions.percentageDelta).toBeNull();
      expect(data.comparisons.abandonedSessions.direction).toBe('up');
    });
  });

  describe('GET /api/analytics/distributions', () => {
    it('returns weekday, hourly, and project distributions with peak points', async () => {
      mockGetWeekdayFocusAggregates.mockResolvedValueOnce([
        { weekday: 0, seconds: 3600, count: 2 }, // Monday
        { weekday: 3, seconds: 7200, count: 4 }, // Thursday
      ]);

      mockGetHourlyFocusAggregates.mockResolvedValueOnce([
        { hour: 9, seconds: 1800, count: 1 },
        { hour: 14, seconds: 5400, count: 3 },
      ]);

      mockGetProjectProductivityAggregates.mockResolvedValueOnce([
        { projectId: 'prj_1', completedFocusSeconds: 5400, completedFocusSessions: 3, totalSessions: 3 },
        { projectId: null, completedFocusSeconds: 1800, completedFocusSessions: 1, totalSessions: 1 },
      ]);

      mockGetProjectsByUserId.mockResolvedValueOnce([
        { id: 'prj_1', name: 'Design System', color: '#6366f1', isArchived: false },
      ]);

      const req = new Request('http://localhost:3000/api/analytics/distributions?period=week');
      const res = await getDistributionsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      const data = json.data;

      // 7 weekdays
      expect(data.weekday).toHaveLength(7);
      expect(data.weekday[0].label).toBe('Mon');
      expect(data.weekday[0].completedFocusSeconds).toBe(3600);
      expect(data.peakWeekday).not.toBeNull();
      expect(data.peakWeekday.weekday).toBe(3); // Thursday

      // 24 hours
      expect(data.hourly).toHaveLength(24);
      expect(data.hourly[14].completedFocusSeconds).toBe(5400);
      expect(data.peakHour).not.toBeNull();
      expect(data.peakHour.hour).toBe(14);

      // Projects
      expect(data.projects).toHaveLength(2);
      expect(data.projects[0].projectName).toBe('Design System');
      expect(data.projects[0].percentage).toBe(75); // 5400 / (5400 + 1800)
      expect(data.projects[1].projectName).toBe('Unassigned');
      expect(data.projects[1].percentage).toBe(25);
    });
  });
});

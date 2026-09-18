// src/domain/services/analytics-service.ts
// FocusFlow — Analytics Domain Service
// Aggregates real FocusSession records into actionable productivity metrics.
// Pure query-first architecture with zero unbounded session loading into application memory.

import * as db from '@/lib/db';
import {
  computeAnalyticsSummary,
  computeDailyTrend,
  computeProjectBreakdown,
  calculateConsistencyRate,
  calculateComparison,
  calculateAverageDuration,
  findPeakWeekday,
  findPeakHour,
  fillWeekdayBuckets,
  fillHourlyBuckets,
  getPreviousPeriodBounds,
} from '@/domain/analytics';
import {
  getLocalDayBoundsUtc,
  getPeriodBoundsUtc,
  resolveCustomRangeBounds,
  toLocalDateString,
  getContinuousLocalDateRange,
} from '@/domain/productivity/date-range';
import { calculateCompletionRate } from '@/domain/productivity/calculations';
import { calculateStreaks } from '@/domain/streaks';
import { NotFoundError } from '@/lib/errors';
import type {
  AnalyticsSummaryResponse,
  DailyTrendPoint,
  ProjectFocusBreakdown,
  ProductivitySummaryQuery,
  AnalyticsOverviewResponse,
  AnalyticsDistributionsResponse,
  ProjectAnalyticsPoint,
} from '@/types/api';

export class AnalyticsService {
  /**
   * Resolves query into authoritative half-open UTC bounds [startUtc, endUtcExclusive).
   */
  private static resolveAnalyticsBounds(
    query: ProductivitySummaryQuery,
    userTimezone: string
  ): {
    startUtc: Date;
    endUtcExclusive: Date;
    startDate: string;
    endDate: string;
    period?: 'today' | 'yesterday' | 'week' | 'month';
  } {
    // Mode A: Single local calendar day
    if (query.date) {
      const bounds = getLocalDayBoundsUtc(query.date, userTimezone);
      return {
        ...bounds,
        startDate: query.date,
        endDate: query.date,
      };
    }

    // Mode C: Custom date range (both required)
    if (query.startDate && query.endDate) {
      const bounds = resolveCustomRangeBounds(query.startDate, query.endDate, userTimezone);
      return {
        ...bounds,
        startDate: query.startDate,
        endDate: query.endDate,
      };
    }

    // Mode B: Predefined period (defaults to 'week')
    const period = query.period ?? 'week';
    const bounds = getPeriodBoundsUtc(period, userTimezone);
    const startDate = toLocalDateString(bounds.startUtc, userTimezone);
    const endDate = toLocalDateString(new Date(bounds.endUtcExclusive.getTime() - 1), userTimezone);
    return {
      ...bounds,
      startDate,
      endDate,
      period,
    };
  }

  /**
   * Phase 9 — Computes high-level analytics overview with period-over-period comparison deltas.
   */
  static async getOverview(
    userId: string,
    query: ProductivitySummaryQuery = {}
  ): Promise<AnalyticsOverviewResponse> {
    const user = await db.getUserById(userId);
    if (!user) throw new NotFoundError('User');

    const userTimezone = user.timezone || 'UTC';
    const { startUtc, endUtcExclusive, startDate, endDate, period } =
      this.resolveAnalyticsBounds(query, userTimezone);

    const prevBounds = getPreviousPeriodBounds(query, userTimezone, startUtc, endUtcExclusive);

    const [currAggs, prevAggs] = await Promise.all([
      db.getAnalyticsOverviewAggregates(userId, startUtc, endUtcExclusive, userTimezone),
      db.getAnalyticsOverviewAggregates(
        userId,
        prevBounds.prevStartUtc,
        prevBounds.prevEndUtcExclusive,
        userTimezone
      ),
    ]);

    const totalDaysInRange = getContinuousLocalDateRange(
      startUtc,
      endUtcExclusive,
      userTimezone
    ).length;

    const completionRate = calculateCompletionRate(
      currAggs.completedFocusSessions,
      currAggs.abandonedFocusSessions
    );
    const prevCompletionRate = calculateCompletionRate(
      prevAggs.completedFocusSessions,
      prevAggs.abandonedFocusSessions
    );

    const averageCompletedSessionSeconds = calculateAverageDuration(
      currAggs.completedFocusSeconds,
      currAggs.completedFocusSessions
    );

    const consistencyRate = calculateConsistencyRate(
      currAggs.activeFocusDays,
      totalDaysInRange
    );

    return {
      ...(period ? { period } : {}),
      startDate,
      endDate,

      completedFocusSeconds: currAggs.completedFocusSeconds,
      completedFocusMinutes: Math.floor(currAggs.completedFocusSeconds / 60),
      completedFocusSessions: currAggs.completedFocusSessions,
      abandonedFocusSeconds: currAggs.abandonedFocusSeconds,
      abandonedFocusSessions: currAggs.abandonedFocusSessions,
      completionRate,
      averageCompletedSessionSeconds,
      longestCompletedSessionSeconds: currAggs.longestCompletedSessionSeconds,
      totalBreakSeconds: currAggs.totalBreakSeconds,
      totalSessions: currAggs.totalSessions,

      activeFocusDays: currAggs.activeFocusDays,
      totalDaysInRange,
      consistencyRate,

      previousPeriod: {
        startDate: prevBounds.prevStartDateStr,
        endDate: prevBounds.prevEndDateStr,
      },
      comparisons: {
        focusTime: calculateComparison(
          currAggs.completedFocusSeconds,
          prevAggs.completedFocusSeconds
        ),
        completedSessions: calculateComparison(
          currAggs.completedFocusSessions,
          prevAggs.completedFocusSessions
        ),
        completionRate: calculateComparison(completionRate, prevCompletionRate),
        abandonedSessions: calculateComparison(
          currAggs.abandonedFocusSessions,
          prevAggs.abandonedFocusSessions
        ),
      },
    };
  }

  /**
   * Phase 9 — Computes weekday, 24-hour, and project focus distributions.
   */
  static async getDistributions(
    userId: string,
    query: ProductivitySummaryQuery = {}
  ): Promise<AnalyticsDistributionsResponse> {
    const user = await db.getUserById(userId);
    if (!user) throw new NotFoundError('User');

    const userTimezone = user.timezone || 'UTC';
    const { startUtc, endUtcExclusive, startDate, endDate, period } =
      this.resolveAnalyticsBounds(query, userTimezone);

    const [rawWeekday, rawHourly, rawProjects, userProjects] = await Promise.all([
      db.getWeekdayFocusAggregates(userId, startUtc, endUtcExclusive, userTimezone),
      db.getHourlyFocusAggregates(userId, startUtc, endUtcExclusive, userTimezone),
      db.getProjectProductivityAggregates(userId, startUtc, endUtcExclusive),
      db.getProjectsByUserId(userId),
    ]);

    const weekday = fillWeekdayBuckets(rawWeekday);
    const hourly = fillHourlyBuckets(rawHourly);
    const peakWeekday = findPeakWeekday(weekday);
    const peakHour = findPeakHour(hourly);

    const totalCompletedFocusSeconds = rawProjects.reduce(
      (acc, p) => acc + p.completedFocusSeconds,
      0
    );
    const projectMap = new Map(userProjects.map((p) => [p.id, p]));

    const projects: ProjectAnalyticsPoint[] = rawProjects.map((p) => {
      const proj = p.projectId ? projectMap.get(p.projectId) : undefined;
      const percentage =
        totalCompletedFocusSeconds > 0
          ? (p.completedFocusSeconds / totalCompletedFocusSeconds) * 100
          : 0;

      return {
        projectId: p.projectId,
        projectName: proj ? proj.name : 'Unassigned',
        projectColor: proj ? proj.color : null,
        isArchived: proj ? proj.status === 'ARCHIVED' : false,
        completedFocusSeconds: p.completedFocusSeconds,
        completedFocusMinutes: Math.floor(p.completedFocusSeconds / 60),
        sessionCount: p.completedFocusSessions,
        percentage,
      };
    });

    return {
      ...(period ? { period } : {}),
      startDate,
      endDate,
      weekday,
      hourly,
      projects,
      peakWeekday,
      peakHour,
    };
  }

  // ============================================================
  // LEGACY METHODS (Preserved for backwards compatibility)
  // ============================================================

  /**
   * Retrieves high-level analytics summary for today, this week, or this month.
   * All metrics are derived from persistent FocusSession records in PostgreSQL.
   */
  static async getSummary(
    userId: string,
    period: 'today' | 'week' | 'month' = 'today'
  ): Promise<AnalyticsSummaryResponse> {
    const user = await db.getUserById(userId);
    if (!user) throw new NotFoundError('User');

    const userTz = user.timezone;
    const now = new Date();

    // Determine start of period in user's timezone
    const { startDate, endDate } = getPeriodBounds(period, userTz, now);

    // Fetch sessions in the target window for summary calculations
    const periodSessions = await db.getSessionsForPeriod(userId, startDate, endDate);
    const summary = computeAnalyticsSummary(periodSessions);

    // Fetch up to 365 days of session history to compute accurate streaks
    const streakWindowStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const allRecentSessions = await db.getSessionsForPeriod(userId, streakWindowStart, now);
    const streaks = calculateStreaks(allRecentSessions, userTz, now);

    return {
      period,
      ...summary,
      currentStreakDays: streaks.currentStreak,
      longestStreakDays: streaks.longestStreak,
    };
  }

  /**
   * Computes daily trend time-series for 7, 14, or 30 days.
   */
  static async getDailyTrend(
    userId: string,
    days: number = 7
  ): Promise<DailyTrendPoint[]> {
    const user = await db.getUserById(userId);
    if (!user) throw new NotFoundError('User');

    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const sessions = await db.getSessionsForPeriod(userId, startDate, now);
    return computeDailyTrend(sessions, user.timezone, days, now);
  }

  /**
   * Computes focus time breakdown by project.
   */
  static async getProjectBreakdown(
    userId: string,
    period: 'week' | 'month' | 'all' = 'week'
  ): Promise<ProjectFocusBreakdown[]> {
    const user = await db.getUserById(userId);
    if (!user) throw new NotFoundError('User');

    const now = new Date();
    let startDate: Date;

    if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      startDate = new Date(0); // All time
    }

    const [sessions, userProjects] = await Promise.all([
      db.getSessionsForPeriod(userId, startDate, now),
      db.getProjectsByUserId(userId),
    ]);

    const breakdown = computeProjectBreakdown(sessions);
    const projectMap = new Map(userProjects.map((p) => [p.id, p]));

    return breakdown.map((item) => {
      const project = item.projectId ? projectMap.get(item.projectId) ?? null : null;
      return {
        project: project ? { id: project.id, name: project.name, color: project.color } : null,
        focusSeconds: item.focusSeconds,
        sessionCount: item.sessionCount,
        percentage: item.percentage,
      };
    });
  }
}

/**
 * Calculates start and end UTC bounds for a given period in user's timezone.
 */
function getPeriodBounds(
  period: 'today' | 'week' | 'month',
  timezone: string,
  now: Date
): { startDate: Date; endDate: Date } {
  const localDateStr = now.toLocaleDateString('en-CA', { timeZone: timezone });
  const [year, month, day] = localDateStr.split('-').map(Number);

  let startYear = year;
  let startMonth = month;
  let startDay = day;

  if (period === 'week') {
    const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const pastStr = past.toLocaleDateString('en-CA', { timeZone: timezone });
    const [py, pm, pd] = pastStr.split('-').map(Number);
    startYear = py;
    startMonth = pm;
    startDay = pd;
  } else if (period === 'month') {
    const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const pastStr = past.toLocaleDateString('en-CA', { timeZone: timezone });
    const [py, pm, pd] = pastStr.split('-').map(Number);
    startYear = py;
    startMonth = pm;
    startDay = pd;
  }

  const startDate = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

  return { startDate, endDate };
}

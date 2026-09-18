// src/domain/services/productivity-service.ts
// FocusFlow — Productivity Domain Service
//
// Orchestrates database-side aggregation with domain formatting.
// Zero unbounded session loading into application memory.
// Strictly enforces mutually exclusive query modes:
// - 0 modes: defaults to today (summary) or week (projects)
// - 1 mode: executes specified mode (Single Day, Predefined Period, Custom Range)
// - 2+ modes: rejected by validation schema
// Computes unrounded duration-based project percentages.

import { prisma } from '@/lib/db/client';
import * as db from '@/lib/db';
import {
  getLocalDayBoundsUtc,
  getPeriodBoundsUtc,
  resolveCustomRangeBounds,
  toLocalDateString,
  getContinuousLocalDateRange,
} from '@/domain/productivity/date-range';
import {
  calculateCompletionRate,
  calculateProjectPercentage,
} from '@/domain/productivity/calculations';
import { NotFoundError } from '@/lib/errors';
import type {
  ProductivitySummaryQuery,
  DailyProductivitySummaryResponse,
  RangeProductivitySummaryResponse,
  ProjectProductivityResponse,
  TaskProductivityResponse,
  ProductivityTrendResponse,
  ProductivityTrendPoint,
} from '@/types/api';

export class ProductivityService {
  /**
   * Resolves query mode into authoritative half-open UTC bounds [startUtc, endUtcExclusive).
   */
  private static resolveBounds(
    query: ProductivitySummaryQuery,
    userTimezone: string,
    defaultPeriod: 'today' | 'week'
  ): { startUtc: Date; endUtcExclusive: Date; localDateStr: string; isSingleDay: boolean } {
    // Mode A: Single local calendar day
    if (query.date) {
      const bounds = getLocalDayBoundsUtc(query.date, userTimezone);
      return { ...bounds, isSingleDay: true };
    }

    // Mode C: Custom date range (both required)
    if (query.startDate && query.endDate) {
      const bounds = resolveCustomRangeBounds(query.startDate, query.endDate, userTimezone);
      const localDateStr = `${query.startDate} to ${query.endDate}`;
      return { ...bounds, localDateStr, isSingleDay: false };
    }

    // Mode B: Predefined period (today, yesterday, week, month) or default
    const period = query.period ?? defaultPeriod;
    const bounds = getPeriodBoundsUtc(period, userTimezone);
    const isSingleDay = period === 'today' || period === 'yesterday';
    return { ...bounds, isSingleDay };
  }

  /**
   * Retrieves high-level productivity summary for today, yesterday, week, month, or custom range.
   * Leverages PostgreSQL aggregations (COUNT, SUM).
   */
  static async getSummary(
    userId: string,
    query: ProductivitySummaryQuery = {}
  ): Promise<DailyProductivitySummaryResponse | RangeProductivitySummaryResponse> {
    const user = await db.getUserById(userId);
    if (!user) throw new NotFoundError('User');

    const userTimezone = user.timezone || 'UTC';
    const { startUtc, endUtcExclusive, localDateStr, isSingleDay } = this.resolveBounds(
      query,
      userTimezone,
      'today'
    );

    const aggregates = await db.getProductivityAggregatesForRange(
      userId,
      startUtc,
      endUtcExclusive
    );

    const completionRate = calculateCompletionRate(
      aggregates.completedFocusSessions,
      aggregates.abandonedFocusSessions
    );

    if (isSingleDay) {
      return {
        date: localDateStr,
        completedFocusSessions: aggregates.completedFocusSessions,
        completedFocusSeconds: aggregates.completedFocusSeconds,
        completedFocusMinutes: Math.floor(aggregates.completedFocusSeconds / 60),
        abandonedFocusSessions: aggregates.abandonedFocusSessions,
        abandonedFocusSeconds: aggregates.abandonedFocusSeconds,
        skippedFocusSessions: aggregates.skippedFocusSessions,
        completedBreakSessions: aggregates.completedBreakSessions,
        completedBreakSeconds: aggregates.completedBreakSeconds,
        totalSessions: aggregates.totalSessions,
        completionRate,
      };
    }

    // Format start and end date for response range
    const startDate = toLocalDateString(startUtc, userTimezone);
    const endDate = toLocalDateString(new Date(endUtcExclusive.getTime() - 1), userTimezone);

    return {
      startDate,
      endDate,
      completedFocusSessions: aggregates.completedFocusSessions,
      completedFocusSeconds: aggregates.completedFocusSeconds,
      completedFocusMinutes: Math.floor(aggregates.completedFocusSeconds / 60),
      abandonedFocusSessions: aggregates.abandonedFocusSessions,
      abandonedFocusSeconds: aggregates.abandonedFocusSeconds,
      skippedFocusSessions: aggregates.skippedFocusSessions,
      completedBreakSessions: aggregates.completedBreakSessions,
      completedBreakSeconds: aggregates.completedBreakSeconds,
      totalSessions: aggregates.totalSessions,
      completionRate,
    };
  }

  /**
   * Computes completed focus duration breakdown by project using PostgreSQL groupBy.
   * Returns unrounded floating-point percentages.
   */
  static async getProjectSummaries(
    userId: string,
    query: ProductivitySummaryQuery = {}
  ): Promise<ProjectProductivityResponse[]> {
    const user = await db.getUserById(userId);
    if (!user) throw new NotFoundError('User');

    const userTimezone = user.timezone || 'UTC';
    const { startUtc, endUtcExclusive } = this.resolveBounds(
      query,
      userTimezone,
      'week'
    );

    const aggregates = await db.getProjectProductivityAggregates(
      userId,
      startUtc,
      endUtcExclusive
    );

    // Sum total completed focus duration across all groups for exact same range
    const totalCompletedFocusSeconds = aggregates.reduce(
      (acc, a) => acc + a.completedFocusSeconds,
      0
    );

    // Separately fetch project records for non-null projectIds
    const projectIds = aggregates
      .map((a) => a.projectId)
      .filter((id): id is string => id !== null);

    const userProjects = await prisma.project.findMany({
      where: {
        userId,
        id: { in: projectIds },
      },
      select: {
        id: true,
        name: true,
        color: true,
        status: true,
      },
    });

    const projectMap = new Map(userProjects.map((p) => [p.id, p]));

    return aggregates.map((item) => {
      const percentage = calculateProjectPercentage(
        item.completedFocusSeconds,
        totalCompletedFocusSeconds
      );

      if (!item.projectId) {
        return {
          projectId: null,
          projectName: 'Unassigned',
          projectColor: null,
          isArchived: false,
          completedFocusSessions: item.completedFocusSessions,
          actualFocusSeconds: item.completedFocusSeconds,
          actualFocusMinutes: Math.floor(item.completedFocusSeconds / 60),
          sessionCount: item.totalSessions,
          percentage,
        };
      }

      const project = projectMap.get(item.projectId);
      return {
        projectId: item.projectId,
        projectName: project ? project.name : 'Unassigned',
        projectColor: project ? project.color : null,
        isArchived: project ? project.status === 'ARCHIVED' : false,
        completedFocusSessions: item.completedFocusSessions,
        actualFocusSeconds: item.completedFocusSeconds,
        actualFocusMinutes: Math.floor(item.completedFocusSeconds / 60),
        sessionCount: item.totalSessions,
        percentage,
      };
    });
  }

  /**
   * Retrieves focus session productivity statistics for a single task.
   */
  static async getTaskSummary(
    userId: string,
    taskId: string
  ): Promise<TaskProductivityResponse> {
    const task = await db.getTaskById(userId, taskId);
    if (!task) {
      throw new NotFoundError('Task not found or does not belong to you');
    }

    const aggregates = await db.getTaskProductivityAggregates(userId, taskId);

    return {
      taskId: task.id,
      taskTitle: task.title,
      completedPomodoros: task.completedPomodoros,
      completedFocusSessions: aggregates.completedFocusSessions,
      actualFocusSeconds: aggregates.completedFocusSeconds,
      actualFocusMinutes: Math.floor(aggregates.completedFocusSeconds / 60),
      lastFocusAt: aggregates.lastFocusAt ? aggregates.lastFocusAt.toISOString() : null,
    };
  }

  /**
   * Retrieves continuous day-by-day focus trend points within the specified period/range.
   * Fills missing days with 0 duration and 0 count. Defaults to 'week'.
   */
  static async getTrend(
    userId: string,
    query: ProductivitySummaryQuery = {}
  ): Promise<ProductivityTrendResponse> {
    const user = await db.getUserById(userId);
    if (!user) throw new NotFoundError('User');

    const userTimezone = user.timezone || 'UTC';
    const { startUtc, endUtcExclusive } = this.resolveBounds(
      query,
      userTimezone,
      'week'
    );

    const rawAggregates = await db.getProductivityTrend(
      userId,
      startUtc,
      endUtcExclusive,
      userTimezone
    );

    const aggMap = new Map<string, { seconds: number; count: number }>();
    for (const item of rawAggregates) {
      aggMap.set(item.date, {
        seconds: item.completedFocusSeconds,
        count: item.completedFocusSessions,
      });
    }

    const allDates = getContinuousLocalDateRange(startUtc, endUtcExclusive, userTimezone);

    let totalFocusSeconds = 0;
    const points: ProductivityTrendPoint[] = allDates.map((dateStr) => {
      const data = aggMap.get(dateStr);
      const focusSeconds = data ? data.seconds : 0;
      const completedSessions = data ? data.count : 0;
      totalFocusSeconds += focusSeconds;

      return {
        date: dateStr,
        focusSeconds,
        focusMinutes: Math.floor(focusSeconds / 60),
        completedSessions,
      };
    });

    const startDate = allDates.length > 0 ? allDates[0] : toLocalDateString(startUtc, userTimezone);
    const endDate =
      allDates.length > 0
        ? allDates[allDates.length - 1]
        : toLocalDateString(new Date(endUtcExclusive.getTime() - 1), userTimezone);

    return {
      period: query.period ?? (!query.date && !query.startDate ? 'week' : undefined),
      startDate,
      endDate,
      totalFocusSeconds,
      totalFocusMinutes: Math.floor(totalFocusSeconds / 60),
      points,
    };
  }
}

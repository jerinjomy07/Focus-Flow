// src/lib/db/productivity.ts
// FocusFlow — Productivity Database Aggregation Layer
//
// Direct PostgreSQL engine aggregations (COUNT, SUM, GROUP BY).
// Zero unbounded session loading into application memory.
// Leverages composite indexes: @@index([userId, startedAt]), @@index([userId, type, status]).

import { prisma } from './client';
import { toLocalDateString } from '@/domain/productivity/date-range';

export interface RawProductivityAggregates {
  completedFocusSeconds: number;
  completedFocusSessions: number;
  abandonedFocusSeconds: number;
  abandonedFocusSessions: number;
  skippedFocusSessions: number;
  completedBreakSeconds: number;
  completedBreakSessions: number;
  totalSessions: number;
}

export interface RawProjectAggregate {
  projectId: string | null;
  completedFocusSeconds: number;
  completedFocusSessions: number;
  totalSessions: number;
}

export interface RawTaskAggregate {
  taskId: string;
  completedFocusSeconds: number;
  completedFocusSessions: number;
  totalSessions: number;
  lastFocusAt: Date | null;
}

/**
 * Executes concurrent PostgreSQL aggregations for a specified half-open interval [startUtc, endUtcExclusive).
 * Memory footprint: scalar numbers. No raw session rows loaded into Node.js.
 */
export async function getProductivityAggregatesForRange(
  userId: string,
  startUtc: Date,
  endUtcExclusive: Date
): Promise<RawProductivityAggregates> {
  const dateFilter = {
    gte: startUtc,
    lt: endUtcExclusive,
  };

  const [
    completedFocusAgg,
    abandonedFocusAgg,
    skippedCount,
    completedBreakAgg,
    totalCount,
  ] = await Promise.all([
    // Completed FOCUS sessions
    prisma.focusSession.aggregate({
      where: {
        userId,
        startedAt: dateFilter,
        type: 'FOCUS',
        status: 'COMPLETED',
      },
      _sum: { actualDuration: true },
      _count: { id: true },
    }),

    // Abandoned FOCUS sessions
    prisma.focusSession.aggregate({
      where: {
        userId,
        startedAt: dateFilter,
        type: 'FOCUS',
        status: 'ABANDONED',
      },
      _sum: { actualDuration: true },
      _count: { id: true },
    }),

    // Skipped FOCUS sessions
    prisma.focusSession.count({
      where: {
        userId,
        startedAt: dateFilter,
        type: 'FOCUS',
        status: 'SKIPPED',
      },
    }),

    // Completed break sessions (SHORT_BREAK & LONG_BREAK)
    prisma.focusSession.aggregate({
      where: {
        userId,
        startedAt: dateFilter,
        type: { in: ['SHORT_BREAK', 'LONG_BREAK'] },
        status: 'COMPLETED',
      },
      _sum: { actualDuration: true },
      _count: { id: true },
    }),

    // Total sessions of any type/status in interval
    prisma.focusSession.count({
      where: {
        userId,
        startedAt: dateFilter,
      },
    }),
  ]);

  return {
    completedFocusSeconds: completedFocusAgg._sum.actualDuration ?? 0,
    completedFocusSessions: completedFocusAgg._count.id,
    abandonedFocusSeconds: abandonedFocusAgg._sum.actualDuration ?? 0,
    abandonedFocusSessions: abandonedFocusAgg._count.id,
    skippedFocusSessions: skippedCount,
    completedBreakSeconds: completedBreakAgg._sum.actualDuration ?? 0,
    completedBreakSessions: completedBreakAgg._count.id,
    totalSessions: totalCount,
  };
}

/**
 * Groups sessions by projectId in PostgreSQL to compute completed focus duration and total counts.
 */
export async function getProjectProductivityAggregates(
  userId: string,
  startUtc: Date,
  endUtcExclusive: Date
): Promise<RawProjectAggregate[]> {
  const dateFilter = {
    gte: startUtc,
    lt: endUtcExclusive,
  };

  const [completedGroups, allGroups] = await Promise.all([
    // Completed FOCUS sessions grouped by projectId
    prisma.focusSession.groupBy({
      by: ['projectId'],
      where: {
        userId,
        startedAt: dateFilter,
        type: 'FOCUS',
        status: 'COMPLETED',
      },
      _sum: { actualDuration: true },
      _count: { id: true },
    }),

    // All sessions in range grouped by projectId
    prisma.focusSession.groupBy({
      by: ['projectId'],
      where: {
        userId,
        startedAt: dateFilter,
      },
      _count: { id: true },
    }),
  ]);

  const totalMap = new Map<string | null, number>();
  for (const g of allGroups) {
    totalMap.set(g.projectId, g._count.id);
  }

  // Collect all project IDs that had sessions in this interval
  const allProjectKeys = new Set<string | null>();
  for (const g of allGroups) allProjectKeys.add(g.projectId);
  for (const g of completedGroups) allProjectKeys.add(g.projectId);

  const completedMap = new Map<string | null, { seconds: number; count: number }>();
  for (const g of completedGroups) {
    completedMap.set(g.projectId, {
      seconds: g._sum.actualDuration ?? 0,
      count: g._count.id,
    });
  }

  const results: RawProjectAggregate[] = [];
  for (const projectId of allProjectKeys) {
    const comp = completedMap.get(projectId) ?? { seconds: 0, count: 0 };
    results.push({
      projectId,
      completedFocusSeconds: comp.seconds,
      completedFocusSessions: comp.count,
      totalSessions: totalMap.get(projectId) ?? 0,
    });
  }

  return results.sort((a, b) => b.completedFocusSeconds - a.completedFocusSeconds);
}

/**
 * Aggregates focus stats for a single task in PostgreSQL.
 */
export async function getTaskProductivityAggregates(
  userId: string,
  taskId: string
): Promise<RawTaskAggregate> {
  const [completedAgg, totalCount, lastSession] = await Promise.all([
    prisma.focusSession.aggregate({
      where: {
        userId,
        taskId,
        type: 'FOCUS',
        status: 'COMPLETED',
      },
      _sum: { actualDuration: true },
      _count: { id: true },
    }),
    prisma.focusSession.count({
      where: {
        userId,
        taskId,
      },
    }),
    prisma.focusSession.findFirst({
      where: {
        userId,
        taskId,
      },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    }),
  ]);

  return {
    taskId,
    completedFocusSeconds: completedAgg._sum.actualDuration ?? 0,
    completedFocusSessions: completedAgg._count.id,
    totalSessions: totalCount,
    lastFocusAt: lastSession?.startedAt ?? null,
  };
}

export interface RawDailyTrendPoint {
  date: string; // "YYYY-MM-DD" in user's timezone
  completedFocusSeconds: number;
  completedFocusSessions: number;
}

/**
 * Queries completed FOCUS sessions within [startUtc, endUtcExclusive)
 * and groups actualDuration and session count by local calendar date in userTimezone.
 */
export async function getProductivityTrend(
  userId: string,
  startUtc: Date,
  endUtcExclusive: Date,
  userTimezone: string
): Promise<RawDailyTrendPoint[]> {
  const sessions = await prisma.focusSession.findMany({
    where: {
      userId,
      startedAt: {
        gte: startUtc,
        lt: endUtcExclusive,
      },
      type: 'FOCUS',
      status: 'COMPLETED',
    },
    select: {
      startedAt: true,
      actualDuration: true,
    },
  });

  const map = new Map<string, { seconds: number; count: number }>();
  for (const s of sessions) {
    const localDate = toLocalDateString(s.startedAt, userTimezone);
    const existing = map.get(localDate) ?? { seconds: 0, count: 0 };
    existing.seconds += s.actualDuration ?? 0;
    existing.count += 1;
    map.set(localDate, existing);
  }

  const results: RawDailyTrendPoint[] = [];
  for (const [date, val] of map.entries()) {
    results.push({
      date,
      completedFocusSeconds: val.seconds,
      completedFocusSessions: val.count,
    });
  }

  return results.sort((a, b) => a.date.localeCompare(b.date));
}

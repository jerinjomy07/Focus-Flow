// src/lib/db/analytics.ts
// FocusFlow — Advanced Analytics Database Layer (Phase 9)
//
// Direct PostgreSQL engine aggregations for analytics overview and temporal distributions.
// Leverages composite indexes: @@index([userId, startedAt]), @@index([userId, type, status]).
// Strictly enforces multi-tenant isolation by requiring userId on all queries.

import { prisma } from './client';
import { getProductivityAggregatesForRange } from './productivity';

export interface RawAnalyticsOverviewAggregates {
  completedFocusSeconds: number;
  completedFocusSessions: number;
  abandonedFocusSeconds: number;
  abandonedFocusSessions: number;
  longestCompletedSessionSeconds: number;
  totalBreakSeconds: number;
  totalSessions: number;
  activeFocusDays: number;
}

export interface RawWeekdayFocusAggregate {
  weekday: number; // 0 = Monday ... 6 = Sunday
  seconds: number;
  count: number;
}

export interface RawHourlyFocusAggregate {
  hour: number; // 0..23
  seconds: number;
  count: number;
}

/**
 * Computes analytics overview aggregates for a given time range [startUtc, endUtcExclusive).
 * Gathers core counts, durations, longest session, and distinct active calendar days.
 */
export async function getAnalyticsOverviewAggregates(
  userId: string,
  startUtc: Date,
  endUtcExclusive: Date,
  userTimezone: string
): Promise<RawAnalyticsOverviewAggregates> {
  const tz = userTimezone || 'UTC';
  const dateFilter = {
    gte: startUtc,
    lt: endUtcExclusive,
  };

  const [baseAggregates, longestSessionAgg, activeDaysRows] = await Promise.all([
    getProductivityAggregatesForRange(userId, startUtc, endUtcExclusive),

    prisma.focusSession.aggregate({
      where: {
        userId,
        startedAt: dateFilter,
        type: 'FOCUS',
        status: 'COMPLETED',
      },
      _max: { actualDuration: true },
    }),

    prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(DISTINCT DATE(timezone(${tz}, timezone('UTC', "startedAt"))))::int AS count
      FROM "FocusSession"
      WHERE "userId" = ${userId}
        AND "startedAt" >= ${startUtc}
        AND "startedAt" < ${endUtcExclusive}
        AND "type" = 'FOCUS'::"SessionType"
        AND "status" = 'COMPLETED'::"SessionStatus"
    `,
  ]);

  return {
    completedFocusSeconds: baseAggregates.completedFocusSeconds,
    completedFocusSessions: baseAggregates.completedFocusSessions,
    abandonedFocusSeconds: baseAggregates.abandonedFocusSeconds,
    abandonedFocusSessions: baseAggregates.abandonedFocusSessions,
    longestCompletedSessionSeconds: longestSessionAgg._max.actualDuration ?? 0,
    totalBreakSeconds: baseAggregates.completedBreakSeconds,
    totalSessions: baseAggregates.totalSessions,
    activeFocusDays: Number(activeDaysRows[0]?.count ?? 0),
  };
}

/**
 * Computes weekday distribution for completed FOCUS sessions in the user's timezone.
 * Weekdays are mapped to canonical 0 = Monday ... 6 = Sunday using PostgreSQL EXTRACT(ISODOW).
 */
export async function getWeekdayFocusAggregates(
  userId: string,
  startUtc: Date,
  endUtcExclusive: Date,
  userTimezone: string
): Promise<RawWeekdayFocusAggregate[]> {
  const tz = userTimezone || 'UTC';
  const rows = await prisma.$queryRaw<{ weekday: number; seconds: number; count: number }[]>`
    SELECT
      (EXTRACT(ISODOW FROM timezone(${tz}, timezone('UTC', "startedAt")))::int - 1) AS weekday,
      COALESCE(SUM(COALESCE("actualDuration", "plannedDuration", 0)), 0)::int AS seconds,
      COUNT(*)::int AS count
    FROM "FocusSession"
    WHERE "userId" = ${userId}
      AND "startedAt" >= ${startUtc}
      AND "startedAt" < ${endUtcExclusive}
      AND "type" = 'FOCUS'::"SessionType"
      AND "status" = 'COMPLETED'::"SessionStatus"
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  return rows.map((r) => ({
    weekday: Number(r.weekday),
    seconds: Number(r.seconds),
    count: Number(r.count),
  }));
}

/**
 * Computes 24-hour distribution (0..23) for completed FOCUS sessions in the user's timezone
 * using PostgreSQL EXTRACT(HOUR).
 */
export async function getHourlyFocusAggregates(
  userId: string,
  startUtc: Date,
  endUtcExclusive: Date,
  userTimezone: string
): Promise<RawHourlyFocusAggregate[]> {
  const tz = userTimezone || 'UTC';
  const rows = await prisma.$queryRaw<{ hour: number; seconds: number; count: number }[]>`
    SELECT
      EXTRACT(HOUR FROM timezone(${tz}, timezone('UTC', "startedAt")))::int AS hour,
      COALESCE(SUM(COALESCE("actualDuration", "plannedDuration", 0)), 0)::int AS seconds,
      COUNT(*)::int AS count
    FROM "FocusSession"
    WHERE "userId" = ${userId}
      AND "startedAt" >= ${startUtc}
      AND "startedAt" < ${endUtcExclusive}
      AND "type" = 'FOCUS'::"SessionType"
      AND "status" = 'COMPLETED'::"SessionStatus"
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  return rows.map((r) => ({
    hour: Number(r.hour),
    seconds: Number(r.seconds),
    count: Number(r.count),
  }));
}

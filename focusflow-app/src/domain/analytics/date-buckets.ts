// src/domain/analytics/date-buckets.ts
// FocusFlow — Temporal Bucketing Utilities for Advanced Analytics (Phase 9)

import type { WeekdayAnalyticsPoint, HourlyAnalyticsPoint } from './types';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/**
 * Generates an empty, zero-initialized array of 7 weekday analytics points (0 = Monday ... 6 = Sunday).
 */
export function getEmptyWeekdayBuckets(): WeekdayAnalyticsPoint[] {
  return WEEKDAY_LABELS.map((label, index) => ({
    weekday: index as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    label,
    completedFocusSeconds: 0,
    completedFocusMinutes: 0,
    completedSessions: 0,
    averageSessionSeconds: 0,
  }));
}

/**
 * Merges raw database weekday aggregates into the complete 7-day Monday-first sequence.
 */
export function fillWeekdayBuckets(
  rawPoints: Array<{ weekday: number; seconds: number; count: number }>
): WeekdayAnalyticsPoint[] {
  const buckets = getEmptyWeekdayBuckets();
  const rawMap = new Map<number, { seconds: number; count: number }>();

  for (const p of rawPoints) {
    rawMap.set(p.weekday, { seconds: p.seconds, count: p.count });
  }

  return buckets.map((bucket) => {
    const raw = rawMap.get(bucket.weekday);
    if (!raw) return bucket;

    const seconds = raw.seconds;
    const count = raw.count;
    return {
      ...bucket,
      completedFocusSeconds: seconds,
      completedFocusMinutes: Math.floor(seconds / 60),
      completedSessions: count,
      averageSessionSeconds: count > 0 ? Math.round(seconds / count) : 0,
    };
  });
}

/**
 * Generates an empty, zero-initialized array of 24 hourly analytics points (0 = 00:00 ... 23 = 23:00).
 */
export function getEmptyHourlyBuckets(): HourlyAnalyticsPoint[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00`,
    completedFocusSeconds: 0,
    completedFocusMinutes: 0,
    completedSessions: 0,
  }));
}

/**
 * Merges raw database hourly aggregates into the complete 24-hour sequence.
 */
export function fillHourlyBuckets(
  rawPoints: Array<{ hour: number; seconds: number; count: number }>
): HourlyAnalyticsPoint[] {
  const buckets = getEmptyHourlyBuckets();
  const rawMap = new Map<number, { seconds: number; count: number }>();

  for (const p of rawPoints) {
    rawMap.set(p.hour, { seconds: p.seconds, count: p.count });
  }

  return buckets.map((bucket) => {
    const raw = rawMap.get(bucket.hour);
    if (!raw) return bucket;

    const seconds = raw.seconds;
    return {
      ...bucket,
      completedFocusSeconds: seconds,
      completedFocusMinutes: Math.floor(seconds / 60),
      completedSessions: raw.count,
    };
  });
}

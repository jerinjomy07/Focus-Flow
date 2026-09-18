// src/domain/analytics/calculations.ts
// FocusFlow — Pure Analytics Calculation Domain Logic (Phase 9)
// Zero I/O — deterministic calculation functions for unit testing and analytical derivations.

import type {
  AnalyticsComparison,
  WeekdayAnalyticsPoint,
  HourlyAnalyticsPoint,
} from './types';

/**
 * Canonical consistency rate formula:
 * (activeFocusDays / totalCalendarDaysInRange) * 100
 *
 * Rules:
 * - activeFocusDays: local calendar days with >= 1 completed FOCUS session
 * - totalCalendarDaysInRange: all local calendar days in the period (including zero-session days)
 * - Returns 0 when totalCalendarDaysInRange is 0.
 */
export function calculateConsistencyRate(
  activeFocusDays: number,
  totalDaysInRange: number
): number {
  if (totalDaysInRange <= 0) return 0;
  return (activeFocusDays / totalDaysInRange) * 100;
}

/**
 * Computes period-over-period comparison metrics:
 * - absoluteDelta: currentValue - previousValue
 * - percentageDelta: ((currentValue - previousValue) / previousValue) * 100 (or null if previousValue === 0)
 * - direction: 'up' | 'down' | 'unchanged'
 */
export function calculateComparison(
  currentValue: number,
  previousValue: number
): AnalyticsComparison {
  const absoluteDelta = currentValue - previousValue;

  let percentageDelta: number | null = null;
  if (previousValue > 0) {
    percentageDelta = (absoluteDelta / previousValue) * 100;
  }

  let direction: 'up' | 'down' | 'unchanged' = 'unchanged';
  if (currentValue > previousValue) {
    direction = 'up';
  } else if (currentValue < previousValue) {
    direction = 'down';
  }

  return {
    currentValue,
    previousValue,
    absoluteDelta,
    percentageDelta,
    direction,
  };
}

/**
 * Computes average completed session duration in seconds.
 * Returns 0 when count is 0.
 */
export function calculateAverageDuration(
  totalSeconds: number,
  sessionCount: number
): number {
  if (sessionCount <= 0) return 0;
  return Math.round(totalSeconds / sessionCount);
}

/**
 * Deterministically identifies the peak focus weekday based on completedFocusSeconds.
 * Tie-breaker: Earliest weekday index (0 = Monday ... 6 = Sunday).
 * Returns null if all weekdays have 0 completed focus seconds.
 */
export function findPeakWeekday(
  weekdayPoints: WeekdayAnalyticsPoint[]
): WeekdayAnalyticsPoint | null {
  if (!weekdayPoints || weekdayPoints.length === 0) return null;

  const maxSeconds = Math.max(...weekdayPoints.map((p) => p.completedFocusSeconds));
  if (maxSeconds <= 0) return null;

  // Find first point matching maxSeconds (preserves canonical weekday order 0..6)
  return weekdayPoints.find((p) => p.completedFocusSeconds === maxSeconds) ?? null;
}

/**
 * Deterministically identifies the peak focus hour based on completedFocusSeconds.
 * Tie-breaker: Earliest hour (0 ... 23).
 * Returns null if all hours have 0 completed focus seconds.
 */
export function findPeakHour(
  hourlyPoints: HourlyAnalyticsPoint[]
): HourlyAnalyticsPoint | null {
  if (!hourlyPoints || hourlyPoints.length === 0) return null;

  const maxSeconds = Math.max(...hourlyPoints.map((p) => p.completedFocusSeconds));
  if (maxSeconds <= 0) return null;

  // Find first point matching maxSeconds (preserves canonical hour order 0..23)
  return hourlyPoints.find((p) => p.completedFocusSeconds === maxSeconds) ?? null;
}

// src/domain/productivity/date-range.ts
// FocusFlow — Productivity Date-Range & Timezone Calculations
//
// All calculations use the user's authoritative IANA timezone.
// Strictly implements half-open interval semantics: [startUtc, endUtcExclusive).
// All date-only inputs (YYYY-MM-DD) evaluate in User.timezone.
// Explicit ISO datetime offsets normalize to UTC instants without preserving original offset.
// Week boundaries start on Monday at 00:00:00.000 in User.timezone.
// Calendar month boundaries encompass [MonthStartUtc, NextMonthStartUtc).

import { ValidationError } from '@/lib/errors';
import type { DateRangeBoundsUtc, LocalPeriodBoundsUtc } from './types';

/**
 * Formats a Date into a "YYYY-MM-DD" string in the user's timezone.
 */
export function toLocalDateString(utcDate: Date, timezone: string): string {
  return utcDate.toLocaleDateString('en-CA', { timeZone: timezone });
}

/**
 * Canonical rule: A session belongs to the local calendar day
 * on which work started (startedAt), evaluated in User.timezone.
 */
export function getProductivityDay(startedAt: Date, timezone: string): string {
  return toLocalDateString(startedAt, timezone);
}

/**
 * Computes the exact UTC moment when the local clock in `timezone` strikes 00:00:00.000
 * on the specified calendar date. Handles day/month rollover and DST cleanly.
 */
export function getLocalMidnightUtc(
  year: number,
  month: number,
  day: number,
  timezone: string
): Date {
  const targetLocalMs = Date.UTC(year, month - 1, day, 0, 0, 0);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const getLocalMs = (ms: number): number => {
    const parts = formatter.formatToParts(new Date(ms));
    const p: Record<string, number> = {};
    for (const part of parts) {
      if (part.type !== 'literal') {
        p[part.type] = parseInt(part.value, 10);
      }
    }
    const h = p.hour === 24 ? 0 : p.hour;
    return Date.UTC(p.year, p.month - 1, p.day, h, p.minute, p.second);
  };

  let guessMs = targetLocalMs;
  let diff = targetLocalMs - getLocalMs(guessMs);
  guessMs += diff;
  diff = targetLocalMs - getLocalMs(guessMs);
  guessMs += diff;

  return new Date(guessMs);
}

/**
 * Returns half-open UTC bounds [startUtc, endUtcExclusive) for a local calendar day YYYY-MM-DD.
 */
export function getLocalDayBoundsUtc(
  localDateStr: string,
  timezone: string
): LocalPeriodBoundsUtc {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDateStr)) {
    throw new ValidationError(`Invalid date string: expected format YYYY-MM-DD, got "${localDateStr}"`);
  }

  const [year, month, day] = localDateStr.split('-').map(Number);
  const startUtc = getLocalMidnightUtc(year, month, day, timezone);
  const endUtcExclusive = getLocalMidnightUtc(year, month, day + 1, timezone);

  return {
    startUtc,
    endUtcExclusive,
    localDateStr,
  };
}

/**
 * Returns half-open UTC bounds [startUtc, endUtcExclusive) for predefined periods:
 * - 'today': current local day [TodayStartUtc, TomorrowStartUtc)
 * - 'yesterday': previous local day [YesterdayStartUtc, TodayStartUtc)
 * - 'week': Monday-based week [MondayStartUtc, NextMondayStartUtc)
 * - 'month': calendar month [MonthStartUtc, NextMonthStartUtc)
 */
export function getPeriodBoundsUtc(
  period: 'today' | 'yesterday' | 'week' | 'month',
  timezone: string,
  now: Date = new Date()
): LocalPeriodBoundsUtc {
  const localDateStr = toLocalDateString(now, timezone);
  const [year, month, day] = localDateStr.split('-').map(Number);

  if (period === 'today') {
    const startUtc = getLocalMidnightUtc(year, month, day, timezone);
    const endUtcExclusive = getLocalMidnightUtc(year, month, day + 1, timezone);
    return { startUtc, endUtcExclusive, localDateStr };
  }

  if (period === 'yesterday') {
    const startUtc = getLocalMidnightUtc(year, month, day - 1, timezone);
    const endUtcExclusive = getLocalMidnightUtc(year, month, day, timezone);
    const yesterdayStr = toLocalDateString(new Date(startUtc.getTime() + 12 * 3600 * 1000), timezone);
    return { startUtc, endUtcExclusive, localDateStr: yesterdayStr };
  }

  if (period === 'week') {
    // Determine weekday in timezone: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const dayOfWeek = probe.getUTCDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const startUtc = getLocalMidnightUtc(year, month, day - daysSinceMonday, timezone);
    const endUtcExclusive = getLocalMidnightUtc(year, month, day - daysSinceMonday + 7, timezone);
    const mondayStr = toLocalDateString(new Date(startUtc.getTime() + 12 * 3600 * 1000), timezone);
    return { startUtc, endUtcExclusive, localDateStr: mondayStr };
  }

  // period === 'month' (Calendar Month: 1st of current month to 1st of next month)
  const startUtc = getLocalMidnightUtc(year, month, 1, timezone);
  const endUtcExclusive = getLocalMidnightUtc(year, month + 1, 1, timezone);
  const monthStr = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
  return { startUtc, endUtcExclusive, localDateStr: monthStr };
}

/**
 * Normalizes date inputs into a UTC Date instant:
 * - Date-only (YYYY-MM-DD):
 *   - For startDate: start of that specified local calendar day at 00:00:00.000 in User.timezone.
 *   - For endDate: exclusive upper bound, start of following local calendar day at 00:00:00.000 in User.timezone.
 * - Explicit-offset ISO datetime:
 *   - Interpreted as the exact instant represented and normalized to a UTC Date.
 *   - The original textual offset is not retained as metadata.
 */
export function normalizeDateInput(
  value: string,
  isEndDate: boolean,
  timezone: string
): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    if (isEndDate) {
      return getLocalMidnightUtc(year, month, day + 1, timezone);
    }
    return getLocalMidnightUtc(year, month, day, timezone);
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new ValidationError(`Invalid date or timestamp: "${value}"`);
  }
  return date;
}

/**
 * Authoritative post-normalization range resolution:
 * Normalizes both boundaries and rejects with ValidationError if startUtc >= endUtcExclusive.
 */
export function resolveCustomRangeBounds(
  startDateStr: string | undefined,
  endDateStr: string | undefined,
  timezone: string
): DateRangeBoundsUtc {
  if (!startDateStr || !endDateStr) {
    throw new ValidationError(
      'Custom range mode requires both startDate and endDate',
      [{ field: !startDateStr ? 'startDate' : 'endDate', issue: 'REQUIRED_FIELD_MISSING' }]
    );
  }

  const startUtc = normalizeDateInput(startDateStr, false, timezone);
  const endUtcExclusive = normalizeDateInput(endDateStr, true, timezone);

  if (startUtc.getTime() >= endUtcExclusive.getTime()) {
    throw new ValidationError(
      'startDate must be chronologically before endDate',
      [{ field: 'startDate', issue: 'START_DATE_NOT_BEFORE_END_DATE' }]
    );
  }

  return { startUtc, endUtcExclusive };
}

/**
 * Returns an ordered array of continuous local calendar dates (YYYY-MM-DD)
 * spanning the half-open interval [startUtc, endUtcExclusive) in the specified timezone.
 * Handles DST shifts, month rollovers, and leap years cleanly without missing days.
 */
export function getContinuousLocalDateRange(
  startUtc: Date,
  endUtcExclusive: Date,
  timezone: string
): string[] {
  if (startUtc.getTime() >= endUtcExclusive.getTime()) {
    return [];
  }

  const dates: string[] = [];
  const firstDayStr = toLocalDateString(startUtc, timezone);
  let currentMidnight = getLocalDayBoundsUtc(firstDayStr, timezone).startUtc;

  while (currentMidnight.getTime() < endUtcExclusive.getTime()) {
    const dayStr = toLocalDateString(currentMidnight, timezone);
    dates.push(dayStr);
    const nextMidnight = getLocalDayBoundsUtc(dayStr, timezone).endUtcExclusive;
    // Safety check against infinite loop if midnight fails to advance
    if (nextMidnight.getTime() <= currentMidnight.getTime()) {
      break;
    }
    currentMidnight = nextMidnight;
  }

  return dates;
}

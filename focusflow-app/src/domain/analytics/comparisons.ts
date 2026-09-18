// src/domain/analytics/comparisons.ts
// FocusFlow — Comparison Interval Determination for Advanced Analytics (Phase 9)

import {
  getLocalMidnightUtc,
  getLocalDayBoundsUtc,
  toLocalDateString,
  getContinuousLocalDateRange,
} from '@/domain/productivity/date-range';
import type { ProductivitySummaryQuery } from '@/types/api';

export interface ComparisonPeriodBounds {
  prevStartUtc: Date;
  prevEndUtcExclusive: Date;
  prevStartDateStr: string;
  prevEndDateStr: string;
}

/**
 * Computes calendar day shifted by deltaDays in the user's timezone.
 */
function shiftLocalDateStr(dateStr: string, deltaDays: number, timezone: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const targetUtc = getLocalMidnightUtc(year, month, day + deltaDays, timezone);
  return toLocalDateString(targetUtc, timezone);
}

/**
 * Derives the preceding comparison interval for a given query and current bounds.
 *
 * Rules:
 * - Mode A (Single Day): Immediately preceding local calendar day.
 * - Mode B (Predefined):
 *   - 'today': Yesterday
 *   - 'yesterday': Day before yesterday
 *   - 'week': Preceding Monday-based week [PrevMonday, CurrentMonday)
 *   - 'month': Preceding full calendar month [PrevMonthStart, CurrentMonthStart)
 * - Mode C (Custom Range): Preceding range of identical calendar length immediately preceding startDate.
 */
export function getPreviousPeriodBounds(
  query: ProductivitySummaryQuery,
  timezone: string,
  currentStartUtc: Date,
  currentEndUtcExclusive: Date
): ComparisonPeriodBounds {
  // Mode A: Single Day
  if (query.date) {
    const prevDateStr = shiftLocalDateStr(query.date, -1, timezone);
    const bounds = getLocalDayBoundsUtc(prevDateStr, timezone);
    return {
      prevStartUtc: bounds.startUtc,
      prevEndUtcExclusive: bounds.endUtcExclusive,
      prevStartDateStr: prevDateStr,
      prevEndDateStr: prevDateStr,
    };
  }

  // Mode C: Custom Range
  if (query.startDate && query.endDate) {
    const currentDays = getContinuousLocalDateRange(
      currentStartUtc,
      currentEndUtcExclusive,
      timezone
    );
    const dayCount = Math.max(1, currentDays.length);

    const prevEndDateStr = shiftLocalDateStr(query.startDate, -1, timezone);
    const prevStartDateStr = shiftLocalDateStr(prevEndDateStr, -(dayCount - 1), timezone);

    const startBounds = getLocalDayBoundsUtc(prevStartDateStr, timezone);
    const endBounds = getLocalDayBoundsUtc(prevEndDateStr, timezone);

    return {
      prevStartUtc: startBounds.startUtc,
      prevEndUtcExclusive: endBounds.endUtcExclusive,
      prevStartDateStr,
      prevEndDateStr,
    };
  }

  // Mode B: Predefined Period (or default 'week')
  const period = query.period ?? 'week';

  if (period === 'today') {
    const todayStr = toLocalDateString(currentStartUtc, timezone);
    const prevDateStr = shiftLocalDateStr(todayStr, -1, timezone);
    const bounds = getLocalDayBoundsUtc(prevDateStr, timezone);
    return {
      prevStartUtc: bounds.startUtc,
      prevEndUtcExclusive: bounds.endUtcExclusive,
      prevStartDateStr: prevDateStr,
      prevEndDateStr: prevDateStr,
    };
  }

  if (period === 'yesterday') {
    const yesterdayStr = toLocalDateString(currentStartUtc, timezone);
    const prevDateStr = shiftLocalDateStr(yesterdayStr, -1, timezone);
    const bounds = getLocalDayBoundsUtc(prevDateStr, timezone);
    return {
      prevStartUtc: bounds.startUtc,
      prevEndUtcExclusive: bounds.endUtcExclusive,
      prevStartDateStr: prevDateStr,
      prevEndDateStr: prevDateStr,
    };
  }

  if (period === 'week') {
    // Current is Monday-based week [ThisMondayUtc, NextMondayUtc).
    // Previous is [LastMondayUtc, ThisMondayUtc).
    const currentMondayStr = toLocalDateString(currentStartUtc, timezone);
    const lastMondayStr = shiftLocalDateStr(currentMondayStr, -7, timezone);
    const lastSundayStr = shiftLocalDateStr(currentMondayStr, -1, timezone);

    const startBounds = getLocalDayBoundsUtc(lastMondayStr, timezone);
    const endBounds = getLocalDayBoundsUtc(lastSundayStr, timezone);

    return {
      prevStartUtc: startBounds.startUtc,
      prevEndUtcExclusive: endBounds.endUtcExclusive,
      prevStartDateStr: lastMondayStr,
      prevEndDateStr: lastSundayStr,
    };
  }

  // period === 'month'
  // Preceding calendar month
  const currentFirstStr = toLocalDateString(currentStartUtc, timezone);
  const [curYear, curMonth] = currentFirstStr.split('-').map(Number);

  // Month before current
  let prevMonth = curMonth - 1;
  let prevYear = curYear;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }

  const prevMonthStartUtc = getLocalMidnightUtc(prevYear, prevMonth, 1, timezone);
  const prevMonthEndUtcExclusive = currentStartUtc;

  const prevStartDateStr = toLocalDateString(prevMonthStartUtc, timezone);
  const prevEndDateStr = toLocalDateString(
    new Date(prevMonthEndUtcExclusive.getTime() - 1),
    timezone
  );

  return {
    prevStartUtc: prevMonthStartUtc,
    prevEndUtcExclusive: prevMonthEndUtcExclusive,
    prevStartDateStr,
    prevEndDateStr,
  };
}

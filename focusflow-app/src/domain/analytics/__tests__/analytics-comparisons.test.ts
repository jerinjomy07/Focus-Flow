// src/domain/analytics/__tests__/analytics-comparisons.test.ts
// FocusFlow — Unit tests for Phase 9 comparison interval determination

import { describe, it, expect } from 'vitest';
import { getPreviousPeriodBounds } from '../comparisons';
import {
  getLocalDayBoundsUtc,
  getPeriodBoundsUtc,
  resolveCustomRangeBounds,
} from '@/domain/productivity/date-range';

describe('Analytics Comparisons — getPreviousPeriodBounds', () => {
  const timezone = 'America/New_York';

  describe('Mode A: Single Day', () => {
    it('returns immediately preceding calendar day', () => {
      const dateStr = '2026-09-17';
      const current = getLocalDayBoundsUtc(dateStr, timezone);
      const prev = getPreviousPeriodBounds({ date: dateStr }, timezone, current.startUtc, current.endUtcExclusive);

      expect(prev.prevStartDateStr).toBe('2026-09-16');
      expect(prev.prevEndDateStr).toBe('2026-09-16');

      const expectedBounds = getLocalDayBoundsUtc('2026-09-16', timezone);
      expect(prev.prevStartUtc.toISOString()).toBe(expectedBounds.startUtc.toISOString());
      expect(prev.prevEndUtcExclusive.toISOString()).toBe(expectedBounds.endUtcExclusive.toISOString());
    });

    it('handles month boundary correctly', () => {
      const dateStr = '2026-10-01';
      const current = getLocalDayBoundsUtc(dateStr, timezone);
      const prev = getPreviousPeriodBounds({ date: dateStr }, timezone, current.startUtc, current.endUtcExclusive);

      expect(prev.prevStartDateStr).toBe('2026-09-30');
      expect(prev.prevEndDateStr).toBe('2026-09-30');
    });
  });

  describe('Mode B: Predefined Periods', () => {
    const fixedNow = new Date('2026-09-17T14:30:00Z'); // Thursday in America/New_York

    it('today compares against yesterday', () => {
      const current = getPeriodBoundsUtc('today', timezone, fixedNow);
      const prev = getPreviousPeriodBounds({ period: 'today' }, timezone, current.startUtc, current.endUtcExclusive);

      expect(prev.prevStartDateStr).toBe('2026-09-16');
      expect(prev.prevEndDateStr).toBe('2026-09-16');
      const expectedYesterday = getLocalDayBoundsUtc('2026-09-16', timezone);
      expect(prev.prevStartUtc.toISOString()).toBe(expectedYesterday.startUtc.toISOString());
      expect(prev.prevEndUtcExclusive.toISOString()).toBe(expectedYesterday.endUtcExclusive.toISOString());
    });

    it('yesterday compares against day before yesterday', () => {
      const current = getPeriodBoundsUtc('yesterday', timezone, fixedNow);
      const prev = getPreviousPeriodBounds({ period: 'yesterday' }, timezone, current.startUtc, current.endUtcExclusive);

      expect(prev.prevStartDateStr).toBe('2026-09-15');
      expect(prev.prevEndDateStr).toBe('2026-09-15');
    });

    it('week compares against preceding full Monday-based week', () => {
      // 2026-09-17 is Thursday. This week: 2026-09-14 (Mon) .. 2026-09-20 (Sun).
      // Preceding week: 2026-09-07 (Mon) .. 2026-09-13 (Sun).
      const current = getPeriodBoundsUtc('week', timezone, fixedNow);
      const prev = getPreviousPeriodBounds({ period: 'week' }, timezone, current.startUtc, current.endUtcExclusive);

      expect(prev.prevStartDateStr).toBe('2026-09-07');
      expect(prev.prevEndDateStr).toBe('2026-09-13');
      expect(prev.prevEndUtcExclusive.toISOString()).toBe(current.startUtc.toISOString());
    });

    it('month compares against preceding full calendar month', () => {
      // 2026-09-17 is September. Previous month is 2026-08-01 .. 2026-08-31.
      const current = getPeriodBoundsUtc('month', timezone, fixedNow);
      const prev = getPreviousPeriodBounds({ period: 'month' }, timezone, current.startUtc, current.endUtcExclusive);

      expect(prev.prevStartDateStr).toBe('2026-08-01');
      expect(prev.prevEndDateStr).toBe('2026-08-31');
      expect(prev.prevEndUtcExclusive.toISOString()).toBe(current.startUtc.toISOString());
    });
  });

  describe('Mode C: Custom Range', () => {
    it('compares against preceding range of identical calendar length immediately prior to startDate', () => {
      // Current range: 2026-09-10 to 2026-09-16 (7 days inclusive)
      const query = { startDate: '2026-09-10', endDate: '2026-09-16' };
      const current = resolveCustomRangeBounds(query.startDate, query.endDate, timezone);
      const prev = getPreviousPeriodBounds(query, timezone, current.startUtc, current.endUtcExclusive);

      // Preceding 7 days: 2026-09-03 to 2026-09-09
      expect(prev.prevStartDateStr).toBe('2026-09-03');
      expect(prev.prevEndDateStr).toBe('2026-09-09');
      expect(prev.prevEndUtcExclusive.toISOString()).toBe(current.startUtc.toISOString());
    });

    it('handles single-day custom range', () => {
      const query = { startDate: '2026-09-15', endDate: '2026-09-15' };
      const current = resolveCustomRangeBounds(query.startDate, query.endDate, timezone);
      const prev = getPreviousPeriodBounds(query, timezone, current.startUtc, current.endUtcExclusive);

      expect(prev.prevStartDateStr).toBe('2026-09-14');
      expect(prev.prevEndDateStr).toBe('2026-09-14');
      expect(prev.prevEndUtcExclusive.toISOString()).toBe(current.startUtc.toISOString());
    });
  });
});

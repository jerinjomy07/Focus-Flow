// src/domain/productivity/__tests__/date-range.test.ts
// FocusFlow — Productivity Date-Range Unit Tests

import { describe, it, expect } from 'vitest';
import {
  getProductivityDay,
  toLocalDateString,
  getLocalDayBoundsUtc,
  getPeriodBoundsUtc,
  normalizeDateInput,
  resolveCustomRangeBounds,
} from '../date-range';
import { ValidationError } from '@/lib/errors';

describe('Productivity Date-Range & Timezone Domain Logic', () => {
  describe('Productivity Day Attribution', () => {
    it('attributes a session to the calendar day it started in the user timezone', () => {
      // 2026-09-17 19:30 UTC is 2026-09-17 15:30 in America/New_York (EDT, UTC-4)
      const dateNY = new Date('2026-09-17T19:30:00.000Z');
      expect(getProductivityDay(dateNY, 'America/New_York')).toBe('2026-09-17');

      // 2026-09-17 19:30 UTC is 2026-09-18 01:00 in Asia/Kolkata (IST, UTC+5:30)
      expect(getProductivityDay(dateNY, 'Asia/Kolkata')).toBe('2026-09-18');
    });

    it('attributes midnight-crossing sessions to the START day', () => {
      // User starts at 23:55 local time (2026-09-17) and completes at 00:20 next day
      // In New York (EDT, UTC-4): 23:55 EDT is 2026-09-18 03:55 UTC
      const startedAt = new Date('2026-09-18T03:55:00.000Z');
      expect(getProductivityDay(startedAt, 'America/New_York')).toBe('2026-09-17');
    });

    it('dynamically re-evaluates historical sessions when timezone changes', () => {
      const sessionUtc = new Date('2026-09-17T23:00:00.000Z');
      // In UTC: 2026-09-17
      expect(getProductivityDay(sessionUtc, 'UTC')).toBe('2026-09-17');
      // In America/New_York (UTC-4): 19:00 -> 2026-09-17
      expect(getProductivityDay(sessionUtc, 'America/New_York')).toBe('2026-09-17');
      // In Asia/Kolkata (UTC+5:30): 04:30 next morning -> 2026-09-18
      expect(getProductivityDay(sessionUtc, 'Asia/Kolkata')).toBe('2026-09-18');
      // In Pacific/Auckland (UTC+12): 11:00 next morning -> 2026-09-18
      expect(getProductivityDay(sessionUtc, 'Pacific/Auckland')).toBe('2026-09-18');
    });
  });

  describe('Half-Open Boundary Semantics [startUtc, endUtcExclusive)', () => {
    const timezones = [
      'America/New_York',
      'Asia/Kolkata',
      'Europe/London',
      'Pacific/Auckland',
      'UTC',
    ];

    it.each(timezones)('generates valid half-open bounds in %s', (tz) => {
      const bounds = getLocalDayBoundsUtc('2026-09-17', tz);
      expect(bounds.startUtc.getTime()).toBeLessThan(bounds.endUtcExclusive.getTime());

      // Start must format to 00:00:00 in tz (handling both h23 and legacy representations)
      const startLocalTime = bounds.startUtc.toLocaleTimeString('en-US', {
        timeZone: tz,
        hour12: false,
        hourCycle: 'h23',
      });
      expect(['00:00:00', '24:00:00']).toContain(startLocalTime);

      // 1 millisecond before start is previous day in tz
      const oneMsBeforeStart = new Date(bounds.startUtc.getTime() - 1);
      expect(toLocalDateString(oneMsBeforeStart, tz)).toBe('2026-09-16');

      // Exact start is today in tz
      expect(toLocalDateString(bounds.startUtc, tz)).toBe('2026-09-17');

      // 1 millisecond before endUtcExclusive is still today in tz
      const oneMsBeforeEnd = new Date(bounds.endUtcExclusive.getTime() - 1);
      expect(toLocalDateString(oneMsBeforeEnd, tz)).toBe('2026-09-17');

      // Exact endUtcExclusive is tomorrow in tz
      expect(toLocalDateString(bounds.endUtcExclusive, tz)).toBe('2026-09-18');
    });

    it('rejects invalid local date format', () => {
      expect(() => getLocalDayBoundsUtc('2026/09/17', 'UTC')).toThrow(ValidationError);
      expect(() => getLocalDayBoundsUtc('invalid', 'UTC')).toThrow(ValidationError);
    });
  });

  describe('Monday-Based Week Boundaries', () => {
    it('calculates [MondayStartUtc, NextMondayStartUtc) for a regular week', () => {
      // 2026-09-17 is a Thursday
      const now = new Date('2026-09-17T12:00:00.000Z');
      const bounds = getPeriodBoundsUtc('week', 'America/New_York', now);

      // Monday of this week in NY is 2026-09-14
      expect(toLocalDateString(bounds.startUtc, 'America/New_York')).toBe('2026-09-14');
      // Next Monday in NY is 2026-09-21
      expect(toLocalDateString(bounds.endUtcExclusive, 'America/New_York')).toBe('2026-09-21');
      // Exactly 7 days (168 hours) in non-DST transition week
      expect(bounds.endUtcExclusive.getTime() - bounds.startUtc.getTime()).toBe(7 * 24 * 3600 * 1000);
    });

    it('handles week crossing spring forward DST (167 hours)', () => {
      // In America/New_York, DST starts Sunday March 8, 2026 (clock jumps 2:00 to 3:00)
      // Monday March 2 to Monday March 9
      const now = new Date('2026-03-05T12:00:00.000Z');
      const bounds = getPeriodBoundsUtc('week', 'America/New_York', now);

      expect(toLocalDateString(bounds.startUtc, 'America/New_York')).toBe('2026-03-02');
      expect(toLocalDateString(bounds.endUtcExclusive, 'America/New_York')).toBe('2026-03-09');
      // 167 hours due to spring forward
      expect(bounds.endUtcExclusive.getTime() - bounds.startUtc.getTime()).toBe(167 * 3600 * 1000);
    });

    it('handles week crossing fall back DST (169 hours)', () => {
      // In America/New_York, DST ends Sunday November 1, 2026 (clock repeats 1:00 to 2:00)
      // Monday October 26 to Monday November 2
      const now = new Date('2026-10-28T12:00:00.000Z');
      const bounds = getPeriodBoundsUtc('week', 'America/New_York', now);

      expect(toLocalDateString(bounds.startUtc, 'America/New_York')).toBe('2026-10-26');
      expect(toLocalDateString(bounds.endUtcExclusive, 'America/New_York')).toBe('2026-11-02');
      // 169 hours due to fall back
      expect(bounds.endUtcExclusive.getTime() - bounds.startUtc.getTime()).toBe(169 * 3600 * 1000);
    });
  });

  describe('Calendar Month Boundaries', () => {
    it('calculates 28 days for non-leap February (2025)', () => {
      const now = new Date('2025-02-15T12:00:00.000Z');
      const bounds = getPeriodBoundsUtc('month', 'UTC', now);

      expect(toLocalDateString(bounds.startUtc, 'UTC')).toBe('2025-02-01');
      expect(toLocalDateString(bounds.endUtcExclusive, 'UTC')).toBe('2025-03-01');
      expect((bounds.endUtcExclusive.getTime() - bounds.startUtc.getTime()) / (24 * 3600 * 1000)).toBe(28);
    });

    it('calculates 29 days for leap year February (2024)', () => {
      const now = new Date('2024-02-15T12:00:00.000Z');
      const bounds = getPeriodBoundsUtc('month', 'UTC', now);

      expect(toLocalDateString(bounds.startUtc, 'UTC')).toBe('2024-02-01');
      expect(toLocalDateString(bounds.endUtcExclusive, 'UTC')).toBe('2024-03-01');
      expect((bounds.endUtcExclusive.getTime() - bounds.startUtc.getTime()) / (24 * 3600 * 1000)).toBe(29);
    });

    it('calculates 30 days for 30-day month (September 2026)', () => {
      const now = new Date('2026-09-17T12:00:00.000Z');
      const bounds = getPeriodBoundsUtc('month', 'America/New_York', now);

      expect(toLocalDateString(bounds.startUtc, 'America/New_York')).toBe('2026-09-01');
      expect(toLocalDateString(bounds.endUtcExclusive, 'America/New_York')).toBe('2026-10-01');
      expect((bounds.endUtcExclusive.getTime() - bounds.startUtc.getTime()) / (24 * 3600 * 1000)).toBe(30);
    });

    it('calculates 31 days for 31-day month (October 2026)', () => {
      const now = new Date('2026-10-15T12:00:00.000Z');
      const bounds = getPeriodBoundsUtc('month', 'UTC', now);

      expect(toLocalDateString(bounds.startUtc, 'UTC')).toBe('2026-10-01');
      expect(toLocalDateString(bounds.endUtcExclusive, 'UTC')).toBe('2026-11-01');
      expect((bounds.endUtcExclusive.getTime() - bounds.startUtc.getTime()) / (24 * 3600 * 1000)).toBe(31);
    });

    it('handles month boundary crossing DST correctly', () => {
      // March 2026 in New York has DST transition on March 8
      const now = new Date('2026-03-15T12:00:00.000Z');
      const bounds = getPeriodBoundsUtc('month', 'America/New_York', now);

      expect(toLocalDateString(bounds.startUtc, 'America/New_York')).toBe('2026-03-01');
      expect(toLocalDateString(bounds.endUtcExclusive, 'America/New_York')).toBe('2026-04-01');
      // March starts at 05:00 UTC (standard time) and April starts at 04:00 UTC (daylight saving time)
      expect(bounds.startUtc.toISOString()).toBe('2026-03-01T05:00:00.000Z');
      expect(bounds.endUtcExclusive.toISOString()).toBe('2026-04-01T04:00:00.000Z');
      // Exactly 31 days minus 1 hour = 743 hours
      expect(bounds.endUtcExclusive.getTime() - bounds.startUtc.getTime()).toBe(743 * 3600 * 1000);
    });
  });

  describe('Date Input Normalization & Post-Normalization Validation', () => {
    it('normalizes date-only input (YYYY-MM-DD) into whole local day bounds', () => {
      const start = normalizeDateInput('2026-09-17', false, 'America/New_York');
      const end = normalizeDateInput('2026-09-17', true, 'America/New_York');

      expect(start.toISOString()).toBe('2026-09-17T04:00:00.000Z'); // 00:00 EDT
      expect(end.toISOString()).toBe('2026-09-18T04:00:00.000Z');   // 00:00 EDT next day
    });

    it('normalizes explicit ISO datetime offsets to exact UTC instants', () => {
      const instant1 = normalizeDateInput('2026-09-17T14:30:00.000Z', false, 'America/New_York');
      const instant2 = normalizeDateInput('2026-09-17T10:30:00.000-04:00', false, 'America/New_York');

      // Both represent the exact same UTC instant
      expect(instant1.getTime()).toBe(instant2.getTime());
      expect(instant1.toISOString()).toBe('2026-09-17T14:30:00.000Z');
    });

    it('validates custom range post-normalization (startUtc < endUtcExclusive)', () => {
      const bounds = resolveCustomRangeBounds('2026-09-01', '2026-09-17', 'America/New_York');
      expect(bounds.startUtc.toISOString()).toBe('2026-09-01T04:00:00.000Z');
      expect(bounds.endUtcExclusive.toISOString()).toBe('2026-09-18T04:00:00.000Z');
    });

    it('rejects chronologically reversed range post-normalization', () => {
      expect(() =>
        resolveCustomRangeBounds('2026-09-17', '2026-09-01', 'America/New_York')
      ).toThrow(ValidationError);
    });

    it('rejects equal instants when supplied as custom range', () => {
      expect(() =>
        resolveCustomRangeBounds(
          '2026-09-17T14:00:00Z',
          '2026-09-17T10:00:00-04:00', // same instant!
          'UTC'
        )
      ).toThrow(ValidationError);
    });

    it('rejects when only one custom range boundary is supplied', () => {
      expect(() => resolveCustomRangeBounds('2026-09-17', undefined, 'UTC')).toThrow(ValidationError);
      expect(() => resolveCustomRangeBounds(undefined, '2026-09-17', 'UTC')).toThrow(ValidationError);
    });
  });
});

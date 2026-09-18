// src/domain/analytics/__tests__/analytics-date-buckets.test.ts
// FocusFlow — Unit tests for Phase 9 temporal bucketing

import { describe, it, expect } from 'vitest';
import {
  getEmptyWeekdayBuckets,
  fillWeekdayBuckets,
  getEmptyHourlyBuckets,
  fillHourlyBuckets,
} from '../date-buckets';

describe('Analytics Date Buckets', () => {
  describe('Weekday Buckets', () => {
    it('generates 7 zero-initialized buckets starting Monday (0) through Sunday (6)', () => {
      const buckets = getEmptyWeekdayBuckets();
      expect(buckets).toHaveLength(7);

      const expectedLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      buckets.forEach((b, idx) => {
        expect(b.weekday).toBe(idx);
        expect(b.label).toBe(expectedLabels[idx]);
        expect(b.completedFocusSeconds).toBe(0);
        expect(b.completedFocusMinutes).toBe(0);
        expect(b.completedSessions).toBe(0);
        expect(b.averageSessionSeconds).toBe(0);
      });
    });

    it('merges raw database rows into complete 7-day array and preserves empty days', () => {
      const raw = [
        { weekday: 0, seconds: 3000, count: 2 }, // Monday: 3000s, 2 sessions -> avg 1500s
        { weekday: 2, seconds: 1800, count: 1 }, // Wednesday: 1800s, 1 session -> avg 1800s
        { weekday: 4, seconds: 7200, count: 4 }, // Friday: 7200s, 4 sessions -> avg 1800s
      ];

      const merged = fillWeekdayBuckets(raw);
      expect(merged).toHaveLength(7);

      // Mon (0)
      expect(merged[0].completedFocusSeconds).toBe(3000);
      expect(merged[0].completedFocusMinutes).toBe(50);
      expect(merged[0].completedSessions).toBe(2);
      expect(merged[0].averageSessionSeconds).toBe(1500);

      // Tue (1) - untouched
      expect(merged[1].completedFocusSeconds).toBe(0);
      expect(merged[1].completedSessions).toBe(0);

      // Wed (2)
      expect(merged[2].completedFocusSeconds).toBe(1800);
      expect(merged[2].completedFocusMinutes).toBe(30);
      expect(merged[2].completedSessions).toBe(1);
      expect(merged[2].averageSessionSeconds).toBe(1800);

      // Thu (3) - untouched
      expect(merged[3].completedFocusSeconds).toBe(0);

      // Fri (4)
      expect(merged[4].completedFocusSeconds).toBe(7200);
      expect(merged[4].completedFocusMinutes).toBe(120);
      expect(merged[4].completedSessions).toBe(4);
      expect(merged[4].averageSessionSeconds).toBe(1800);

      // Sat (5), Sun (6) - untouched
      expect(merged[5].completedSessions).toBe(0);
      expect(merged[6].completedSessions).toBe(0);
    });
  });

  describe('Hourly Buckets', () => {
    it('generates 24 zero-initialized buckets from 00:00 through 23:00', () => {
      const buckets = getEmptyHourlyBuckets();
      expect(buckets).toHaveLength(24);

      buckets.forEach((b, idx) => {
        expect(b.hour).toBe(idx);
        expect(b.label).toBe(`${String(idx).padStart(2, '0')}:00`);
        expect(b.completedFocusSeconds).toBe(0);
        expect(b.completedFocusMinutes).toBe(0);
        expect(b.completedSessions).toBe(0);
      });
    });

    it('merges raw database rows into complete 24-hour array and preserves empty hours', () => {
      const raw = [
        { hour: 9, seconds: 1500, count: 1 },
        { hour: 10, seconds: 3000, count: 2 },
        { hour: 14, seconds: 4500, count: 3 },
      ];

      const merged = fillHourlyBuckets(raw);
      expect(merged).toHaveLength(24);

      expect(merged[9].completedFocusSeconds).toBe(1500);
      expect(merged[9].completedFocusMinutes).toBe(25);
      expect(merged[9].completedSessions).toBe(1);

      expect(merged[10].completedFocusSeconds).toBe(3000);
      expect(merged[10].completedFocusMinutes).toBe(50);
      expect(merged[10].completedSessions).toBe(2);

      expect(merged[14].completedFocusSeconds).toBe(4500);
      expect(merged[14].completedFocusMinutes).toBe(75);
      expect(merged[14].completedSessions).toBe(3);

      expect(merged[0].completedFocusSeconds).toBe(0);
      expect(merged[12].completedFocusSeconds).toBe(0);
      expect(merged[23].completedFocusSeconds).toBe(0);
    });
  });
});

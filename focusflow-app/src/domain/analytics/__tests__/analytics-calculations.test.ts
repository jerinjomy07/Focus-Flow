// src/domain/analytics/__tests__/analytics-calculations.test.ts
// FocusFlow — Unit tests for Phase 9 analytics calculations

import { describe, it, expect } from 'vitest';
import {
  calculateConsistencyRate,
  calculateComparison,
  calculateAverageDuration,
  findPeakWeekday,
  findPeakHour,
} from '../calculations';
import type { WeekdayAnalyticsPoint, HourlyAnalyticsPoint } from '../types';

describe('Analytics Calculations', () => {
  describe('calculateConsistencyRate', () => {
    it('returns 0 when totalDaysInRange is 0 or negative', () => {
      expect(calculateConsistencyRate(0, 0)).toBe(0);
      expect(calculateConsistencyRate(5, -1)).toBe(0);
    });

    it('returns 0 when activeFocusDays is 0', () => {
      expect(calculateConsistencyRate(0, 7)).toBe(0);
    });

    it('returns 100 when all days in range had focus sessions', () => {
      expect(calculateConsistencyRate(7, 7)).toBe(100);
      expect(calculateConsistencyRate(30, 30)).toBe(100);
    });

    it('returns exact unrounded float for fractional percentages', () => {
      const rate = calculateConsistencyRate(3, 7);
      expect(rate).toBeCloseTo(42.857, 3);
      expect(rate).toBe((3 / 7) * 100);
    });
  });

  describe('calculateComparison', () => {
    it('calculates increase correctly (current > previous)', () => {
      const comp = calculateComparison(150, 100);
      expect(comp.currentValue).toBe(150);
      expect(comp.previousValue).toBe(100);
      expect(comp.absoluteDelta).toBe(50);
      expect(comp.percentageDelta).toBe(50);
      expect(comp.direction).toBe('up');
    });

    it('calculates decrease correctly (current < previous)', () => {
      const comp = calculateComparison(75, 100);
      expect(comp.currentValue).toBe(75);
      expect(comp.previousValue).toBe(100);
      expect(comp.absoluteDelta).toBe(-25);
      expect(comp.percentageDelta).toBe(-25);
      expect(comp.direction).toBe('down');
    });

    it('handles unchanged values', () => {
      const comp = calculateComparison(100, 100);
      expect(comp.currentValue).toBe(100);
      expect(comp.previousValue).toBe(100);
      expect(comp.absoluteDelta).toBe(0);
      expect(comp.percentageDelta).toBe(0);
      expect(comp.direction).toBe('unchanged');
    });

    it('returns percentageDelta = null when previousValue is 0 (avoids division by zero)', () => {
      const comp = calculateComparison(50, 0);
      expect(comp.currentValue).toBe(50);
      expect(comp.previousValue).toBe(0);
      expect(comp.absoluteDelta).toBe(50);
      expect(comp.percentageDelta).toBeNull();
      expect(comp.direction).toBe('up');
    });

    it('returns percentageDelta = null and unchanged direction when both are 0', () => {
      const comp = calculateComparison(0, 0);
      expect(comp.currentValue).toBe(0);
      expect(comp.previousValue).toBe(0);
      expect(comp.absoluteDelta).toBe(0);
      expect(comp.percentageDelta).toBeNull();
      expect(comp.direction).toBe('unchanged');
    });
  });

  describe('calculateAverageDuration', () => {
    it('returns 0 when sessionCount is 0 or negative', () => {
      expect(calculateAverageDuration(1000, 0)).toBe(0);
      expect(calculateAverageDuration(1000, -2)).toBe(0);
    });

    it('returns rounded average seconds when sessionCount > 0', () => {
      expect(calculateAverageDuration(3000, 2)).toBe(1500);
      expect(calculateAverageDuration(100, 3)).toBe(33);
      expect(calculateAverageDuration(200, 3)).toBe(67);
    });
  });

  describe('findPeakWeekday', () => {
    it('returns null for empty array', () => {
      expect(findPeakWeekday([])).toBeNull();
    });

    it('returns null when all weekdays have 0 completedFocusSeconds', () => {
      const points: WeekdayAnalyticsPoint[] = [
        { weekday: 0, label: 'Mon', completedFocusSeconds: 0, completedFocusMinutes: 0, completedSessions: 0, averageSessionSeconds: 0 },
        { weekday: 1, label: 'Tue', completedFocusSeconds: 0, completedFocusMinutes: 0, completedSessions: 0, averageSessionSeconds: 0 },
      ];
      expect(findPeakWeekday(points)).toBeNull();
    });

    it('returns point with maximum completedFocusSeconds', () => {
      const points: WeekdayAnalyticsPoint[] = [
        { weekday: 0, label: 'Mon', completedFocusSeconds: 1200, completedFocusMinutes: 20, completedSessions: 1, averageSessionSeconds: 1200 },
        { weekday: 1, label: 'Tue', completedFocusSeconds: 3600, completedFocusMinutes: 60, completedSessions: 2, averageSessionSeconds: 1800 },
        { weekday: 2, label: 'Wed', completedFocusSeconds: 1800, completedFocusMinutes: 30, completedSessions: 1, averageSessionSeconds: 1800 },
      ];
      const peak = findPeakWeekday(points);
      expect(peak).not.toBeNull();
      expect(peak?.weekday).toBe(1);
      expect(peak?.label).toBe('Tue');
      expect(peak?.completedFocusSeconds).toBe(3600);
    });

    it('breaks ties by selecting the earliest weekday in canonical Monday-first order', () => {
      const points: WeekdayAnalyticsPoint[] = [
        { weekday: 0, label: 'Mon', completedFocusSeconds: 3600, completedFocusMinutes: 60, completedSessions: 2, averageSessionSeconds: 1800 },
        { weekday: 1, label: 'Tue', completedFocusSeconds: 1200, completedFocusMinutes: 20, completedSessions: 1, averageSessionSeconds: 1200 },
        { weekday: 2, label: 'Wed', completedFocusSeconds: 3600, completedFocusMinutes: 60, completedSessions: 2, averageSessionSeconds: 1800 },
      ];
      const peak = findPeakWeekday(points);
      expect(peak?.weekday).toBe(0); // Monday chosen over Wednesday
    });
  });

  describe('findPeakHour', () => {
    it('returns null for empty array', () => {
      expect(findPeakHour([])).toBeNull();
    });

    it('returns null when all hours have 0 completedFocusSeconds', () => {
      const points: HourlyAnalyticsPoint[] = [
        { hour: 9, label: '09:00', completedFocusSeconds: 0, completedFocusMinutes: 0, completedSessions: 0 },
        { hour: 10, label: '10:00', completedFocusSeconds: 0, completedFocusMinutes: 0, completedSessions: 0 },
      ];
      expect(findPeakHour(points)).toBeNull();
    });

    it('returns point with maximum completedFocusSeconds', () => {
      const points: HourlyAnalyticsPoint[] = [
        { hour: 9, label: '09:00', completedFocusSeconds: 1500, completedFocusMinutes: 25, completedSessions: 1 },
        { hour: 10, label: '10:00', completedFocusSeconds: 3000, completedFocusMinutes: 50, completedSessions: 2 },
        { hour: 11, label: '11:00', completedFocusSeconds: 1200, completedFocusMinutes: 20, completedSessions: 1 },
      ];
      const peak = findPeakHour(points);
      expect(peak).not.toBeNull();
      expect(peak?.hour).toBe(10);
      expect(peak?.label).toBe('10:00');
      expect(peak?.completedFocusSeconds).toBe(3000);
    });

    it('breaks ties by selecting the earliest hour in canonical 0..23 order', () => {
      const points: HourlyAnalyticsPoint[] = [
        { hour: 9, label: '09:00', completedFocusSeconds: 3000, completedFocusMinutes: 50, completedSessions: 2 },
        { hour: 14, label: '14:00', completedFocusSeconds: 3000, completedFocusMinutes: 50, completedSessions: 2 },
      ];
      const peak = findPeakHour(points);
      expect(peak?.hour).toBe(9); // 09:00 chosen over 14:00
    });
  });
});

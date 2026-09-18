// src/domain/timer/__tests__/cycle.test.ts
// Unit tests for Pomodoro cycle progression and duration logic

import { describe, it, expect } from 'vitest';
import {
  getPlannedDurationSeconds,
  isLongBreakNext,
  getNextCycleSession,
  type TimerCycleSettings,
} from '../cycle';

describe('Timer Domain — Cycle Progression (cycle.ts)', () => {
  const settings: TimerCycleSettings = {
    focusDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    sessionsBeforeLongBreak: 4,
  };

  describe('getPlannedDurationSeconds', () => {
    it('returns duration in seconds for FOCUS', () => {
      expect(getPlannedDurationSeconds('FOCUS', settings)).toBe(1500);
    });

    it('returns duration in seconds for SHORT_BREAK', () => {
      expect(getPlannedDurationSeconds('SHORT_BREAK', settings)).toBe(300);
    });

    it('returns duration in seconds for LONG_BREAK', () => {
      expect(getPlannedDurationSeconds('LONG_BREAK', settings)).toBe(900);
    });

    it('enforces minimum 60 seconds defensively', () => {
      expect(
        getPlannedDurationSeconds('SHORT_BREAK', {
          ...settings,
          shortBreakDuration: 0,
        })
      ).toBe(60);
    });
  });

  describe('isLongBreakNext', () => {
    it('returns false when completed count is 0', () => {
      expect(isLongBreakNext(0, 4)).toBe(false);
    });

    it('returns false when completed count is not a multiple of threshold', () => {
      expect(isLongBreakNext(1, 4)).toBe(false);
      expect(isLongBreakNext(2, 4)).toBe(false);
      expect(isLongBreakNext(3, 4)).toBe(false);
    });

    it('returns true when completed count reaches threshold', () => {
      expect(isLongBreakNext(4, 4)).toBe(true);
      expect(isLongBreakNext(8, 4)).toBe(true);
      expect(isLongBreakNext(12, 4)).toBe(true);
    });

    it('handles custom sessionsBeforeLongBreak threshold', () => {
      expect(isLongBreakNext(2, 2)).toBe(true);
      expect(isLongBreakNext(3, 2)).toBe(false);
    });
  });

  describe('getNextCycleSession', () => {
    it('suggests SHORT_BREAK after 1st, 2nd, 3rd completed focus sessions', () => {
      const next1 = getNextCycleSession('FOCUS', 1, settings);
      expect(next1.nextType).toBe('SHORT_BREAK');
      expect(next1.plannedDurationSeconds).toBe(300);

      const next2 = getNextCycleSession('FOCUS', 2, settings);
      expect(next2.nextType).toBe('SHORT_BREAK');

      const next3 = getNextCycleSession('FOCUS', 3, settings);
      expect(next3.nextType).toBe('SHORT_BREAK');
    });

    it('suggests LONG_BREAK after 4th completed focus session', () => {
      const next4 = getNextCycleSession('FOCUS', 4, settings);
      expect(next4.nextType).toBe('LONG_BREAK');
      expect(next4.plannedDurationSeconds).toBe(900);
    });

    it('always transitions back to FOCUS from SHORT_BREAK', () => {
      const next = getNextCycleSession('SHORT_BREAK', 1, settings);
      expect(next.nextType).toBe('FOCUS');
      expect(next.plannedDurationSeconds).toBe(1500);
    });

    it('always transitions back to FOCUS from LONG_BREAK', () => {
      const next = getNextCycleSession('LONG_BREAK', 4, settings);
      expect(next.nextType).toBe('FOCUS');
      expect(next.plannedDurationSeconds).toBe(1500);
    });
  });
});

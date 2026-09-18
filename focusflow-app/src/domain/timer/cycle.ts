// src/domain/timer/cycle.ts
// FocusFlow — Timer Domain: Pomodoro Cycle Progression & Duration Logic
//
// Pure deterministic functions for resolving cycle sequence and duration.
// ZERO external dependencies.

import type { SessionType, UserSettings } from '@/types/domain';

export type TimerCycleSettings = Pick<
  UserSettings,
  'focusDuration' | 'shortBreakDuration' | 'longBreakDuration' | 'sessionsBeforeLongBreak'
>;

export interface NextCycleSessionResult {
  nextType: SessionType;
  plannedDurationSeconds: number;
}

/**
 * Resolves the configured duration in seconds for a given session type.
 */
export function getPlannedDurationSeconds(
  sessionType: SessionType,
  settings: Pick<UserSettings, 'focusDuration' | 'shortBreakDuration' | 'longBreakDuration'>
): number {
  switch (sessionType) {
    case 'FOCUS':
      return Math.max(60, settings.focusDuration * 60);
    case 'SHORT_BREAK':
      return Math.max(60, settings.shortBreakDuration * 60);
    case 'LONG_BREAK':
      return Math.max(60, settings.longBreakDuration * 60);
    default:
      return 25 * 60;
  }
}

/**
 * Returns true if the next break session should be a LONG_BREAK.
 */
export function isLongBreakNext(
  completedTodayCount: number,
  sessionsBeforeLongBreak: number = 4
): boolean {
  if (completedTodayCount <= 0) return false;
  const threshold = Math.max(1, sessionsBeforeLongBreak);
  return completedTodayCount % threshold === 0;
}

/**
 * Determines the next session type and planned duration following Pomodoro rules:
 * - If current is FOCUS:
 *     checks if completedTodayCount % sessionsBeforeLongBreak === 0 -> LONG_BREAK, else SHORT_BREAK
 * - If current is SHORT_BREAK or LONG_BREAK:
 *     always transitions to FOCUS
 */
export function getNextCycleSession(
  currentType: SessionType,
  completedTodayCount: number,
  settings: TimerCycleSettings
): NextCycleSessionResult {
  if (currentType === 'FOCUS') {
    const nextType: SessionType = isLongBreakNext(completedTodayCount, settings.sessionsBeforeLongBreak)
      ? 'LONG_BREAK'
      : 'SHORT_BREAK';

    return {
      nextType,
      plannedDurationSeconds: getPlannedDurationSeconds(nextType, settings),
    };
  }

  // After any break, return to FOCUS
  return {
    nextType: 'FOCUS',
    plannedDurationSeconds: getPlannedDurationSeconds('FOCUS', settings),
  };
}

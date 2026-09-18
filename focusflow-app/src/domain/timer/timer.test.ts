// src/domain/timer/timer.test.ts
// FocusFlow — Comprehensive Timer Domain Unit Tests
// Tests the pure state machine, mathematical formulas, and cycle progression
// with zero DOM/React/Network mocking.

import { describe, it, expect } from 'vitest';
import {
  calculateEndTimestampMs,
  calculateRemainingMs,
  calculateElapsedMs,
  calculateActualDurationSeconds,
  calculateTimerValues,
  formatRemainingTime,
  calculateNewTotalPausedMs,
  detectClockSkew,
  isTimerExpired,
} from './calculations';
import {
  timerReducer,
  createIdleSnapshot,
  canDispatch,
  getNextSessionType,
  InvalidStateTransitionError,
} from './state-machine';
import type { TimerSessionSnapshot } from '@/types/domain';

describe('Timer Domain — Calculations', () => {
  const BASE_TIME = 1_700_000_000_000; // Fixed epoch ms for deterministic testing
  const DURATION_25_MIN = 25 * 60;     // 1500 seconds = 1,500,000 ms

  describe('calculateTimerValues', () => {
    it('computes all combined timer display values in one pass', () => {
      const snapshot: TimerSessionSnapshot = {
        id: 'ses_test',
        type: 'FOCUS',
        state: 'RUNNING',
        plannedDurationSeconds: 1500,
        startedAtMs: BASE_TIME,
        pausedAtMs: null,
        totalPausedMs: 0,
        taskId: null,
        projectId: null,
      };
      const values = calculateTimerValues(snapshot, BASE_TIME + 750_000);
      expect(values.remainingMs).toBe(750_000);
      expect(values.remainingSeconds).toBe(750);
      expect(values.progressPercent).toBe(50);
    });
  });

  describe('calculateEndTimestampMs', () => {
    it('computes exact end timestamp without pauses', () => {
      const end = calculateEndTimestampMs(BASE_TIME, DURATION_25_MIN, 0);
      expect(end).toBe(BASE_TIME + 1_500_000);
    });

    it('extends end timestamp by accumulated pause milliseconds', () => {
      const totalPausedMs = 45_000; // 45 seconds paused
      const end = calculateEndTimestampMs(BASE_TIME, DURATION_25_MIN, totalPausedMs);
      expect(end).toBe(BASE_TIME + 1_500_000 + 45_000);
    });
  });

  describe('calculateRemainingMs', () => {
    it('returns full planned duration when IDLE', () => {
      const snapshot: TimerSessionSnapshot = {
        id: 'ses_1',
        type: 'FOCUS',
        state: 'IDLE',
        plannedDurationSeconds: DURATION_25_MIN,
        startedAtMs: 0,
        pausedAtMs: null,
        totalPausedMs: 0,
        taskId: null,
        projectId: null,
      };

      const remaining = calculateRemainingMs(snapshot, BASE_TIME);
      expect(remaining).toBe(1_500_000);
    });

    it('computes dynamic remaining time when RUNNING', () => {
      const snapshot: TimerSessionSnapshot = {
        id: 'ses_1',
        type: 'FOCUS',
        state: 'RUNNING',
        plannedDurationSeconds: DURATION_25_MIN,
        startedAtMs: BASE_TIME,
        pausedAtMs: null,
        totalPausedMs: 0,
        taskId: null,
        projectId: null,
      };

      // 10 minutes elapsed
      const now = BASE_TIME + 10 * 60 * 1000;
      const remaining = calculateRemainingMs(snapshot, now);
      expect(remaining).toBe(15 * 60 * 1000); // 15 mins remaining
    });

    it('freezes remaining time at paused moment when PAUSED', () => {
      const pausedAt = BASE_TIME + 5 * 60 * 1000; // Paused after 5 minutes
      const snapshot: TimerSessionSnapshot = {
        id: 'ses_1',
        type: 'FOCUS',
        state: 'PAUSED',
        plannedDurationSeconds: DURATION_25_MIN,
        startedAtMs: BASE_TIME,
        pausedAtMs: pausedAt,
        totalPausedMs: 0,
        taskId: null,
        projectId: null,
      };

      // Even if current wall-clock is 2 hours later, remaining is frozen at 20 mins
      const futureNow = BASE_TIME + 2 * 60 * 60 * 1000;
      const remaining = calculateRemainingMs(snapshot, futureNow);
      expect(remaining).toBe(20 * 60 * 1000);
    });

    it('returns 0 when time has naturally expired or overrun', () => {
      const snapshot: TimerSessionSnapshot = {
        id: 'ses_1',
        type: 'FOCUS',
        state: 'RUNNING',
        plannedDurationSeconds: DURATION_25_MIN,
        startedAtMs: BASE_TIME,
        pausedAtMs: null,
        totalPausedMs: 0,
        taskId: null,
        projectId: null,
      };

      // 30 minutes elapsed (5 min overrun)
      const now = BASE_TIME + 30 * 60 * 1000;
      const remaining = calculateRemainingMs(snapshot, now);
      expect(remaining).toBe(0); // Clamped at 0, no negative numbers
    });

    it('returns 0 when COMPLETED or ABANDONED', () => {
      const completedSnapshot: TimerSessionSnapshot = {
        id: 'ses_1',
        type: 'FOCUS',
        state: 'COMPLETED',
        plannedDurationSeconds: DURATION_25_MIN,
        startedAtMs: BASE_TIME,
        pausedAtMs: null,
        totalPausedMs: 0,
        taskId: null,
        projectId: null,
      };

      expect(calculateRemainingMs(completedSnapshot, BASE_TIME)).toBe(0);
    });
  });

  describe('calculateElapsedMs and calculateActualDurationSeconds', () => {
    it('returns full planned duration when COMPLETED', () => {
      const snapshot: TimerSessionSnapshot = {
        id: 'ses_1',
        type: 'FOCUS',
        state: 'COMPLETED',
        plannedDurationSeconds: 1500,
        startedAtMs: BASE_TIME,
        pausedAtMs: null,
        totalPausedMs: 0,
        taskId: null,
        projectId: null,
      };

      expect(calculateElapsedMs(snapshot, BASE_TIME + 2000000)).toBe(1_500_000);
      expect(calculateActualDurationSeconds(snapshot, BASE_TIME + 2000000)).toBe(1500);
    });

    it('accurately deducts pause periods from elapsed time', () => {
      const totalPausedMs = 60_000; // 1 minute paused
      const snapshot: TimerSessionSnapshot = {
        id: 'ses_1',
        type: 'FOCUS',
        state: 'RUNNING',
        plannedDurationSeconds: 1500,
        startedAtMs: BASE_TIME,
        pausedAtMs: null,
        totalPausedMs,
        taskId: null,
        projectId: null,
      };

      // 10 minutes wall-clock time passed
      const now = BASE_TIME + 10 * 60 * 1000;
      // 10 mins - 1 min pause = 9 active minutes (540,000 ms)
      expect(calculateElapsedMs(snapshot, now)).toBe(540_000);
      expect(calculateActualDurationSeconds(snapshot, now)).toBe(540);
    });
  });

  describe('formatRemainingTime', () => {
    it('formats remaining ms into mm:ss display format', () => {
      expect(formatRemainingTime(1_500_000)).toEqual({
        minutes: '25',
        seconds: '00',
        formatted: '25:00',
      });

      expect(formatRemainingTime(65_000)).toEqual({
        minutes: '01',
        seconds: '05',
        formatted: '01:05',
      });

      expect(formatRemainingTime(4_000)).toEqual({
        minutes: '00',
        seconds: '04',
        formatted: '00:04',
      });

      expect(formatRemainingTime(0)).toEqual({
        minutes: '00',
        seconds: '00',
        formatted: '00:00',
      });
    });
  });

  describe('calculateNewTotalPausedMs', () => {
    it('accumulates pause interval accurately', () => {
      const existingPause = 30_000; // 30s
      const pausedAt = BASE_TIME + 10_000;
      const resumedAt = BASE_TIME + 25_000; // 15s pause

      const total = calculateNewTotalPausedMs(existingPause, pausedAt, resumedAt);
      expect(total).toBe(45_000);
    });
  });

  describe('detectClockSkew', () => {
    it('detects backwards clock manipulation', () => {
      const startedAt = BASE_TIME;
      const backwardsTime = startedAt - 60_000; // Clock shifted back 1 min
      expect(detectClockSkew(startedAt, backwardsTime)).toBe(true);

      const normalTime = startedAt + 10_000;
      expect(detectClockSkew(startedAt, normalTime)).toBe(false);
    });
  });

  describe('isTimerExpired', () => {
    it('returns true only when RUNNING and remainingMs <= 0', () => {
      const snapshot: TimerSessionSnapshot = {
        id: 'ses_1',
        type: 'FOCUS',
        state: 'RUNNING',
        plannedDurationSeconds: 1500,
        startedAtMs: BASE_TIME,
        pausedAtMs: null,
        totalPausedMs: 0,
        taskId: null,
        projectId: null,
      };

      expect(isTimerExpired(snapshot, BASE_TIME + 1000)).toBe(false);
      expect(isTimerExpired(snapshot, BASE_TIME + 1_500_000)).toBe(true);
      expect(isTimerExpired(snapshot, BASE_TIME + 1_600_000)).toBe(true);
    });
  });
});

describe('Timer Domain — State Machine Transitions', () => {
  const BASE_TIME = 1_700_000_000_000;

  it('completes the canonical full Pomodoro cycle: IDLE → RUNNING → PAUSED → RUNNING → COMPLETED → IDLE', () => {
    // 1. Initial IDLE state
    let snapshot = createIdleSnapshot(1500, 'FOCUS');
    expect(snapshot.state).toBe('IDLE');

    // 2. START
    snapshot = timerReducer(snapshot, {
      type: 'START',
      sessionId: 'ses_100',
      sessionType: 'FOCUS',
      plannedDurationSeconds: 1500,
      startedAtMs: BASE_TIME,
      taskId: 'tsk_1',
      projectId: 'prj_1',
    });
    expect(snapshot.state).toBe('RUNNING');
    expect(snapshot.id).toBe('ses_100');
    expect(snapshot.startedAtMs).toBe(BASE_TIME);
    expect(snapshot.taskId).toBe('tsk_1');

    // 3. PAUSE
    const pausedAt = BASE_TIME + 600_000; // after 10 mins
    snapshot = timerReducer(snapshot, {
      type: 'PAUSE',
      pausedAtMs: pausedAt,
    });
    expect(snapshot.state).toBe('PAUSED');
    expect(snapshot.pausedAtMs).toBe(pausedAt);

    // 4. RESUME
    const resumedAt = pausedAt + 60_000; // 1 min pause
    snapshot = timerReducer(snapshot, {
      type: 'RESUME',
      resumedAtMs: resumedAt,
    });
    expect(snapshot.state).toBe('RUNNING');
    expect(snapshot.pausedAtMs).toBeNull();
    expect(snapshot.totalPausedMs).toBe(60_000);

    // 5. TIME_EXPIRED
    snapshot = timerReducer(snapshot, {
      type: 'TIME_EXPIRED',
      atMs: BASE_TIME + 1_560_000,
    });
    expect(snapshot.state).toBe('COMPLETED');

    // 6. DISMISS back to IDLE
    snapshot = timerReducer(snapshot, { type: 'DISMISS' });
    expect(snapshot.state).toBe('IDLE');
    expect(snapshot.id).toBe('');
  });

  it('supports RESET (abandonment) from RUNNING state', () => {
    let snapshot = createIdleSnapshot(1500, 'FOCUS');
    snapshot = timerReducer(snapshot, {
      type: 'START',
      sessionId: 'ses_200',
      sessionType: 'FOCUS',
      plannedDurationSeconds: 1500,
      startedAtMs: BASE_TIME,
    });

    snapshot = timerReducer(snapshot, {
      type: 'RESET',
      atMs: BASE_TIME + 300_000,
    });
    expect(snapshot.state).toBe('ABANDONED');
  });

  it('supports RESET from PAUSED state', () => {
    let snapshot = createIdleSnapshot(1500, 'FOCUS');
    snapshot = timerReducer(snapshot, {
      type: 'START',
      sessionId: 'ses_201',
      sessionType: 'FOCUS',
      plannedDurationSeconds: 1500,
      startedAtMs: BASE_TIME,
    });
    snapshot = timerReducer(snapshot, {
      type: 'PAUSE',
      pausedAtMs: BASE_TIME + 100_000,
    });

    snapshot = timerReducer(snapshot, {
      type: 'RESET',
      atMs: BASE_TIME + 200_000,
    });
    expect(snapshot.state).toBe('ABANDONED');
  });

  it('rejects illegal transitions with InvalidStateTransitionError', () => {
    const idleSnapshot = createIdleSnapshot(1500, 'FOCUS');

    // Cannot PAUSE from IDLE
    expect(() =>
      timerReducer(idleSnapshot, { type: 'PAUSE', pausedAtMs: BASE_TIME })
    ).toThrow(InvalidStateTransitionError);

    // Cannot RESUME from IDLE
    expect(() =>
      timerReducer(idleSnapshot, { type: 'RESUME', resumedAtMs: BASE_TIME })
    ).toThrow(InvalidStateTransitionError);

    // Cannot TIME_EXPIRED from IDLE
    expect(() =>
      timerReducer(idleSnapshot, { type: 'TIME_EXPIRED', atMs: BASE_TIME })
    ).toThrow(InvalidStateTransitionError);

    // Cannot DISMISS from RUNNING
    const runningSnapshot = timerReducer(idleSnapshot, {
      type: 'START',
      sessionId: 'ses_300',
      sessionType: 'FOCUS',
      plannedDurationSeconds: 1500,
      startedAtMs: BASE_TIME,
    });
    expect(() => timerReducer(runningSnapshot, { type: 'DISMISS' })).toThrow(
      InvalidStateTransitionError
    );

    // Cannot START from RUNNING (must be IDLE)
    expect(() =>
      timerReducer(runningSnapshot, {
        type: 'START',
        sessionId: 'ses_301',
        sessionType: 'FOCUS',
        plannedDurationSeconds: 1500,
        startedAtMs: BASE_TIME,
      })
    ).toThrow(InvalidStateTransitionError);
  });

  it('supports SKIP from RUNNING state, transitioning to SKIPPED', () => {
    let snapshot = createIdleSnapshot(1500, 'FOCUS');
    snapshot = timerReducer(snapshot, {
      type: 'START',
      sessionId: 'ses_skip_1',
      sessionType: 'FOCUS',
      plannedDurationSeconds: 1500,
      startedAtMs: BASE_TIME,
    });

    snapshot = timerReducer(snapshot, {
      type: 'SKIP',
      atMs: BASE_TIME + 300_000,
    });
    expect(snapshot.state).toBe('SKIPPED');

    // Dismiss from SKIPPED returns to IDLE
    const idle = timerReducer(snapshot, { type: 'DISMISS' });
    expect(idle.state).toBe('IDLE');
  });

  it('supports SKIP from PAUSED state', () => {
    let snapshot = createIdleSnapshot(1500, 'FOCUS');
    snapshot = timerReducer(snapshot, {
      type: 'START',
      sessionId: 'ses_skip_2',
      sessionType: 'FOCUS',
      plannedDurationSeconds: 1500,
      startedAtMs: BASE_TIME,
    });
    snapshot = timerReducer(snapshot, {
      type: 'PAUSE',
      pausedAtMs: BASE_TIME + 200_000,
    });

    snapshot = timerReducer(snapshot, {
      type: 'SKIP',
      atMs: BASE_TIME + 400_000,
    });
    expect(snapshot.state).toBe('SKIPPED');
  });

  describe('canDispatch and Boolean Guards', () => {
    it('returns true only for legally dispatchable events', () => {
      expect(canDispatch('IDLE', 'START')).toBe(true);
      expect(canDispatch('IDLE', 'PAUSE')).toBe(false);

      expect(canDispatch('RUNNING', 'PAUSE')).toBe(true);
      expect(canDispatch('RUNNING', 'RESET')).toBe(true);
      expect(canDispatch('RUNNING', 'SKIP')).toBe(true);
      expect(canDispatch('RUNNING', 'START')).toBe(false);

      expect(canDispatch('PAUSED', 'RESUME')).toBe(true);
      expect(canDispatch('PAUSED', 'RESET')).toBe(true);
      expect(canDispatch('PAUSED', 'SKIP')).toBe(true);
      expect(canDispatch('PAUSED', 'PAUSE')).toBe(false);

      expect(canDispatch('COMPLETED', 'DISMISS')).toBe(true);
      expect(canDispatch('COMPLETED', 'START_NEXT')).toBe(true);
      expect(canDispatch('COMPLETED', 'PAUSE')).toBe(false);

      expect(canDispatch('SKIPPED', 'DISMISS')).toBe(true);
      expect(canDispatch('SKIPPED', 'START_NEXT')).toBe(true);
    });
  });

  describe('Cycle Progression', () => {
    it('alternates between short breaks and long break after N sessions', () => {
      expect(getNextSessionType(1, 4)).toBe('SHORT_BREAK');
      expect(getNextSessionType(2, 4)).toBe('SHORT_BREAK');
      expect(getNextSessionType(3, 4)).toBe('SHORT_BREAK');
      expect(getNextSessionType(4, 4)).toBe('LONG_BREAK');
      expect(getNextSessionType(5, 4)).toBe('SHORT_BREAK');
      expect(getNextSessionType(8, 4)).toBe('LONG_BREAK');
    });
  });
});



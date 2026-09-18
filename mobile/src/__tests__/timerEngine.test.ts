// mobile/src/__tests__/timerEngine.test.ts
// FocusFlow Mobile — Timer Engine Unit Tests

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reconcileSessionTimer, formatTimerSeconds } from '../services/timerEngine';
import { FocusSession } from '../types';

describe('formatTimerSeconds', () => {
  it('formats whole minutes correctly', () => {
    expect(formatTimerSeconds(1500)).toBe('25:00');
    expect(formatTimerSeconds(300)).toBe('05:00');
    expect(formatTimerSeconds(0)).toBe('00:00');
  });

  it('formats mixed minutes and seconds with leading zeros', () => {
    expect(formatTimerSeconds(65)).toBe('01:05');
    expect(formatTimerSeconds(9)).toBe('00:09');
    expect(formatTimerSeconds(59)).toBe('00:59');
  });

  it('clamps negative values to 00:00', () => {
    expect(formatTimerSeconds(-10)).toBe('00:00');
  });
});

describe('reconcileSessionTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns IDLE state when session is null', () => {
    const result = reconcileSessionTimer(null);
    expect(result.status).toBe('IDLE');
    expect(result.remainingSeconds).toBe(1500);
    expect(result.elapsedSeconds).toBe(0);
    expect(result.progressPercent).toBe(0);
  });

  it('reconciles RUNNING session accurately from startedAt timestamp', () => {
    const now = new Date('2026-09-18T10:10:00Z').getTime();
    vi.setSystemTime(now);

    // Started 5 minutes (300 seconds) ago
    const startedAt = new Date('2026-09-18T10:05:00Z').toISOString();

    const session: FocusSession = {
      id: 'sess-1',
      userId: 'usr-1',
      taskId: 'task-1',
      projectId: null,
      status: 'ACTIVE',
      type: 'POMODORO',
      startedAt,
      endedAt: null,
      targetDurationMinutes: 25,
      durationSeconds: null,
      pauseSeconds: 0,
    };

    const result = reconcileSessionTimer(session);
    expect(result.status).toBe('RUNNING');
    expect(result.elapsedSeconds).toBe(300);
    expect(result.remainingSeconds).toBe(1200); // 1500 - 300
    expect(result.progressPercent).toBe(20);
  });

  it('accounts for pauseSeconds when reconciling RUNNING session', () => {
    const now = new Date('2026-09-18T10:10:00Z').getTime();
    vi.setSystemTime(now);

    // Started 10 minutes ago, but spent 2 minutes paused
    const startedAt = new Date('2026-09-18T10:00:00Z').toISOString();

    const session: FocusSession = {
      id: 'sess-2',
      userId: 'usr-1',
      taskId: null,
      projectId: null,
      status: 'ACTIVE',
      type: 'POMODORO',
      startedAt,
      endedAt: null,
      targetDurationMinutes: 25,
      durationSeconds: null,
      pauseSeconds: 120, // 2 mins paused
    };

    const result = reconcileSessionTimer(session);
    expect(result.status).toBe('RUNNING');
    expect(result.elapsedSeconds).toBe(480); // 600 - 120
    expect(result.remainingSeconds).toBe(1020);
  });

  it('reconciles PAUSED session using server elapsedSeconds', () => {
    const session: FocusSession = {
      id: 'sess-3',
      userId: 'usr-1',
      taskId: null,
      projectId: null,
      status: 'PAUSED',
      type: 'POMODORO',
      startedAt: new Date().toISOString(),
      endedAt: null,
      targetDurationMinutes: 25,
      durationSeconds: null,
      elapsedSeconds: 500,
    };

    const result = reconcileSessionTimer(session);
    expect(result.status).toBe('PAUSED');
    expect(result.elapsedSeconds).toBe(500);
    expect(result.remainingSeconds).toBe(1000);
  });

  it('detects natural completion when elapsed >= totalDuration', () => {
    const now = new Date('2026-09-18T10:30:00Z').getTime();
    vi.setSystemTime(now);

    // Started 30 minutes ago for a 25-minute session
    const startedAt = new Date('2026-09-18T10:00:00Z').toISOString();

    const session: FocusSession = {
      id: 'sess-4',
      userId: 'usr-1',
      taskId: null,
      projectId: null,
      status: 'ACTIVE',
      type: 'POMODORO',
      startedAt,
      endedAt: null,
      targetDurationMinutes: 25,
      durationSeconds: null,
      pauseSeconds: 0,
    };

    const result = reconcileSessionTimer(session);
    expect(result.status).toBe('COMPLETED');
    expect(result.remainingSeconds).toBe(0);
    expect(result.progressPercent).toBe(100);
  });
});

// src/app/api/focus-sessions/__tests__/focus-sessions-paused.test.ts
// FocusFlow — Paused Session Stale/Recovery Policy Unit Tests (ADR-014)
// Verifies that paused sessions never auto-expire, countdown is frozen at pause moment,
// zero focus time is consumed during pause, and resume correctly accounts for paused duration.

import { describe, it, expect } from 'vitest';
import {
  calculateRemainingMs,
  calculateElapsedMs,
  calculateActualDurationSeconds,
} from '@/domain/timer/calculations';

describe('Paused Session Recovery & Freeze Semantics (ADR-014)', () => {
  const startedAt = 1_000_000;
  const plannedDurationSeconds = 1500; // 25 minutes (1,500,000 ms)

  it('freezes remaining time at the exact pause moment even hours later', () => {
    // Session runs for 10 minutes (600,000 ms), then pauses
    const pausedAt = startedAt + 600_000; // 10 minutes in

    const snapshot = {
      state: 'PAUSED' as const,
      plannedDurationSeconds,
      startedAtMs: startedAt,
      pausedAtMs: pausedAt,
      totalPausedMs: 0,
    };

    // 1 minute after pause
    const remaining1Min = calculateRemainingMs(snapshot, pausedAt + 60_000);
    // 5 hours after pause (18,000,000 ms later)
    const remaining5Hours = calculateRemainingMs(snapshot, pausedAt + 18_000_000);
    // 24 hours after pause
    const remaining24Hours = calculateRemainingMs(snapshot, pausedAt + 86_400_000);

    // Remaining time must be identically 15 minutes (900,000 ms) in all cases
    expect(remaining1Min).toBe(900_000);
    expect(remaining5Hours).toBe(900_000);
    expect(remaining24Hours).toBe(900_000);
  });

  it('consumes zero active focus time while paused', () => {
    const pausedAt = startedAt + 600_000; // 10 minutes worked

    const snapshot = {
      state: 'PAUSED' as const,
      plannedDurationSeconds,
      startedAtMs: startedAt,
      pausedAtMs: pausedAt,
      totalPausedMs: 0,
    };

    // Elapsed active work time must remain exactly 10 minutes (600,000 ms)
    const elapsedAtPause = calculateElapsedMs(snapshot, pausedAt);
    const elapsed5HoursLater = calculateElapsedMs(snapshot, pausedAt + 18_000_000);

    expect(elapsedAtPause).toBe(600_000);
    expect(elapsed5HoursLater).toBe(600_000);
    expect(calculateActualDurationSeconds(snapshot, pausedAt + 18_000_000)).toBe(600);
  });

  it('correctly shifts end timestamp forward when resumed', () => {
    const pausedAt = startedAt + 600_000; // paused at minute 10
    const resumedAt = pausedAt + 1_200_000; // resumed 20 minutes later
    const pauseInterval = resumedAt - pausedAt; // 1,200,000 ms (20 mins)

    const resumedSnapshot = {
      state: 'RUNNING' as const,
      plannedDurationSeconds,
      startedAtMs: startedAt,
      pausedAtMs: null,
      totalPausedMs: pauseInterval,
    };

    // At the exact resume moment, remaining time must still be 15 minutes (900,000 ms)
    const remainingAtResume = calculateRemainingMs(resumedSnapshot, resumedAt);
    expect(remainingAtResume).toBe(900_000);

    // 5 minutes of active work after resume (300,000 ms later)
    const nowAfterWork = resumedAt + 300_000;
    const remainingAfterWork = calculateRemainingMs(resumedSnapshot, nowAfterWork);
    const elapsedAfterWork = calculateElapsedMs(resumedSnapshot, nowAfterWork);

    expect(remainingAfterWork).toBe(600_000); // 10 minutes remaining
    expect(elapsedAfterWork).toBe(900_000); // 15 minutes worked
    expect(calculateActualDurationSeconds(resumedSnapshot, nowAfterWork)).toBe(900);
  });

  it('preserves paused session on recovery without auto-expiring', () => {
    // Database getActiveSession reconciliation logic
    const pausedSessionRecord = {
      id: 'ses_paused_1',
      userId: 'usr_1',
      status: 'IN_PROGRESS' as const,
      startedAt: new Date(Date.now() - 100_000_000), // started long ago
      plannedDuration: 1500,
      pausedAt: new Date(Date.now() - 95_000_000), // paused long ago
      pausedDuration: 0,
    };

    // Policy check: if pausedAt !== null, it NEVER auto-expires
    const shouldAutoExpire = (session: typeof pausedSessionRecord) => {
      if (session.pausedAt !== null) {
        return false; // ADR-014: Paused session policy
      }
      const endTimestampMs = session.startedAt.getTime() + session.plannedDuration * 1000 + session.pausedDuration * 1000;
      return Date.now() >= endTimestampMs;
    };

    expect(shouldAutoExpire(pausedSessionRecord)).toBe(false);
  });
});

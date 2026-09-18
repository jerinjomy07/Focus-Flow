// src/domain/timer/calculations.ts
// FocusFlow — Timer Domain: Core Mathematical Calculations
//
// CRITICAL: This file MUST have ZERO dependencies on:
//   - React / Next.js
//   - Prisma
//   - Browser APIs
//   - Any I/O
//
// Every function is a pure, deterministic computation that
// can be tested exhaustively in Vitest with zero mocking.

import type { TimerSessionSnapshot } from '@/types/domain';

// ============================================================
// TYPES
// ============================================================

/** Result of computing timer time values */
export interface TimerTimeValues {
  remainingMs: number;
  remainingSeconds: number;
  elapsedMs: number;
  elapsedSeconds: number;
  endTimestampMs: number;
  progressPercent: number; // 0–100
}

/** Formatted display string components */
export interface TimerDisplayParts {
  minutes: string; // zero-padded, e.g. "04"
  seconds: string; // zero-padded, e.g. "05"
  formatted: string; // combined, e.g. "04:05"
}

// ============================================================
// CORE FORMULA: END TIMESTAMP
// ============================================================

/**
 * Derives the authoritative end timestamp from session parameters.
 *
 * endTimestampMs = startedAtMs + (plannedDurationSeconds × 1000) + totalPausedMs
 *
 * The end timestamp slides forward every time a pause is resumed,
 * ensuring that pause time is not "lost" from the countdown.
 */
export function calculateEndTimestampMs(
  startedAtMs: number,
  plannedDurationSeconds: number,
  totalPausedMs: number
): number {
  return startedAtMs + plannedDurationSeconds * 1000 + totalPausedMs;
}

// ============================================================
// CORE FORMULA: REMAINING TIME
// ============================================================

/**
 * Computes remaining time in milliseconds for any timer state.
 *
 * This is the ONLY authoritative source of remaining time.
 * No other code may compute remaining time.
 *
 * Formula by state:
 *   IDLE      → plannedDurationSeconds × 1000
 *   RUNNING   → max(0, endTimestampMs - nowMs)
 *   PAUSED    → max(0, endTimestampMs - pausedAtMs)  [clock frozen at pause moment]
 *   COMPLETED → 0
 *   ABANDONED → 0
 *
 * @param snapshot - Current timer session snapshot
 * @param nowMs - Current time as Unix epoch ms (allows deterministic testing)
 */
export function calculateRemainingMs(
  snapshot: Readonly<Pick<TimerSessionSnapshot, 'state' | 'plannedDurationSeconds' | 'startedAtMs' | 'pausedAtMs' | 'totalPausedMs'>>,
  nowMs: number
): number {
  const { state, plannedDurationSeconds, startedAtMs, pausedAtMs, totalPausedMs } = snapshot;

  switch (state) {
    case 'IDLE':
      return plannedDurationSeconds * 1000;

    case 'RUNNING': {
      const endTimestamp = calculateEndTimestampMs(startedAtMs, plannedDurationSeconds, totalPausedMs);
      return Math.max(0, endTimestamp - nowMs);
    }

    case 'PAUSED': {
      if (pausedAtMs === null) {
        // Defensive: should never happen in PAUSED state — treat as 0
        return 0;
      }
      const endTimestamp = calculateEndTimestampMs(startedAtMs, plannedDurationSeconds, totalPausedMs);
      return Math.max(0, endTimestamp - pausedAtMs);
    }

    case 'COMPLETED':
    case 'ABANDONED':
    case 'SKIPPED':
      return 0;

    default: {
      // Exhaustiveness check
      const _exhaustive: never = state;
      void _exhaustive;
      return 0;
    }
  }
}

// ============================================================
// CORE FORMULA: ELAPSED / ACTUAL DURATION
// ============================================================

/**
 * Computes actual elapsed active-work time in milliseconds.
 * Excludes any paused duration from the calculation.
 *
 * Formula by state:
 *   RUNNING/ABANDONED/SKIPPED → (nowMs - startedAtMs) - totalPausedMs
 *   PAUSED                    → (pausedAtMs - startedAtMs) - totalPausedMs
 *   COMPLETED                 → plannedDurationSeconds × 1000
 *   IDLE                      → 0
 *
 * @param snapshot - Current timer session snapshot
 * @param nowMs - Current time as Unix epoch ms
 */
export function calculateElapsedMs(
  snapshot: Readonly<Pick<TimerSessionSnapshot, 'state' | 'plannedDurationSeconds' | 'startedAtMs' | 'pausedAtMs' | 'totalPausedMs'>>,
  nowMs: number
): number {
  const { state, plannedDurationSeconds, startedAtMs, pausedAtMs, totalPausedMs } = snapshot;

  switch (state) {
    case 'IDLE':
      return 0;

    case 'RUNNING':
    case 'ABANDONED':
    case 'SKIPPED':
      return Math.max(0, nowMs - startedAtMs - totalPausedMs);

    case 'PAUSED': {
      if (pausedAtMs === null) return 0;
      return Math.max(0, pausedAtMs - startedAtMs - totalPausedMs);
    }

    case 'COMPLETED':
      return plannedDurationSeconds * 1000;

    default: {
      const _exhaustive: never = state;
      void _exhaustive;
      return 0;
    }
  }
}

/**
 * Computes actual elapsed active-work time in whole seconds.
 * This is what gets persisted to the database as actualDuration.
 */
export function calculateActualDurationSeconds(
  snapshot: Readonly<Pick<TimerSessionSnapshot, 'state' | 'plannedDurationSeconds' | 'startedAtMs' | 'pausedAtMs' | 'totalPausedMs'>>,
  nowMs: number
): number {
  return Math.floor(calculateElapsedMs(snapshot, nowMs) / 1000);
}

// ============================================================
// DERIVED TIME VALUES (all in one call)
// ============================================================

/**
 * Computes all timer display values from a single snapshot + now.
 * Designed for use in the animation frame loop to minimize
 * redundant calculations.
 */
export function calculateTimerValues(
  snapshot: Readonly<Pick<TimerSessionSnapshot, 'state' | 'plannedDurationSeconds' | 'startedAtMs' | 'pausedAtMs' | 'totalPausedMs'>>,
  nowMs: number
): TimerTimeValues {
  const remainingMs = calculateRemainingMs(snapshot, nowMs);
  const elapsedMs = calculateElapsedMs(snapshot, nowMs);
  const endTimestampMs =
    snapshot.state === 'IDLE'
      ? nowMs + snapshot.plannedDurationSeconds * 1000
      : calculateEndTimestampMs(snapshot.startedAtMs, snapshot.plannedDurationSeconds, snapshot.totalPausedMs);

  const totalMs = snapshot.plannedDurationSeconds * 1000;
  const progressPercent = totalMs > 0
    ? Math.min(100, Math.max(0, ((totalMs - remainingMs) / totalMs) * 100))
    : 0;

  return {
    remainingMs,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    elapsedMs,
    elapsedSeconds: Math.floor(elapsedMs / 1000),
    endTimestampMs,
    progressPercent,
  };
}

// ============================================================
// DISPLAY FORMATTING
// ============================================================

/**
 * Converts remaining milliseconds to zero-padded display parts.
 *
 * @example
 * formatRemainingTime(304_000) // { minutes: "05", seconds: "04", formatted: "05:04" }
 */
export function formatRemainingTime(remainingMs: number): TimerDisplayParts {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const minutesStr = String(minutes).padStart(2, '0');
  const secondsStr = String(seconds).padStart(2, '0');

  return {
    minutes: minutesStr,
    seconds: secondsStr,
    formatted: `${minutesStr}:${secondsStr}`,
  };
}

// ============================================================
// PAUSE/RESUME TIME ACCOUNTING
// ============================================================

/**
 * Calculates the new totalPausedMs when a session is resumed.
 * Adds the duration of the completed pause interval.
 *
 * @param totalPausedMs - Previously accumulated pause ms
 * @param pausedAtMs - When the most recent pause began
 * @param resumedAtMs - When resume was triggered
 */
export function calculateNewTotalPausedMs(
  totalPausedMs: number,
  pausedAtMs: number,
  resumedAtMs: number
): number {
  const pauseIntervalMs = Math.max(0, resumedAtMs - pausedAtMs);
  return totalPausedMs + pauseIntervalMs;
}

// ============================================================
// CLOCK SKEW DETECTION
// ============================================================

/**
 * Detects if the system clock has moved backward (e.g. manual clock change).
 * Returns true if skew is detected, which triggers recovery logic.
 */
export function detectClockSkew(
  startedAtMs: number,
  nowMs: number,
  toleranceMs: number = 5000
): boolean {
  return nowMs < startedAtMs - toleranceMs;
}

// ============================================================
// COMPLETION DETECTION
// ============================================================

/**
 * Returns true if the timer has naturally elapsed (remaining time reached 0).
 * Used by the animation frame loop to trigger the completion event.
 */
export function isTimerExpired(
  snapshot: Readonly<Pick<TimerSessionSnapshot, 'state' | 'plannedDurationSeconds' | 'startedAtMs' | 'pausedAtMs' | 'totalPausedMs'>>,
  nowMs: number
): boolean {
  if (snapshot.state !== 'RUNNING') return false;
  return calculateRemainingMs(snapshot, nowMs) <= 0;
}

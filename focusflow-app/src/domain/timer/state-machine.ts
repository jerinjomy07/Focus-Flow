// src/domain/timer/state-machine.ts
// FocusFlow — Timer Domain: State Machine
//
// Implements the authoritative state transition rules for the timer.
// CRITICAL: ZERO external dependencies — no React, no Prisma, no I/O.
// Every transition must be deterministic and testable in isolation.

import type { TimerSessionSnapshot, TimerEvent, TimerState, SessionType } from '@/types/domain';
import { calculateNewTotalPausedMs } from './calculations';

// ============================================================
// DOMAIN ERRORS
// ============================================================

export class InvalidStateTransitionError extends Error {
  constructor(
    public readonly currentState: TimerState,
    public readonly event: TimerEvent['type'],
  ) {
    super(
      `Invalid timer transition: cannot dispatch '${event}' from state '${currentState}'`
    );
    this.name = 'InvalidStateTransitionError';
  }
}

// ============================================================
// NULL / IDLE SNAPSHOT
// ============================================================

/**
 * The canonical IDLE snapshot. Used when no session is active.
 * The id is empty because no DB record exists yet.
 */
export function createIdleSnapshot(
  plannedDurationSeconds: number = 25 * 60,
  sessionType: SessionType = 'FOCUS'
): TimerSessionSnapshot {
  return {
    id: '',
    type: sessionType,
    state: 'IDLE',
    plannedDurationSeconds,
    startedAtMs: 0,
    pausedAtMs: null,
    totalPausedMs: 0,
    taskId: null,
    projectId: null,
  };
}

// ============================================================
// STATE MACHINE TRANSITION FUNCTION
// ============================================================

/**
 * Pure state machine reducer.
 *
 * Given the current snapshot and an event, returns a new snapshot
 * or throws InvalidStateTransitionError for illegal transitions.
 *
 * This function never performs I/O — it only computes the next state.
 * Side effects (DB writes, notifications, cache invalidation) are the
 * responsibility of the application layer that calls this function.
 *
 * @throws {InvalidStateTransitionError} on illegal state transitions
 */
export function timerReducer(
  snapshot: TimerSessionSnapshot,
  event: TimerEvent
): TimerSessionSnapshot {
  const { state } = snapshot;

  switch (event.type) {
    // ── START ──────────────────────────────────────────────
    case 'START': {
      if (state !== 'IDLE') {
        throw new InvalidStateTransitionError(state, 'START');
      }
      return {
        id: event.sessionId,
        type: event.sessionType,
        state: 'RUNNING',
        plannedDurationSeconds: event.plannedDurationSeconds,
        startedAtMs: event.startedAtMs,
        pausedAtMs: null,
        totalPausedMs: 0,
        taskId: event.taskId ?? null,
        projectId: event.projectId ?? null,
      };
    }

    // ── PAUSE ──────────────────────────────────────────────
    case 'PAUSE': {
      if (state !== 'RUNNING') {
        throw new InvalidStateTransitionError(state, 'PAUSE');
      }
      return {
        ...snapshot,
        state: 'PAUSED',
        pausedAtMs: event.pausedAtMs,
      };
    }

    // ── RESUME ─────────────────────────────────────────────
    case 'RESUME': {
      if (state !== 'PAUSED') {
        throw new InvalidStateTransitionError(state, 'RESUME');
      }
      if (snapshot.pausedAtMs === null) {
        // Should never happen in PAUSED state — defensive guard
        throw new InvalidStateTransitionError(state, 'RESUME');
      }
      const newTotalPausedMs = calculateNewTotalPausedMs(
        snapshot.totalPausedMs,
        snapshot.pausedAtMs,
        event.resumedAtMs
      );
      return {
        ...snapshot,
        state: 'RUNNING',
        pausedAtMs: null,
        totalPausedMs: newTotalPausedMs,
      };
    }

    // ── TIME_EXPIRED ───────────────────────────────────────
    case 'TIME_EXPIRED': {
      if (state !== 'RUNNING') {
        throw new InvalidStateTransitionError(state, 'TIME_EXPIRED');
      }
      return {
        ...snapshot,
        state: 'COMPLETED',
        pausedAtMs: null,
      };
    }

    // ── RESET ──────────────────────────────────────────────
    case 'RESET': {
      if (state !== 'RUNNING' && state !== 'PAUSED') {
        throw new InvalidStateTransitionError(state, 'RESET');
      }
      return {
        ...snapshot,
        state: 'ABANDONED',
        pausedAtMs: null,
      };
    }

    // ── SKIP ───────────────────────────────────────────────
    case 'SKIP': {
      if (state !== 'RUNNING' && state !== 'PAUSED') {
        throw new InvalidStateTransitionError(state, 'SKIP');
      }
      return {
        ...snapshot,
        state: 'SKIPPED',
        pausedAtMs: null,
      };
    }

    // ── DISMISS (COMPLETED / SKIPPED → IDLE) ─────────────────────────
    case 'DISMISS': {
      if (state !== 'COMPLETED' && state !== 'SKIPPED') {
        throw new InvalidStateTransitionError(state, 'DISMISS');
      }
      return createIdleSnapshot(snapshot.plannedDurationSeconds, snapshot.type);
    }

    // ── START_NEXT (COMPLETED / SKIPPED → RUNNING, next session) ─────
    case 'START_NEXT': {
      if (state !== 'COMPLETED' && state !== 'SKIPPED') {
        throw new InvalidStateTransitionError(state, 'START_NEXT');
      }
      return {
        id: event.sessionId,
        type: event.sessionType,
        state: 'RUNNING',
        plannedDurationSeconds: event.plannedDurationSeconds,
        startedAtMs: event.startedAtMs,
        pausedAtMs: null,
        totalPausedMs: 0,
        taskId: null, // Break sessions have no task
        projectId: null,
      };
    }

    default: {
      // Exhaustiveness check — TypeScript will error if an event type is unhandled
      const _exhaustive: never = event;
      void _exhaustive;
      throw new InvalidStateTransitionError(state, 'UNKNOWN' as TimerEvent['type']);
    }
  }
}

// ============================================================
// VALIDATION GUARDS
// ============================================================

/**
 * Returns true if the given event can be legally dispatched from the given state.
 * Use this for UI guard conditions (e.g. showing/hiding the Pause button).
 */
export function canDispatch(state: TimerState, eventType: TimerEvent['type']): boolean {
  const legalTransitions: Record<TimerState, ReadonlyArray<TimerEvent['type']>> = {
    IDLE: ['START'],
    RUNNING: ['PAUSE', 'RESET', 'SKIP', 'TIME_EXPIRED'],
    PAUSED: ['RESUME', 'RESET', 'SKIP'],
    COMPLETED: ['DISMISS', 'START_NEXT'],
    SKIPPED: ['DISMISS', 'START_NEXT'],
    ABANDONED: [], // terminal state — no events possible
  };
  return (legalTransitions[state] as ReadonlyArray<string>).includes(eventType);
}

/** Convenience boolean guard for starting a session */
export function canStartSession(state: TimerState): boolean {
  return state === 'IDLE';
}

/** Convenience boolean guard for pausing a session */
export function canPauseSession(state: TimerState): boolean {
  return state === 'RUNNING';
}

/** Convenience boolean guard for resuming a session */
export function canResumeSession(state: TimerState): boolean {
  return state === 'PAUSED';
}

/** Convenience boolean guard for resetting a session */
export function canResetSession(state: TimerState): boolean {
  return state === 'RUNNING' || state === 'PAUSED';
}

/** Convenience boolean guard for skipping a session */
export function canSkipSession(state: TimerState): boolean {
  return state === 'RUNNING' || state === 'PAUSED';
}

/** Convenience boolean guard for completing a session */
export function canCompleteSession(state: TimerState): boolean {
  return state === 'RUNNING';
}

// ============================================================
// CYCLE PROGRESSION LOGIC
// ============================================================

/**
 * Determines the next session type in the Pomodoro cycle.
 *
 * @param completedFocusCount - Number of FOCUS sessions completed today
 * @param sessionsBeforeLongBreak - User setting (default 4)
 * @returns Next recommended session type
 */
export function getNextSessionType(
  completedFocusCount: number,
  sessionsBeforeLongBreak: number = 4
): SessionType {
  if (completedFocusCount <= 0) return 'SHORT_BREAK';
  if (completedFocusCount % sessionsBeforeLongBreak === 0) return 'LONG_BREAK';
  return 'SHORT_BREAK';
}

/**
 * Determines whether the next session after a break should be FOCUS.
 * (It always is — breaks are always followed by FOCUS sessions.)
 */
export function getNextFocusSessionType(): SessionType {
  return 'FOCUS';
}


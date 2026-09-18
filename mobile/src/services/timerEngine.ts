// mobile/src/services/timerEngine.ts
// FocusFlow Mobile — Server-Authoritative Timer Engine & Lifecycle Reconciliation
//
// Strictly derives remaining and elapsed seconds from authoritative server timestamps.
// Reconciles on app foregrounding, screen lock/unlock, and network recovery.

import { AppState, AppStateStatus } from 'react-native';
import { FocusSession } from '../types';

export interface TimerDisplayState {
  status: 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ABANDONED' | 'SKIPPED';
  remainingSeconds: number;
  elapsedSeconds: number;
  totalDurationSeconds: number;
  progressPercent: number;
}

/**
 * Calculates deterministic timer values from an active or paused server session.
 * Does NOT rely on local client state or interval accumulators.
 */
export function reconcileSessionTimer(session: FocusSession | null): TimerDisplayState {
  if (!session) {
    return {
      status: 'IDLE',
      remainingSeconds: 25 * 60,
      elapsedSeconds: 0,
      totalDurationSeconds: 25 * 60,
      progressPercent: 0,
    };
  }

  const totalDurationSeconds =
    (session as any).plannedDuration ??
    (session.targetDurationMinutes ? session.targetDurationMinutes * 60 : 25 * 60);

  const isPaused = session.status === 'PAUSED' || !!(session as any).pausedAt;

  if (isPaused) {
    const pauseSeconds = (session as any).pausedDuration ?? session.pauseSeconds ?? 0;
    const pausedAtMs = (session as any).pausedAt ? new Date((session as any).pausedAt).getTime() : Date.now();
    const startedAtMs = new Date(session.startedAt).getTime();
    const effectiveElapsed = Math.max(0, Math.floor((pausedAtMs - startedAtMs) / 1000) - pauseSeconds);
    const elapsedSeconds = Math.min(totalDurationSeconds, (session as any).elapsedSeconds ?? effectiveElapsed);
    const remainingSeconds = Math.max(0, totalDurationSeconds - elapsedSeconds);
    const progressPercent = totalDurationSeconds > 0 ? (elapsedSeconds / totalDurationSeconds) * 100 : 0;

    return {
      status: 'PAUSED',
      remainingSeconds,
      elapsedSeconds,
      totalDurationSeconds,
      progressPercent,
    };
  }

  if (session.status === 'ACTIVE' || session.status === 'IN_PROGRESS') {
    const nowMs = Date.now();
    const startedAtMs = new Date(session.startedAt).getTime();
    const pauseSeconds = (session as any).pausedDuration ?? session.pauseSeconds ?? 0;
    const totalElapsedFromStart = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
    const effectiveElapsed = Math.max(0, totalElapsedFromStart - pauseSeconds);

    const elapsedSeconds = Math.min(totalDurationSeconds, effectiveElapsed);
    const remainingSeconds = Math.max(0, totalDurationSeconds - elapsedSeconds);
    const progressPercent = totalDurationSeconds > 0 ? (elapsedSeconds / totalDurationSeconds) * 100 : 0;

    return {
      status: remainingSeconds === 0 ? 'COMPLETED' : 'RUNNING',
      remainingSeconds,
      elapsedSeconds,
      totalDurationSeconds,
      progressPercent,
    };
  }

  return {
    status: session.status,
    remainingSeconds: 0,
    elapsedSeconds: session.durationSeconds ?? totalDurationSeconds,
    totalDurationSeconds,
    progressPercent: 100,
  };
}

/**
 * Formats seconds into MM:SS display string
 */
export function formatTimerSeconds(seconds: number): string {
  const safeSec = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSec / 60);
  const secs = safeSec % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Registers an AppState listener to invoke a reconciliation callback on foreground resume
 */
export function subscribeToForegroundResume(onResume: () => void): () => void {
  let previousState = AppState.currentState;

  const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
    if (previousState.match(/inactive|background/) && nextState === 'active') {
      onResume();
    }
    previousState = nextState;
  });

  return () => {
    subscription.remove();
  };
}

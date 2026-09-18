// src/stores/timer-store.ts
// FocusFlow — Active Focus Task & Timer Client Store (Zustand)
// Implements ADR-012: User-Scoped Active Task State Management
// Implements ADR-014: Single Active Session Guarantee & Drift-Free Timer State
// Provides multi-tab broadcast bus synchronization via BroadcastChannel

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SessionType, TimerState } from '@/types/domain';
import type { ActiveSessionResponse } from '@/types/api';
import {
  calculateTimerValues,
  isTimerExpired,
} from '@/domain/timer/calculations';

// ============================================================
// ACTIVE TASK STORE (ADR-012)
// ============================================================

export interface ActiveTaskState {
  userId: string | null;
  selectedTaskId: string | null;
  selectedProjectId: string | null;
  selectedTaskTitle: string | null;

  // Actions
  setSelectedTask: (
    userId: string,
    taskId: string,
    projectId?: string | null,
    taskTitle?: string | null
  ) => void;
  clearSelectedTask: () => void;
  syncUser: (currentUserId: string | null) => void;
}

export const useActiveTaskStore = create<ActiveTaskState>()(
  persist(
    (set, get) => ({
      userId: null,
      selectedTaskId: null,
      selectedProjectId: null,
      selectedTaskTitle: null,

      setSelectedTask: (userId, taskId, projectId = null, taskTitle = null) => {
        set({
          userId,
          selectedTaskId: taskId,
          selectedProjectId: projectId,
          selectedTaskTitle: taskTitle,
        });
      },

      clearSelectedTask: () => {
        set({
          selectedTaskId: null,
          selectedProjectId: null,
          selectedTaskTitle: null,
        });
      },

      syncUser: (currentUserId) => {
        const currentStoredUserId = get().userId;
        // If user changed or logged out, clear active task immediately
        if (!currentUserId || (currentStoredUserId && currentStoredUserId !== currentUserId)) {
          set({
            userId: currentUserId,
            selectedTaskId: null,
            selectedProjectId: null,
            selectedTaskTitle: null,
          });
        } else if (currentUserId && !currentStoredUserId) {
          set({ userId: currentUserId });
        }
      },
    }),
    {
      name: 'focusflow_active_task',
      storage: createJSONStorage(() => sessionStorage), // sessionStorage clears on tab close
    }
  )
);

// ============================================================
// TIMER MULTI-TAB BROADCAST BUS
// ============================================================

export const TIMER_BUS_CHANNEL_NAME = 'focusflow_timer_bus';

export interface TimerBusMessage {
  type: 'TIMER_STATE_SYNC' | 'TIMER_PAUSED' | 'TIMER_RESUMED' | 'TIMER_COMPLETED' | 'TIMER_ABANDONED' | 'TIMER_SKIPPED' | 'TIMER_IDLE';
  snapshot: TimerSnapshot;
  senderTabId: string;
}

const tabId = typeof window !== 'undefined' ? Math.random().toString(36).slice(2, 9) : 'server';

let timerBusChannel: BroadcastChannel | null = null;

function getTimerBus(): BroadcastChannel | null {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null;
  if (!timerBusChannel) {
    timerBusChannel = new BroadcastChannel(TIMER_BUS_CHANNEL_NAME);
  }
  return timerBusChannel;
}

export function broadcastTimerMessage(type: TimerBusMessage['type'], snapshot: TimerSnapshot): void {
  try {
    getTimerBus()?.postMessage({
      type,
      snapshot,
      senderTabId: tabId,
    } satisfies TimerBusMessage);
  } catch {
    // Non-blocking
  }
}

// ============================================================
// TIMER ENGINE STORE
// ============================================================

export interface TimerSnapshot {
  sessionId: string | null;
  type: SessionType;
  state: TimerState;
  plannedDurationSeconds: number;
  startedAtMs: number;
  pausedAtMs: number | null;
  totalPausedMs: number;
  taskId: string | null;
  taskTitle: string | null;
  projectId: string | null;
  projectName: string | null;
  projectColor: string | null;
}

export interface TimerStoreState {
  snapshot: TimerSnapshot;
  remainingMs: number;
  elapsedMs: number;
  progressPercent: number;
  isExpired: boolean;
  completedCyclesToday: number;
  otherTabConflict: boolean;

  // Actions
  setCompletedCyclesToday: (count: number) => void;
  setOtherTabConflict: (conflict: boolean) => void;
  initSession: (session: ActiveSessionResponse) => void;
  startSession: (
    sessionId: string,
    type: SessionType,
    plannedDurationSeconds: number,
    startedAt: Date,
    task?: { id: string; title: string } | null,
    project?: { id: string; name: string; color: string } | null
  ) => void;
  pauseSession: (pausedAt: Date) => void;
  resumeSession: (resumedAt: Date) => void;
  completeSession: () => void;
  resetSession: () => void;
  skipSession: () => void;
  tick: (nowMs?: number) => void;
  resetToIdle: (type?: SessionType, plannedDurationSeconds?: number) => void;
  syncFromSnapshot: (snapshot: TimerSnapshot) => void;
}

const DEFAULT_FOCUS_DURATION = 25 * 60; // 1500 seconds

const initialSnapshot: TimerSnapshot = {
  sessionId: null,
  type: 'FOCUS',
  state: 'IDLE',
  plannedDurationSeconds: DEFAULT_FOCUS_DURATION,
  startedAtMs: 0,
  pausedAtMs: null,
  totalPausedMs: 0,
  taskId: null,
  taskTitle: null,
  projectId: null,
  projectName: null,
  projectColor: null,
};

export const useTimerStore = create<TimerStoreState>()((set, get) => ({
  snapshot: initialSnapshot,
  remainingMs: DEFAULT_FOCUS_DURATION * 1000,
  elapsedMs: 0,
  progressPercent: 0,
  isExpired: false,
  completedCyclesToday: 0,
  otherTabConflict: false,

  setCompletedCyclesToday: (count) => {
    set({ completedCyclesToday: count });
  },

  setOtherTabConflict: (conflict) => {
    set({ otherTabConflict: conflict });
  },

  initSession: (session) => {
    const startedAtMs = new Date(session.startedAt).getTime();
    const pausedAtMs = session.pausedAt ? new Date(session.pausedAt).getTime() : null;
    const totalPausedMs = (session.pausedDuration ?? 0) * 1000;

    const snapshot: TimerSnapshot = {
      sessionId: session.id,
      type: session.type,
      state: pausedAtMs !== null ? 'PAUSED' : 'RUNNING',
      plannedDurationSeconds: session.plannedDuration,
      startedAtMs,
      pausedAtMs,
      totalPausedMs,
      taskId: session.taskId,
      taskTitle: session.task?.title ?? null,
      projectId: session.projectId,
      projectName: session.project?.name ?? null,
      projectColor: session.project?.color ?? null,
    };

    const now = Date.now();
    const values = calculateTimerValues(snapshot, now);
    const isExpired = isTimerExpired(snapshot, now);

    set({
      snapshot,
      remainingMs: values.remainingMs,
      elapsedMs: values.elapsedMs,
      progressPercent: values.progressPercent,
      isExpired,
      otherTabConflict: false,
    });
  },

  startSession: (sessionId, type, plannedDurationSeconds, startedAt, task = null, project = null) => {
    const startedAtMs = startedAt.getTime();
    const snapshot: TimerSnapshot = {
      sessionId,
      type,
      state: 'RUNNING',
      plannedDurationSeconds,
      startedAtMs,
      pausedAtMs: null,
      totalPausedMs: 0,
      taskId: task?.id ?? null,
      taskTitle: task?.title ?? null,
      projectId: project?.id ?? null,
      projectName: project?.name ?? null,
      projectColor: project?.color ?? null,
    };

    const now = Date.now();
    const values = calculateTimerValues(snapshot, now);

    set({
      snapshot,
      remainingMs: values.remainingMs,
      elapsedMs: values.elapsedMs,
      progressPercent: values.progressPercent,
      isExpired: false,
      otherTabConflict: false,
    });

    broadcastTimerMessage('TIMER_STATE_SYNC', snapshot);
  },

  pauseSession: (pausedAt) => {
    const snapshot = get().snapshot;
    const pausedAtMs = pausedAt.getTime();
    const updatedSnapshot: TimerSnapshot = {
      ...snapshot,
      state: 'PAUSED',
      pausedAtMs,
    };

    const now = Date.now();
    const values = calculateTimerValues(updatedSnapshot, now);

    set({
      snapshot: updatedSnapshot,
      remainingMs: values.remainingMs,
      elapsedMs: values.elapsedMs,
      progressPercent: values.progressPercent,
      isExpired: false,
    });

    broadcastTimerMessage('TIMER_PAUSED', updatedSnapshot);
  },

  resumeSession: (resumedAt) => {
    const snapshot = get().snapshot;
    const resumedAtMs = resumedAt.getTime();
    const pauseDeltaMs = snapshot.pausedAtMs
      ? Math.max(0, resumedAtMs - snapshot.pausedAtMs)
      : 0;

    const updatedSnapshot: TimerSnapshot = {
      ...snapshot,
      state: 'RUNNING',
      pausedAtMs: null,
      totalPausedMs: snapshot.totalPausedMs + pauseDeltaMs,
    };

    const now = Date.now();
    const values = calculateTimerValues(updatedSnapshot, now);

    set({
      snapshot: updatedSnapshot,
      remainingMs: values.remainingMs,
      elapsedMs: values.elapsedMs,
      progressPercent: values.progressPercent,
      isExpired: false,
    });

    broadcastTimerMessage('TIMER_RESUMED', updatedSnapshot);
  },

  completeSession: () => {
    const snapshot = get().snapshot;
    const updatedSnapshot: TimerSnapshot = {
      ...snapshot,
      state: 'COMPLETED',
    };

    set({
      snapshot: updatedSnapshot,
      remainingMs: 0,
      elapsedMs: snapshot.plannedDurationSeconds * 1000,
      progressPercent: 100,
      isExpired: true,
    });

    broadcastTimerMessage('TIMER_COMPLETED', updatedSnapshot);
  },

  resetSession: () => {
    const snapshot = get().snapshot;
    const updatedSnapshot: TimerSnapshot = {
      ...snapshot,
      state: 'ABANDONED',
    };

    set({
      snapshot: updatedSnapshot,
      remainingMs: 0,
      isExpired: false,
    });

    broadcastTimerMessage('TIMER_ABANDONED', updatedSnapshot);
  },

  skipSession: () => {
    const snapshot = get().snapshot;
    const updatedSnapshot: TimerSnapshot = {
      ...snapshot,
      state: 'SKIPPED',
    };

    set({
      snapshot: updatedSnapshot,
      remainingMs: 0,
      isExpired: false,
    });

    broadcastTimerMessage('TIMER_SKIPPED', updatedSnapshot);
  },

  tick: (nowMs) => {
    const snapshot = get().snapshot;
    if (snapshot.state !== 'RUNNING') {
      return;
    }

    const now = nowMs ?? Date.now();
    const values = calculateTimerValues(snapshot, now);
    const isExpired = isTimerExpired(snapshot, now);

    set({
      remainingMs: values.remainingMs,
      elapsedMs: values.elapsedMs,
      progressPercent: values.progressPercent,
      isExpired,
    });
  },

  resetToIdle: (type = 'FOCUS', plannedDurationSeconds = DEFAULT_FOCUS_DURATION) => {
    const current = get().snapshot;
    const snapshot: TimerSnapshot = {
      sessionId: null,
      type,
      state: 'IDLE',
      plannedDurationSeconds,
      startedAtMs: 0,
      pausedAtMs: null,
      totalPausedMs: 0,
      taskId: current.taskId,
      taskTitle: current.taskTitle,
      projectId: current.projectId,
      projectName: current.projectName,
      projectColor: current.projectColor,
    };

    set({
      snapshot,
      remainingMs: plannedDurationSeconds * 1000,
      elapsedMs: 0,
      progressPercent: 0,
      isExpired: false,
      otherTabConflict: false,
    });

    broadcastTimerMessage('TIMER_IDLE', snapshot);
  },

  syncFromSnapshot: (snapshot) => {
    const now = Date.now();
    const values = calculateTimerValues(snapshot, now);
    const isExpired = isTimerExpired(snapshot, now);

    set({
      snapshot,
      remainingMs: values.remainingMs,
      elapsedMs: values.elapsedMs,
      progressPercent: values.progressPercent,
      isExpired,
    });
  },
}));

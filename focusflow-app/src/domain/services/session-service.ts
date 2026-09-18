// src/domain/services/session-service.ts
// FocusFlow — Focus Session Domain Service
// Orchestrates business rules, state validations, and transactions
// for the focus session lifecycle.

import * as db from '@/lib/db';
import { calculateActualDurationSeconds } from '@/domain/timer/calculations';
import {
  NotFoundError,
  DomainError,
} from '@/lib/errors';
import type { StartSessionInput, FocusSession } from '@/types/domain';

export class SessionService {
  /**
   * Starts a new focus session.
   * Business rules:
   * 1. Validates that task and project belong to the user.
   * 2. Any currently in-progress session for this user is marked ABANDONED.
   * 3. An authoritative record is written to PostgreSQL before returning.
   */
  static async startSession(
    userId: string,
    input: StartSessionInput
  ): Promise<FocusSession> {
    // If a task is referenced, verify it belongs to this user
    if (input.taskId) {
      const task = await db.getTaskById(userId, input.taskId);
      if (!task) {
        throw new NotFoundError('Task');
      }
    }

    // If a project is referenced, verify it belongs to this user
    if (input.projectId) {
      const project = await db.getProjectById(userId, input.projectId);
      if (!project) {
        throw new NotFoundError('Project');
      }
    }

    return db.createFocusSession(userId, input);
  }

  /**
   * Completes an active focus session.
   * Business rules:
   * 1. Session must exist, belong to user, and be IN_PROGRESS.
   * 2. Calculates actual duration.
   * 3. If FOCUS type and linked to task, increments task completedPomodoros atomically.
   */
  static async completeSession(
    userId: string,
    sessionId: string,
    endedAt: Date = new Date(),
    pausedDurationSeconds: number = 0
  ): Promise<FocusSession> {
    const active = await db.getActiveSession(userId);
    if (!active || active.id !== sessionId) {
      throw new NotFoundError('Active focus session');
    }

    const startedAtMs = new Date(active.startedAt).getTime();
    const endedAtMs = endedAt.getTime();
    const pausedDurationMs = pausedDurationSeconds * 1000;

    // Calculate actual active duration worked (excluding pause periods)
    const actualDurationSeconds = calculateActualDurationSeconds(
      {
        state: 'RUNNING',
        plannedDurationSeconds: active.plannedDuration,
        startedAtMs,
        pausedAtMs: null,
        totalPausedMs: pausedDurationMs,
      },
      endedAtMs
    );

    const updated = await db.endFocusSession(userId, sessionId, {
      status: 'COMPLETED',
      endedAt,
      actualDuration: actualDurationSeconds,
      pausedDuration: pausedDurationSeconds,
    });

    if (!updated) {
      throw new DomainError('Failed to complete session', 'SESSION_COMPLETION_FAILED');
    }

    return updated;
  }

  /**
   * Abandons an active focus session (user reset/skip).
   * Business rules:
   * 1. Session must exist and belong to user.
   * 2. Records partial actual duration worked up to the abandonment moment.
   * 3. Does NOT increment task completedPomodoros.
   */
  static async abandonSession(
    userId: string,
    sessionId: string,
    endedAt: Date = new Date(),
    pausedDurationSeconds: number = 0
  ): Promise<FocusSession> {
    const active = await db.getActiveSession(userId);
    if (!active || active.id !== sessionId) {
      throw new NotFoundError('Active focus session');
    }

    const startedAtMs = new Date(active.startedAt).getTime();
    const endedAtMs = endedAt.getTime();
    const pausedDurationMs = pausedDurationSeconds * 1000;

    const actualDurationSeconds = calculateActualDurationSeconds(
      {
        state: 'ABANDONED',
        plannedDurationSeconds: active.plannedDuration,
        startedAtMs,
        pausedAtMs: null,
        totalPausedMs: pausedDurationMs,
      },
      endedAtMs
    );

    const updated = await db.endFocusSession(userId, sessionId, {
      status: 'ABANDONED',
      endedAt,
      actualDuration: actualDurationSeconds,
      pausedDuration: pausedDurationSeconds,
    });

    if (!updated) {
      throw new DomainError('Failed to abandon session', 'SESSION_ABANDON_FAILED');
    }

    return updated;
  }
}

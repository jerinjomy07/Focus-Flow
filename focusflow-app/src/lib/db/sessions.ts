// src/lib/db/sessions.ts
// FocusFlow — Focus Sessions Data Access Layer
// Manages the persistent session lifecycle: creation at start,
// atomic completion transactions, explicit sub-resources, and history querying.

import { prisma } from './client';
import {
  ActiveSessionConflictError,
  NotFoundError,
  ValidationError,
  DomainError,
} from '@/lib/errors';
import type {
  FocusSession,
  FocusSessionWithRelations,
  StartSessionInput,
} from '@/types/domain';
import type { ActiveSessionResponse, SessionListQuery } from '@/types/api';
import {
  resolveCustomRangeBounds,
  normalizeDateInput,
} from '@/domain/productivity/date-range';

/** Helper to check if an error is a Prisma P2002 unique constraint violation */
function isPrismaP2002(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: unknown }).code === 'P2002'
  );
}

/**
 * Retrieves the currently active (IN_PROGRESS) session for a user.
 * Used for refresh recovery and multi-tab state alignment.
 *
 * Implements deterministic reconciliation:
 * 1. If paused (`pausedAt !== null`): returns active session without expiration.
 * 2. If running (`pausedAt === null`) and past expiration boundary: auto-reconciles to COMPLETED.
 */
export async function getActiveSession(
  userId: string
): Promise<ActiveSessionResponse | null> {
  const session = await prisma.focusSession.findFirst({
    where: {
      userId,
      status: 'IN_PROGRESS',
    },
    include: {
      task: {
        select: { id: true, title: true },
      },
      project: {
        select: { id: true, name: true, color: true },
      },
    },
    orderBy: { startedAt: 'desc' },
  });

  if (!session) return null;

  // If session is paused, it NEVER auto-expires (ADR-014 Paused Session Policy)
  if (session.pausedAt !== null) {
    return {
      id: session.id,
      type: session.type,
      status: 'IN_PROGRESS',
      plannedDuration: session.plannedDuration,
      startedAt: session.startedAt,
      pausedAt: session.pausedAt,
      pausedDuration: session.pausedDuration,
      taskId: session.taskId,
      projectId: session.projectId,
      task: session.task,
      project: session.project,
    };
  }

  // Session is actively running — check expiration against wall-clock time
  const nowMs = Date.now();
  const startedAtMs = session.startedAt.getTime();
  const endTimestampMs = startedAtMs + session.plannedDuration * 1000 + session.pausedDuration * 1000;

  if (nowMs >= endTimestampMs) {
    // Reconcile expired running session atomically
    await prisma.$transaction(async (tx) => {
      await tx.focusSession.update({
        where: { id: session.id },
        data: {
          status: 'COMPLETED',
          endedAt: new Date(endTimestampMs),
          actualDuration: session.plannedDuration,
        },
      });

      if (session.type === 'FOCUS' && session.taskId) {
        await tx.task.update({
          where: { id: session.taskId },
          data: { completedPomodoros: { increment: 1 } },
        });
      }
    });

    return null;
  }

  return {
    id: session.id,
    type: session.type,
    status: 'IN_PROGRESS',
    plannedDuration: session.plannedDuration,
    startedAt: session.startedAt,
    pausedAt: null,
    pausedDuration: session.pausedDuration,
    taskId: session.taskId,
    projectId: session.projectId,
    task: session.task,
    project: session.project,
  };
}

/**
 * Starts a new focus session.
 * Enforces single active session per user at database level (ADR-014).
 * Enforces completed task guard and archived project guard.
 */
export async function createFocusSession(
  userId: string,
  data: StartSessionInput
): Promise<FocusSession> {
  return prisma.$transaction(async (tx) => {
    // 1. Check for an existing active session
    const existing = await tx.focusSession.findFirst({
      where: {
        userId,
        status: 'IN_PROGRESS',
      },
    });

    if (existing) {
      // If running and past expiration, auto-reconcile it first
      if (existing.pausedAt === null) {
        const nowMs = Date.now();
        const endTimestampMs =
          existing.startedAt.getTime() +
          existing.plannedDuration * 1000 +
          existing.pausedDuration * 1000;

        if (nowMs >= endTimestampMs) {
          await tx.focusSession.update({
            where: { id: existing.id },
            data: {
              status: 'COMPLETED',
              endedAt: new Date(endTimestampMs),
              actualDuration: existing.plannedDuration,
            },
          });

          if (existing.type === 'FOCUS' && existing.taskId) {
            await tx.task.update({
              where: { id: existing.taskId },
              data: { completedPomodoros: { increment: 1 } },
            });
          }
        } else {
          // Running and unexpired -> conflict!
          throw new ActiveSessionConflictError(existing);
        }
      } else {
        // Paused session -> conflict! Paused sessions do not auto-expire
        throw new ActiveSessionConflictError(existing);
      }
    }

    // 2. Validate linked task if provided
    let effectiveProjectId = data.projectId ?? null;
    if (data.taskId) {
      const task = await tx.task.findFirst({
        where: { id: data.taskId, userId },
        include: { project: true },
      });

      if (!task) {
        throw new NotFoundError('Task not found or does not belong to you');
      }

      // Completed Task Guard: cannot focus a completed task
      if (task.status === 'COMPLETED') {
        throw new ValidationError(
          'Cannot start a focus session on a completed task. Reopen the task first.',
          [{ field: 'taskId', issue: 'TASK_IS_COMPLETED' }]
        );
      }

      // Archived Project Guard: cannot focus tasks in archived projects
      if (task.project && task.project.status === 'ARCHIVED') {
        throw new ValidationError(
          'Cannot start a focus session on a task within an archived project.',
          [{ field: 'projectId', issue: 'PROJECT_IS_ARCHIVED' }]
        );
      }

      if (!effectiveProjectId && task.projectId) {
        effectiveProjectId = task.projectId;
      }

      // Transition TODO task to IN_PROGRESS atomically
      if (task.status === 'TODO') {
        await tx.task.update({
          where: { id: task.id },
          data: { status: 'IN_PROGRESS' },
        });
      }
    }

    // 3. Validate project if provided directly
    if (effectiveProjectId) {
      const project = await tx.project.findFirst({
        where: { id: effectiveProjectId, userId },
      });
      if (!project) {
        throw new NotFoundError('Project not found or does not belong to you');
      }
      if (project.status === 'ARCHIVED') {
        throw new ValidationError(
          'Cannot start a focus session in an archived project.',
          [{ field: 'projectId', issue: 'PROJECT_IS_ARCHIVED' }]
        );
      }
    }

    // 4. Create the authoritative session record
    try {
      const session = await tx.focusSession.create({
        data: {
          userId,
          type: data.type,
          status: 'IN_PROGRESS',
          plannedDuration: data.plannedDuration,
          startedAt: new Date(data.startedAt),
          pausedAt: null,
          pausedDuration: 0,
          taskId: data.taskId ?? null,
          projectId: effectiveProjectId,
        },
      });

      return session as unknown as FocusSession;
    } catch (err) {
      if (isPrismaP2002(err)) {
        throw new ActiveSessionConflictError();
      }
      throw err;
    }
  });
}

/**
 * Pauses an active focus session. Sets pausedAt to current timestamp.
 * Idempotent: returns current record if already paused.
 */
export async function pauseFocusSession(
  userId: string,
  sessionId: string
): Promise<FocusSession> {
  const session = await prisma.focusSession.findFirst({
    where: { id: sessionId, userId },
  });

  if (!session) {
    throw new NotFoundError('Focus session not found');
  }

  if (session.status !== 'IN_PROGRESS') {
    throw new DomainError('Cannot pause a session that is not in progress');
  }

  if (session.pausedAt !== null) {
    return session as unknown as FocusSession;
  }

  const updated = await prisma.focusSession.update({
    where: { id: sessionId },
    data: { pausedAt: new Date() },
  });

  return updated as unknown as FocusSession;
}

/**
 * Resumes a paused focus session.
 * Adds elapsed pause delta to pausedDuration and clears pausedAt to null.
 * Idempotent: returns current record if already running.
 */
export async function resumeFocusSession(
  userId: string,
  sessionId: string
): Promise<FocusSession> {
  const session = await prisma.focusSession.findFirst({
    where: { id: sessionId, userId },
  });

  if (!session) {
    throw new NotFoundError('Focus session not found');
  }

  if (session.status !== 'IN_PROGRESS') {
    throw new DomainError('Cannot resume a session that is not in progress');
  }

  if (session.pausedAt === null) {
    return session as unknown as FocusSession;
  }

  const pauseDeltaSeconds = Math.max(
    0,
    Math.floor((Date.now() - session.pausedAt.getTime()) / 1000)
  );

  const updated = await prisma.focusSession.update({
    where: { id: sessionId },
    data: {
      pausedDuration: session.pausedDuration + pauseDeltaSeconds,
      pausedAt: null,
    },
  });

  return updated as unknown as FocusSession;
}

/**
 * Completes a focus session upon natural countdown expiry.
 * Atomically marks status COMPLETED, sets actualDuration = plannedDuration,
 * and increments Task.completedPomodoros if type === FOCUS.
 * Idempotent: does not re-increment if already finalized.
 */
export async function completeFocusSession(
  userId: string,
  sessionId: string
): Promise<FocusSession> {
  return prisma.$transaction(async (tx) => {
    const session = await tx.focusSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundError('Focus session not found');
    }

    if (session.status !== 'IN_PROGRESS') {
      return session as unknown as FocusSession;
    }

    const updated = await tx.focusSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
        actualDuration: session.plannedDuration,
        pausedAt: null,
      },
    });

    if (session.type === 'FOCUS' && session.taskId) {
      await tx.task.update({
        where: { id: session.taskId },
        data: { completedPomodoros: { increment: 1 } },
      });
    }

    // Phase 10: In-App Notification creation upon FOCUS session completion
    if (session.type === 'FOCUS') {
      const pref = await tx.notificationPreference.findUnique({
        where: { userId },
      });

      const isNotificationEnabled = pref ? pref.focusSessionCompletion : true;

      if (isNotificationEnabled) {
        const plannedMinutes = Math.max(1, Math.round(session.plannedDuration / 60));
        await tx.notification.upsert({
          where: { dedupeKey: `focus-session-completed:${session.id}` },
          create: {
            userId,
            type: 'FOCUS_SESSION_COMPLETED',
            title: 'Focus session completed',
            body: `Your ${plannedMinutes}-minute focus session has been completed.`,
            metadata: { focusSessionId: session.id },
            dedupeKey: `focus-session-completed:${session.id}`,
          },
          update: {},
        });
      }
    }

    return updated as unknown as FocusSession;
  });
}

/**
 * Resets (abandons) an in-progress or paused focus session.
 * Computes active elapsed seconds worked (excluding pause time).
 */
export async function resetFocusSession(
  userId: string,
  sessionId: string
): Promise<FocusSession> {
  const session = await prisma.focusSession.findFirst({
    where: { id: sessionId, userId },
  });

  if (!session) {
    throw new NotFoundError('Focus session not found');
  }

  if (session.status !== 'IN_PROGRESS') {
    return session as unknown as FocusSession;
  }

  const nowMs = Date.now();
  const activeElapsedMs = session.pausedAt
    ? session.pausedAt.getTime() - session.startedAt.getTime() - session.pausedDuration * 1000
    : nowMs - session.startedAt.getTime() - session.pausedDuration * 1000;

  const actualDurationSeconds = Math.max(0, Math.floor(activeElapsedMs / 1000));

  const updated = await prisma.focusSession.update({
    where: { id: sessionId },
    data: {
      status: 'ABANDONED',
      endedAt: new Date(),
      actualDuration: actualDurationSeconds,
      pausedAt: null,
    },
  });

  return updated as unknown as FocusSession;
}

/**
 * Explicitly skips an in-progress or paused focus session to advance the cycle.
 * Marks status as SKIPPED. Does NOT increment task Pomodoro count.
 */
export async function skipFocusSession(
  userId: string,
  sessionId: string
): Promise<FocusSession> {
  const session = await prisma.focusSession.findFirst({
    where: { id: sessionId, userId },
  });

  if (!session) {
    throw new NotFoundError('Focus session not found');
  }

  if (session.status !== 'IN_PROGRESS') {
    return session as unknown as FocusSession;
  }

  const nowMs = Date.now();
  const activeElapsedMs = session.pausedAt
    ? session.pausedAt.getTime() - session.startedAt.getTime() - session.pausedDuration * 1000
    : nowMs - session.startedAt.getTime() - session.pausedDuration * 1000;

  const actualDurationSeconds = Math.max(0, Math.floor(activeElapsedMs / 1000));

  const updated = await prisma.focusSession.update({
    where: { id: sessionId },
    data: {
      status: 'SKIPPED',
      endedAt: new Date(),
      actualDuration: actualDurationSeconds,
      pausedAt: null,
    },
  });

  return updated as unknown as FocusSession;
}

/**
 * Counts the number of completed FOCUS sessions for a user today in their local timezone.
 * Used for server-derived Pomodoro cycle calculation.
 */
export async function getCompletedTodayCount(
  userId: string
): Promise<number> {
  const now = new Date();
  const startOfDayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));

  return prisma.focusSession.count({
    where: {
      userId,
      type: 'FOCUS',
      status: 'COMPLETED',
      startedAt: {
        gte: startOfDayUtc,
      },
    },
  });
}

/**
 * Retrieves paginated session history for a user with full-stack filtering and stable sorting.
 */
export async function getSessionHistory(
  userId: string,
  query: SessionListQuery = {},
  userTimezone: string = 'UTC'
): Promise<{
  sessions: FocusSessionWithRelations[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const {
    type,
    status,
    taskId,
    projectId,
    startDate,
    endDate,
    sort = 'startedAt',
    sortOrder = 'desc',
    page = 1,
    pageSize = 20,
  } = query;

  const skip = (page - 1) * pageSize;

  // Resolve half-open date interval [startUtc, endUtcExclusive)
  let startUtc: Date | undefined;
  let endUtcExclusive: Date | undefined;

  if (startDate && endDate) {
    const range = resolveCustomRangeBounds(startDate, endDate, userTimezone);
    startUtc = range.startUtc;
    endUtcExclusive = range.endUtcExclusive;
  } else if (startDate) {
    startUtc = normalizeDateInput(startDate, false, userTimezone);
  } else if (endDate) {
    endUtcExclusive = normalizeDateInput(endDate, true, userTimezone);
  }

  const where = {
    userId,
    ...(type && { type }),
    ...(status && { status }),
    ...(taskId && { taskId }),
    ...(projectId && { projectId }),
    ...((startUtc || endUtcExclusive) && {
      startedAt: {
        ...(startUtc && { gte: startUtc }),
        ...(endUtcExclusive && { lt: endUtcExclusive }),
      },
    }),
  };

  // Stable multi-column sorting
  const orderBy =
    sort === 'actualDuration'
      ? [{ actualDuration: sortOrder }, { startedAt: 'desc' as const }, { id: 'desc' as const }]
      : [{ startedAt: sortOrder }, { id: 'desc' as const }];

  const [sessions, total] = await Promise.all([
    prisma.focusSession.findMany({
      where,
      include: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            completedPomodoros: true,
            estimatedPomodoros: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
            status: true,
          },
        },
      },
      orderBy,
      skip,
      take: pageSize,
    }),
    prisma.focusSession.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return {
    sessions: sessions as unknown as FocusSessionWithRelations[],
    total,
    totalPages,
    page,
    pageSize,
    hasMore: skip + sessions.length < total,
  };
}

/**
 * Retrieves a single session by ID scoped to the authenticated user.
 * Returns null if not found or belongs to another user.
 */
export async function getSessionById(
  userId: string,
  sessionId: string
): Promise<FocusSessionWithRelations | null> {
  const session = await prisma.focusSession.findFirst({
    where: {
      id: sessionId,
      userId,
    },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          status: true,
          completedPomodoros: true,
          estimatedPomodoros: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          color: true,
          status: true,
        },
      },
    },
  });

  return session as unknown as FocusSessionWithRelations | null;
}

/**
 * Retrieves all sessions for a user within a date interval.
 */
export async function getSessionsForPeriod(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<FocusSession[]> {
  const sessions = await prisma.focusSession.findMany({
    where: {
      userId,
      startedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { startedAt: 'asc' },
  });

  return sessions as unknown as FocusSession[];
}

/**
 * Legacy / unified helper to end a session with a target status.
 * Delegates to explicit functions: completeFocusSession, skipFocusSession, resetFocusSession.
 */
export async function endFocusSession(
  userId: string,
  sessionId: string,
  data: {
    status: 'COMPLETED' | 'ABANDONED' | 'SKIPPED';
    endedAt?: Date;
    actualDuration?: number;
    pausedDuration?: number;
  }
): Promise<FocusSession | null> {
  if (data.status === 'COMPLETED') {
    return completeFocusSession(userId, sessionId);
  } else if (data.status === 'SKIPPED') {
    return skipFocusSession(userId, sessionId);
  } else {
    return resetFocusSession(userId, sessionId);
  }
}

// src/domain/productivity/calculations.ts
// FocusFlow — Pure Productivity Calculation Domain Logic
//
// Pure, deterministic calculation functions for unit testing and formula cross-validation.
// Zero I/O — accepts in-memory arrays and scalar values.

import type {
  FocusSessionRecord,
  DailyProductivitySummary,
  ProjectProductivitySummary,
  TaskProductivitySummary,
} from './types';
import { getProductivityDay } from './date-range';

/**
 * Canonical formula: Completed Focus Time is the sum of actualDuration
 * for sessions where type === 'FOCUS' and status === 'COMPLETED'.
 */
export function calculateCompletedFocusTime(
  sessions: ReadonlyArray<FocusSessionRecord>
): number {
  return sessions
    .filter((s) => s.type === 'FOCUS' && s.status === 'COMPLETED')
    .reduce((acc, s) => acc + (s.actualDuration ?? s.plannedDuration), 0);
}

/**
 * Sum of actualDuration for sessions where type === 'FOCUS' and status === 'ABANDONED'.
 */
export function calculateAbandonedFocusTime(
  sessions: ReadonlyArray<FocusSessionRecord>
): number {
  return sessions
    .filter((s) => s.type === 'FOCUS' && s.status === 'ABANDONED')
    .reduce((acc, s) => acc + (s.actualDuration ?? 0), 0);
}

/**
 * Sum of actualDuration for completed break sessions.
 * Never mixed into completed focus time.
 */
export function calculateBreakTime(
  sessions: ReadonlyArray<FocusSessionRecord>
): number {
  return sessions
    .filter((s) => s.type !== 'FOCUS' && s.status === 'COMPLETED')
    .reduce((acc, s) => acc + (s.actualDuration ?? s.plannedDuration), 0);
}

/**
 * Canonical completionRate formula:
 * (completedFocusSessions / (completedFocusSessions + abandonedFocusSessions)) * 100
 *
 * Rules:
 * - Counts only FOCUS sessions.
 * - COMPLETED contributes to both numerator and denominator.
 * - ABANDONED contributes only to denominator.
 * - SKIPPED, breaks, and IN_PROGRESS do not contribute.
 * - When denominator is 0, returns 0.
 */
export function calculateCompletionRate(
  completedFocusSessions: number,
  abandonedFocusSessions: number
): number {
  const total = completedFocusSessions + abandonedFocusSessions;
  if (total <= 0) return 0;
  return (completedFocusSessions / total) * 100;
}

/**
 * Canonical projectPercentage formula:
 * (projectCompletedFocusDuration / totalCompletedFocusDurationForSameRange) * 100
 *
 * Unrounded floating-point percentage. Presentation rounding is strictly performed by UI.
 * When totalCompletedFocusDuration is 0, returns 0.
 */
export function calculateProjectPercentage(
  projectCompletedFocusDuration: number,
  totalCompletedFocusDuration: number
): number {
  if (totalCompletedFocusDuration <= 0) return 0;
  return (projectCompletedFocusDuration / totalCompletedFocusDuration) * 100;
}

/**
 * Aggregates in-memory sessions for a single local calendar day.
 */
export function aggregateDailySummary(
  sessions: ReadonlyArray<FocusSessionRecord>,
  dateStr: string,
  timezone: string
): DailyProductivitySummary {
  // Filter sessions that started on this local calendar day
  const daySessions = sessions.filter(
    (s) => getProductivityDay(s.startedAt, timezone) === dateStr
  );

  const focusSessions = daySessions.filter((s) => s.type === 'FOCUS');
  const completedFocus = focusSessions.filter((s) => s.status === 'COMPLETED');
  const abandonedFocus = focusSessions.filter((s) => s.status === 'ABANDONED');
  const skippedFocus = focusSessions.filter((s) => s.status === 'SKIPPED');

  const breakSessions = daySessions.filter((s) => s.type !== 'FOCUS');
  const completedBreaks = breakSessions.filter((s) => s.status === 'COMPLETED');

  const completedFocusSeconds = calculateCompletedFocusTime(daySessions);
  const abandonedFocusSeconds = calculateAbandonedFocusTime(daySessions);
  const completedBreakSeconds = calculateBreakTime(daySessions);

  return {
    date: dateStr,
    completedFocusSessions: completedFocus.length,
    completedFocusSeconds,
    completedFocusMinutes: Math.floor(completedFocusSeconds / 60),
    abandonedFocusSessions: abandonedFocus.length,
    abandonedFocusSeconds,
    skippedFocusSessions: skippedFocus.length,
    completedBreakSessions: completedBreaks.length,
    completedBreakSeconds,
    totalSessions: daySessions.length,
    completionRate: calculateCompletionRate(completedFocus.length, abandonedFocus.length),
  };
}

/**
 * Pure breakdown of focus time across projects.
 * projectId = null is mapped to "Unassigned" and participates in the denominator.
 */
export function aggregateProjectBreakdown(
  sessions: ReadonlyArray<
    FocusSessionRecord & {
      project?: { id: string; name: string; color: string | null; status?: string } | null;
    }
  >
): ProjectProductivitySummary[] {
  const completedFocusSessions = sessions.filter(
    (s) => s.type === 'FOCUS' && s.status === 'COMPLETED'
  );

  const totalFocusSeconds = completedFocusSessions.reduce(
    (acc, s) => acc + (s.actualDuration ?? s.plannedDuration),
    0
  );

  const projectMap = new Map<
    string | null,
    {
      name: string;
      color: string | null;
      isArchived: boolean;
      focusSeconds: number;
      completedCount: number;
      totalCount: number;
    }
  >();

  // Count total sessions per project
  for (const s of sessions) {
    const key = s.projectId ?? null;
    const existing = projectMap.get(key) ?? {
      name: s.project?.name ?? (key === null ? 'Unassigned' : 'Unassigned'),
      color: s.project?.color ?? null,
      isArchived: s.project?.status === 'ARCHIVED',
      focusSeconds: 0,
      completedCount: 0,
      totalCount: 0,
    };
    existing.totalCount += 1;
    projectMap.set(key, existing);
  }

  // Accumulate completed focus seconds and count
  for (const s of completedFocusSessions) {
    const key = s.projectId ?? null;
    const item = projectMap.get(key)!;
    item.focusSeconds += s.actualDuration ?? s.plannedDuration;
    item.completedCount += 1;
    if (s.project) {
      item.name = s.project.name;
      item.color = s.project.color;
      item.isArchived = s.project.status === 'ARCHIVED';
    }
  }

  return Array.from(projectMap.entries())
    .map(([projectId, item]) => ({
      projectId,
      projectName: item.name,
      projectColor: item.color,
      isArchived: item.isArchived,
      completedFocusSessions: item.completedCount,
      actualFocusSeconds: item.focusSeconds,
      actualFocusMinutes: Math.floor(item.focusSeconds / 60),
      sessionCount: item.totalCount,
      percentage: calculateProjectPercentage(item.focusSeconds, totalFocusSeconds),
    }))
    .sort((a, b) => b.actualFocusSeconds - a.actualFocusSeconds);
}

/**
 * Pure task breakdown calculation from session records.
 */
export function aggregateTaskBreakdown(
  sessions: ReadonlyArray<
    FocusSessionRecord & {
      task?: { id: string; title: string; completedPomodoros?: number } | null;
    }
  >
): TaskProductivitySummary[] {
  const taskMap = new Map<
    string,
    {
      title: string;
      completedPomodoros: number;
      completedSessions: number;
      focusSeconds: number;
      lastFocusAt: Date | null;
    }
  >();

  for (const s of sessions) {
    if (!s.taskId) continue;

    const existing = taskMap.get(s.taskId) ?? {
      title: s.task?.title ?? 'Task',
      completedPomodoros: s.task?.completedPomodoros ?? 0,
      completedSessions: 0,
      focusSeconds: 0,
      lastFocusAt: null,
    };

    if (s.type === 'FOCUS' && s.status === 'COMPLETED') {
      existing.completedSessions += 1;
      existing.focusSeconds += s.actualDuration ?? s.plannedDuration;
    }

    if (!existing.lastFocusAt || s.startedAt > existing.lastFocusAt) {
      existing.lastFocusAt = s.startedAt;
    }

    taskMap.set(s.taskId, existing);
  }

  return Array.from(taskMap.entries()).map(([taskId, item]) => ({
    taskId,
    taskTitle: item.title,
    completedPomodoros: item.completedPomodoros,
    completedFocusSessions: item.completedSessions,
    actualFocusSeconds: item.focusSeconds,
    actualFocusMinutes: Math.floor(item.focusSeconds / 60),
    lastFocusAt: item.lastFocusAt ? item.lastFocusAt.toISOString() : null,
  }));
}

// src/domain/analytics/index.ts
// FocusFlow — Analytics Domain Logic
//
// Pure calculation functions for productivity analytics.
// All data is derived from real FocusSession records — no fake counters.
// ZERO I/O — these functions accept raw data arrays and return computed results.

// Phase 9 Submodules
export * from './types';
export * from './calculations';
export * from './date-buckets';
export * from './comparisons';

// ============================================================
// INPUT TYPES (minimal, decoupled from Prisma)
// ============================================================

export interface AnalyticsSession {
  startedAt: Date;          // UTC
  type: 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' | 'SKIPPED';
  actualDuration: number | null; // seconds
  plannedDuration: number;       // seconds
  projectId: string | null;
}

export interface AnalyticsSummary {
  totalFocusSeconds: number;
  totalFocusMinutes: number;
  completedPomodoros: number;
  abandonedSessions: number;
  completionRate: number;         // 0–100
  averageSessionDurationSeconds: number;
}

export interface DailyTrendPoint {
  date: string;            // "YYYY-MM-DD" in user's timezone
  focusSeconds: number;
  pomodoroCount: number;
  completedSessions: number;
}

export interface ProjectFocusBreakdown {
  projectId: string | null;
  focusSeconds: number;
  sessionCount: number;
  percentage: number;      // 0–100
}

// ============================================================
// ANALYTICS SUMMARY
// ============================================================

/**
 * Computes an analytics summary for a set of sessions.
 * Input sessions should be pre-filtered to the relevant time period.
 *
 * Only COMPLETED FOCUS sessions contribute to totalFocusSeconds and
 * completedPomodoros. ABANDONED sessions are counted separately.
 */
export function computeAnalyticsSummary(sessions: ReadonlyArray<AnalyticsSession>): AnalyticsSummary {
  const focusSessions = sessions.filter((s) => s.type === 'FOCUS');
  const completedFocus = focusSessions.filter((s) => s.status === 'COMPLETED');
  const abandonedSessions = sessions.filter((s) => s.status === 'ABANDONED');

  const totalFocusSeconds = completedFocus.reduce(
    (acc, s) => acc + (s.actualDuration ?? s.plannedDuration),
    0
  );

  const completedCount = completedFocus.length;
  const abandonedCount = abandonedSessions.length;
  const totalSessionCount = focusSessions.length;

  const completionRate =
    totalSessionCount > 0
      ? Math.round((completedCount / totalSessionCount) * 100)
      : 0;

  const averageSessionDurationSeconds =
    completedCount > 0
      ? Math.round(totalFocusSeconds / completedCount)
      : 0;

  return {
    totalFocusSeconds,
    totalFocusMinutes: Math.floor(totalFocusSeconds / 60),
    completedPomodoros: completedCount,
    abandonedSessions: abandonedCount,
    completionRate,
    averageSessionDurationSeconds,
  };
}

// ============================================================
// DAILY TREND
// ============================================================

/**
 * Groups COMPLETED FOCUS sessions by calendar day in the user's timezone.
 * Returns an array of DailyTrendPoint entries sorted by date ascending.
 *
 * Days with no qualifying sessions are included with zeros if they fall
 * within the requested date range (enables continuous chart rendering).
 *
 * @param sessions - Array of AnalyticsSession records (any time period)
 * @param timezone - User's IANA timezone
 * @param days - How many past days to include (including today)
 * @param now - Optional override for deterministic testing
 */
export function computeDailyTrend(
  sessions: ReadonlyArray<AnalyticsSession>,
  timezone: string,
  days: number = 7,
  now: Date = new Date()
): DailyTrendPoint[] {
  // Build a map of date → aggregated values
  const dayMap = new Map<string, { focusSeconds: number; pomodoroCount: number; completedSessions: number }>();

  // Initialize all days in the range with zeros
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: timezone });
    dayMap.set(dateStr, { focusSeconds: 0, pomodoroCount: 0, completedSessions: 0 });
  }

  // Accumulate only COMPLETED FOCUS sessions
  for (const session of sessions) {
    if (session.type !== 'FOCUS' || session.status !== 'COMPLETED') continue;

    const dateStr = session.startedAt.toLocaleDateString('en-CA', { timeZone: timezone });
    const existing = dayMap.get(dateStr);
    if (!existing) continue; // outside our window

    existing.focusSeconds += session.actualDuration ?? session.plannedDuration;
    existing.pomodoroCount += 1;
    existing.completedSessions += 1;
  }

  // Convert to sorted array
  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, ...values }));
}

// ============================================================
// PROJECT BREAKDOWN
// ============================================================

/**
 * Computes focus time distribution by project from a set of sessions.
 * Returns entries sorted by focusSeconds descending (most-focused first).
 *
 * Sessions without a project are grouped under projectId: null.
 * Input sessions should be pre-filtered to the relevant time period.
 */
export function computeProjectBreakdown(
  sessions: ReadonlyArray<AnalyticsSession>
): ProjectFocusBreakdown[] {
  const projectMap = new Map<string | null, { focusSeconds: number; sessionCount: number }>();

  const completedFocus = sessions.filter(
    (s) => s.type === 'FOCUS' && s.status === 'COMPLETED'
  );

  for (const session of completedFocus) {
    const key = session.projectId;
    const existing = projectMap.get(key) ?? { focusSeconds: 0, sessionCount: 0 };
    existing.focusSeconds += session.actualDuration ?? session.plannedDuration;
    existing.sessionCount += 1;
    projectMap.set(key, existing);
  }

  const totalFocusSeconds = completedFocus.reduce(
    (acc, s) => acc + (s.actualDuration ?? s.plannedDuration),
    0
  );

  return Array.from(projectMap.entries())
    .sort(([, a], [, b]) => b.focusSeconds - a.focusSeconds)
    .map(([projectId, { focusSeconds, sessionCount }]) => ({
      projectId,
      focusSeconds,
      sessionCount,
      percentage:
        totalFocusSeconds > 0
          ? Math.round((focusSeconds / totalFocusSeconds) * 100)
          : 0,
    }));
}

// ============================================================
// GOAL PROGRESS
// ============================================================

/**
 * Computes progress toward a goal from session data.
 * Returns a value between 0 and target (not capped).
 *
 * @param sessions - Sessions for the goal period (pre-filtered by date range)
 * @param goalType - 'POMODORO_COUNT' | 'FOCUS_DURATION'
 * @param target - Goal target value
 */
export function computeGoalProgress(
  sessions: ReadonlyArray<AnalyticsSession>,
  goalType: 'POMODORO_COUNT' | 'FOCUS_DURATION',
  target: number
): { progress: number; percentage: number } {
  const completedFocus = sessions.filter(
    (s) => s.type === 'FOCUS' && s.status === 'COMPLETED'
  );

  let progress: number;
  if (goalType === 'POMODORO_COUNT') {
    progress = completedFocus.length;
  } else {
    // FOCUS_DURATION: target in minutes, progress in minutes
    const totalSeconds = completedFocus.reduce(
      (acc, s) => acc + (s.actualDuration ?? s.plannedDuration),
      0
    );
    progress = Math.floor(totalSeconds / 60);
  }

  const percentage = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0;

  return { progress, percentage };
}

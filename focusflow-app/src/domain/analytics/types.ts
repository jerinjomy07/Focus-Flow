// src/domain/analytics/types.ts
// FocusFlow — Advanced Analytics Domain Types (Phase 9)

export interface AnalyticsComparison {
  currentValue: number;
  previousValue: number;
  absoluteDelta: number;
  percentageDelta: number | null; // null when previousValue === 0
  direction: 'up' | 'down' | 'unchanged';
}

export interface AnalyticsOverviewResponse {
  period?: 'today' | 'yesterday' | 'week' | 'month';
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"

  // Core focus totals
  completedFocusSeconds: number;
  completedFocusMinutes: number;
  completedFocusSessions: number;
  abandonedFocusSeconds: number;
  abandonedFocusSessions: number;
  completionRate: number; // unrounded numeric float (0-100)
  averageCompletedSessionSeconds: number;
  longestCompletedSessionSeconds: number;
  totalBreakSeconds: number;
  totalSessions: number;

  // Consistency
  activeFocusDays: number;
  totalDaysInRange: number;
  consistencyRate: number; // unrounded numeric float (0-100)

  // Period-over-Period comparison vs preceding equivalent range
  previousPeriod: {
    startDate: string;
    endDate: string;
  };
  comparisons: {
    focusTime: AnalyticsComparison;
    completedSessions: AnalyticsComparison;
    completionRate: AnalyticsComparison;
    abandonedSessions: AnalyticsComparison;
  };
}

export interface WeekdayAnalyticsPoint {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Monday, 6 = Sunday
  label: string;                       // "Mon", "Tue", etc.
  completedFocusSeconds: number;
  completedFocusMinutes: number;
  completedSessions: number;
  averageSessionSeconds: number;
}

export interface HourlyAnalyticsPoint {
  hour: number;  // 0-23
  label: string; // "00:00", "01:00", ..., "23:00"
  completedFocusSeconds: number;
  completedFocusMinutes: number;
  completedSessions: number;
}

export interface ProjectAnalyticsPoint {
  projectId: string | null;
  projectName: string;
  projectColor: string | null;
  isArchived: boolean;
  completedFocusSeconds: number;
  completedFocusMinutes: number;
  sessionCount: number;
  percentage: number; // unrounded float (0-100)
}

export interface AnalyticsDistributionsResponse {
  period?: 'today' | 'yesterday' | 'week' | 'month';
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
  weekday: WeekdayAnalyticsPoint[];
  hourly: HourlyAnalyticsPoint[];
  projects: ProjectAnalyticsPoint[];
  peakWeekday: WeekdayAnalyticsPoint | null;
  peakHour: HourlyAnalyticsPoint | null;
}

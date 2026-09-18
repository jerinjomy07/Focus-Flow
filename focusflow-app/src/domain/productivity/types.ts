// src/domain/productivity/types.ts
// FocusFlow — Productivity Domain Types

import type { SessionType, SessionStatus } from '@/types/domain';

export interface DateRangeBoundsUtc {
  startUtc: Date;
  endUtcExclusive: Date;
}

export interface LocalPeriodBoundsUtc extends DateRangeBoundsUtc {
  localDateStr: string;
}

export interface FocusSessionRecord {
  id: string;
  type: SessionType;
  status: SessionStatus;
  plannedDuration: number;
  actualDuration: number | null;
  startedAt: Date;
  endedAt: Date | null;
  taskId?: string | null;
  projectId?: string | null;
}

export interface DailyProductivitySummary {
  date: string; // "YYYY-MM-DD" in user's timezone
  completedFocusSessions: number;
  completedFocusSeconds: number;
  completedFocusMinutes: number;
  abandonedFocusSessions: number;
  abandonedFocusSeconds: number;
  skippedFocusSessions: number;
  completedBreakSessions: number;
  completedBreakSeconds: number;
  totalSessions: number;
  completionRate: number; // 0–100 derived via completed / (completed + abandoned) * 100
}

export interface RangeProductivitySummary {
  startDate: string; // ISO UTC or YYYY-MM-DD
  endDate: string;
  completedFocusSessions: number;
  completedFocusSeconds: number;
  completedFocusMinutes: number;
  abandonedFocusSessions: number;
  abandonedFocusSeconds: number;
  skippedFocusSessions: number;
  completedBreakSessions: number;
  completedBreakSeconds: number;
  totalSessions: number;
  completionRate: number;
}

export interface ProjectProductivitySummary {
  projectId: string | null;
  projectName: string;
  projectColor: string | null;
  isArchived: boolean;
  completedFocusSessions: number;
  actualFocusSeconds: number;
  actualFocusMinutes: number;
  sessionCount: number;
  percentage: number; // unrounded numeric float (0-100)
}

export interface TaskProductivitySummary {
  taskId: string;
  taskTitle: string;
  completedPomodoros: number;
  completedFocusSessions: number;
  actualFocusSeconds: number;
  actualFocusMinutes: number;
  lastFocusAt: string | null; // ISO 8601 UTC
}

export interface ProductivityTrendPoint {
  date: string; // "YYYY-MM-DD" in user's timezone
  focusSeconds: number;
  focusMinutes: number;
  completedSessions: number;
}

export interface ProductivityTrendResponse {
  period?: 'today' | 'yesterday' | 'week' | 'month';
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
  totalFocusSeconds: number;
  totalFocusMinutes: number;
  points: ProductivityTrendPoint[];
}

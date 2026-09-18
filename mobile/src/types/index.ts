// mobile/src/types/index.ts
// FocusFlow Mobile — Shared Domain & API Types

export interface User {
  id: string;
  name: string;
  email: string;
  timezone: string;
  onboardedAt: string | null;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  taskCount?: number;
  completedTaskCount?: number;
  totalFocusSeconds?: number;
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  projectId: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  project?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

export type SessionStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED' | 'SKIPPED';
export type SessionType = 'POMODORO' | 'SHORT_BREAK' | 'LONG_BREAK';

export interface FocusSession {
  id: string;
  userId: string;
  taskId: string | null;
  projectId: string | null;
  status: SessionStatus;
  type: SessionType;
  startedAt: string;
  endedAt: string | null;
  targetDurationMinutes: number;
  durationSeconds: number | null;
  elapsedSeconds?: number;
  pausedAt?: string | null;
  pauseSeconds?: number;
  task?: {
    id: string;
    title: string;
  } | null;
  project?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

export interface ProductivitySummary {
  totalFocusSeconds: number;
  completedSessions: number;
  completionRate: number;
  dailyGoalSeconds: number;
  dailyGoalProgressPercent: number;
  todayFocusSeconds: number;
  streakCount: number;
}

export interface AnalyticsOverview {
  totalFocusSeconds: number;
  completedSessions: number;
  averageSessionDurationMinutes: number;
  completionRate: number;
  activeDays: number;
  totalDays: number;
  consistencyRate: number;
  streakCount: number;
}

export interface HourlyDistribution {
  hour: number;
  focusSeconds: number;
  sessionCount: number;
}

export interface WeekdayDistribution {
  weekday: number;
  dayName: string;
  focusSeconds: number;
  sessionCount: number;
}

export interface UserSettings {
  focusDurationMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  dailyGoalMinutes: number;
  soundEnabled: boolean;
  soundVolume: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  theme: 'SYSTEM' | 'LIGHT' | 'DARK';
  timezone: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  dedupeKey: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationPreferences {
  sessionCompleted: boolean;
  dailyGoalAchieved: boolean;
  streakReminder: boolean;
}

export interface APIError {
  code: string;
  message: string;
  details?: Array<{ field: string; issue: string }>;
}

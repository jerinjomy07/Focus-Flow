// src/types/api.ts
// FocusFlow — API Request/Response Type Contracts
// These types define the public API surface. They deliberately
// do NOT expose raw Prisma types to prevent tight coupling.

import type {
  User,
  UserSettings,
  SessionType,
  ProjectStatus,
  TaskStatus,
  Priority,
  GoalType,
  GoalPeriod,
  Theme,
  ProjectWithStats,
  TaskWithProject,
  FocusSessionWithRelations,
  GoalWithProgress,
} from './domain';

// ============================================================
// STANDARD RESPONSE ENVELOPES
// ============================================================

export interface ApiSuccessResponse<T> {
  data: T;
  meta?: ApiMeta;
}

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  hasMore?: boolean;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; issue: string }>;
  };
}

// Union type for any API response
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================================
// ERROR CODES
// ============================================================

export const ApiErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  ACTIVE_SESSION_EXISTS: 'ACTIVE_SESSION_EXISTS',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TASK_IS_COMPLETED: 'TASK_IS_COMPLETED',
  PROJECT_IS_ARCHIVED: 'PROJECT_IS_ARCHIVED',
} as const;

export type ApiErrorCode = (typeof ApiErrorCodes)[keyof typeof ApiErrorCodes];

// ============================================================
// USER & SETTINGS RESPONSES
// ============================================================

export type UserResponse = Pick<User, 'id' | 'name' | 'email' | 'image' | 'timezone' | 'createdAt'>;

export type SettingsResponse = Omit<UserSettings, 'id' | 'userId'> & { timezone?: string };

// ============================================================
// PROJECT RESPONSES
// ============================================================

export type ProjectResponse = ProjectWithStats;

// ============================================================
// TASK RESPONSES
// ============================================================

export type TaskResponse = TaskWithProject;

// ============================================================
// FOCUS SESSION RESPONSES
// ============================================================

export type SessionResponse = FocusSessionWithRelations;

export interface ActiveSessionResponse {
  id: string;
  type: SessionType;
  status: 'IN_PROGRESS';
  plannedDuration: number;
  startedAt: Date;
  pausedAt: Date | null;
  pausedDuration: number;
  taskId: string | null;
  projectId: string | null;
  task: { id: string; title: string } | null;
  project: { id: string; name: string; color: string } | null;
}

// ============================================================
// ANALYTICS RESPONSES
// ============================================================

export interface AnalyticsSummaryResponse {
  period: 'today' | 'week' | 'month';
  totalFocusSeconds: number;
  totalFocusMinutes: number;
  completedPomodoros: number;
  abandonedSessions: number;
  completionRate: number;
  averageSessionDurationSeconds: number;
  currentStreakDays: number;
  longestStreakDays: number;
}

export interface DailyTrendPoint {
  date: string; // "YYYY-MM-DD" in user's local timezone
  focusSeconds: number;
  pomodoroCount: number;
  completedSessions: number;
}

export interface ProjectFocusBreakdown {
  project: { id: string; name: string; color: string } | null;
  focusSeconds: number;
  sessionCount: number;
  percentage: number;
}

// ============================================================
// PRODUCTIVITY RESPONSES (Phase 7 Foundation)
// ============================================================

export interface DailyProductivitySummaryResponse {
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
  completionRate: number; // unrounded float: completed / (completed + abandoned) * 100
}

export interface RangeProductivitySummaryResponse {
  startDate: string;
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

export interface ProjectProductivityResponse {
  projectId: string | null;
  projectName: string;
  projectColor: string | null;
  isArchived: boolean;
  completedFocusSessions: number;
  actualFocusSeconds: number;
  actualFocusMinutes: number;
  sessionCount: number;
  percentage: number; // unrounded float derived from duration ratio
}

export interface TaskProductivityResponse {
  taskId: string;
  taskTitle: string;
  completedPomodoros: number;
  completedFocusSessions: number;
  actualFocusSeconds: number;
  actualFocusMinutes: number;
  lastFocusAt: string | null;
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

// ============================================================
// GOAL RESPONSES
// ============================================================

export type GoalResponse = GoalWithProgress;

// ============================================================
// HEALTH CHECK RESPONSE
// ============================================================

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  database: {
    status: 'connected' | 'disconnected';
    latencyMs?: number;
  };
}

// ============================================================
// REQUEST SCHEMAS (typed input shapes that match Zod schemas)
// ============================================================

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string | null;
  color?: string;
  status?: ProjectStatus;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  projectId?: string | null;
  priority?: Priority;
  estimatedPomodoros?: number | null;
  dueDate?: string | null;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: Priority;
  projectId?: string | null;
  estimatedPomodoros?: number | null;
  dueDate?: string | null;
}

export interface StartSessionRequest {
  type: SessionType;
  plannedDuration: number; // seconds
  startedAt: string;       // ISO 8601 UTC
  taskId?: string | null;
  projectId?: string | null;
}

export interface EndSessionRequest {
  status: 'COMPLETED' | 'ABANDONED';
  endedAt: string;        // ISO 8601 UTC
  actualDuration: number; // seconds
  pausedDuration: number; // seconds
}

export interface CreateGoalRequest {
  type: GoalType;
  target: number;
  period: GoalPeriod;
}

export interface UpdateSettingsRequest {
  focusDuration?: number;
  shortBreakDuration?: number;
  longBreakDuration?: number;
  sessionsBeforeLongBreak?: number;
  autoStartBreaks?: boolean;
  autoStartFocus?: boolean;
  soundEnabled?: boolean;
  notificationsEnabled?: boolean;
  theme?: Theme;
}

export interface UpdateUserRequest {
  name?: string;
  timezone?: string;
}

// ============================================================
// QUERY PARAMETER TYPES
// ============================================================

export interface TaskListQuery {
  projectId?: string;
  status?: TaskStatus;
  priority?: Priority;
  search?: string;
  dueDateFilter?: 'all' | 'today' | 'overdue' | 'upcoming' | 'none';
  sort?: 'dueDate' | 'priority' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface ProjectListQuery {
  status?: ProjectStatus;
}

export interface SessionListQuery {
  type?: 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
  status?: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' | 'SKIPPED';
  taskId?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
  sort?: 'startedAt' | 'actualDuration';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface ProductivitySummaryQuery {
  period?: 'today' | 'yesterday' | 'week' | 'month';
  date?: string;
  startDate?: string;
  endDate?: string;
}

export interface AnalyticsSummaryQuery {
  period?: 'today' | 'week' | 'month';
}

export interface DailyTrendQuery {
  days?: 7 | 14 | 30;
}

export interface ByProjectQuery {
  period?: 'week' | 'month' | 'all';
}

// ============================================================
// PHASE 9 ANALYTICS CONTRACTS
// ============================================================

export type {
  AnalyticsComparison,
  AnalyticsOverviewResponse,
  WeekdayAnalyticsPoint,
  HourlyAnalyticsPoint,
  ProjectAnalyticsPoint,
  AnalyticsDistributionsResponse,
} from '@/domain/analytics';

// ============================================================
// PHASE 10 SETTINGS & NOTIFICATIONS CONTRACTS
// ============================================================

export interface NotificationPreferencesResponse {
  focusSessionCompletion: boolean;
}

export interface NotificationResponse {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationListResponse {
  data: NotificationResponse[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
    unreadCount: number;
  };
}


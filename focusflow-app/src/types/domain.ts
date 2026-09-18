// src/types/domain.ts
// FocusFlow — Canonical Domain Types
// These are the authoritative TypeScript types for FocusFlow domain entities.
// They are intentionally decoupled from Prisma-generated types to keep the
// domain layer portable and independently testable.

// ============================================================
// ENUMS
// ============================================================

export type Theme = 'LIGHT' | 'DARK' | 'SYSTEM';

export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type SessionType = 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';

export type SessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' | 'SKIPPED';

export type GoalType = 'POMODORO_COUNT' | 'FOCUS_DURATION';

export type GoalPeriod = 'DAILY' | 'WEEKLY';

export type NotificationType = 'FOCUS_SESSION_COMPLETED';

// Timer state machine states
export type TimerState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ABANDONED' | 'SKIPPED';

// ============================================================
// CORE DOMAIN ENTITIES
// ============================================================

/**
 * User — The root identity entity for the platform.
 * All user-owned resources link back to this via userId.
 */
export interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  image: string | null;
  timezone: string; // IANA timezone string, e.g. "Asia/Kolkata"
  onboardedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * UserSettings — Per-user timer and notification preferences.
 * Created automatically during onboarding. One-to-one with User.
 */
export interface UserSettings {
  id: string;
  userId: string;
  focusDuration: number;           // minutes (1–120)
  shortBreakDuration: number;      // minutes (1–60)
  longBreakDuration: number;       // minutes (1–120)
  sessionsBeforeLongBreak: number; // (1–10)
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  theme: Theme;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Project — Organizational grouping for tasks and time investments.
 */
export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  color: string; // Hex color, e.g. "#6366f1"
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Task — Actionable unit of work with priority and Pomodoro tracking.
 */
export interface Task {
  id: string;
  userId: string;
  projectId: string | null; // null = "Inbox" (no project)
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  estimatedPomodoros: number | null;
  completedPomodoros: number;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * FocusSession — Persistent ledger entry for every timer execution.
 * Source of truth for all productivity analytics. Never deleted.
 */
export interface FocusSession {
  id: string;
  userId: string;
  taskId: string | null;
  projectId: string | null; // denormalized from task for analytics
  type: SessionType;
  status: SessionStatus;
  plannedDuration: number;  // seconds
  actualDuration: number | null; // seconds; null until ended
  startedAt: Date;          // UTC
  endedAt: Date | null;     // UTC; null until ended
  pausedAt: Date | null;    // UTC; null while running, set when paused
  pausedDuration: number;   // accumulated pause seconds
  createdAt: Date;
}

/**
 * Goal — Daily or weekly productivity target.
 * Progress is always derived from FocusSession records.
 */
export interface Goal {
  id: string;
  userId: string;
  type: GoalType;
  target: number; // count or minutes depending on type
  period: GoalPeriod;
  startDate: Date;
  endDate: Date | null; // null = indefinite / recurring
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// TIMER DOMAIN TYPES
// ============================================================

/**
 * TimerSessionSnapshot — Immutable record of the timer's current state.
 * This is the authoritative data structure used by the timer domain
 * calculations. It contains ONLY what is needed to compute remaining
 * time and elapsed duration. No UI state or React state here.
 *
 * All time values are Unix epoch milliseconds.
 */
export interface TimerSessionSnapshot {
  readonly id: string;                       // DB FocusSession ID (set after server confirms)
  readonly type: SessionType;
  readonly state: TimerState;
  readonly plannedDurationSeconds: number;   // e.g. 1500 for 25 minutes
  readonly startedAtMs: number;              // Unix epoch ms when session began
  readonly pausedAtMs: number | null;        // Epoch ms when most recently paused; null if not paused
  readonly totalPausedMs: number;            // Cumulative pause duration in ms (all pauses combined)
  readonly taskId: string | null;
  readonly projectId: string | null;
}

/**
 * Timer events — all possible actions dispatched to the state machine.
 */
export type TimerEvent =
  | { type: 'START'; sessionId: string; startedAtMs: number; plannedDurationSeconds: number; taskId?: string | null; projectId?: string | null; sessionType: SessionType }
  | { type: 'PAUSE'; pausedAtMs: number }
  | { type: 'RESUME'; resumedAtMs: number }
  | { type: 'TIME_EXPIRED'; atMs: number }
  | { type: 'RESET'; atMs: number }
  | { type: 'SKIP'; atMs: number }
  | { type: 'DISMISS' }
  | { type: 'START_NEXT'; sessionId: string; startedAtMs: number; plannedDurationSeconds: number; sessionType: SessionType };

// ============================================================
// ENRICHED / VIEW TYPES
// These types are used in API responses and UI — they include
// related data that would require joins to assemble.
// ============================================================

export interface TaskWithProject extends Task {
  project: Pick<Project, 'id' | 'name' | 'color'> | null;
}

export interface FocusSessionWithRelations extends FocusSession {
  task: Pick<Task, 'id' | 'title'> | null;
  project: Pick<Project, 'id' | 'name' | 'color'> | null;
}

export interface ProjectWithStats extends Project {
  taskCount: number;
  completedTaskCount: number;
}

export interface ProjectDetail extends ProjectWithStats {
  tasks: Task[];
}

export interface GoalWithProgress extends Goal {
  progress: number;    // current progress toward target
  percentage: number;  // 0–100 (capped)
}

/**
 * Notification — In-app notification entity.
 */
export interface NotificationMetadata {
  focusSessionId?: string;
  [key: string]: unknown;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  readAt: Date | null;
  metadata: NotificationMetadata | null;
  dedupeKey: string | null;
  createdAt: Date;
}

/**
 * NotificationPreference — User-level notification delivery preferences.
 */
export interface NotificationPreference {
  id: string;
  userId: string;
  focusSessionCompletion: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// INPUT / DTO TYPES
// These represent the typed inputs for domain operations.
// Validated by Zod schemas before being passed here.
// ============================================================

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  color?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  color?: string;
  status?: ProjectStatus;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  projectId?: string | null;
  priority?: Priority;
  estimatedPomodoros?: number | null;
  dueDate?: Date | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: Priority;
  projectId?: string | null;
  estimatedPomodoros?: number | null;
  dueDate?: Date | null;
}

export interface StartSessionInput {
  type: SessionType;
  plannedDuration: number; // seconds
  startedAt: Date;
  taskId?: string | null;
  projectId?: string | null;
}

export interface EndSessionInput {
  status: 'COMPLETED' | 'ABANDONED';
  endedAt: Date;
  actualDuration: number; // seconds
  pausedDuration: number; // seconds
}

export interface CreateGoalInput {
  type: GoalType;
  target: number;
  period: GoalPeriod;
}

export interface UpdateGoalInput {
  target?: number;
  isActive?: boolean;
}

export interface UpdateSettingsInput {
  focusDuration?: number;
  shortBreakDuration?: number;
  longBreakDuration?: number;
  sessionsBeforeLongBreak?: number;
  autoStartBreaks?: boolean;
  autoStartFocus?: boolean;
  soundEnabled?: boolean;
  notificationsEnabled?: boolean;
  theme?: Theme;
  timezone?: string;
}

export interface UpdateNotificationPreferenceInput {
  focusSessionCompletion?: boolean;
}

export interface UpdateUserInput {
  name?: string;
  timezone?: string;
  image?: string | null;
}

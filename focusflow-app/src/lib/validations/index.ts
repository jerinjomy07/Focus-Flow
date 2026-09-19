// src/lib/validations/index.ts
// FocusFlow — Runtime Validation Schemas (Zod)
// All external input MUST be validated through these schemas before
// reaching domain logic or the database. TypeScript types alone
// do NOT provide runtime safety.

import { z } from 'zod';

// ============================================================
// REUSABLE PRIMITIVES
// ============================================================

/** Valid IANA timezone string validator */
const ianaTimezone = z
  .string()
  .refine(
    (tz) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Must be a valid IANA timezone string (e.g. "America/New_York")' }
  );

/** Valid hex color validator */
const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid 6-character hex color (e.g. "#6366f1")');

/** CUID string validator */
const cuid = z.string().cuid('Must be a valid resource identifier');

/** ISO 8601 UTC datetime string */
const isoDatetime = z.string().datetime({ message: 'Must be a valid ISO 8601 UTC datetime string' });

// ============================================================
// AUTH & USER SCHEMAS
// ============================================================

export const RegisterSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or fewer'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Must be a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or fewer'),
}).strict();
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const ResetPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Must be a valid email address'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or fewer'),
}).strict();
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Must be a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .max(128, 'Password must be 128 characters or fewer'),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const OnboardingCompleteSchema = z.object({
  timezone: ianaTimezone,
  focusDuration: z.number().int().min(1).max(120).default(25),
  shortBreakDuration: z.number().int().min(1).max(60).default(5),
  longBreakDuration: z.number().int().min(1).max(120).default(15),
  dailyGoal: z.number().int().min(1).max(50).default(4),
  firstProjectName: z.string().trim().max(100).optional(),
  firstTaskTitle: z.string().trim().max(200).optional(),
});
export type OnboardingCompleteInput = z.infer<typeof OnboardingCompleteSchema>;

export const UpdateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name must be 100 characters or fewer')
    .optional(),
  timezone: ianaTimezone.optional(),
}).strict();
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

// ============================================================
// SETTINGS SCHEMA
// ============================================================

export const UpdateSettingsSchema = z
  .object({
    focusDuration: z
      .number()
      .int()
      .min(1, 'Focus duration must be at least 1 minute')
      .max(120, 'Focus duration cannot exceed 120 minutes')
      .optional(),
    shortBreakDuration: z
      .number()
      .int()
      .min(1, 'Short break must be at least 1 minute')
      .max(60, 'Short break cannot exceed 60 minutes')
      .optional(),
    longBreakDuration: z
      .number()
      .int()
      .min(1, 'Long break must be at least 1 minute')
      .max(120, 'Long break cannot exceed 120 minutes')
      .optional(),
    sessionsBeforeLongBreak: z
      .number()
      .int()
      .min(1, 'Must be at least 1 session')
      .max(10, 'Cannot exceed 10 sessions')
      .optional(),
    autoStartBreaks: z.boolean().optional(),
    autoStartFocus: z.boolean().optional(),
    soundEnabled: z.boolean().optional(),
    notificationsEnabled: z.boolean().optional(),
    theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(),
    timezone: ianaTimezone.optional(),
  })
  .strict();
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;

// ============================================================
// NOTIFICATION SCHEMAS
// ============================================================

export const UpdateNotificationPreferenceSchema = z
  .object({
    focusSessionCompletion: z.boolean({
      message: 'focusSessionCompletion must be a boolean',
    }).optional(),
  })
  .strict();
export type UpdateNotificationPreferenceInput = z.infer<typeof UpdateNotificationPreferenceSchema>;

export const NotificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z
    .union([z.boolean(), z.string().transform((v) => v === 'true' || v === '1')])
    .optional(),
});
export type NotificationListQueryInput = z.infer<typeof NotificationListQuerySchema>;

// ============================================================
// PROJECT SCHEMAS
// ============================================================

export const CreateProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be 100 characters or fewer'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must be 500 characters or fewer')
    .optional()
    .nullable(),
  color: hexColor.default('#6366f1'),
}).strict();
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Project name cannot be empty')
      .max(100)
      .optional(),
    description: z.string().trim().max(500).optional().nullable(),
    color: hexColor.optional(),
    status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  })
  .strict();
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

// ============================================================
// TASK SCHEMAS
// ============================================================

export const CreateTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Task title is required')
    .max(200, 'Task title must be 200 characters or fewer'),
  description: z
    .string()
    .trim()
    .max(2000, 'Description must be 2000 characters or fewer')
    .optional()
    .nullable(),
  projectId: cuid.optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  estimatedPomodoros: z
    .number()
    .int()
    .min(1, 'Estimated Pomodoros must be at least 1')
    .max(50, 'Estimated Pomodoros cannot exceed 50')
    .optional()
    .nullable(),
  dueDate: isoDatetime.optional().nullable(),
}).strict();
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED']).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    projectId: cuid.optional().nullable(),
    estimatedPomodoros: z.number().int().min(1).max(50).optional().nullable(),
    dueDate: isoDatetime.optional().nullable(),
  })
  .strict();
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

// ============================================================
// FOCUS SESSION SCHEMAS
// ============================================================

/** Maximum sane session duration: 2 hours (7200 seconds) */
const MAX_SESSION_DURATION_SECONDS = 7_200;
/** Minimum sane session duration: 60 seconds */
const MIN_SESSION_DURATION_SECONDS = 60;

export const StartSessionSchema = z.object({
  type: z.enum(['FOCUS', 'SHORT_BREAK', 'LONG_BREAK']),
  plannedDuration: z
    .number()
    .int()
    .min(MIN_SESSION_DURATION_SECONDS, 'Session must be at least 60 seconds')
    .max(MAX_SESSION_DURATION_SECONDS, 'Session cannot exceed 2 hours (7200 seconds)'),
  startedAt: isoDatetime,
  taskId: cuid.optional().nullable(),
  projectId: cuid.optional().nullable(),
}).strict();
export type StartSessionInput = z.infer<typeof StartSessionSchema>;

export const EndSessionSchema = z.object({
  status: z.enum(['COMPLETED', 'ABANDONED']),
  endedAt: isoDatetime,
  actualDuration: z
    .number()
    .int()
    .min(0, 'Actual duration cannot be negative')
    .max(MAX_SESSION_DURATION_SECONDS * 2, 'Actual duration is unreasonably large'),
  pausedDuration: z
    .number()
    .int()
    .min(0, 'Paused duration cannot be negative')
    .default(0),
});
export type EndSessionInput = z.infer<typeof EndSessionSchema>;

// ============================================================
// GOAL SCHEMAS
// ============================================================

export const CreateGoalSchema = z.object({
  type: z.enum(['POMODORO_COUNT', 'FOCUS_DURATION']),
  target: z
    .number()
    .int()
    .min(1, 'Target must be at least 1')
    .max(1000, 'Target cannot exceed 1000'),
  period: z.enum(['DAILY', 'WEEKLY']),
});
export type CreateGoalInput = z.infer<typeof CreateGoalSchema>;

export const UpdateGoalSchema = z
  .object({
    target: z.number().int().min(1).max(1000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export type UpdateGoalInput = z.infer<typeof UpdateGoalSchema>;

// ============================================================
// QUERY PARAMETER SCHEMAS
// ============================================================

/** Safely coerce string query params to integers */
const pageNumber = z
  .union([z.string(), z.number()])
  .transform((v) => parseInt(String(v), 10))
  .pipe(z.number().int().min(1).max(10_000))
  .default(1);

const pageSize = z
  .union([z.string(), z.number()])
  .transform((v) => parseInt(String(v), 10))
  .pipe(z.number().int().min(1).max(100))
  .default(50);

export const TaskListQuerySchema = z.object({
  projectId: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  search: z.string().trim().max(100).optional(),
  dueDateFilter: z.enum(['all', 'today', 'overdue', 'upcoming', 'none']).default('all'),
  sort: z.enum(['dueDate', 'priority', 'createdAt', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: pageNumber,
  pageSize: pageSize,
});
export type TaskListQuery = z.infer<typeof TaskListQuerySchema>;

export const ProjectListQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
});
export type ProjectListQuery = z.infer<typeof ProjectListQuerySchema>;

export const SessionListQuerySchema = z.object({
  type: z.enum(['FOCUS', 'SHORT_BREAK', 'LONG_BREAK']).optional(),
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'SKIPPED']).optional(),
  taskId: z.string().optional(),
  projectId: z.string().optional(),
  startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  endDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  sort: z.enum(['startedAt', 'actualDuration']).default('startedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: pageNumber,
  pageSize: z
    .union([z.string(), z.number()])
    .transform((v) => parseInt(String(v), 10))
    .pipe(z.number().int().min(1).max(100))
    .default(20),
});
export type SessionListQuery = z.infer<typeof SessionListQuerySchema>;

export const ProductivitySummaryQuerySchema = z
  .object({
    period: z.enum(['today', 'yesterday', 'week', 'month']).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD').optional(),
    startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    endDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  })
  .superRefine((data, ctx) => {
    const hasPeriod = data.period !== undefined;
    const hasDate = data.date !== undefined;
    const hasStartDate = data.startDate !== undefined;
    const hasEndDate = data.endDate !== undefined;

    // Custom range mode requires both startDate and endDate
    if ((hasStartDate && !hasEndDate) || (!hasStartDate && hasEndDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Custom range mode requires both startDate and endDate',
        path: [hasStartDate ? 'endDate' : 'startDate'],
      });
      return;
    }

    const hasCustomRange = hasStartDate && hasEndDate;
    const activeModesCount = (hasPeriod ? 1 : 0) + (hasDate ? 1 : 0) + (hasCustomRange ? 1 : 0);

    // 0 modes is valid (defaults applied in service). 1 mode is valid. 2+ is rejected.
    if (activeModesCount > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Productivity summary query modes (period, date, custom range) are mutually exclusive',
        path: hasDate ? ['date'] : hasPeriod ? ['period'] : ['startDate'],
      });
    }
  });
export type ProductivitySummaryQuery = z.infer<typeof ProductivitySummaryQuerySchema>;

export const AnalyticsSummaryQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month']).default('today'),
});
export type AnalyticsSummaryQuery = z.infer<typeof AnalyticsSummaryQuerySchema>;

export const DailyTrendQuerySchema = z.object({
  days: z
    .union([z.string(), z.number()])
    .transform((v) => parseInt(String(v), 10))
    .pipe(z.union([z.literal(7), z.literal(14), z.literal(30)]))
    .default(7),
});
export type DailyTrendQuery = z.infer<typeof DailyTrendQuerySchema>;

export const ByProjectQuerySchema = z.object({
  period: z.enum(['week', 'month', 'all']).default('week'),
});
export type ByProjectQuery = z.infer<typeof ByProjectQuerySchema>;

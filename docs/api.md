# FocusFlow — API Design

**Version:** 0.1.0 (Phase 0 — Discovery)
**Date:** 2026-09-17
**Status:** Draft

---

## 1. Conventions

### Base URL

Development: `http://localhost:3000/api`
Production: `https://focusflow.app/api`

### Authentication

All authenticated endpoints require a valid Auth.js session (cookie-based). Unauthenticated requests return `401`.

### Response Envelope

**Success:**
```json
{
  "data": { ... },
  "meta": { "page": 1, "pageSize": 20, "total": 100 }
}
```

**Error:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": { "field": "error description" }
  }
}
```

### HTTP Status Codes

| Code | Usage |
|---|---|
| 200 | Success (GET, PATCH) |
| 201 | Created (POST) |
| 204 | Success, no content (DELETE) |
| 400 | Validation error |
| 401 | Unauthenticated |
| 403 | Forbidden (reserved; prefer 404 to prevent enumeration) |
| 404 | Not found (also used for unauthorized access to another user's resource) |
| 409 | Conflict (e.g., duplicate email) |
| 422 | Unprocessable entity (valid JSON, invalid business rules) |
| 429 | Rate limited |
| 500 | Internal server error |

---

## 2. Authentication Endpoints

### POST /api/auth/register

**Auth:** Public  
**Rate limit:** 5/hour per IP

**Request:**
```typescript
{
  name: string;      // min 1, max 100
  email: string;     // valid email
  password: string;  // min 8 chars
}
```

**Response 201:**
```typescript
{
  data: {
    user: {
      id: string;
      name: string;
      email: string;
      createdAt: string;
    }
  }
}
```

**Errors:** 400 (validation), 409 (email taken)

---

### POST /api/auth/[...nextauth]

Handled entirely by Auth.js. Provides:
- `POST /api/auth/signin` — credentials login
- `POST /api/auth/signout` — logout
- `GET /api/auth/session` — current session

---

## 3. User Settings Endpoints

### GET /api/settings

**Auth:** Required  
**Response 200:**
```typescript
{
  data: {
    focusDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
    sessionsBeforeLongBreak: number;
    autoStartBreaks: boolean;
    autoStartFocus: boolean;
    soundEnabled: boolean;
    notificationsEnabled: boolean;
    theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  }
}
```

---

### PATCH /api/settings

**Auth:** Required

**Request (all fields optional):**
```typescript
{
  focusDuration?: number;              // 1–120 minutes
  shortBreakDuration?: number;         // 1–60 minutes
  longBreakDuration?: number;          // 1–120 minutes
  sessionsBeforeLongBreak?: number;    // 1–10
  autoStartBreaks?: boolean;
  autoStartFocus?: boolean;
  soundEnabled?: boolean;
  notificationsEnabled?: boolean;
  theme?: 'LIGHT' | 'DARK' | 'SYSTEM';
}
```

**Response 200:** Updated settings object (same shape as GET)

---

## 4. Project Endpoints

### GET /api/projects

**Auth:** Required  
**Query:** `?status=ACTIVE|ARCHIVED`

**Response 200:**
```typescript
{
  data: Array<{
    id: string;
    name: string;
    description: string | null;
    color: string;
    status: 'ACTIVE' | 'ARCHIVED';
    taskCount: number;       // derived
    createdAt: string;
    updatedAt: string;
  }>
}
```

---

### POST /api/projects

**Auth:** Required

**Request:**
```typescript
{
  name: string;          // min 1, max 100
  description?: string;  // max 500
  color?: string;        // hex color, default '#6366f1'
}
```

**Response 201:**
```typescript
{ data: { id: string; name: string; color: string; ... } }
```

---

### GET /api/projects/:id

**Auth:** Required  
**Response 200:** Full project object  
**Errors:** 404 (not found or wrong user)

---

### PATCH /api/projects/:id

**Auth:** Required

**Request (all optional):**
```typescript
{
  name?: string;
  description?: string;
  color?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
}
```

**Response 200:** Updated project object

---

### DELETE /api/projects/:id

**Auth:** Required  
**Response 204:** No content  
**Side effects:** Sets `projectId = null` on all tasks in this project

---

## 5. Task Endpoints

### GET /api/tasks

**Auth:** Required  
**Query:**
```
?projectId=<id>
?status=TODO|IN_PROGRESS|COMPLETED
?priority=LOW|MEDIUM|HIGH|URGENT
?page=1&pageSize=50
```

**Response 200:**
```typescript
{
  data: Array<{
    id: string;
    title: string;
    description: string | null;
    status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    estimatedPomodoros: number | null;
    completedPomodoros: number;
    dueDate: string | null;
    projectId: string | null;
    project: { id: string; name: string; color: string } | null;
    createdAt: string;
    updatedAt: string;
  }>,
  meta: { page: number; pageSize: number; total: number }
}
```

---

### POST /api/tasks

**Auth:** Required

**Request:**
```typescript
{
  title: string;              // min 1, max 200
  description?: string;       // max 2000
  projectId?: string;         // must belong to current user
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  estimatedPomodoros?: number; // 1–50
  dueDate?: string;           // ISO 8601 datetime
}
```

**Response 201:** Created task object

---

### GET /api/tasks/:id

**Auth:** Required  
**Response 200:** Full task object  
**Errors:** 404

---

### PATCH /api/tasks/:id

**Auth:** Required

**Request (all optional):**
```typescript
{
  title?: string;
  description?: string;
  status?: 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  projectId?: string | null;
  estimatedPomodoros?: number | null;
  dueDate?: string | null;
}
```

**Response 200:** Updated task object

---

### DELETE /api/tasks/:id

**Auth:** Required  
**Response 204:** No content  
**Side effects:** `focusSessions.taskId` set to null (SET NULL cascade)

---

## 6. Focus Session Endpoints

### POST /api/focus-sessions

Creates a session at the moment it starts.

**Auth:** Required

**Request:**
```typescript
{
  type: 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
  plannedDuration: number;  // seconds
  startedAt: string;        // ISO 8601 UTC datetime
  taskId?: string;          // must belong to current user
  projectId?: string;       // must belong to current user
}
```

**Response 201:**
```typescript
{
  data: {
    id: string;
    type: string;
    plannedDuration: number;
    startedAt: string;
    status: 'IN_PROGRESS';
  }
}
```

**Validation:**
- `taskId` and `projectId` ownership verified server-side
- Existing `IN_PROGRESS` session for this user → 409 Conflict (or auto-abandon previous)
- `plannedDuration` must be > 0 and ≤ 7200 (2 hours)

---

### PATCH /api/focus-sessions/:id

Updates a session when it completes, is abandoned, or pauses.

**Auth:** Required

**Request:**
```typescript
{
  status: 'COMPLETED' | 'ABANDONED';
  endedAt: string;          // ISO 8601 UTC datetime
  actualDuration: number;   // seconds
  pausedDuration: number;   // seconds paused
}
```

**Response 200:** Updated session object

**Side effects:**
- If `status = COMPLETED` and `type = FOCUS` and `taskId` is set: increment `task.completedPomodoros`

---

### GET /api/focus-sessions/active

Returns the current in-progress session (for page refresh recovery).

**Auth:** Required

**Response 200:**
```typescript
{
  data: {
    id: string;
    type: string;
    plannedDuration: number;
    startedAt: string;
    pausedAt: string | null;
    pausedDuration: number;
    taskId: string | null;
    projectId: string | null;
    task: { id: string; title: string } | null;
    status: 'IN_PROGRESS';
  } | null  // null if no active session
}
```

---

### GET /api/focus-sessions

**Auth:** Required  
**Query:** `?page=1&pageSize=20&type=FOCUS&status=COMPLETED`

**Response 200:**
```typescript
{
  data: Array<{
    id: string;
    type: string;
    status: string;
    plannedDuration: number;
    actualDuration: number | null;
    startedAt: string;
    endedAt: string | null;
    task: { id: string; title: string } | null;
    project: { id: string; name: string; color: string } | null;
  }>,
  meta: { page: number; pageSize: number; total: number }
}
```

---

## 7. Goal Endpoints

### GET /api/goals

**Auth:** Required

**Response 200:**
```typescript
{
  data: Array<{
    id: string;
    type: 'POMODORO_COUNT' | 'FOCUS_DURATION';
    target: number;
    period: 'DAILY' | 'WEEKLY';
    isActive: boolean;
    progress: number;   // derived: current progress toward target
    percentage: number; // min(100, floor(progress/target*100))
  }>
}
```

---

### POST /api/goals

**Auth:** Required

**Request:**
```typescript
{
  type: 'POMODORO_COUNT' | 'FOCUS_DURATION';
  target: number;    // 1–100 for count; 1–480 for duration (minutes)
  period: 'DAILY' | 'WEEKLY';
}
```

**Response 201:** Created goal with progress

---

### PATCH /api/goals/:id

**Auth:** Required  
**Request:** `{ target?: number; isActive?: boolean }`  
**Response 200:** Updated goal

---

### DELETE /api/goals/:id

**Auth:** Required  
**Response 204:** No content

---

## 8. Analytics Endpoints

### GET /api/analytics/summary

**Auth:** Required  
**Query:** `?period=today|week|month`

**Response 200:**
```typescript
{
  data: {
    totalFocusTime: number;         // seconds
    totalSessions: number;
    completedSessions: number;
    abandonedSessions: number;
    averageSessionDuration: number; // seconds
    pomodoroCount: number;          // completed FOCUS sessions
    currentStreak: number;          // days
    longestStreak: number;          // days
  }
}
```

---

### GET /api/analytics/daily-trend

**Auth:** Required  
**Query:** `?days=7|14|30`

**Response 200:**
```typescript
{
  data: Array<{
    date: string;              // 'YYYY-MM-DD'
    focusTime: number;         // seconds
    pomodoroCount: number;
    completedSessions: number;
  }>
}
```

---

### GET /api/analytics/by-project

**Auth:** Required  
**Query:** `?period=week|month|all`

**Response 200:**
```typescript
{
  data: Array<{
    project: { id: string; name: string; color: string } | null; // null = no project
    focusTime: number;   // seconds
    sessionCount: number;
  }>
}
```

---

### GET /api/analytics/overview

**Auth:** Required  
**Query:** Mutually exclusive modes: `?date=YYYY-MM-DD` | `?period=today|yesterday|week|month` (default: week) | `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

**Response 200:**
```typescript
{
  data: {
    period?: 'today' | 'yesterday' | 'week' | 'month';
    startDate: string;
    endDate: string;
    completedFocusSeconds: number;
    completedFocusMinutes: number;
    completedFocusSessions: number;
    abandonedFocusSeconds: number;
    abandonedFocusSessions: number;
    completionRate: number; // unrounded float (0-100)
    averageCompletedSessionSeconds: number;
    longestCompletedSessionSeconds: number;
    totalBreakSeconds: number;
    totalSessions: number;
    activeFocusDays: number;
    totalDaysInRange: number;
    consistencyRate: number; // unrounded float (0-100)
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
}
```

---

### GET /api/analytics/distributions

**Auth:** Required  
**Query:** Mutually exclusive modes: `?date=YYYY-MM-DD` | `?period=today|yesterday|week|month` (default: week) | `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

**Response 200:**
```typescript
{
  data: {
    period?: 'today' | 'yesterday' | 'week' | 'month';
    startDate: string;
    endDate: string;
    weekday: WeekdayAnalyticsPoint[]; // 7 days (Mon=0..Sun=6)
    hourly: HourlyAnalyticsPoint[];   // 24 hours (0..23)
    projects: ProjectAnalyticsPoint[]; // ranked with unrounded percentages
    peakWeekday: WeekdayAnalyticsPoint | null;
    peakHour: HourlyAnalyticsPoint | null;
  }
}
```

---

## 9. User Profile Endpoints

### GET /api/users/me

**Auth:** Required

**Response 200:**
```typescript
{
  data: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    timezone: string;
    createdAt: string;
  }
}
```

---

### PATCH /api/users/me

**Auth:** Required

**Request:**
```typescript
{
  name?: string;      // max 100
  timezone?: string;  // valid IANA timezone
  image?: string;     // URL, max 500
}
```

**Response 200:** Updated user object

---

## 10. Settings & Notifications Endpoints

### GET /api/settings

**Auth:** Required

Retrieves user's timer durations, behavior preferences, and authoritative IANA timezone.

**Response 200:**
```typescript
{
  data: {
    focusDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
    sessionsBeforeLongBreak: number;
    autoStartBreaks: boolean;
    autoStartFocus: boolean;
    soundEnabled: boolean;
    notificationsEnabled: boolean;
    theme: 'SYSTEM' | 'LIGHT' | 'DARK';
    timezone: string; // Authoritative IANA timezone
  }
}
```

---

### PATCH /api/settings

**Auth:** Required

Updates timer settings and/or user timezone.

**Request:**
```typescript
{
  focusDuration?: number;           // 1..120
  shortBreakDuration?: number;      // 1..60
  longBreakDuration?: number;       // 1..120
  sessionsBeforeLongBreak?: number; // 1..10
  autoStartBreaks?: boolean;
  autoStartFocus?: boolean;
  soundEnabled?: boolean;
  notificationsEnabled?: boolean;
  theme?: 'SYSTEM' | 'LIGHT' | 'DARK';
  timezone?: string;                // valid IANA timezone e.g. "America/New_York"
}
```

**Response 200:** Updated settings object with timezone

---

### GET /api/notification-preferences

**Auth:** Required

Retrieves notification delivery preferences.

**Response 200:**
```typescript
{
  data: {
    focusSessionCompletion: boolean;
  }
}
```

---

### PATCH /api/notification-preferences

**Auth:** Required

Updates notification delivery preferences.

**Request:**
```typescript
{
  focusSessionCompletion: boolean;
}
```

**Response 200:** Updated notification preference object

---

### GET /api/notifications

**Auth:** Required

Retrieves paginated notifications for the authenticated user, sorted newest first.

**Query Parameters:**
- `page?: number` (default: 1)
- `pageSize?: number` (default: 20, max: 50)
- `unreadOnly?: boolean`

**Response 200:**
```typescript
{
  data: Array<{
    id: string;
    userId: string;
    type: 'FOCUS_SESSION_COMPLETED';
    title: string;
    body: string;
    readAt: string | null;
    metadata: { focusSessionId: string } | null;
    createdAt: string;
  }>;
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
    unreadCount: number;
  };
}
```

---

### PATCH /api/notifications/:id/read

**Auth:** Required

Marks an individual notification as read. Idempotent. Returns `404 NOT_FOUND` if notification does not exist or belongs to another user.

**Response 200:** Updated notification object

---

### POST /api/notifications/read-all

**Auth:** Required

Marks all unread notifications read for the authenticated user.

**Response 200:**
```typescript
{
  data: {
    count: number; // Number of notifications marked read
  }
}
```

---

## 11. Health Endpoint

### GET /api/health

**Auth:** None (Public)  
**Caching:** `Cache-Control: no-store, no-cache, must-revalidate`

Exposes liveness and database readiness status for uptime monitors (e.g., Vercel, Pingdom, BetterStack). Performs an efficient single-row database connectivity probe (`SELECT 1`). Never leaks internal connection strings, credentials, or stack traces.

**Response 200 (Healthy):**
```json
{
  "status": "healthy",
  "timestamp": "2026-09-17T18:34:00.000Z",
  "uptimeSeconds": 142,
  "version": "1.0.0",
  "database": {
    "status": "connected",
    "latencyMs": 12
  }
}
```

**Response 503 (Unhealthy / DB Degraded):**
```json
{
  "status": "unhealthy",
  "timestamp": "2026-09-17T18:34:00.000Z",
  "version": "1.0.0",
  "database": {
    "status": "disconnected"
  },
  "error": "Database connection failed"
}
```

---

## 12. Error Code Reference

| Code | Description |
|---|---|
| `UNAUTHORIZED` | No valid session |
| `VALIDATION_ERROR` | Request body failed Zod validation |
| `NOT_FOUND` | Resource not found (or belongs to another user) |
| `CONFLICT` | Duplicate resource (e.g., email already registered) |
| `RATE_LIMITED` | Too many requests |
| `INTERNAL_ERROR` | Unhandled server error |
| `ACTIVE_SESSION_EXISTS` | Attempt to start session when one is already running |

# FocusFlow — API Architecture

**Version:** 1.0.0 (Phase 1 — Technical Foundation)  
**Date:** 2026-09-17  
**Status:** Approved Architectural Specification  

---

## 1. Architectural Conventions & Standards

FocusFlow's backend API is implemented as **Next.js Route Handlers** (`app/api/**/route.ts`). The API adheres to RESTful resource-oriented design with strict typing, uniform response envelopes, runtime Zod validation, and tenant-isolated authorization.

### 1.1 Base URLs
- **Local Development:** `http://localhost:3000/api`
- **Production:** `https://<domain>/api`

### 1.2 Response Envelope Specification

Every API endpoint returns JSON matching one of two standardized envelope contracts.

#### Success Response
```typescript
interface ApiSuccessResponse<T> {
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    hasMore?: boolean;
  };
}
```

#### Error Response
```typescript
interface ApiErrorResponse {
  error: {
    code: string;            // Machine-readable uppercase error token (e.g. 'VALIDATION_ERROR')
    message: string;         // Human-readable, sanitized explanation
    details?: Array<{        // Field-specific validation failures or context
      field: string;
      issue: string;
    }>;
  };
}
```

### 1.3 Standard HTTP Status Codes

| Status Code | Usage in FocusFlow |
|---|---|
| `200 OK` | Successful query (`GET`) or resource mutation (`PATCH`, `PUT`). |
| `201 Created` | Successful resource instantiation (`POST`). |
| `204 No Content` | Successful deletion (`DELETE`) with no body returned. |
| `400 Bad Request` | Zod validation failure or malformed payload. |
| `401 Unauthorized` | Missing or invalid authentication session cookie. |
| `404 Not Found` | Resource does not exist **OR belongs to another user** (prevents ID enumeration). |
| `409 Conflict` | Uniqueness conflict (duplicate email) or concurrent active session collision. |
| `422 Unprocessable Entity` | Valid payload syntax, but violates domain invariant (e.g. setting break duration to 0). |
| `429 Too Many Requests` | Rate limit breached (e.g. auth brute-force protection). |
| `500 Internal Server Error` | Unexpected runtime crash. Error is logged to Sentry; sanitized response returned. |

---

## 2. Global Request Pipeline

Every incoming API request passes through a standard four-stage pipeline before touching domain logic:

```
Incoming Request
      │
      ▼
1. Authentication Guard  ──▶ [No Session] ──▶ Return 401 Unauthorized
      │
      ▼ (Extract userId)
2. Zod Input Validation  ──▶ [Invalid Input] ──▶ Return 400 Bad Request (Field Details)
      │
      ▼ (Parsed & Typed DTO)
3. Domain / App Service  ──▶ [Not Found / Forbidden] ──▶ Return 404 Not Found
      │                  ──▶ [Invariant Breach] ──▶ Return 422 Unprocessable
      ▼
4. PostgreSQL (Prisma)
      │
      ▼
Sanitized JSON Response (200 / 201)
```

---

## 3. Detailed Domain Endpoint Specifications

### 3.1 Authentication Domain (`/api/auth`)

Authentication routes are governed by Auth.js v5 with credentials and OAuth handlers.

#### 3.1.1 Register New User
* **Endpoint:** `POST /api/auth/register`
* **Authn Requirement:** Public (Rate limit: 5 requests/hour per IP)
* **Request Schema (Zod):**
  ```typescript
  export const RegisterSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(100),
    email: z.string().trim().toLowerCase().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters").max(128)
  });
  ```
* **Success Response (`201 Created`):**
  ```json
  {
    "data": {
      "user": {
        "id": "clrk91h000001...",
        "name": "Alex Miller",
        "email": "alex@example.com",
        "createdAt": "2026-09-17T00:00:00.000Z"
      }
    }
  }
  ```
* **Error Cases:** `400 Bad Request` (Zod error), `409 Conflict` (`EMAIL_ALREADY_EXISTS`), `429 Too Many Requests`.

---

### 3.2 User & Settings Domain (`/api/users`, `/api/settings`)

#### 3.2.1 Get Current User Profile
* **Endpoint:** `GET /api/users/me`
* **Authn / Authz:** Authenticated session required.
* **Success Response (`200 OK`):**
  ```json
  {
    "data": {
      "id": "usr_123",
      "name": "Alex Miller",
      "email": "alex@example.com",
      "timezone": "America/New_York",
      "image": null,
      "createdAt": "2026-09-17T00:00:00.000Z"
    }
  }
  ```

#### 3.2.2 Update User Profile
* **Endpoint:** `PATCH /api/users/me`
* **Authn / Authz:** Authenticated session required.
* **Request Schema (Zod):**
  ```typescript
  export const UpdateUserSchema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    timezone: z.string().refine((tz) => Intl.supportedValuesOf('timeZone').includes(tz), {
      message: "Invalid IANA timezone string"
    }).optional()
  });
  ```
* **Success Response (`200 OK`):** Updated user object.

#### 3.2.3 Get User Settings
* **Endpoint:** `GET /api/settings`
* **Authn / Authz:** Authenticated session required.
* **Success Response (`200 OK`):**
  ```json
  {
    "data": {
      "focusDuration": 25,
      "shortBreakDuration": 5,
      "longBreakDuration": 15,
      "sessionsBeforeLongBreak": 4,
      "autoStartBreaks": false,
      "autoStartFocus": false,
      "soundEnabled": true,
      "notificationsEnabled": true,
      "theme": "SYSTEM"
    }
  }
  ```

#### 3.2.4 Update User Settings
* **Endpoint:** `PATCH /api/settings`
* **Authn / Authz:** Authenticated session required.
* **Request Schema (Zod):**
  ```typescript
  export const UpdateSettingsSchema = z.object({
    focusDuration: z.number().int().min(1).max(120).optional(),
    shortBreakDuration: z.number().int().min(1).max(60).optional(),
    longBreakDuration: z.number().int().min(1).max(120).optional(),
    sessionsBeforeLongBreak: z.number().int().min(1).max(10).optional(),
    autoStartBreaks: z.boolean().optional(),
    autoStartFocus: z.boolean().optional(),
    soundEnabled: z.boolean().optional(),
    notificationsEnabled: z.boolean().optional(),
    theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional()
  });
  ```
* **Success Response (`200 OK`):** Updated settings object.

---

### 3.3 Projects Domain (`/api/projects`)

#### 3.3.1 List Projects
* **Endpoint:** `GET /api/projects`
* **Query Parameters:** `?status=ACTIVE|ARCHIVED` (optional)
* **Authn / Authz:** Authenticated session required. Only returns projects where `userId = session.user.id`.
* **Success Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": "prj_123",
        "name": "FocusFlow MVP",
        "description": "Core platform architecture and MVP",
        "color": "#6366f1",
        "status": "ACTIVE",
        "taskCount": 12,
        "createdAt": "2026-09-17T00:00:00.000Z",
        "updatedAt": "2026-09-17T00:00:00.000Z"
      }
    ]
  }
  ```

#### 3.3.2 Create Project
* **Endpoint:** `POST /api/projects`
* **Request Schema (Zod):**
  ```typescript
  export const CreateProjectSchema = z.object({
    name: z.string().trim().min(1, "Project name is required").max(100),
    description: z.string().trim().max(500).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid 6-character hex color").default("#6366f1")
  });
  ```
* **Success Response (`201 Created`):** Created project object.

#### 3.3.3 Update Project
* **Endpoint:** `PATCH /api/projects/[id]`
* **Authz:** Rejects with `404 Not Found` if project does not belong to `session.user.id`.
* **Request Schema (Zod):**
  ```typescript
  export const UpdateProjectSchema = CreateProjectSchema.partial().extend({
    status: z.enum(['ACTIVE', 'ARCHIVED']).optional()
  });
  ```
* **Success Response (`200 OK`):** Updated project object.

#### 3.3.4 Delete Project
* **Endpoint:** `DELETE /api/projects/[id]`
* **Authz:** `WHERE id = [id] AND userId = session.user.id` (returns 404 if mismatch).
* **ADR-013 History Preservation Guard:** If the project has recorded focus sessions, deletion is rejected with `409 Conflict` (`PROJECT_HAS_SESSIONS`). Projects with history must be archived instead.
* **Success Response (`200 OK` / `204 No Content`):** Success response. Associated tasks have `projectId` set to `null`.

#### 3.3.5 Archive Project
* **Endpoint:** `POST /api/projects/[id]/archive`
* **Authz:** Rejects with `404 Not Found` if not owned by `session.user.id`.
* **Behavior:** Sets `status = 'ARCHIVED'`. Preserves all task assignments and session analytics.
* **Success Response (`200 OK`):** Updated project object with `status: "ARCHIVED"`.

#### 3.3.6 Restore Project
* **Endpoint:** `POST /api/projects/[id]/restore`
* **Authz:** Rejects with `404 Not Found` if not owned by `session.user.id`.
* **Behavior:** Sets `status = 'ACTIVE'`.
* **Success Response (`200 OK`):** Updated project object with `status: "ACTIVE"`.

---

### 3.4 Tasks Domain (`/api/tasks`)

#### 3.4.1 List Tasks
* **Endpoint:** `GET /api/tasks`
* **Query Parameters:**
  - `projectId`: string | `'inbox'` (optional)
  - `status`: `'ALL'` | `'TODO'` | `'IN_PROGRESS'` | `'COMPLETED'` (optional)
  - `priority`: `'LOW'` | `'MEDIUM'` | `'HIGH'` | `'URGENT'` (optional)
  - `dueDateFilter`: `'all'` | `'today'` | `'overdue'` | `'upcoming'` | `'none'` (optional)
  - `search`: string (optional, searches title and description)
  - `sort`: `'createdAt'` | `'dueDate'` | `'priority'` | `'title'` (default: `'createdAt'`)
  - `sortOrder`: `'asc'` | `'desc'` (default: `'desc'`)
  - `page`: integer (default: 1)
  - `pageSize`: integer (default: 50, max: 100)
* **Authz:** Scoped strictly by `userId = session.user.id`.
* **Success Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": "tsk_123",
        "projectId": "prj_123",
        "title": "Implement Timer State Machine",
        "description": "Pure domain transitions and unit tests",
        "status": "IN_PROGRESS",
        "priority": "HIGH",
        "estimatedPomodoros": 4,
        "completedPomodoros": 2,
        "dueDate": "2026-09-20T23:59:59.999Z",
        "project": { "id": "prj_123", "name": "FocusFlow MVP", "color": "#6366f1" },
        "createdAt": "2026-09-17T00:00:00.000Z",
        "updatedAt": "2026-09-17T00:00:00.000Z"
      }
    ],
    "meta": { "page": 1, "pageSize": 50, "total": 1, "hasMore": false }
  }
  ```

#### 3.4.2 Create Task
* **Endpoint:** `POST /api/tasks`
* **Request Schema (Zod):**
  ```typescript
  export const CreateTaskSchema = z.object({
    title: z.string().trim().min(1, "Task title is required").max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    projectId: z.string().cuid().optional().nullable(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
    estimatedPomodoros: z.number().int().min(1).max(50).optional().nullable(),
    dueDate: z.string().datetime().optional().nullable()
  });
  ```
* **Domain Validation:** If `projectId` is passed, verify `Project.userId === session.user.id`. If invalid, return `400 Bad Request: Invalid projectId`.
* **Success Response (`201 Created`):** Created task object.

#### 3.4.3 Update Task
* **Endpoint:** `PATCH /api/tasks/[id]`
* **Authz:** `WHERE id = [id] AND userId = session.user.id` (returns 404 on failure).
* **Request Schema (Zod):**
  ```typescript
  export const UpdateTaskSchema = CreateTaskSchema.partial().extend({
    status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED']).optional()
  });
  ```
* **Canonical Transition Matrix:** Validates `isValidTaskTransition(currentStatus, nextStatus)`.
* **Success Response (`200 OK`):** Updated task object.

#### 3.4.4 Delete Task
* **Endpoint:** `DELETE /api/tasks/[id]`
* **Authz:** Validates ownership; returns `204 No Content` or `200 OK`. Associated `FocusSession` rows have `taskId` set to `null`.

#### 3.4.5 Complete Task
* **Endpoint:** `POST /api/tasks/[id]/complete`
* **Authz:** Scoped to `userId = session.user.id`.
* **Behavior:** Sets `status = 'COMPLETED'`.
* **Success Response (`200 OK`):** Updated task object.

#### 3.4.6 Reopen Task
* **Endpoint:** `POST /api/tasks/[id]/reopen`
* **Authz:** Scoped to `userId = session.user.id`.
* **Behavior:** Transitions to `IN_PROGRESS` if `completedPomodoros > 0`, otherwise `TODO`.
* **Success Response (`200 OK`):** Updated task object.

---


### 3.5 Focus Sessions Domain (`/api/focus-sessions`)

The focus sessions domain manages the real-time lifecycle, persistence, and recovery of Pomodoro timer sessions. Generic `PATCH` updates are strictly prohibited; all state mutations use explicit, action-oriented REST sub-resources to guarantee atomicity, idempotency, and state machine integrity.

#### 3.5.1 Start Focus Session
* **Endpoint:** `POST /api/focus-sessions`
* **Description:** Initiates an active session record in PostgreSQL before the client timer runs. Enforces the database-level single active session guarantee (ADR-014).
* **Request Schema (Zod):**
  ```typescript
  export const StartSessionSchema = z.object({
    type: z.enum(['FOCUS', 'SHORT_BREAK', 'LONG_BREAK']),
    plannedDuration: z.number().int().min(60).max(7200), // 1m to 120m in seconds
    startedAt: z.string().datetime(),                     // ISO UTC string
    taskId: z.string().cuid().optional().nullable(),
    projectId: z.string().cuid().optional().nullable()
  });
  ```
* **Invariants & Domain Guards:**
  1. **Single Active Session Guarantee (ADR-014):** A user can have at most ONE active session (`status = 'IN_PROGRESS'`). Attempting to start a session when an active unexpired session exists returns `409 Conflict: ACTIVE_SESSION_EXISTS` with the active session payload. The PostgreSQL partial unique index `unique_active_session_per_user` guarantees engine-level isolation.
  2. **Deterministic Auto-Reconciliation:** If an existing session has expired (`now >= startedAt + plannedDuration + pausedDuration`), it is deterministically finalized (running sessions become `COMPLETED`, stale paused sessions become `ABANDONED`) before creating the new session.
  3. **Archived Project Guard:** If `taskId` or `projectId` belongs to an archived project (`Project.status === 'ARCHIVED'`), the request is rejected with `400 Bad Request: PROJECT_IS_ARCHIVED`.
  4. **Task Ownership & State Transition:** If `taskId` is supplied, verify ownership. If the task is `TODO`, atomically transition it to `IN_PROGRESS`.
  5. **Project Inheritance:** If `projectId` is not supplied, inherit `projectId` from the linked task.
* **Success Response (`201 Created`):**
  ```json
  {
    "data": {
      "id": "ses_123",
      "type": "FOCUS",
      "status": "IN_PROGRESS",
      "plannedDuration": 1500,
      "actualDuration": null,
      "startedAt": "2026-09-17T00:00:00.000Z",
      "endedAt": null,
      "pausedAt": null,
      "pausedDuration": 0,
      "taskId": "tsk_123",
      "projectId": "prj_123"
    }
  }
  ```

#### 3.5.2 Pause Focus Session
* **Endpoint:** `POST /api/focus-sessions/[id]/pause`
* **Description:** Freezes the running session countdown, setting `pausedAt = now` in the database.
* **Authz:** `WHERE id = [id] AND userId = session.user.id`.
* **Guard:** Session must have `status === 'IN_PROGRESS'` and `pausedAt === null`. (Idempotent: if already paused, returns `200 OK` with current state).
* **Success Response (`200 OK`):** Updated session object with populated `pausedAt`.

#### 3.5.3 Resume Focus Session
* **Endpoint:** `POST /api/focus-sessions/[id]/resume`
* **Description:** Resumes a paused session. Adds `now - pausedAt` (in seconds) to `pausedDuration` and clears `pausedAt = null`.
* **Authz:** `WHERE id = [id] AND userId = session.user.id`.
* **Guard:** Session must have `status === 'IN_PROGRESS'` and `pausedAt !== null`. (Idempotent: if already running, returns `200 OK` with current state).
* **Success Response (`200 OK`):** Updated session object with incremented `pausedDuration` and `pausedAt: null`.

#### 3.5.4 Complete Focus Session
* **Endpoint:** `POST /api/focus-sessions/[id]/complete`
* **Description:** Finalizes a session upon natural countdown expiry.
* **Authz:** `WHERE id = [id] AND userId = session.user.id`.
* **Idempotency & Atomicity:**
  - If `status !== 'IN_PROGRESS'`, returns `200 OK` with existing record without duplicate task updates.
  - Inside an interactive transaction:
    1. Updates session: `status = 'COMPLETED'`, `endedAt = now`, `actualDuration = plannedDuration`.
    2. If `type === 'FOCUS'` and `taskId` is set: atomically increments `Task.completedPomodoros += 1`.
    3. Note: Does NOT automatically mark task as completed (tasks are completed explicitly by the user).
    4. Note: Streak calculation is decoupled and computed on-demand in analytics queries.
* **Success Response (`200 OK`):** Updated session object.

#### 3.5.5 Reset Focus Session
* **Endpoint:** `POST /api/focus-sessions/[id]/reset`
* **Description:** Cancels/abandons the current active session.
* **Authz:** `WHERE id = [id] AND userId = session.user.id`.
* **Behavior:** Inside transaction, updates session: `status = 'ABANDONED'`, `endedAt = now`, `actualDuration = activeElapsedSeconds`. Does NOT increment `Task.completedPomodoros`.
* **Success Response (`200 OK`):** Updated session object with `status: "ABANDONED"`.

#### 3.5.6 Skip Focus Session
* **Endpoint:** `POST /api/focus-sessions/[id]/skip`
* **Description:** Explicitly skips the current session to advance the Pomodoro cycle.
* **Authz:** `WHERE id = [id] AND userId = session.user.id`.
* **Behavior:**
  - If `type === 'FOCUS'`: records session with `status: 'SKIPPED'`, `actualDuration = activeElapsedSeconds`. Does NOT increment `Task.completedPomodoros`. Cycle advances to next break.
  - If `type === 'SHORT_BREAK' | 'LONG_BREAK'`: records session with `status: 'SKIPPED'`. Cycle advances directly to next focus session.
* **Success Response (`200 OK`):** Updated session object with `status: "SKIPPED"`.

#### 3.5.7 Get Active Session (Recovery & Multi-Tab State)
* **Endpoint:** `GET /api/focus-sessions/active`
* **Description:** Queried on application load, tab reload, or network reconnect to restore authoritative timer state. Also performs auto-reconciliation of expired sessions.
* **Success Response (`200 OK`):**
  ```json
  {
    "data": {
      "id": "ses_123",
      "type": "FOCUS",
      "status": "IN_PROGRESS",
      "plannedDuration": 1500,
      "actualDuration": null,
      "startedAt": "2026-09-17T00:00:00.000Z",
      "endedAt": null,
      "pausedAt": null,
      "pausedDuration": 0,
      "taskId": "tsk_123",
      "projectId": "prj_123",
      "task": { "id": "tsk_123", "title": "Implement Timer State Machine" },
      "project": { "id": "prj_123", "name": "FocusFlow MVP", "color": "#6366f1" }
    }
  }
  ```
  *(Returns `"data": null` if no active unexpired session exists).*

#### 3.5.8 List Focus Sessions History
* **Endpoint:** `GET /api/focus-sessions`
* **Description:** Queries paginated, filterable historical sessions for the authenticated user.
* **Authz:** Scoped strictly to `session.user.id`.
* **Query Parameters:**
  - `page`: 1-based page number (default: `1`)
  - `pageSize`: items per page, 1 to 100 (default: `20`)
  - `sort`: `startedAt` | `actualDuration` (default: `startedAt`)
  - `sortOrder`: `asc` | `desc` (default: `desc`)
  - `type`: `FOCUS` | `SHORT_BREAK` | `LONG_BREAK` (optional)
  - `status`: `IN_PROGRESS` | `COMPLETED` | `ABANDONED` | `SKIPPED` (optional)
  - `projectId`: CUID filter (optional)
  - `taskId`: CUID filter (optional)
  - `startDate`: `YYYY-MM-DD` or ISO 8601 with offset (optional)
  - `endDate`: `YYYY-MM-DD` or ISO 8601 with offset (optional)
* **Success Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": "ses_123",
        "type": "FOCUS",
        "status": "COMPLETED",
        "plannedDuration": 1500,
        "actualDuration": 1500,
        "startedAt": "2026-09-17T10:00:00.000Z",
        "endedAt": "2026-09-17T10:25:00.000Z",
        "pausedDuration": 0,
        "taskId": "tsk_123",
        "projectId": "prj_123",
        "task": { "id": "tsk_123", "title": "Build Architecture" },
        "project": { "id": "prj_123", "name": "Core", "color": "#6366f1" }
      }
    ],
    "meta": {
      "page": 1,
      "pageSize": 20,
      "total": 45,
      "totalPages": 3,
      "hasMore": true
    }
  }
  ```

#### 3.5.9 Get Focus Session Detail
* **Endpoint:** `GET /api/focus-sessions/[id]`
* **Description:** Retrieves a single session with task and project relations.
* **Authz:** Validates ownership (`WHERE id = [id] AND userId = session.user.id`). Rejects cross-tenant access with `404 NOT_FOUND` anti-enumeration.
* **Success Response (`200 OK`):** Session object with relations.

---

### 3.6 Productivity Foundation Domain (`/api/productivity`)

Authoritative productivity calculations powered by PostgreSQL aggregations and timezone-aware domain bounds. Zero unbounded raw session loading.

#### 3.6.1 User Productivity Summary
* **Endpoint:** `GET /api/productivity/summary`
* **Description:** Aggregates focus time, session counts, and canonical `completionRate`.
* **Query Modes (Mutually Exclusive):**
  - **Mode A (Single Local Day):** `date=YYYY-MM-DD`
  - **Mode B (Predefined Period):** `period=today|yesterday|week|month`
  - **Mode C (Custom Range):** `startDate` + `endDate` (both required)
  - *Contract:* 0 modes supplied defaults to `period=today`. 1 mode valid. 2+ modes rejected with `400 VALIDATION_ERROR`.
* **Formulas:**
  - Completed Focus: $\sum \text{actualDuration}$ for `type = 'FOCUS' \land status = 'COMPLETED'`
  - Completion Rate: `completedFocus / (completedFocus + abandonedFocus) * 100` (breaks/skipped/in-progress excluded; 0 when sum is 0).
* **Success Response (`200 OK`):**
  ```json
  {
    "data": {
      "date": "2026-09-17",
      "completedFocusSessions": 4,
      "completedFocusSeconds": 6000,
      "completedFocusMinutes": 100,
      "abandonedFocusSessions": 1,
      "abandonedFocusSeconds": 600,
      "skippedFocusSessions": 0,
      "completedBreakSessions": 3,
      "completedBreakSeconds": 900,
      "totalSessions": 8,
      "completionRate": 80.0
    }
  }
  ```

#### 3.6.2 Project Productivity Breakdown
* **Endpoint:** `GET /api/productivity/projects`
* **Description:** Groups completed focus duration by project using PostgreSQL `groupBy`.
* **Query Modes:** Mutually exclusive (0 modes defaults to `period=week`).
* **Unrounded Percentage Contract:**
  - `percentage = (projectCompletedFocusSeconds / totalCompletedFocusSeconds) * 100` returned as unrounded float.
  - UI performs display rounding.
  - `projectId = null` is represented as `{ "projectName": "Unassigned", "projectColor": null }`.
* **Success Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "projectId": "prj_123",
        "projectName": "Core Architecture",
        "projectColor": "#6366f1",
        "isArchived": false,
        "completedFocusSessions": 4,
        "actualFocusSeconds": 6000,
        "actualFocusMinutes": 100,
        "sessionCount": 5,
        "percentage": 66.66666666666667
      },
      {
        "projectId": null,
        "projectName": "Unassigned",
        "projectColor": null,
        "isArchived": false,
        "completedFocusSessions": 2,
        "actualFocusSeconds": 3000,
        "actualFocusMinutes": 50,
        "sessionCount": 2,
        "percentage": 33.33333333333333
      }
    ]
  }
  ```

#### 3.6.3 Task Productivity Summary
* **Endpoint:** `GET /api/productivity/tasks/[id]`
* **Description:** Returns focus session metrics for a single task.
* **Authz:** Validates task ownership. Returns `404 NOT_FOUND` for another user's task.
* **Success Response (`200 OK`):**
  ```json
  {
    "data": {
      "taskId": "tsk_123",
      "taskTitle": "Implement Timer Engine",
      "completedPomodoros": 4,
      "completedFocusSessions": 4,
      "actualFocusSeconds": 6000,
      "actualFocusMinutes": 100,
      "lastFocusAt": "2026-09-17T15:30:00.000Z"
    }
  }
  ```

---

### 3.7 Analytics Domain (`/api/analytics`)

All analytics are calculated dynamically from real `FocusSession` records in PostgreSQL.

#### 3.6.1 Get Analytics Summary
* **Endpoint:** `GET /api/analytics/summary`
* **Query Parameters:** `?period=today|week|month` (default: `today`)
* **Success Response (`200 OK`):**
  ```json
  {
    "data": {
      "period": "today",
      "totalFocusSeconds": 7200,
      "totalFocusMinutes": 120,
      "completedPomodoros": 4,
      "abandonedSessions": 1,
      "completionRate": 80.0,
      "averageSessionDurationSeconds": 1440,
      "currentStreakDays": 5,
      "longestStreakDays": 12
    }
  }
  ```

#### 3.6.2 Daily Trend (Time Series)
* **Endpoint:** `GET /api/analytics/daily-trend`
* **Query Parameters:** `?days=7|14|30` (default: `7`)
* **Success Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "date": "2026-09-16",
        "focusSeconds": 6000,
        "pomodoroCount": 4,
        "completedSessions": 4
      },
      {
        "date": "2026-09-17",
        "focusSeconds": 7200,
        "pomodoroCount": 4,
        "completedSessions": 4
      }
    ]
  }
  ```

#### 3.6.3 Focus by Project
* **Endpoint:** `GET /api/analytics/by-project`
* **Query Parameters:** `?period=week|month|all` (default: `week`)
* **Success Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "project": { "id": "prj_123", "name": "FocusFlow MVP", "color": "#6366f1" },
        "focusSeconds": 18000,
        "sessionCount": 12,
        "percentage": 75.0
      },
      {
        "project": null,
        "focusSeconds": 6000,
        "sessionCount": 4,
        "percentage": 25.0
      }
    ]
  }
  ```

---

### 3.7 Goals Domain (`/api/goals`)

#### 3.7.1 List Goals with Current Derived Progress
* **Endpoint:** `GET /api/goals`
* **Success Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": "gol_123",
        "type": "POMODORO_COUNT",
        "target": 8,
        "period": "DAILY",
        "progress": 4,
        "percentage": 50,
        "isActive": true
      }
    ]
  }
  ```

#### 3.7.2 Create or Update Goal
* **Endpoint:** `POST /api/goals`
* **Request Schema (Zod):**
  ```typescript
  export const CreateGoalSchema = z.object({
    type: z.enum(['POMODORO_COUNT', 'FOCUS_DURATION']),
    target: z.number().int().min(1).max(1000),
    period: z.enum(['DAILY', 'WEEKLY'])
  });
  ```
* **Success Response (`201 Created`):** Goal object.

---

### 3.8 Health Check Endpoint (`/api/health`)

* **Endpoint:** `GET /api/health`
* **Authn Requirement:** Public
* **Success Response (`200 OK`):**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-09-17T00:00:00.000Z",
    "version": "1.0.0",
    "database": "connected"
  }
  ```
* **Error Response (`503 Service Unavailable`):** Returned if PostgreSQL health ping fails.

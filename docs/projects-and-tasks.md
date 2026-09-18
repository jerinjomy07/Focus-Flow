# FocusFlow — Projects & Task Management Specification

**Version:** 1.0.0 (Phase 5 — Projects & Task Management)  
**Date:** 2026-09-17  
**Status:** Production Implementation Document  

---

## 1. Executive Summary

Phase 5 implements the complete, production-grade Projects and Task Management system for the FocusFlow SaaS platform. Tasks and projects are persistent, authenticated domain models backed by PostgreSQL via Prisma ORM, managed with TanStack Query v5 on the client, and strictly isolated across tenants.

This system establishes the foundational units of work that drive the Pomodoro timer engine (Phase 6), productivity analytics (Phase 7), and streak attribution engines (Phase 8).

---

## 2. Architectural Decisions & Key Constraints

### 2.1 Canonical Task State Machine
Tasks adhere to a strict, bi-directional state transition model:

```
           ┌──────────────┐
           │     TODO     │
           └──┬─────────▲─┘
              │         │
    ┌─────────▼─────────┴─────────┐
    │         IN_PROGRESS         │
    └──┬────────────────────────▲─┘
       │                        │
       ▼                        │
 ┌───────────┐                  │
 │ COMPLETED │──────────────────┘
 └───────────┘
```

- **Direct Completion (`TODO -> COMPLETED`):** Supported to allow rapid checkbox toggles in high-velocity backlog triage.
- **Task Reopening (`COMPLETED -> TODO` / `IN_PROGRESS`):** Governed by `getReopenedStatus(completedPomodoros)`:
  - If `completedPomodoros > 0`: transitions to `IN_PROGRESS`.
  - If `completedPomodoros === 0`: transitions to `TODO`.
- **Self-transitions (`TODO -> TODO`) and unknown states:** Rejected with 400 Bad Request.

### 2.2 Timezone Authority & Due Date Semantics (ADR-010 & ADR-011)
- **Timezone Source of Truth:** `User.timezone` stored in PostgreSQL. Revalidated server-side on every request to prevent stale JWT session tokens.
- **End-of-Day Timestamp Anchor:** Due date inputs anchor to `23:59:59.999` in the user's local timezone and are persisted as UTC ISO strings via `toUtcEndOfDay(dateStr, timezone)`.
- **Dynamic Categorization:** Evaluated via `getDueDateCategory(dueDate, timezone, now)`:
  - `OVERDUE`: calendar day is strictly before today in user timezone (and task is not completed).
  - `TODAY`: calendar day matches today in user timezone.
  - `TOMORROW`: calendar day is exactly tomorrow in user timezone.
  - `UPCOMING`: calendar day is > 1 day in the future.
  - `NONE`: no due date specified.

### 2.3 User-Scoped Active Focus Task (ADR-012)
- **Purpose:** Bridges task management and the Pomodoro timer engine before Phase 6.
- **Implementation:** Zustand client store with `sessionStorage` persistence (`useActiveTaskStore`).
- **Cross-Tenant Safety:** The store records `userId`. Calling `syncUser(currentUserId)` immediately clears the active task if the user changes or logs out, eliminating cross-tenant leakage on shared devices.

### 2.4 Conditional Project Deletion & Analytics Preservation (ADR-013)
- **Primary Decommission Action:** Archiving (`POST /api/projects/:id/archive`). Archived projects and their tasks remain readable and preserved for historical analytics.
- **Hard Deletion Guard:** `DELETE /api/projects/:id` checks if any focus sessions are recorded for the project or its tasks. If sessions exist, deletion is rejected with `409 Conflict` (`PROJECT_HAS_SESSIONS`).

### 2.5 Completed Task Focus Guard
- **Rule:** A focus session CANNOT be started on a task whose status is `COMPLETED`.
- **Server Enforcement:** `POST /api/focus-sessions` verifies `Task.status !== 'COMPLETED'`. If completed, returns `400 Bad Request: TASK_IS_COMPLETED`.
- **No Silent Reopening:** The system never silently alters task status from `COMPLETED` to `IN_PROGRESS` simply because a user clicked Focus.
- **Explicit Reopening Flow:** The UI informs the user that the task is completed and presents a "Reopen Task" action (invoking `POST /api/tasks/:id/reopen`). Once reopened, focus may proceed.

---

## 3. Database & Multi-Tenant Security

### 3.1 Tenant Isolation
Every query in the data access layer (`src/lib/db/tasks.ts` and `src/lib/db/projects.ts`) requires `userId`. Queries are scoped using `{ where: { id, userId } }`.

### 3.2 Anti-Enumeration Policy
If User A requests a task or project ID belonging to User B, the server returns `404 Not Found` (never `403 Forbidden`). This prevents attackers from enumerating valid resource IDs.

### 3.3 Cross-Tenant Project Validation
When a task is created or updated with a `projectId`, the server verifies `getProjectById(userId, projectId)`. If the project belongs to another tenant or does not exist, the API returns `400 Bad Request` with `PROJECT_NOT_FOUND`.

---

## 4. API Endpoints Reference

### Projects API
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/projects?status=ACTIVE\|ARCHIVED` | List projects with task completion metrics |
| `POST` | `/api/projects` | Create a new project |
| `GET` | `/api/projects/:id` | Get project detail with associated tasks |
| `PATCH` | `/api/projects/:id` | Update project name, description, or color |
| `DELETE` | `/api/projects/:id` | Delete project (blocked with 409 if sessions exist) |
| `POST` | `/api/projects/:id/archive` | Archive project |
| `POST` | `/api/projects/:id/restore` | Restore archived project |

### Tasks API
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tasks` | List tasks with multi-criteria filtering, search, and sort |
| `POST` | `/api/tasks` | Create new task with project validation |
| `GET` | `/api/tasks/:id` | Get single task detail |
| `PATCH` | `/api/tasks/:id` | Update task fields (validates status transition) |
| `DELETE` | `/api/tasks/:id` | Delete task |
| `POST` | `/api/tasks/:id/complete` | Complete task (`status = 'COMPLETED'`) |
| `POST` | `/api/tasks/:id/reopen` | Reopen task (`status = 'IN_PROGRESS'` or `'TODO'`) |

#### Task Filtering Query Parameters
- `status`: `'ALL' | 'TODO' | 'IN_PROGRESS' | 'COMPLETED'`
- `projectId`: CUID string or `'inbox'` (unassigned tasks)
- `priority`: `'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'`
- `dueDateFilter`: `'all' | 'today' | 'overdue' | 'upcoming' | 'none'`
- `search`: string (case-insensitive search across title and description)
- `sort`: `'createdAt' | 'dueDate' | 'priority' | 'title'`
- `sortOrder`: `'asc' | 'desc'`
- `page` & `pageSize`: integer pagination (defaults: page 1, size 50)

---

## 5. UI & State Architecture

### 5.1 Query Keys Hierarchy (`src/lib/query-keys.ts`)
```typescript
queryKeys = {
  projects: {
    all: ['projects'],
    list: (status) => ['projects', 'list', status],
    detail: (id) => ['projects', 'detail', id],
  },
  tasks: {
    all: ['tasks'],
    list: (filters) => ['tasks', 'list', filters],
    detail: (id) => ['tasks', 'detail', id],
  },
}
```

### 5.2 Tasks Management View (`src/app/tasks/page.tsx`)
- **Quick-Add Bar:** Instant task creation via single-line input with project & priority pills, submitting on Enter.
- **Toolbar:** Status tabs, keyword search, project dropdown, priority filter, due date filter, and sort order.
- **Active Focus Target Banner:** Displays selected active task with quick button to navigate directly to `/focus`.
- **Task Cards:** Checkbox toggle, priority badge, project pill, timezone due date badge, Pomodoro estimate counter, focus button, edit modal, and delete confirmation dialog.
- **States:** Skeleton loaders during fetch, empty states for zero tasks vs no filter matches, error states with retry button.

### 5.3 Projects Management Views (`src/app/projects/page.tsx` & `[id]/page.tsx`)
- **Project Cards:** Color identifier, completion progress bar, task count metrics, quick edit, archive/restore toggle, and delete protection dialog.
- **Project Detail:** Dedicated page with project header, progress overview, and project-scoped task backlog.

---

## 6. Verification & Quality Gates

All automated verification commands pass with 0 errors:
- **Unit & Integration Tests:** 112 passed across 8 test suites (`vitest run`).
- **TypeScript:** Strict type checking with 0 errors (`tsc --noEmit`).
- **ESLint:** 0 errors, 0 warnings across all project files (`eslint`).
- **Production Build:** Next.js 16 (Turbopack) build succeeded, generating 19 routes including static pre-rendering and dynamic API handlers.

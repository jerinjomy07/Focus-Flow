# FocusFlow — Focus Sessions Reference & Lifecycle Architecture

**Version:** 1.0.0 (Phase 6 Architecture)  
**Date:** 2026-09-17  
**Status:** Approved Architectural Specification  

---

## 1. Overview & Core Philosophy

In FocusFlow, a **Focus Session** (`FocusSession`) is the foundational unit of deep work and the single source of truth for all productivity metrics, analytics, and goals. Unlike casual timer applications that only create database records when a countdown finishes, FocusFlow records every session at **START** (`status = 'IN_PROGRESS'`) to prevent data loss from network dropouts, browser crashes, or accidental navigation.

### Core Tenets
1. **Server-Authoritative Concurrency:** A user can only run at most ONE active focus session at any given moment across all devices and tabs (enforced by PostgreSQL partial unique index, ADR-014).
2. **Action-Oriented State Transitions:** Generic `PATCH` updates are eliminated. Explicit RPC-style REST sub-resources (`/pause`, `/resume`, `/complete`, `/reset`, `/skip`) govern all session lifecycle changes.
3. **Deterministic Reconciliation:** Stale or expired sessions are reconciled deterministically with zero guesswork.
4. **Decoupled Analytics & Streaks:** Session completion increments `Task.completedPomodoros` and persists the session ledger. Streak computations and cycle progression are decoupled queries.

---

## 2. Database Schema & Relationships

```prisma
model FocusSession {
  id              String        @id @default(cuid())
  userId          String
  taskId          String?       // SET NULL on Task deletion
  projectId       String?       // SET NULL on Project deletion (denormalized from Task)
  type            SessionType   // FOCUS, SHORT_BREAK, LONG_BREAK
  status          SessionStatus @default(IN_PROGRESS) // IN_PROGRESS, COMPLETED, ABANDONED, SKIPPED
  plannedDuration Int           // seconds (e.g. 1500 for 25 minutes)
  actualDuration  Int?          // net active seconds; null while IN_PROGRESS
  startedAt       DateTime      // UTC timestamp
  endedAt         DateTime?     // UTC timestamp; null while IN_PROGRESS
  pausedAt        DateTime?     // UTC timestamp; null while running, set when paused
  pausedDuration  Int           @default(0) // accumulated pause seconds
  createdAt       DateTime      @default(now())

  user    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  task    Task?    @relation(fields: [taskId], references: [id], onDelete: SetNull)
  project Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([userId, startedAt])
  @@index([userId, type, status])
  @@index([userId, projectId, startedAt])
  @@index([taskId])
}
```

### 2.1 Database-Level Concurrency Constraint (ADR-014)
```sql
CREATE UNIQUE INDEX "unique_active_session_per_user"
ON "FocusSession" ("userId")
WHERE status = 'IN_PROGRESS';
```
This PostgreSQL partial unique index guarantees that no two concurrent requests can write `IN_PROGRESS` rows for the same `userId`.

---

## 3. Session Lifecycle vs. Timer Runtime State

| Lifecycle Status (`FocusSession.status`) | Timer Runtime State | `pausedAt` | Description |
|---|---|---|---|
| `IN_PROGRESS` | `RUNNING` | `null` | Active countdown ticking against wall-clock time. |
| `IN_PROGRESS` | `PAUSED` | Populated | Active session paused; remaining duration is frozen. |
| `COMPLETED` | `COMPLETED` | `null` | Naturally completed session (`actualDuration = plannedDuration`). |
| `ABANDONED` | `ABANDONED` | N/A | Prematurely canceled session (via Reset or stale recovery). |
| `SKIPPED` | `SKIPPED` | N/A | Explicitly skipped session (advancing the cycle). |

---

## 4. Lifecycle Operations & Explicit REST Sub-Resources

### 4.1 Start Session (`POST /api/focus-sessions`)
- **Prerequisites & Domain Guards:**
  - Validates `type`, `plannedDuration`, `startedAt`, optional `taskId`, optional `projectId`.
  - **Completed Task Guard:** If `taskId` is supplied and `Task.status === 'COMPLETED'`, the request is rejected with `400 Bad Request: TASK_IS_COMPLETED`. Completed tasks cannot be focused without explicitly reopening them first.
  - **Archived Project Guard:** If `taskId` or `projectId` belongs to an archived project (`Project.status === 'ARCHIVED'`), rejects with `400 Bad Request: PROJECT_IS_ARCHIVED`.
  - **Auto-Reconciliation:** Automatically reconciles any existing expired running session before starting a new one.
  - **Single Active Session (ADR-014):** If an active unexpired or paused session exists, returns `409 Conflict: ACTIVE_SESSION_EXISTS`.
- **Side Effects:**
  - If `taskId` is supplied and task is in `TODO` status, atomically transitions task to `IN_PROGRESS`.
  - Inserts `FocusSession` with `status: 'IN_PROGRESS'`.

### 4.2 Pause Session (`POST /api/focus-sessions/:id/pause`)
- Sets `pausedAt = now` in PostgreSQL.
- Halts countdown animation in UI.
- Idempotent: if already paused, returns `200 OK`.

### 4.3 Resume Session (`POST /api/focus-sessions/:id/resume`)
- Computes `pauseDelta = now - pausedAt` (in seconds).
- Updates `pausedDuration += pauseDelta` and resets `pausedAt = null`.
- Restarts countdown animation in UI.
- Idempotent: if already running, returns `200 OK`.

### 4.4 Complete Session (`POST /api/focus-sessions/:id/complete`)
- Idempotent: if `status !== 'IN_PROGRESS'`, returns `200 OK` with existing session record.
- Within an interactive transaction:
  1. Sets `status = 'COMPLETED'`, `endedAt = now`, `actualDuration = plannedDuration`.
  2. If `type === 'FOCUS'` and `taskId` is set: atomically increments `Task.completedPomodoros += 1`.
  3. Triggers non-blocking Web Audio chime (ADR-015).

### 4.5 Reset Session (`POST /api/focus-sessions/:id/reset`)
- Abandons the active session.
- Computes net active elapsed seconds worked (`actualDuration = (now - startedAt) - pausedDuration` or using `pausedAt` if paused).
- Updates `status = 'ABANDONED'`.
- Does NOT increment `Task.completedPomodoros`.

### 4.6 Skip Session (`POST /api/focus-sessions/:id/skip`)
- Allows the user to bypass the remainder of the session to advance the cycle.
- Updates `status = 'SKIPPED'`.
- For `FOCUS`: records partial duration; does NOT increment `Task.completedPomodoros`. Next phase: Short/Long Break.
- For `SHORT_BREAK` / `LONG_BREAK`: advances cycle directly to the next Focus session.

---

## 5. Deterministic Session Expiration & Reconciliation Policy

When the client queries `GET /api/focus-sessions/active` or attempts to create a session while an `IN_PROGRESS` record exists:

$$\text{isExpired} = \text{now} \ge \text{startedAt} + (\text{plannedDuration} \times 1000) + (\text{pausedDuration} \times 1000)$$

1. **Running Session Expired:**
   - If `isExpired` is true and `pausedAt === null`: The session completed naturally while the user was away (e.g. laptop asleep, tab closed).
   - Server marks session `COMPLETED`, sets `actualDuration = plannedDuration`, and increments `Task.completedPomodoros += 1` if `FOCUS`.
2. **Paused Session Policy (Indefinite Pause until Explicit Action):**
   - Paused sessions (`pausedAt !== null`) **NEVER** expire or auto-abandon automatically.
   - If a user pauses a 25-minute session after 10 minutes and returns 5 hours later, the session remains `PAUSED` with exactly 15 minutes remaining.
   - Time spent away is NOT counted as focus duration.
   - The paused session continues to count as the user's single active session (preventing concurrent session creation).
   - On page refresh or app reload, `GET /api/focus-sessions/active` restores the exact `PAUSED` state without time loss or distortion.
   - The user can explicitly resume, reset, or skip.

---

## 6. Multi-Tab & Device Concurrency Architecture

```
                                  [PostgreSQL]
                        (Partial Unique Index: ADR-014)
                                       ▲
                                       │ HTTP REST
                    ┌──────────────────┴──────────────────┐
                    │                                     │
             [Browser Tab 1]                       [Browser Tab 2]
         (Primary Active Timer)                 (Secondary Mirror Tab)
                    │                                     │
                    └─────────── BroadcastChannel ────────┘
                             (Transient UI Events)
```

1. **Database is Sole Concurrency Authority:** The partial unique index rejects concurrent active sessions across all devices.
2. **BroadcastChannel is for UX Mirroring:** When Tab 1 pauses or resumes, Tab 2 mirrors the display immediately.
3. **Active Session Recovery:** On browser refresh or foregrounding, `GET /api/focus-sessions/active` recovers exact authoritative state.
4. **Zustand Store:** Maintains transient local 60fps countdown animation anchored to server timestamps.

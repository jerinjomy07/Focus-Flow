# FocusFlow — Domain Model & Business Rules Specification

**Version:** 1.0.0 (Phase 2 — Database & Domain Foundation)  
**Date:** 2026-09-17  
**Status:** Approved Domain Specification  

---

## 1. Domain Entities & Value Objects

FocusFlow structures its core domain around seven fundamental models:

```
                  ┌──────────────────────────────┐
                  │             USER             │
                  │   - id (cuid)                │
                  │   - email (unique)           │
                  │   - timezone (IANA)          │
                  └──────────────┬───────────────┘
                                 │ owns (1:1 & 1:N)
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
┌─────────▼──────────┐ ┌─────────▼──────────┐ ┌─────────▼──────────┐
│   USER_SETTINGS    │ │      PROJECT       │ │       GOAL         │
│ - focusDuration    │ │ - id (cuid)        │ │ - id (cuid)        │
│ - shortBreakDur    │ │ - name             │ │ - type (POMO/TIME) │
│ - longBreakDur     │ │ - color            │ │ - target           │
│ - autoStartBreaks  │ │ - status           │ │ - period (D/W)     │
└────────────────────┘ └─────────┬──────────┘ └────────────────────┘
                                 │ 1:N
                       ┌─────────▼──────────┐
                       │        TASK        │
                       │ - id (cuid)        │
                       │ - title            │
                       │ - status           │
                       │ - completedPomos   │
                       └─────────┬──────────┘
                                 │ 1:N
                       ┌─────────▼──────────┐
                       │   FOCUS_SESSION    │
                       │ - id (cuid)        │
                       │ - type (FOCUS/BRK) │
                       │ - status (IN_PROG) │
                       │ - plannedDuration  │
                       │ - actualDuration   │
                       │ - startedAt (UTC)  │
                       └────────────────────┘
```

### 1.1 `User`
- **Role:** The root multi-tenant boundary.
- **Invariants:**
  - `email` is strictly normalized to lowercase and trimmed before uniqueness verification.
  - `timezone` must be a valid IANA string (e.g. `America/New_York`, `Asia/Kolkata`). Default is `UTC`.
  - Account deletion triggers a cascade across all owned resources.

### 1.2 `UserSettings`
- **Role:** One-to-one preferences for timer intervals, audio feedback, and UI theme.
- **Invariants:**
  - `focusDuration`: Integer, 1–120 minutes (default 25).
  - `shortBreakDuration`: Integer, 1–60 minutes (default 5).
  - `longBreakDuration`: Integer, 1–120 minutes (default 15).
  - `sessionsBeforeLongBreak`: Integer, 1–10 (default 4).

### 1.3 `Project`
- **Role:** Categorical grouping for tasks and focus time investments.
- **Invariants:**
  - `name`: 1–100 characters.
  - `color`: 6-character hex format (`^#[0-9A-Fa-f]{6}$`). Default `#6366f1`.
  - Soft archiving via `status: ARCHIVED` preserves historical focus records.

### 1.4 `Task`
- **Role:** Actionable work item with priority, due date, and Pomodoro progress tracking.
- **Invariants:**
  - `completedPomodoros`: Non-negative integer. Atomically incremented when a linked `FOCUS` session completes.
  - `estimatedPomodoros`: Optional integer between 1 and 50.
  - Optional `projectId`: If null, the task belongs to the user's "Inbox".

### 1.5 `FocusSession`
- **Role:** The immutable analytical ledger of all work sessions.
- **Invariants:**
  - **Written at START:** Status is initialized to `IN_PROGRESS` immediately upon timer start.
  - `projectId` is denormalized directly onto `FocusSession` at start time to allow fast project-level rollups without joining through `Task`.
  - `actualDuration`: Persisted in seconds upon completion or abandonment.

### 1.6 `Goal`
- **Role:** Daily or weekly productivity targets.
- **Invariants:**
  - `POMODORO_COUNT`: Target integer represents count of completed Pomodoros.
  - `FOCUS_DURATION`: Target integer represents total focus minutes.
  - Progress is **never stored**; it is derived dynamically from `FocusSession` records within the goal's period.

### 1.7 `TimerSessionSnapshot` (Value Object)
- **Role:** In-memory, immutable snapshot representing the authoritative state of the countdown engine.
- **Properties:** `{ id, type, state, plannedDurationSeconds, startedAtMs, pausedAtMs, totalPausedMs, taskId, projectId }`.
- Zero external dependencies.

---

## 2. Business Rules & State Transitions

### 2.1 Timer State Machine Transitions

```
[IDLE] ──(START)──▶ [RUNNING] ──(PAUSE)──▶ [PAUSED]
  ▲                    │                      │
  │                    ├──(TIME_EXPIRED)──┐   │ (RESET/SKIP)
  │ (DISMISS)          │                  │   │
  │                    ├──(RESET/SKIP)──┐ │   │
  │                    ▼                │ ▼   ▼
[COMPLETED] ◀──────────┴────────────── [ABANDONED]
```

- **START:** Allowed only from `IDLE`.
- **PAUSE:** Allowed only from `RUNNING`. Records `pausedAtMs`.
- **RESUME:** Allowed only from `PAUSED`. Adjusts `totalPausedMs += (now - pausedAtMs)`.
- **TIME_EXPIRED:** Allowed only from `RUNNING` when $\text{remainingMs} \le 0$.
- **RESET / SKIP:** Allowed from `RUNNING` or `PAUSED`. Transitions to `ABANDONED`.
- **DISMISS:** Allowed only from `COMPLETED`. Resets state to `IDLE`.

### 2.2 Time Calculation Mathematics

- **End Timestamp:**
  $$\text{endTimestampMs} = \text{startedAtMs} + (\text{plannedDurationSeconds} \times 1000) + \text{totalPausedMs}$$

- **Remaining Time:**
  $$\text{remainingMs}(t) = \begin{cases}
  \text{plannedDurationSeconds} \times 1000, & \text{state} = \text{IDLE} \\
  \max\left(0, \text{endTimestampMs} - \text{pausedAtMs}\right), & \text{state} = \text{PAUSED} \\
  \max\left(0, \text{endTimestampMs} - t\right), & \text{state} = \text{RUNNING} \\
  0, & \text{state} \in \{\text{COMPLETED}, \text{ABANDONED}\}
  \end{cases}$$

### 2.3 Streak Attribution & Timezone Rules
1. Only `COMPLETED` sessions of type `FOCUS` qualify for streaks.
2. The calendar day of a session is evaluated in the **user's stored IANA timezone** based on its `startedAt` timestamp:
   $$\text{localDate} = \text{toLocalDateString}(\text{session.startedAt}, \text{user.timezone})$$
3. Midnight crossings belong to the start day.
4. Consecutive calendar days increment the streak counter. If yesterday had no qualifying sessions, the current streak resets to 0 (or 1 if today has completed sessions).

---

## 3. Multi-Tenant Ownership & Security Invariants

### 3.1 Tenant Scoping
- Every query accessing user-owned resources requires `userId: session.user.id`.
- Cross-tenant relationships (e.g. creating a task under a project owned by a different user) are rejected server-side.

### 3.2 Anti-Enumeration Principle
- If an entity exists in PostgreSQL but belongs to another tenant, the system returns:
  $$\text{HTTP } 404 \text{ Not Found}$$
- `403 Forbidden` is explicitly prohibited for entity queries because it leaks resource existence to attackers.

---

## 4. Transaction Boundaries

### 4.1 User Registration Transaction
```
BEGIN TRANSACTION
  INSERT INTO "User" ...
  INSERT INTO "UserSettings" ... (with default durations & theme)
COMMIT
```

### 4.2 Focus Session Completion Transaction
```
BEGIN TRANSACTION
  UPDATE "FocusSession"
    SET status = 'COMPLETED', endedAt = $endedAt, actualDuration = $actualDuration
    WHERE id = $sessionId AND userId = $userId;

  IF session.type = 'FOCUS' AND session.taskId IS NOT NULL THEN
    UPDATE "Task"
      SET completedPomodoros = completedPomodoros + 1, status = 'IN_PROGRESS'
      WHERE id = session.taskId;
  END IF;
COMMIT
```

Both operations are strictly atomic; any failure rolls back both updates.

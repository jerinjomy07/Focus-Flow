# FocusFlow — Timer Domain Architecture

**Version:** 1.0.0 (Phase 1 — Technical Foundation)  
**Date:** 2026-09-17  
**Status:** Approved Architectural Specification  

---

## 1. Subsystem Overview & Core Philosophy

The focus timer is the central interaction engine of FocusFlow. In many timer utilities, countdown logic is implemented naively using an unanchored client-side interval (`setInterval(tick, 1000)`). In a modern multi-tab, power-throttled browser environment, this creates severe drift, state corruption on sleep/wake, tab synchronization failures, and data loss upon unexpected navigation.

In FocusFlow, the timer is engineered as an **authoritative timestamp-driven state machine** isolated in the domain layer (`domain/timer/`). 

### Core Tenet
> **Remaining time is always a derived, deterministic calculation based on an immutable target timestamp and accumulated pause offsets; it is NEVER an accumulated decrement of an interval ticker.**

---

## 2. Timer Domain States & Session Types

### 2.1 State Definitions: Decoupled Lifecycle vs. Runtime State

To eliminate ambiguity between persistence and user interface presentation, FocusFlow strictly decouples the **Database Session Lifecycle** from the **Timer Runtime State**:

1. **Database Session Lifecycle (`SessionStatus` Enum in PostgreSQL):**
   - `IN_PROGRESS`: The session is currently active (either actively ticking or paused). At most ONE session per user can be `IN_PROGRESS` (enforced by the PostgreSQL partial unique index `unique_active_session_per_user`, ADR-014).
   - `COMPLETED`: The session successfully elapsed its full planned duration.
   - `ABANDONED`: The session was prematurely canceled by the user (via Reset) or left stale while paused.
   - `SKIPPED`: The session was explicitly skipped by the user to advance the Pomodoro cycle.

2. **Timer Runtime State (Client State Machine):**
   - `IDLE`: No active session exists. Timer is ready to configure or start.
   - `RUNNING`: Session is active and actively ticking against wall-clock time (`FocusSession.status = 'IN_PROGRESS'` and `pausedAt === null`).
   - `PAUSED`: Session countdown is frozen (`FocusSession.status = 'IN_PROGRESS'` and `pausedAt !== null`).
   - `COMPLETED`: Countdown elapsed to 0. Session finalized via `POST /complete`.
   - `ABANDONED`: Terminal state upon user reset or stale reconciliation via `POST /reset`.
   - `SKIPPED`: Terminal state upon user skip via `POST /skip`.

```
           ┌──────────┐
           │   IDLE   │◀──────────────────────────────────────────────┐
           └────┬─────┘                                               │
                │ START                                               │
                ▼                                                     │
         ┌─────────────┐   PAUSE (POST /pause)   ┌────────────┐      │
         │   RUNNING   │────────────────────────▶│   PAUSED   │      │
         └──────┬──────┘◀────────────────────────└─────┬──────┘      │
          │     │          RESUME (POST /resume)       │             │
          │     │                                      │             │
 COMPLETE │     │ RESET (POST /reset)                  │ RESET       │
 (POST    │     ▼                                      ▼             │
 /complete)  ┌───────────────┐                  ┌───────────┐         │
          │  │   ABANDONED   │                  │ ABANDONED │         │
          │  └───────┬───────┘                  └─────┬─────┘         │
          │          │                                │              │
          ▼          ▼                                ▼              │
     ┌─────────────┐ └────────────────────────────────┼──────────────┘
     │  COMPLETED  │                                  │
     └──────┬──────┘                                  │
            │ NEXT / AUTO-TRANSITION                  │
            └─────────────────────────────────────────┘
```

| Runtime State | Active in DB? | `FocusSession.status` | `pausedAt` | Display Behavior |
|---|---|---|---|---|
| `IDLE` | No | None | N/A | Displays planned duration (e.g. 25:00). Ring empty/ready. Primary action: "Start Focus". |
| `RUNNING` | Yes | `IN_PROGRESS` | `null` | Real-time countdown via RAF loop (~60fps). Controls: Pause, Reset, Skip. |
| `PAUSED` | Yes | `IN_PROGRESS` | Populated timestamp | Static frozen display of remaining time. Controls: Resume, Reset, Skip. |
| `COMPLETED` | No (Final) | `COMPLETED` | `null` | Displays 00:00, celebration state, break transition prompt. |
| `ABANDONED` | No (Final) | `ABANDONED` | N/A | Terminal state before transitioning back to `IDLE`. |
| `SKIPPED` | No (Final) | `SKIPPED` | N/A | Terminal state before advancing cycle to next session type. |

---

## 3. State Machine Transition Rules & Explicit RPC REST Operations

Generic `PATCH` operations are prohibited. Every state transition is executed through dedicated, action-oriented REST sub-resources to guarantee atomicity and idempotency.

### 3.1 Legal State Transitions

| Current State | Event / Action | Next State | Server Endpoint | Side Effects & Invariants |
|---|---|---|---|---|
| `IDLE` | `START` | `RUNNING` | `POST /api/focus-sessions` | Enforces single active session (ADR-014). Auto-reconciles expired sessions. Records `startedAt`. If task is `TODO`, moves to `IN_PROGRESS`. |
| `RUNNING` | `PAUSE` | `PAUSED` | `POST /api/focus-sessions/:id/pause` | Records `pausedAt = now` in DB. Halts client RAF animation loop. |
| `PAUSED` | `RESUME` | `RUNNING` | `POST /api/focus-sessions/:id/resume` | Adds `(now - pausedAt)` to `pausedDuration`. Clears `pausedAt = null`. Restarts client RAF animation loop. |
| `RUNNING` | `TIME_EXPIRED` | `COMPLETED` | `POST /api/focus-sessions/:id/complete` | Idempotent. Marks `status = 'COMPLETED'`, `actualDuration = plannedDuration`. If `type === 'FOCUS'`, increments `Task.completedPomodoros += 1`. Triggers Web Audio chime (ADR-015). |
| `RUNNING` | `RESET` | `ABANDONED` | `POST /api/focus-sessions/:id/reset` | Marks `status = 'ABANDONED'`, `actualDuration = activeElapsedSeconds`. Does NOT increment task Pomodoro count. Returns timer to `IDLE`. |
| `PAUSED` | `RESET` | `ABANDONED` | `POST /api/focus-sessions/:id/reset` | Marks `status = 'ABANDONED'`, `actualDuration = (pausedAt - startedAt) - pausedDuration`. Returns timer to `IDLE`. |
| `RUNNING` | `SKIP` (Focus) | `SKIPPED` | `POST /api/focus-sessions/:id/skip` | Marks `status = 'SKIPPED'`, `actualDuration = activeElapsedSeconds`. Does NOT increment task Pomodoro count. Advances cycle to Break. |
| `PAUSED` | `SKIP` (Focus) | `SKIPPED` | `POST /api/focus-sessions/:id/skip` | Marks `status = 'SKIPPED'`, `actualDuration = (pausedAt - startedAt) - pausedDuration`. Advances cycle to Break. |
| `RUNNING`/`PAUSED` | `SKIP` (Break) | `SKIPPED` | `POST /api/focus-sessions/:id/skip` | Marks break session `status = 'SKIPPED'`. Advances cycle directly to next Focus session. |
| `COMPLETED` | `DISMISS` | `IDLE` | None (Client) | Resets timer interface to default planned duration of next cycle phase. |
| `COMPLETED` | `START_NEXT` | `RUNNING` | `POST /api/focus-sessions` | Initiates the subsequent phase in the cycle (Short Break, Long Break, or Focus). |

### 3.2 Prohibited Transitions

- `IDLE` → `PAUSED` (cannot pause what has not started)
- `IDLE` → `COMPLETED` (cannot complete without starting)
- `PAUSED` → `COMPLETED` (time does not expire while paused; countdown is frozen)
- `COMPLETED` → `PAUSED` (completed sessions cannot be paused)
- `ABANDONED` / `SKIPPED` → `RUNNING` (terminal states cannot be resumed)


---

## 4. Time Calculation Domain Mathematics

All calculations use integer milliseconds based on Unix epoch time (`Date.now()`).

### 4.1 Data Structure (Immutable Domain Record)

```typescript
export interface TimerSessionSnapshot {
  readonly id: string;                     // DB FocusSession ID
  readonly type: 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
  readonly state: 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ABANDONED';
  readonly plannedDurationSeconds: number; // e.g. 1500 (25 mins)
  readonly startedAtMs: number;            // Unix epoch ms
  readonly pausedAtMs: number | null;      // Epoch ms when paused, null if running
  readonly totalPausedMs: number;          // Accumulated pause duration
  readonly taskId: string | null;
  readonly projectId: string | null;
}
```

### 4.2 Authoritative Formulas

#### Target End Timestamp (`endTimestampMs`)
The point in time at which the session expires:
$$\text{endTimestampMs} = \text{startedAtMs} + (\text{plannedDurationSeconds} \times 1000) + \text{totalPausedMs}$$

#### Remaining Time (`remainingMs`)
Calculated dynamically at any moment $t = \text{Date.now()}$:

$$\text{remainingMs}(t) = \begin{cases}
\text{plannedDurationSeconds} \times 1000, & \text{if state} = \text{IDLE} \\
\max\left(0, \text{endTimestampMs} - \text{pausedAtMs}\right), & \text{if state} = \text{PAUSED} \\
\max\left(0, \text{endTimestampMs} - t\right), & \text{if state} = \text{RUNNING} \\
0, & \text{if state} = \text{COMPLETED}
\end{cases}$$

#### Actual Active Duration (`actualDurationSeconds`)
The net productive seconds worked (excluding pause periods):

$$\text{elapsedMs} = \begin{cases}
\text{pausedAtMs} - \text{startedAtMs} - \text{totalPausedMs}, & \text{if state} = \text{PAUSED} \\
t - \text{startedAtMs} - \text{totalPausedMs}, & \text{if state} = \text{RUNNING} \text{ or } \text{ABANDONED} \\
\text{plannedDurationSeconds} \times 1000, & \text{if state} = \text{COMPLETED}
\end{cases}$$

$$\text{actualDurationSeconds} = \max\left(0, \left\lfloor \frac{\text{elapsedMs}}{1000} \right\rfloor\right)$$

---

## 5. Resilient Runtime Behavior & Edge Cases

### 5.1 Browser Tab Backgrounding (Throttling Protection)
* **Problem:** Modern browsers (Chrome, Safari, Firefox) aggressively throttle background tab timers (`setInterval` / `setTimeout` throttled to $\ge 1000\text{ms}$ or suspended after 5 minutes).
* **Architecture Solution:** The display loop uses `requestAnimationFrame` for 60fps smoothness while active. The authoritative state is timestamp-based.
* **Visibility API Hook:**
  ```typescript
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && timerStore.state === 'RUNNING') {
      // Upon foregrounding, compute exact remaining ms immediately
      const remaining = calculateRemainingMs(timerStore.session, Date.now());
      if (remaining <= 0) {
        timerStore.dispatch({ type: 'TIME_EXPIRED', atMs: Date.now() });
      } else {
        timerStore.syncDisplay(remaining);
      }
    }
  });
  ```

### 5.2 Laptop Sleep / System Suspend
* **Problem:** If a user closes their laptop lid at minute 10 of a 25-minute Pomodoro and reopens it 30 minutes later, an interval countdown would show 15 minutes remaining.
* **Architecture Solution:** When the OS wakes, `Date.now()` reflects true wall-clock time. `endTimestampMs - Date.now()` evaluates to a negative number ($\le 0$). The system transitions to `COMPLETED` immediately upon wake, recording the session ending without state drift.

### 5.3 Page Refresh & Navigation Recovery
1. When a session starts, `POST /api/focus-sessions` writes the active session to PostgreSQL and returns `{ id, startedAt, plannedDuration, pausedAt, pausedDuration }`.
2. Simultaneously, the session snapshot is cached in `sessionStorage` (`focusflow_active_timer`).
3. Upon hard page reload:
   - Synchronous read from `sessionStorage` paints the UI instantly with zero layout shift.
   - The application immediately calls `GET /api/focus-sessions/active`.
   - The server inspects the database record, reconciles it if already expired, and returns the authoritative state.
   - If paused (`pausedAt !== null`), the timer remains paused at the exact remaining duration without drift.

### 5.4 Multi-Tab Synchronization & Authority Boundaries
To ensure strict data integrity across tabs and devices:
1. **Database is the Sole Concurrency Authority:**
   - PostgreSQL enforces single active session via `unique_active_session_per_user` (ADR-014).
   - Attempting to start a concurrent session in another tab triggers `409 Conflict: ACTIVE_SESSION_EXISTS`.
2. **`BroadcastChannel` is ONLY for Client UX & Synchronization:**
   - `BroadcastChannel` (`focusflow_timer_bus`) broadcasts actions (`START`, `PAUSE`, `RESUME`, `RESET`, `SKIP`).
   - Open tabs immediately mirror state changes (e.g. pausing in Tab 1 pauses Tab 2).
   - If `BroadcastChannel` is unavailable or dropped, the database prevents concurrency.
3. **Active Session API is the Recovery Authority:**
   - On foregrounding, network reconnection, or tab load, `GET /api/focus-sessions/active` reconciles state.
4. **Zustand is Transient Presentation State:**
   - Calculates smooth 60fps countdown visuals locally, anchored to server timestamps.

### 5.5 Deterministic Session Expiration & Reconciliation Policy
When a session is evaluated (via `GET /api/focus-sessions/active` or prior to `POST /api/focus-sessions`), state is reconciled with zero ambiguity:

1. **Running Sessions Past Expiration (`now >= endTimestamp`):**
   - If `status = 'IN_PROGRESS'` and `pausedAt === null` and `now >= startedAt + plannedDuration*1000 + pausedDuration*1000`:
   - The session elapsed naturally while the user was away (e.g. laptop asleep, tab closed).
   - Reconciled to `COMPLETED`: `actualDuration = plannedDuration`, `endedAt = endTimestamp`. If `type === 'FOCUS'`, `Task.completedPomodoros` is incremented by 1.
2. **Paused Sessions Policy (Indefinite Pause until Explicit Action):**
   - Paused sessions **NEVER** expire or auto-abandon automatically due to inactivity or wall-clock time.
   - If a session is paused at 10:10 with 15:00 remaining and the user returns at 15:00:
     - The session remains `IN_PROGRESS` with `pausedAt` populated.
     - The countdown remains frozen at exactly 15:00.
     - Time spent away (`now - pausedAt`) is NOT counted as elapsed focus time.
     - The session continues to hold the user's single active session constraint (preventing new sessions on other tabs/devices).
     - On page refresh or app reload, `GET /api/focus-sessions/active` restores the exact `PAUSED` state with 15:00 remaining.
     - The user can explicitly:
       - **Resume** (`POST /resume`): accumulates pause duration and continues countdown.
       - **Reset** (`POST /reset`): marks `ABANDONED` with actual duration worked prior to pause.
       - **Skip** (`POST /skip`): marks `SKIPPED` and advances cycle to break.

| Condition upon Query / Mutation | Reconciled Status | Actual Duration | Task Pomodoros | Cycle Progression |
|---|---|---|---|---|
| Running & `now >= endTimestamp` | `COMPLETED` | `plannedDuration` | Atomic increment `+1` (if FOCUS) | Advances to next break |
| Paused (`pausedAt !== null`) | `PAUSED` (Unchanged) | Frozen at active duration prior to pause | Unchanged | Frozen / Waiting for user action |
| Explicit Reset click | `ABANDONED` | Active elapsed seconds (excluding pause) | Unchanged | Reset to `IDLE` |
| Explicit Skip click (Focus) | `SKIPPED` | Active elapsed seconds (excluding pause) | Unchanged | Advances to next break |
| Explicit Skip click (Break) | `SKIPPED` | Elapsed break seconds | Unchanged | Advances to next focus |

### 5.6 Completed Task Policy
Starting a focus session requires an active task. The system enforces the following deterministic rule:
- **`COMPLETED` Tasks:** A user **CANNOT** start a focus session on a completed task. Attempting to start focus on a task with `status === 'COMPLETED'` is rejected by the server with `400 Bad Request: TASK_IS_COMPLETED`.
- **No Silent Reopening:** The system will **never** silently reopen a completed task simply because the user clicked Focus.
- **User Experience:** The UI alerts the user ("This task is already completed. Reopen the task to track more focus time.") and offers a prominent "Reopen Task" action button (which calls `POST /api/tasks/:id/reopen`). Once reopened to `IN_PROGRESS`, the user can begin focus.
- **Task Status Permissibility Matrix:**
  - `TODO` Task: Permitted. Starting focus atomically transitions the task to `IN_PROGRESS`.
  - `IN_PROGRESS` Task: Permitted. Task remains `IN_PROGRESS`.
  - `COMPLETED` Task: **Rejected** (`400 Bad Request: TASK_IS_COMPLETED`).
  - Cross-User Task: **Rejected** (`404 Not Found: TASK_NOT_FOUND`).
  - Archived-Project Task: **Rejected** (`400 Bad Request: PROJECT_IS_ARCHIVED`).

### 5.7 System Clock & Timezone Changes
* If a user changes their OS system clock backward or forward during a session:
  - If $\text{Date.now()} < \text{startedAtMs}$, clock skew is detected. The session falls back to elapsed intervals from server sync.
  - Timezone changes do not affect UTC epoch timestamps. Day grouping for daily goals is calculated based on user's configured timezone.

---

## 6. Cycle Sequencing & Server-Derived Cycle Counters

### 6.1 Default Pomodoro Progression Cycle

A complete productivity cycle consists of $N$ focus sessions separated by short breaks, culminating in a long break:

$$\text{FOCUS (1)} \rightarrow \text{SHORT\_BREAK} \rightarrow \text{FOCUS (2)} \rightarrow \text{SHORT\_BREAK} \rightarrow \text{FOCUS (3)} \rightarrow \text{SHORT\_BREAK} \rightarrow \text{FOCUS (4)} \rightarrow \text{LONG\_BREAK}$$

- **Server-Derived Authority:** The cycle position (`completedTodayCount`) is queried from the server based on completed focus sessions in the user's timezone today. The client store does **not** become an authoritative counter.
- When `completedTodayCount % sessionsBeforeLongBreak === 0` and `completedTodayCount > 0`, the recommended session type is `LONG_BREAK`. Otherwise, `SHORT_BREAK`.
- **Streak Decoupling:** Session completion increments `Task.completedPomodoros` and writes `FocusSession`. Streak calculations are completely decoupled and computed dynamically from session history.

### 6.2 Auto-Transition Rules
* **`autoStartBreaks` (User Setting):**
  - If `true`: When a `FOCUS` session completes, the timer initiates the break session automatically after a 3-second prompt.
  - If `false`: Timer enters `COMPLETED` state; waits for explicit user click on "Start Break".
* **`autoStartFocus` (User Setting):**
  - If `true`: When a break completes, the next `FOCUS` session starts automatically.
  - If `false`: Timer enters `COMPLETED` state; waits for user action.

---

## 7. Notification & Web Audio Chime Orchestration (ADR-015)

Auditory feedback is implemented using the zero-dependency Web Audio API with strict non-blocking isolation:
1. **Zero External Assets:** Native dual oscillator bell chimes synthesized in-memory.
2. **Autoplay Policy Resilience:** The shared `AudioContext` is lazily resumed during user click gestures ("Start Focus").
3. **Non-Blocking Error Isolation:**
   - Any audio playback failure (`NotAllowedError`, suspended context) is swallowed safely in a `try...catch` block.
   - Audio failure **MUST NEVER** fail timer state transitions, network completion requests, or cycle auto-starts.

---

## 8. Summary of Non-Negotiable Invariants

1. **Deterministic Calculations:** No code outside `domain/timer/calculations.ts` may compute remaining time or elapsed time.
2. **Database-Level Single Active Session:** Enforced by PostgreSQL partial unique index `unique_active_session_per_user` (ADR-014).
3. **Explicit Sub-Resources:** State transitions use dedicated POST endpoints (`/pause`, `/resume`, `/complete`, `/reset`, `/skip`); generic `PATCH` is eliminated.
4. **Idempotent Completion:** Calling `/complete` multiple times never increments `Task.completedPomodoros` more than once.
5. **Archived Project Guard:** Focus sessions cannot be started on tasks belonging to archived projects (`400 Bad Request: PROJECT_IS_ARCHIVED`).
6. **Pure Domain Logic:** The timer state machine and calculations have zero DOM or database dependencies, ensuring 100% testability.


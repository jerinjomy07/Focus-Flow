# ADR-014: Single Active Session Guarantee and Concurrency Control

**Date:** 2026-09-17  
**Status:** Accepted  
**Author:** Architecture Team

---

## 1. Context & Invariant

In FocusFlow, focus sessions represent real, dedicated intervals of productive deep work. A user cannot physically perform two distinct focus sessions simultaneously. Therefore, the core business domain dictates the following invariant:

> **Invariant:** A user must have at most ONE active focus session (`status = 'IN_PROGRESS'`) at any given moment across all browser tabs, windows, devices, network retries, and concurrent API requests.

In Phase 5, the preliminary approach checked for an existing active session before inserting a new one (`CHECK → INSERT`). However, under high concurrency (e.g. rapid double-clicking of the start button, opening the application in two browser tabs simultaneously, or automated concurrent requests), an ordinary read-then-write transaction at read-committed isolation level is vulnerable to race conditions where two threads read zero active sessions and both execute an `INSERT`, violating the invariant.

---

## 2. Race Condition Analysis

Consider two concurrent requests, Request A (Tab 1) and Request B (Tab 2), arriving within 5ms of each other:

```
Tab 1: SELECT id FROM "FocusSession" WHERE "userId" = 'u1' AND status = 'IN_PROGRESS' -> None
Tab 2: SELECT id FROM "FocusSession" WHERE "userId" = 'u1' AND status = 'IN_PROGRESS' -> None
Tab 1: INSERT INTO "FocusSession" ("userId", status, ...) VALUES ('u1', 'IN_PROGRESS', ...) -> SUCCESS
Tab 2: INSERT INTO "FocusSession" ("userId", status, ...) VALUES ('u1', 'IN_PROGRESS', ...) -> SUCCESS (Violation!)
```

Without database-level enforcement, both sessions become `IN_PROGRESS`. Subsequent queries find multiple active sessions, timer state machine synchronization fails, and analytics become corrupted.

---

## 3. Evaluated Mechanisms & Decision

We evaluated four strategies to strictly guarantee single active session per user:

| Strategy | Feasibility in Prisma / PostgreSQL | Complexity | Performance | Robustness |
|---|---|---|---|---|
| **A. Application-Only Check** (`findFirst` + `create`) | Supported natively | Lowest | High | ❌ **Rejected:** Vulnerable to race conditions. |
| **B. PostgreSQL Advisory Locks** (`pg_advisory_xact_lock(hash(userId))`) | Requires raw SQL query | Medium | High | ❌ **Rejected:** Connection pooler (Neon/PgBouncer) transaction-mode quirks; leaks lock semantics into app logic. |
| **C. Serializable Isolation Level** (`prisma.$transaction(..., { isolationLevel: 'Serializable' })`) | Supported natively | Medium | Lower (retry overhead) | ❌ **Rejected:** Requires complex retry loops on 40001 serialization failures; does not protect against external non-transactional inserts. |
| **D. PostgreSQL Partial Unique Index + Interactive Transaction** | Supported natively in PostgreSQL | Low | Highest | ✅ **ACCEPTED:** Engine-level guarantee; zero serialization overhead; instantly throws P2002 on collision. |

### The Chosen Mechanism: Partial Unique Index

We enforce the single-active-session invariant at the database engine level using a PostgreSQL partial unique index:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_session_per_user"
ON "FocusSession"("userId")
WHERE "status" = 'IN_PROGRESS';
```

### Prisma ORM Integration & Migration Strategy
Prisma Schema Language (PSL) does not natively support `WHERE` predicate filters on `@@unique`. Therefore, the partial unique index is defined in a committed migration SQL script:
`prisma/migrations/20260917120000_phase6_timer_enhancements/migration.sql`.

When a concurrent insert occurs that violates this index, PostgreSQL raises error code `23505` (unique_violation), which Prisma's runtime query engine maps to a `PrismaClientKnownRequestError` with code `P2002`. The application layer catches `P2002` and deterministically converts it to `409 Conflict: ACTIVE_SESSION_EXISTS`.

In addition to the partial unique index, session creation executes inside an interactive transaction (`prisma.$transaction`) with auto-reconciliation:
1. First, any active running session whose `startedAt + plannedDuration + pausedDuration` has already elapsed (`pausedAt === null`) is automatically reconciled to `COMPLETED`.
2. Paused sessions (`pausedAt !== null`) **NEVER** auto-expire; they remain indefinitely `IN_PROGRESS` holding the single active session slot until the user explicitly resumes, resets, or skips.
3. If an active, unexpired or paused session exists, the server returns an explicit `409 Conflict: ACTIVE_SESSION_EXISTS` with the active session payload.
4. If an unforeseen race occurs, the PostgreSQL partial unique index enforces database-level rejection of the second insert with Prisma error code `P2002`, mapped to `409 Conflict`.

---

## 4. Client vs. Server Authority Boundaries

1. **Database / Server is the Sole Concurrency Authority:**
   - The PostgreSQL partial unique index is the definitive, immutable single-source-of-truth.
2. **`BroadcastChannel` is ONLY for Client UX & Synchronization:**
   - `BroadcastChannel` notifies other open tabs of state changes (e.g. Tab 1 started session -> Tab 2 displays running timer).
   - `BroadcastChannel` is **NEVER** relied upon for concurrency safety. If `BroadcastChannel` is blocked, unmounted, or running on separate physical devices (e.g. laptop and phone), the database-level partial unique index prevents concurrent sessions.
3. **Active Session API (`GET /api/focus-sessions/active`) is for Client Recovery:**
   - On page reload, laptop wake, or network reconnect, the client queries this endpoint to recover authoritative session state.
4. **Zustand Store is Transient UI State:**
   - Zustand calculates smooth 60fps countdown visuals locally, anchored to server timestamps.

---

## 5. Failure Behavior & Error Envelope

When a start request collides with an existing active session:
- **HTTP Status:** `409 Conflict`
- **Error Code:** `ACTIVE_SESSION_EXISTS`
- **Response Payload:**
  ```json
  {
    "success": false,
    "error": {
      "code": "ACTIVE_SESSION_EXISTS",
      "message": "An active focus session is already in progress.",
      "details": {
        "activeSession": {
          "id": "cly123456",
          "type": "FOCUS",
          "status": "IN_PROGRESS",
          "startedAt": "2026-09-17T12:00:00.000Z",
          "plannedDuration": 1500
        }
      }
    }
  }
  ```
- **UI Behavior:** Tab 2 catches the `409 Conflict`, renders a notification banner to the user ("Active session detected in another tab or device"), and provides buttons to "Join Session" (syncing Tab 2 to Tab 1's running session) or "Abandon Existing Session".

---

## 6. Testing Strategy

1. **Unit & Concurrency Tests:**
   - Mock concurrent calls to `createFocusSession` for the same `userId` and assert that exactly one call succeeds and the second raises `ActiveSessionConflictError` / P2002.
2. **Deterministic Auto-Reconciliation Tests:**
   - Ensure an expired `IN_PROGRESS` session is reconciled before creating a new one, avoiding false 409 errors.
3. **Multi-Tenant Isolation Tests:**
   - User A starting a session must never collide with User B starting a session simultaneously (unique index is scoped to `userId`).

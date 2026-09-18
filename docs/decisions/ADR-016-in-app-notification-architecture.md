# ADR-016: In-App Notification System & Idempotent Deduplication

## Status
Approved

## Context
Phase 10 introduces persistent notifications to alert users when a focus session countdown naturally completes. Productivity applications often suffer from duplicate alerts due to multi-tab usage, network retries, browser sleep/wake events, or concurrent page reloads.

Furthermore, notification systems often grow uncontrollably in scope (e.g., adding Web Push, email digests, background workers, cron queues, and task due date alerts prematurely), causing reliability and infrastructure overhead.

## Decision

1. **Strict In-App Scope Boundary**:
   - FocusFlow restricts notifications strictly to an **in-app notification ledger** displayed within the application shell's `NotificationCenter` popover.
   - External transports (email, Web Push, browser native desktop notifications, service workers, cron daemons, background queue workers) are explicitly excluded from Phase 10.
   - Exactly one production notification type is defined: `FOCUS_SESSION_COMPLETED`.
   - Task due dates remain queried inline on the Tasks view without creating passive notification backlog.

2. **Transactional Event Creation**:
   - Notifications are generated atomically within the PostgreSQL transaction of `completeFocusSession`.
   - When a focus session transitions from `IN_PROGRESS` to `COMPLETED`, the system queries the user's `NotificationPreference`. If `focusSessionCompletion` is enabled (the default), a notification record is generated.

3. **Deterministic Database Deduplication Key**:
   - To guarantee idempotency across client retries, multi-tab broadcast events, and concurrent background reconciliation, every notification uses a deterministic `dedupeKey`:
     `focus-session-completed:<focusSessionId>`
   - A database-level unique constraint (`@unique` on `Notification.dedupeKey`) prevents duplicate notification rows under any race condition.
   - Insertions execute via Prisma `upsert` with a no-op update on collision.

4. **Multi-Tenant Isolation & Anti-Enumeration**:
   - All notification reads, unread counts, and mark-as-read mutations are strictly scoped to the authenticated `userId`.
   - Attempting to mark or access another user's notification returns a `404 NOT_FOUND` error to prevent resource enumeration.
   - No public notification creation endpoint exists (`POST /api/notifications` is omitted); notifications can only be created by authoritative internal domain triggers.

5. **Authoritative Timezone Preservation (ADR-011)**:
   - Modifying `User.timezone` via Settings updates user-local calendar boundaries for daily summaries, streaks, and analytics without rewriting historical UTC timestamps in `FocusSession` or `Notification`.

## Consequences
- Guarantees zero duplicate notification badges even when users have multiple browser tabs open during session expiry.
- Eliminates dependency on external messaging infrastructure or push worker processes.
- Guarantees fast, indexed queries (`[userId, createdAt]` and `[userId, readAt]`) with deterministic pagination.

# FocusFlow — In-App Notifications & Settings Architecture

## 1. Overview & Architecture

FocusFlow Phase 10 introduces a lightweight, deterministic in-app notification system coupled with authoritative user timezone and preference settings.

```text
Focus Session Expiry
       ↓
completeFocusSession Transaction
       ↓
Check NotificationPreference.focusSessionCompletion
       ↓ (if true)
Idempotent Upsert (dedupeKey: "focus-session-completed:<id>")
       ↓
PostgreSQL Notification Table
       ↓
NotificationCenter UI (TanStack Query polling / cache invalidation)
```

## 2. In-App Scope Boundaries

To maintain high reliability, low cognitive load, and SaaS production standards without unnecessary infrastructure complexity, the notification system adheres to strict architectural boundaries:

- **Transports Included**:
  - In-app notification bell with live unread badge.
  - Dropdown popover list sorted newest first.
  - Read/unread visual indicators, relative timestamps, and one-click session navigation to `/history`.
  - Batch "Mark all as read" capability.
- **Transports Explicitly Excluded**:
  - Email digests / transactional emails.
  - Web Push API / Service Worker notifications.
  - Browser native desktop notification popups.
  - Background queue workers / Redis / BullMQ.
  - Cron jobs or scheduled reminder workers.
  - Task due date notification spam (due dates remain filtered inline in the Task list).

## 3. Production Notification Types

In Phase 10, exactly one authoritative notification type is produced:

| Type | Trigger | Title | Body Example |
|---|---|---|---|
| `FOCUS_SESSION_COMPLETED` | Natural countdown expiry of a `FOCUS` session | "Focus session completed" | "Your 25-minute focus session has been completed." |

Break sessions (`SHORT_BREAK`, `LONG_BREAK`) do not produce notifications. Abandoned or skipped sessions do not produce completion notifications.

## 4. Deduplication & Idempotency Guarantees

In multi-tab or network retry environments, session completion events may trigger concurrently. The notification architecture enforces database-level deduplication:

1. **Deterministic Deduplication Key**:
   ```text
   dedupeKey = "focus-session-completed:" + focusSessionId
   ```
2. **Unique Database Constraint**:
   ```prisma
   model Notification {
     ...
     dedupeKey String? @unique
     ...
   }
   ```
3. **Atomic Upsert**:
   The session completion transaction performs an upsert:
   ```typescript
   await tx.notification.upsert({
     where: { dedupeKey },
     create: { ... },
     update: {}, // no-op on collision
   });
   ```
   This guarantees that no race condition or retry can ever produce duplicate notifications.

## 5. Notification Preferences

Users retain full control over notification delivery in the Settings page:

- **Model**: `NotificationPreference` (`focusSessionCompletion: boolean`, default `true`).
- **Behavior**: If `focusSessionCompletion === false`, `completeFocusSession` atomically skips notification creation.
- **Endpoint**: `GET /api/notification-preferences` and `PATCH /api/notification-preferences`.

## 6. Authoritative Timezone Model (ADR-011)

- The single source of truth for the user's timezone is `User.timezone` in PostgreSQL.
- Changing timezone via `PATCH /api/settings` immediately adjusts local calendar day boundaries for streak calculations, daily goals, productivity summaries, and analytics distributions.
- Existing historical timestamps (`startedAt`, `endedAt`, `createdAt`) are stored as absolute UTC instants and are never modified when timezone changes.

## 7. Security & Multi-Tenant Isolation

- All notification endpoints require Auth.js authentication.
- All database queries (`getNotifications`, `getUnreadNotificationCount`, `markNotificationAsRead`, `markAllNotificationsAsRead`) filter strictly by `userId`.
- Attempting to mark a notification belonging to another user returns `404 NOT_FOUND` to prevent resource enumeration.
- No public `POST /api/notifications` endpoint exists, preventing external notification injection.

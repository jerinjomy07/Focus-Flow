# ADR-010: Task Due Date Semantics (UTC Timestamp with End-of-Day Anchor)

## Status
Approved

## Context
FocusFlow tasks feature an optional due date (`Task.dueDate`). There are two potential conceptual models for due dates in task management systems:
1. **Calendar Date Only (Date String / Date Column)**: e.g. "Due on September 20". Has no time component.
2. **Exact Point in Time / Deadline (UTC Timestamp)**: e.g. `2026-09-20T23:59:59.000Z`. Represents a specific point in time.

The PostgreSQL schema established in Phase 2 defines `dueDate DateTime?` (which maps to `TIMESTAMP(3) WITH TIME ZONE` in PostgreSQL and `Date | null` in Prisma).

## Decision
We retain the existing **UTC timestamp representation** in PostgreSQL (`dueDate DateTime?`), with the following semantic behavior:
1. When a user selects a calendar date in the UI without specifying an exact time of day, the client anchors the deadline to the **final second of that calendar day in the user's local timezone** (`23:59:59.999`), then converts and transmits this as an ISO 8601 UTC string (e.g. `2026-09-20T23:59:59.000Z`).
2. Due date categorization (`OVERDUE`, `TODAY`, `TOMORROW`, `UPCOMING`) is evaluated by converting the stored UTC `dueDate` to the calendar day string (`YYYY-MM-DD`) in the user's authoritative timezone and comparing against today's local date.
3. This preserves compatibility with the Phase 2 schema without requiring DDL alterations, while preserving future capability for users to set precise deadline times (e.g. "Due at 3:00 PM").

## Consequences
- **Positive:** No database schema migration needed; consistent with `docs/api-architecture.md` line 276; supports both calendar-day tasks and future hourly deadlines.
- **Negative:** Display and filter logic must always pass through timezone-aware domain functions (`getDueDateCategory`, `formatDueDate`). Naive client-local `new Date(dueDate)` comparisons are strictly prohibited.

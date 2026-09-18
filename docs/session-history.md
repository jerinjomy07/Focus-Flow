# FocusFlow — Session History Documentation

## Overview

FocusFlow Session History provides users with authoritative, immutable historical records of all completed, abandoned, skipped, and in-progress focus and break sessions. It serves as an audit trail of user effort and the data foundation for future dashboards and analytics.

---

## 1. Data Model & Field Definitions

Historical records are stored in PostgreSQL within the `FocusSession` table.

| Field | Type | Origin | Semantics |
|---|---|---|---|
| `id` | `String` (CUID) | Authoritative | Unique session identifier |
| `userId` | `String` | Authoritative | Foreign key to `User`, enforces strict tenant boundary |
| `type` | `SessionType` | Authoritative | `FOCUS`, `SHORT_BREAK`, or `LONG_BREAK` |
| `status` | `SessionStatus` | Authoritative | `IN_PROGRESS`, `COMPLETED`, `ABANDONED`, or `SKIPPED` |
| `plannedDuration` | `Int` (seconds) | Authoritative | Target duration agreed upon when session was initiated |
| `actualDuration` | `Int?` (seconds) | Authoritative | Active elapsed seconds worked (frozen during pauses) |
| `pausedDuration` | `Int` (seconds) | Authoritative | Cumulative paused seconds during the session lifecycle |
| `startedAt` | `DateTime` (UTC) | Authoritative | Timestamp when session countdown began |
| `endedAt` | `DateTime?` (UTC) | Authoritative | Timestamp when session completed or was abandoned |
| `projectId` | `String?` | Relational | Reference to `Project`, `SetNull` on project deletion |
| `taskId` | `String?` | Relational | Reference to `Task`, `SetNull` on task deletion |

---

## 2. Querying, Filtering & Pagination

The collection endpoint `GET /api/focus-sessions` supports full-stack filtering, sorting, and pagination:

### Supported Query Parameters

| Parameter | Type | Validation | Default | Description |
|---|---|---|---|---|
| `page` | `Int` | $\ge 1$ | `1` | 1-based page index |
| `pageSize` | `Int` | $1 \le \text{pageSize} \le 100$ | `20` | Records per page |
| `sort` | `String` | `startedAt` \| `actualDuration` | `startedAt` | Primary sort column |
| `sortOrder` | `String` | `asc` \| `desc` | `desc` | Sort direction |
| `type` | `String` | `FOCUS` \| `SHORT_BREAK` \| `LONG_BREAK` | `undefined` | Filter by session type |
| `status` | `String` | `IN_PROGRESS` \| `COMPLETED` \| `ABANDONED` \| `SKIPPED` | `undefined` | Filter by outcome status |
| `projectId` | `String` | Valid project CUID | `undefined` | Filter by linked project |
| `taskId` | `String` | Valid task CUID | `undefined` | Filter by linked task |
| `startDate` | `String` | `YYYY-MM-DD` or ISO 8601 with offset | `undefined` | Lower date boundary |
| `endDate` | `String` | `YYYY-MM-DD` or ISO 8601 with offset | `undefined` | Upper date boundary |

### Deterministic Multi-Column Sorting
To eliminate pagination drift and nondeterministic ordering, database queries apply secondary tie-breakers:
```prisma
orderBy: [
  { [sort]: sortOrder },
  { startedAt: 'desc' },
  { id: 'desc' }
]
```

### Pagination Envelope
```json
{
  "data": [ /* Array of FocusSessionWithRelations */ ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 142,
    "totalPages": 8,
    "hasMore": true
  }
}
```

---

## 3. Date Input Normalization & Boundaries

Date filtering supports both calendar dates and ISO timestamps:

1. **Date-Only Input (`YYYY-MM-DD`):**
   - Represents the complete local calendar day in the authenticated user's `User.timezone`.
   - `startDate=2026-09-17` normalizes to `00:00:00.000` in the user's timezone converted to UTC.
   - `endDate=2026-09-17` normalizes to exclusive upper bound `00:00:00.000` of `2026-09-18` in the user's timezone converted to UTC.

2. **Explicit-Offset Datetime (ISO 8601):**
   - Represents an exact UTC instant (e.g., `2026-09-17T09:00:00.000-04:00` $\longrightarrow$ `2026-09-17T13:00:00.000Z`).
   - The textual offset is used solely for instant resolution; the UTC `Date` object is stored and queried.

3. **Half-Open Interval Semantics:**
   All date filtering is strictly half-open:
   $$\text{startedAt} \ge \text{startUtc} \quad \text{AND} \quad \text{startedAt} < \text{endUtcExclusive}$$

4. **Post-Normalization Validation:**
   If `startUtc >= endUtcExclusive`, the request is rejected with `400 VALIDATION_ERROR` (`START_DATE_AFTER_END_DATE`).

---

## 4. Deleted Resource Semantics (ADR-013 & Phase 7 Policy)

Both `FocusSession.projectId` and `FocusSession.taskId` use Prisma `onDelete: SetNull` to guarantee that deleting a task or project never cascades into session data loss.

Because deletion mutates the foreign key column to `NULL`, the database does not distinguish between a session originally recorded without a project and one whose project was subsequently deleted:

- `projectId = null`: Uniformly rendered in the UI as **`Unassigned`**. It participates in project breakdown calculations under the `Unassigned` group.
- `taskId = null`: Uniformly rendered in the UI as **`No Task`** (neutral indicator).

Multi-tenant isolation is strictly maintained: cross-tenant access returns `404 NOT_FOUND` anti-enumeration responses.

---

## 5. UI Architecture (`/history`)

The Session History view provides:
1. **Daily Summary Header:** Displays today's completed focus sessions, focus time, completion rate (rounded in UI), and abandoned/skipped counts.
2. **Filter Toolbar:** Fast dropdown filtering by Status, Type, Project, Task, Date Range preset/custom, and Sort order, with active filter badges and reset capability.
3. **Responsive Views:**
   - Desktop: Dense, sortable table with visual status indicators, duration comparison, and row click inspection.
   - Mobile: Touch-friendly cards (min 48px target) with clear status tags and timing chips.
4. **Session Detail Modal:** Accessible inspection dialog detailing start/end timestamps, actual duration, planned duration, paused duration, linked task stats, and project color tags.

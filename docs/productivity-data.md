# FocusFlow — Productivity Data Foundation Specification

## Overview

This specification establishes the authoritative, timezone-aware productivity data layer for FocusFlow. It transforms individual `FocusSession` audit records into reliable metric aggregations for consumption by Phase 8 (Dashboard), Phase 9 (Analytics), and goal/streak engines.

---

## 1. Core Metric Formulas & Architectural Guarantees

### 1.1 Canonical Completed Focus Time
Authoritative completed focus duration is defined strictly as:
$$\text{CompletedFocusSeconds} = \sum \text{actualDuration} \quad \text{for } \text{type} = \text{'FOCUS'} \land \text{status} = \text{'COMPLETED'}$$

*Rules:*
- Abandoned focus sessions (`status = 'ABANDONED'`) are excluded.
- Skipped focus sessions (`status = 'SKIPPED'`) have `actualDuration = 0` and are excluded.
- Short break and long break sessions are excluded (break duration never inflates focus time).
- In-progress sessions are excluded.

### 1.2 Canonical `completionRate` Formula
The completion rate evaluates focus discipline and intentionality:
$$\text{completionRate} = \frac{\text{completedFocusSessions}}{\text{completedFocusSessions} + \text{abandonedFocusSessions}} \times 100$$

*Rules:*
- Evaluates only `FOCUS` sessions.
- `COMPLETED` contributes to both numerator and denominator.
- `ABANDONED` contributes only to the denominator.
- `SKIPPED` does not contribute (neutral outcome).
- Break sessions do not contribute.
- In-progress sessions do not contribute.
- When `(completedFocusSessions + abandonedFocusSessions) === 0`, `completionRate` returns `0`.

### 1.3 Duration-Based Project Percentage & Floating-Point Precision
Project distribution evaluates where focus effort was spent:
$$\text{percentage} = \frac{\text{projectCompletedFocusSeconds}}{\text{totalCompletedFocusSecondsForSameRange}} \times 100$$

*Precision Contract:*
- The API and domain services return the **unrounded numeric percentage** derived from the duration ratio (e.g. `33.33333333333333` or `66.66666666666667`).
- Presentation rounding (e.g. `Math.round(val)` or `toFixed(1)`) is performed strictly by UI rendering components.
- `Unassigned` sessions (`projectId = null`) participate in the denominator and appear as an `Unassigned` entry.
- Abandoned sessions and breaks do not pollute the percentage denominator.
- If total completed focus time is 0, percentage is `0`.

---

## 2. Mutually Exclusive Summary Query Modes

Endpoints `GET /api/productivity/summary` and `GET /api/productivity/projects` enforce three mutually exclusive query modes:

| Mode | Parameters | Description |
|---|---|---|
| **Mode A: Single Local Day** | `date=YYYY-MM-DD` | Complete local calendar day in `User.timezone` |
| **Mode B: Predefined Period** | `period=today\|yesterday\|week\|month` | Canonical boundary calculations |
| **Mode C: Custom Range** | `startDate` + `endDate` | Normalized half-open bounds `[startUtc, endUtcExclusive)` |

### Mode Count Enforcement
- **0 modes supplied:**
  - `GET /api/productivity/summary` defaults to `period=today` (200 OK)
  - `GET /api/productivity/projects` defaults to `period=week` (200 OK)
- **Exactly 1 mode supplied:** Valid request (200 OK).
- **2 or more modes supplied:** Ambiguous request, immediately rejected with `400 VALIDATION_ERROR`.
- **Incomplete Custom Range:** Supplying `startDate` without `endDate` or `endDate` without `startDate` is rejected with `400 VALIDATION_ERROR`.

---

## 3. Timezone & Boundary Definitions

### 3.1 Productivity Day Attribution
A session belongs to the local calendar day on which work **started** (`startedAt`) in the user's current `User.timezone`.
- A session starting at `23:55` on September 17 and ending at `00:20` on September 18 belongs to September 17.
- Attribution is evaluated dynamically using `startedAt` and current `User.timezone`.

### 3.2 Explicit Monday-Based Week Boundary
For all productivity period calculations:
- The week starts on Monday at `00:00:00.000` in the user's timezone.
- The interval is half-open: `[MondayStartUtc, NextMondayStartUtc)`.
- Handled across Daylight Saving Time (DST) shifts (e.g. 167h spring-forward, 169h fall-back).

### 3.3 Calendar Month Period
The month period represents the full local calendar month:
- Starts on the 1st of the month at `00:00:00.000` in the user's timezone.
- Ends on the 1st of the following month at `00:00:00.000` in the user's timezone.
- Represents exact month boundaries (28, 29, 30, or 31 days) rather than rolling 30-day windows.

### 3.4 Iterative Local Midnight Offset Solver
Because timezones with large positive offsets (e.g. `Pacific/Auckland` UTC+12/13) or negative offsets shift local dates relative to UTC noon, `getLocalMidnightUtc` uses a two-pass iterative solver:
1. Initial probe: `Date.UTC(y, m-1, d, 0, 0, 0)`.
2. Extract calendar date in target timezone using `Intl.DateTimeFormat('en-CA', { timeZone })`.
3. Compute exact minute error and offset; adjust target UTC timestamp.
4. Second probe verifies exact local midnight `00:00:00.000`.

---

## 4. PostgreSQL Database-Side Aggregations

To guarantee scalability and zero unbounded in-memory session loading:

### 4.1 Range Aggregations (`getProductivityAggregatesForRange`)
Executes concurrent PostgreSQL aggregation and count queries:
- `aggregate({ where: { userId, type: 'FOCUS', status: 'COMPLETED', startedAt }, _sum: { actualDuration: true }, _count: { id: true } })`
- `aggregate({ where: { userId, type: 'FOCUS', status: 'ABANDONED', startedAt }, _sum: { actualDuration: true }, _count: { id: true } })`
- `count({ where: { userId, type: 'FOCUS', status: 'SKIPPED', startedAt } })`
- `aggregate({ where: { userId, type: { in: ['SHORT_BREAK', 'LONG_BREAK'] }, status: 'COMPLETED', startedAt }, _sum: { actualDuration: true }, _count: { id: true } })`
- Total session count in interval.

### 4.2 Two-Step Project Summary
Because Prisma `groupBy` does not join relational tables, project breakdown uses a two-step query:
1. **Step 1:** Execute `groupBy({ by: ['projectId'], where: { userId, type: 'FOCUS', status: 'COMPLETED', startedAt }, _sum: { actualDuration: true }, _count: { id: true } })`.
2. **Step 2:** Query project metadata for non-null IDs: `prisma.project.findMany({ where: { userId, id: { in: projectIds } } })`.
3. **Step 3:** Merge metadata in Node.js. For `projectId = null`, map to `{ projectName: 'Unassigned', projectColor: null, isArchived: false }`. Compute unrounded percentage based on group duration sum.

---

## 5. Indexing & Multi-Tenant Performance

All session queries are backed by PostgreSQL composite indexes:
- `@@index([userId, startedAt])`: Primary composite index for half-open range queries.
- `@@index([userId, type, status])`: Optimized for aggregation filtering.
- `@@index([userId, status])`: Optimized for single-active-session concurrency check.
- `@@unique([userId], where: { status: 'IN_PROGRESS' })`: PostgreSQL partial unique index guaranteeing at most 1 active session per user.

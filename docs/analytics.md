# FocusFlow — Advanced Analytics Specification (Phase 9)

## Overview

This specification establishes the query-first analytics architecture for FocusFlow. Building upon the authoritative `FocusSession` records and the Phase 7/8 productivity foundations, Phase 9 delivers deterministic, on-demand analytical insights, period-over-period comparisons, temporal rhythm histograms, and project focus allocations.

---

## 1. Architectural Principles (Option A: Query-First Analytics)

FocusFlow strictly implements **Option A: Query-First Analytics**:
- **Zero Precomputed Counters or Snapshot Tables**: All analytical metrics are derived on demand directly from authoritative `FocusSession` records in PostgreSQL.
- **Zero Unbounded Session Loading**: Calculations use database engine aggregations (`COUNT`, `SUM`, `_max`) and indexed date filters `[startUtc, endUtcExclusive)`.
- **Strict Multi-Tenant Isolation**: Every query requires `userId` scoped filtering.
- **Timezone Awareness**: All calendar days, weekday buckets (0 = Monday .. 6 = Sunday), and hour buckets (0..23) are computed in the authenticated user's IANA timezone (`User.timezone`).
- **No Third-Party Chart Dependencies**: Visual charts are implemented using pure, accessible inline SVGs with screen reader fallbacks.

---

## 2. API Endpoints

### 2.1 `GET /api/analytics/overview`
Retrieves comprehensive focus performance metrics and period-over-period comparison deltas.

#### Supported Query Modes
Mutually exclusive modes matching Phase 7/8 conventions:
1. **Mode A — Single Day**: `?date=YYYY-MM-DD`
2. **Mode B — Predefined Period**: `?period=today|yesterday|week|month` (defaults to `week` if 0 params supplied)
3. **Mode C — Custom Range**: `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` (both required)

#### Response Envelope (`AnalyticsOverviewResponse`)
```json
{
  "data": {
    "period": "week",
    "startDate": "2026-09-14",
    "endDate": "2026-09-20",
    "completedFocusSeconds": 28800,
    "completedFocusMinutes": 480,
    "completedFocusSessions": 16,
    "abandonedFocusSeconds": 1800,
    "abandonedFocusSessions": 2,
    "completionRate": 88.88888888888889,
    "averageCompletedSessionSeconds": 1800,
    "longestCompletedSessionSeconds": 3000,
    "totalBreakSeconds": 4800,
    "totalSessions": 19,
    "activeFocusDays": 5,
    "totalDaysInRange": 7,
    "consistencyRate": 71.42857142857143,
    "previousPeriod": {
      "startDate": "2026-09-07",
      "endDate": "2026-09-13"
    },
    "comparisons": {
      "focusTime": {
        "currentValue": 28800,
        "previousValue": 21600,
        "absoluteDelta": 7200,
        "percentageDelta": 33.33333333333333,
        "direction": "up"
      },
      "completedSessions": {
        "currentValue": 16,
        "previousValue": 12,
        "absoluteDelta": 4,
        "percentageDelta": 33.33333333333333,
        "direction": "up"
      },
      "completionRate": {
        "currentValue": 88.88888888888889,
        "previousValue": 75.0,
        "absoluteDelta": 13.888888888888886,
        "percentageDelta": 18.518518518518515,
        "direction": "up"
      },
      "abandonedSessions": {
        "currentValue": 2,
        "previousValue": 4,
        "absoluteDelta": -2,
        "percentageDelta": -50.0,
        "direction": "down"
      }
    }
  }
}
```

---

### 2.2 `GET /api/analytics/distributions`
Retrieves temporal distributions across weekdays and hours of the day, as well as project focus allocations.

#### Response Envelope (`AnalyticsDistributionsResponse`)
```json
{
  "data": {
    "period": "week",
    "startDate": "2026-09-14",
    "endDate": "2026-09-20",
    "weekday": [
      {
        "weekday": 0,
        "label": "Mon",
        "completedFocusSeconds": 7200,
        "completedFocusMinutes": 120,
        "completedSessions": 4,
        "averageSessionSeconds": 1800
      }
      // ... Tue through Sun
    ],
    "hourly": [
      {
        "hour": 0,
        "label": "00:00",
        "completedFocusSeconds": 0,
        "completedFocusMinutes": 0,
        "completedSessions": 0
      }
      // ... 01:00 through 23:00
    ],
    "projects": [
      {
        "projectId": "prj_1",
        "projectName": "Mobile App",
        "projectColor": "#3b82f6",
        "isArchived": false,
        "completedFocusSeconds": 21600,
        "completedFocusMinutes": 360,
        "sessionCount": 12,
        "percentage": 75.0
      },
      {
        "projectId": null,
        "projectName": "Unassigned",
        "projectColor": null,
        "isArchived": false,
        "completedFocusSeconds": 7200,
        "completedFocusMinutes": 120,
        "sessionCount": 4,
        "percentage": 25.0
      }
    ],
    "peakWeekday": {
      "weekday": 3,
      "label": "Thu",
      "completedFocusSeconds": 10800,
      "completedFocusMinutes": 180,
      "completedSessions": 6,
      "averageSessionSeconds": 1800
    },
    "peakHour": {
      "hour": 14,
      "label": "14:00",
      "completedFocusSeconds": 5400,
      "completedFocusMinutes": 90,
      "completedSessions": 3
    }
  }
}
```

---

## 3. Mathematical Definitions & Rules

### 3.1 Consistency Rate
$$\text{consistencyRate} = \frac{\text{activeFocusDays}}{\text{totalCalendarDaysInRange}} \times 100$$
- $\text{activeFocusDays}$: Distinct local calendar days in the user's timezone having $\ge 1$ completed `FOCUS` session.
- $\text{totalCalendarDaysInRange}$: Total calendar days in the interval $[startUtc, endUtcExclusive)$.
- If $\text{totalCalendarDaysInRange} \le 0$, returns `0`.
- **Factual & Descriptive**: Consistency is strictly a deterministic, factual metric. No evaluative habit scores, tiers, or qualitative labels (such as "Excellent", "Good Habit", "Needs Improvement", "Poor Consistency", or "Strong Habit") are computed or emitted.

### 3.2 Period-over-Period Comparisons
Preceding interval calculation:
- **Mode A (Single Day)**: Immediately preceding local calendar day.
- **Mode B (Predefined Period)**:
  - `today` $\rightarrow$ `yesterday`
  - `yesterday` $\rightarrow$ day before yesterday
  - `week` $\rightarrow$ preceding Monday-based calendar week $[LastMondayUtc, ThisMondayUtc)$
  - `month` $\rightarrow$ preceding full calendar month
- **Mode C (Custom Range)**: Preceding range of identical calendar duration immediately preceding `startDate`.

Delta rules:
$$\text{absoluteDelta} = \text{currentValue} - \text{previousValue}$$
$$\text{percentageDelta} = \frac{\text{absoluteDelta}}{\text{previousValue}} \times 100 \quad (\text{null if } \text{previousValue} = 0)$$

### 3.3 Peak Productivity Windows & Tie-Breaking
- **Peak Weekday**: Weekday with maximum `completedFocusSeconds`. If multiple days tie for maximum, the tie is broken deterministically by choosing the earliest weekday index ($0 = \text{Monday} \dots 6 = \text{Sunday}$). Returns `null` if total focus seconds across all days is 0.
- **Peak Hour**: Hour ($0 \dots 23$) with maximum `completedFocusSeconds`. If multiple hours tie, the earliest hour is selected. Returns `null` if all hours are 0.

---

## 4. UI Implementation

The `/analytics` page features:
1. **Analytics Header**: Predefined period buttons (Today, Yesterday, This Week, This Month, Custom Range) with URL param synchronization and accessible date inputs.
2. **Overview KPI Grid**: 4 cards (Total Focus Time, Completed Blocks, Completion Rate, Consistency Rate) with period-over-period trend badges.
3. **Peak Focus Banner**: Visual cards identifying the most productive day and peak focus window.
4. **Secondary Metrics Bar**: Avg block duration, longest session, abandoned session count with delta, and logged break time.
5. **Weekday Distribution Chart**: Accessible SVG bar chart with 7 columns (Mon..Sun), peak highlighting, and keyboard navigation.
6. **24-Hour Focus Rhythm**: Accessible SVG 24-hour histogram (00:00..23:00) with key interval labels (00:00, 06:00, 12:00, 18:00, 23:00).
7. **Project Focus Allocation**: Visual bars showing time and unrounded duration percentage per project (plus Unassigned).
8. **Consistency Meter**: Factual, deterministic progress meter displaying active focus days vs. total calendar days with percentage. Contains zero evaluative habit scores, tiers, or qualitative judgments.

---

## 5. Performance & Aggregation Result Model

FocusFlow strictly guarantees bounded, efficient query-first analytics:
- **Engine-Side Aggregation**: PostgreSQL performs all filtering, duration summing, and grouping. Node.js never loads unbounded raw session histories into process memory.
- **Accurate Aggregation Result Model**:
  ```text
  1 scalar overview result
  + 7 weekday aggregation rows
  + 24 hourly aggregation rows
  + N project aggregation rows
  ```
  where `N` is the number of distinct project groups returned for the selected range.
- **Bounded Temporal Buckets**: Weekday results are strictly bounded to 7 rows (Mon..Sun); hourly results are strictly bounded to 24 rows (00:00..23:00).
- **Scalable Project Cardinality**: Project distribution rows scale linearly with the count of distinct projects ($N$) having logged activity in the range, without arbitrary small-project truncation or silent data loss.

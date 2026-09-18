# ADR-006: Timestamp-Based Timer over Interval Accumulation

**Date:** 2026-09-17  
**Status:** Accepted  
**Author:** Architecture Team

---

## Context

The timer is the core feature of FocusFlow. The fundamental question is: **how should the timer calculate remaining time?**

Two approaches exist:

**Approach A — Interval accumulation (naive)**
```typescript
// Run setInterval every second; decrement a counter
let remaining = 25 * 60;
const interval = setInterval(() => {
  remaining -= 1;
  if (remaining <= 0) complete();
}, 1000);
```

**Approach B — Timestamp-based calculation (correct)**
```typescript
// Record when the timer ends; always derive remaining time from system clock
const endTimestamp = Date.now() + plannedDuration * 1000;
function getRemainingTime(): number {
  return Math.max(0, endTimestamp - Date.now());
}
```

## Decision

Use **timestamp-based calculation** (Approach B) exclusively.

## Rationale

### Problems with interval accumulation

1. **Browser tab throttling:** Browsers throttle `setInterval` in background tabs to 1000ms or longer. A tab backgrounded for 30 seconds with a 1-second interval may only fire 10-15 times — losing 15-20 seconds.

2. **Laptop sleep:** If the device sleeps, `setInterval` is suspended entirely. Upon wake, the timer resumes from where it left off — showing incorrect remaining time.

3. **JavaScript event loop delay:** Under CPU load, `setInterval` callbacks can be delayed by tens to hundreds of milliseconds. Over a 25-minute session, this accumulates to a measurable error.

4. **Page refresh:** On refresh, the accumulated state is lost. There is no way to reconstruct the correct remaining time without the original end timestamp.

5. **Multi-tab inconsistency:** Multiple tabs each accumulate their own countdown, leading to divergent state.

### Why timestamp-based is correct

- `getRemainingTime()` always returns the exact truth based on `endTimestamp - Date.now()`
- Background tab, laptop sleep, network lag — none of these affect the calculation because the clock always advances correctly
- Page refresh: the server records `startedAt` and `plannedDuration`; the client can reconstruct `endTimestamp` exactly
- Multi-tab: any tab can reconstruct the same remaining time from the same server-authoritative timestamps

### Display loop

Display is driven by `requestAnimationFrame` (not `setInterval`):
```typescript
function tick() {
  const remaining = getRemainingTime();
  updateDisplay(remaining);
  if (remaining > 0) requestAnimationFrame(tick);
  else handleComplete();
}
```

RAF is also throttled in background tabs — but it only drives **display**, not the calculation. The timer is always correct when the tab comes to foreground.

## Trade-offs Accepted

- Pause/resume requires tracking `totalPausedDuration` and recalculating `endTimestamp` on resume
- Slightly more complex implementation than a naive counter

## Consequences

- `TimerSession` always stores: `startedAt`, `plannedDuration`, `totalPausedDuration`
- `endTimestamp` is a derived value: `startedAt + plannedDuration - totalPausedDuration` (accounting for pauses)
- `getRemainingTime()` is a pure function tested in isolation
- No `setInterval` is used as the authoritative source of time
- `setInterval` may be used as a fallback wake mechanism (check every second if rAF stops) but is never the source of truth for remaining time

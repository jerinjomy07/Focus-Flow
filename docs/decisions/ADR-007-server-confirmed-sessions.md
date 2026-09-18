# ADR-007: Server-Confirmed Session Creation over Optimistic-Only

**Date:** 2026-09-17  
**Status:** Accepted  
**Author:** Architecture Team

---

## Context

When a user starts a focus session, the application must create a session record. Two strategies exist:

**Option A — Optimistic-only:**
The client immediately starts the timer. The server record is created asynchronously. If the network request fails, the session runs without a database record. The session is only recorded at completion.

**Option B — Server-confirmed:**
The client sends a POST request to create the session before starting the timer. The timer only starts after receiving a `201 Created` with the session ID. If the POST fails, the timer does not start and the user is informed.

**Option C — Hybrid:**
The client starts the timer immediately (optimistic), while the POST runs in the background. If the POST fails, the user is notified but the timer continues. A retry mechanism attempts to write the session.

## Decision

Use **Option B — Server-confirmed session creation**, with optimistic loading state.

The UI immediately transitions to a "Starting..." state when the user clicks Start, then transitions to RUNNING when the server confirms. This feels instant to the user while ensuring data integrity.

## Rationale

### Why not Option A (optimistic-only)

The core data integrity requirement of FocusFlow is: **every completed session is recorded accurately.** If the session record is only created at completion:

1. If the user closes the browser before completing → no record is created
2. If the network fails after the session completes → data is lost
3. Refresh recovery is impossible (no session ID exists to look up)

This violates NFR-REL-02 and NFR-REL-03.

### Why not Option C (hybrid)

The hybrid approach requires retry logic, conflict resolution, and handling the case where the timer finishes before the session is confirmed. This is complex and still has failure modes (what if the retry never succeeds?).

### Why Option B is correct

- The server `POST /api/focus-sessions` returns a `sessionId`
- The `sessionId` is stored in the timer store
- On page refresh: `GET /api/focus-sessions/active` recovers the session by ID
- On completion: `PATCH /api/focus-sessions/:id` updates the existing record
- Data is never lost due to a missed creation request

### User experience

The latency between clicking Start and the timer beginning is ~50-200ms (server round-trip). This is imperceptible in practice. The UI shows a brief loading state.

If the POST fails:
- User sees an error toast: "Could not start session. Please try again."
- Timer does not start
- No partial state to clean up

This is a clean failure mode.

## Trade-offs Accepted

- Timer start has a ~50-200ms server round-trip latency
- Poor network conditions (>1s) may make the start feel sluggish
- Requires the client to handle the loading-to-running transition

## Mitigation

- Use a loading spinner / "Starting..." state for the button
- Set a short timeout (3s); if the POST doesn't respond, allow the user to retry
- The loading window is so brief that in practice this is imperceptible on any reasonable connection

## Consequences

- `POST /api/focus-sessions` is called before any timer display starts
- Timer store's RUNNING state is only entered after receiving the session ID
- Session ID is always available for recovery and updates
- Session completion update (`PATCH`) uses the known session ID — no orphan records

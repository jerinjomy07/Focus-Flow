# ADR-012: User-Scoped Active Task State Management

## Status
Approved

## Context
FocusFlow allows users to designate an "Active Task" for focused Pomodoro work. The implementation plan proposed storing `selectedTaskId` in a persisted client Zustand store.
However, persisted browser storage (`localStorage` / `sessionStorage`) survives across user logouts. If User A selects Task A, logs out, and User B logs in on the same browser, User B could erroneously inherit User A's selected task ID, violating tenant isolation and leaking task identifiers.

## Decision
We enforce multi-tenant isolation on client-side active task state:
1. **User Identity Binding in Store**: The Zustand store schema records `userId: string | null` alongside `selectedTaskId` and `selectedProjectId`.
2. **Desynchronization Auto-Reset**: When the application shell or task selector initializes, it verifies `store.userId === session.user.id`. If there is any mismatch (or if session is null), the store immediately clears all active task state.
3. **Logout Sanitization**: The `signOut()` action explicitly triggers `clearActiveTask()`.
4. **Task Existence Validation**: When the task query (`queryKeys.tasks`) resolves, if `selectedTaskId` does not correspond to an active, non-completed task belonging to the current user, the selection is safely cleared.

## Consequences
- Guaranteed zero tenant cross-contamination on shared workstations.
- Stale or deleted active tasks are gracefully cleared without UI crashes or ghost timer labels.

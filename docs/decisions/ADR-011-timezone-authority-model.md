# ADR-011: Timezone Authority Model

## Status
Approved

## Context
FocusFlow relies on the user's timezone to compute streaks, daily midnight boundaries, and due date categories. The user's timezone is present in both:
1. The authenticated JWT session (`session.user.timezone`).
2. The persistent database record (`User.timezone`).

In NextAuth v5 JWT sessions, relying solely on `session.user.timezone` risks stale reads if the user updates their timezone on another device or tab, because JWT cookies only refresh on explicit session triggers or token expiry.

## Decision
We establish a two-tier hierarchy for timezone authority:
1. **Server Authority (Single Source of Truth)**: The database record `User.timezone` is the authoritative source for all backend calculations, streak updates, midnight bounds, and server-side due date filters.
2. **Session Identification**: The session (`auth()`) establishes the user's *identity* (`session.user.id`).
3. **Client-Side Cache**: In frontend components, TanStack Query caches the user profile via `queryKeys.user` (`GET /api/users/me`), ensuring that timezone updates invalidate the cache immediately. `session.user.timezone` is used purely as an initial hydration fallback.

## Consequences
- Prevents desynchronization bugs between profile updates and midnight streak boundaries.
- Session updates (`updateSession({ user: { timezone } })`) are still triggered on profile edits to keep the client cookie warm.

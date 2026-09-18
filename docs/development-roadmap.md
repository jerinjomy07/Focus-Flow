# FocusFlow — Development Roadmap

**Version:** 0.1.0 (Phase 0 — Discovery)
**Date:** 2026-09-17
**Status:** Active

---

## Overview

This roadmap defines the phased delivery of FocusFlow from discovery through production deployment. Each phase has explicit entry criteria, deliverables, and exit criteria. A phase must meet its exit criteria before the next phase begins.

**Principle:** Deliver a complete, correct slice of functionality at each phase. Avoid "skeleton" implementations that require revisiting later.

---

## Phase 0 — Discovery & Specification ✅ (Current)

**Objective:** Establish a coherent technical foundation before any implementation.

### Deliverables

- [x] `docs/product-spec.md` — Requirements, personas, journeys, MVP definition
- [x] `docs/architecture.md` — Technology decisions, folder structure, data flows
- [x] `docs/database.md` — Schema design, indexes, cascade rules, timezone strategy
- [x] `docs/testing.md` — Test strategy, test cases, CI pipeline
- [x] `docs/security.md` — Auth, authorization, input validation, secrets
- [x] `docs/development-roadmap.md` — This document
- [ ] `docs/api.md` — API contract, endpoint definitions, response schemas
- [ ] `docs/decisions/ADR-001` through `ADR-007` — Key technical decisions

### Exit Criteria

- All documentation reviewed and internally consistent
- No unresolved blocking decisions
- Technology stack confirmed
- Data model verified to support all MVP features

---

## Phase 1 — Project Scaffold & Architecture ✅

**Objective:** Create the project structure, configure all tooling, and validate that the scaffold works end-to-end.

### Deliverables

- [x] Next.js project initialized with App Router
- [x] TypeScript strict mode configured
- [x] Tailwind CSS configured
- [x] shadcn/ui initialized
- [x] ESLint + Prettier configured
- [x] Prisma initialized with PostgreSQL
- [x] Auth.js v5 + Prisma adapter configured
- [x] Vitest configured
- [x] Playwright configured
- [x] Environment variable setup documented
- [x] Folder structure established per architecture doc
- [x] `tsconfig.json` with path aliases (`@/components`, `@/domain`, `@/lib`, etc.)
- [x] Health check route (`/api/health`)
- [x] CI pipeline skeleton (GitHub Actions)
- [x] `README.md` with setup instructions

### Exit Criteria

- `npm run dev` starts without errors
- `npm run build` succeeds
- `npm run type-check` passes
- `npm run lint` passes
- `npm run test` passes
- Database connection verified

---

## Phase 2 — Database & Domain Layer ✅

**Objective:** Implement the complete Prisma schema, migrations, and all pure domain logic.

### Deliverables

- [x] Full Prisma schema matching `docs/database.md`
- [x] Initial migration (`0001_initial`)
- [x] All enums defined
- [x] All indexes applied
- [x] Seed script (`prisma/seed.ts`)
- [x] Domain types (`types/domain.ts`)
- [x] Timer state machine (`domain/timer/state-machine.ts`)
- [x] Timer calculation functions (`domain/timer/calculations.ts`)
- [x] Streak calculation (`domain/streaks/streak.ts`)
- [x] Analytics aggregation (`domain/analytics/aggregate.ts`)
- [x] Goal progress calculation (`domain/goals/progress.ts`)
- [x] Zod validation schemas (`lib/validations/`)
- [x] Unit tests for all domain logic (≥90% for timer + streaks)

### Exit Criteria

- `prisma migrate dev` succeeds
- `prisma db seed` populates test data
- All unit tests pass
- Timer state machine handles all valid transitions
- Timer state machine rejects all invalid transitions
- Streak calculation handles edge cases (timezone, midnight crossing)

---

## Phase 3 — Design System & Application Shell ✅

**Objective:** Build the visual language and application structure before feature implementation.

### Deliverables

- [x] Global CSS variables (colors, spacing, radius, shadows)
- [x] Typography scale applied
- [x] Light and dark theme implemented
- [x] Theme toggle with system preference detection
- [x] Landing page (`/`) — marketing page with CTA
- [x] Application shell (authenticated layout with nav)
- [x] Responsive sidebar / mobile bottom nav
- [x] Page header component
- [x] Loading skeleton components
- [x] Empty state components
- [x] Error state components
- [x] Toast notification system
- [x] Modal / dialog system
- [x] shadcn/ui components installed and themed:
  - Button (variants)
  - Input
  - Label
  - Card
  - Badge
  - Progress
  - Dialog
  - Dropdown Menu
  - Tabs
  - Tooltip
  - Avatar
  - Select
  - Textarea
  - Switch
  - Calendar (for due dates)

### Exit Criteria

- Light and dark themes work correctly
- Layout is responsive on 320px, 768px, 1024px, 1440px
- Navigation works (routes resolve)
- All shadcn components render and are keyboard navigable
- No accessibility violations on shell pages (axe)

---

## Phase 4 — Authentication & Onboarding ✅

**Objective:** Complete user registration, login, session management, and onboarding flow.

### Deliverables

- [x] Registration page (`/register`) with email/password form
- [x] Login page (`/login`) with email/password form
- [x] Auth.js credentials provider configured
- [x] Password hashing (bcrypt, cost 12)
- [x] Session middleware (route protection & onboarding redirection)
- [x] Logout action (`signOut`) in user menu
- [x] Onboarding wizard (`/onboarding`):
  - Step 1: Timezone confirmation (auto-detected from browser via Intl)
  - Step 2: Timer preferences (focus, short break, long break)
  - Step 3: Daily goal target
  - Step 4: First project & task creation
  - Atomic completion transaction (`POST /api/onboarding/complete`)
  - Completion redirects to `/dashboard`
- [x] UserSettings auto-created on registration
- [x] Current user & settings management API endpoints (`/api/users/me`, `/api/settings`)
- [x] Auth & onboarding unit tests (`src/lib/auth/__tests__/auth.test.ts`)
- [x] Documentation (`docs/authentication.md`, `docs/onboarding.md`)

### Exit Criteria

- User can register with email/password
- User can log in and see protected pages
- User is redirected to login if unauthenticated
- Password is stored as bcrypt hash (salt cost 12)
- Session persists correctly (30-day sliding JWT)
- Logout clears session and redirects to `/login`
- Onboarding completes and redirects correctly
- UserSettings created on registration and updated on onboarding
- All 80 test suite tests pass
- TypeScript compilation and ESLint pass with 0 errors/warnings

---

## Phase 5 — Tasks & Projects ✅

**Objective:** Complete task and project management with full CRUD.

### Deliverables

**Projects:**
- [x] Projects list page (`/projects`) with active and archived tabs
- [x] Create project form (name, color, description)
- [x] Edit project modal with live invalidation
- [x] Archive / restore project endpoints and UI toggles
- [x] Project detail page (`/projects/[id]`) with completion metrics and task backlog
- [x] API: GET/POST/PATCH/DELETE `/api/projects`, `/api/projects/[id]/archive`, `/api/projects/[id]/restore`
- [x] Server-side ownership validation and ADR-013 hard deletion guard (409 Conflict when sessions exist)

**Tasks:**
- [x] Tasks list page (`/tasks`) with TanStack Query v5
- [x] Inline Quick-Add bar (Enter key instant creation) + rich Add Task dialog
- [x] Edit task modal (status, project, priority, estimate, timezone due date)
- [x] Complete task / reopen task (canonical matrix & `getReopenedStatus`)
- [x] Delete task with confirmation dialog
- [x] Rich multi-criteria filter toolbar (status tabs, search, project, priority, due date, sorting)
- [x] Pomodoro estimate and completion counter display (`🍅 completed / estimated`)
- [x] Active Focus Task state integration (ADR-012 user-scoped Zustand store)
- [x] API: GET/POST/PATCH/DELETE `/api/tasks`, `/api/tasks/[id]/complete`, `/api/tasks/[id]/reopen`
- [x] Server-side ownership validation and anti-enumeration 404 policy on all endpoints
- [x] Cross-tenant project assignment prevention
- [x] Timezone-aware due date semantics (ADR-010, ADR-011, `toUtcEndOfDay`)
- [x] Comprehensive unit and security integration tests (112 test suite tests passing)

### Exit Criteria

- [x] All CRUD operations work and persist correctly in PostgreSQL
- [x] Unauthorized access returns 404 (not 403) — prevents enumeration
- [x] Task filter by project, status, priority, due date, and search keyword works
- [x] Pomodoro estimate shows correctly
- [x] Mobile layout works for task list, project cards, and modals
- [x] Full quality gates passed: TypeScript, ESLint, Vitest, and Turbopack build


---

### Phase 6 — Focus Timer Engine ✅

**Objective:** Implement the complete timer as a production-grade domain subsystem.

### Deliverables

- [x] Timer page (`/focus`)
- [x] Task selector on timer page with modal & completed task guard
- [x] Timer display (SVG circular progress, time remaining, session type indicator)
- [x] Start / Pause / Resume / Reset / Skip controls
- [x] Timer state machine integrated with React (`domain/timer/` + `stores/timer-store.ts`)
- [x] Timestamp-based time calculation (no interval accumulation, zero drift)
- [x] requestAnimationFrame display loop (60fps)
- [x] Page Visibility API handling (background tab)
- [x] Session state persisted to PostgreSQL & client store (for reload recovery)
- [x] Refresh recovery: `GET /api/focus-sessions/active` on page load
- [x] Session type sequencing (FOCUS → SHORT_BREAK → FOCUS → ... → LONG_BREAK)
- [x] Settings-driven durations (reads from UserSettings)
- [x] Auto-start break / auto-start focus if configured
- [x] Keyboard shortcuts (Space = start/pause, R = reset, S = skip)
- [x] Browser notification on session complete (if permission granted)
- [x] Zero-asset Web Audio API chime synthesis (ADR-015)
- [x] Timer works correctly on mobile

### Exit Criteria

- [x] Timer state machine tests all pass
- [x] Timer survives page refresh and continues from correct time
- [x] Timer correctly handles laptop sleep/wake
- [x] Timer correctly handles tab backgrounding
- [x] All three session types work and sequence correctly
- [x] Auto-start settings respected
- [x] Keyboard shortcuts work
- [x] Timer is accessible (ARIA live region for time updates)
- [x] No timer behavior depends on `setInterval` accumulation

---

## Phase 7 — Session Tracking

**Objective:** Ensure every focus session is correctly persisted with full data integrity.

### Deliverables

- [ ] Session created in DB at session start
- [ ] Session updated at completion (COMPLETED status, actualDuration, endedAt)
- [ ] Session updated at abandonment (ABANDONED status, actualDuration)
- [ ] `Task.completedPomodoros` incremented on FOCUS session completion
- [ ] `GET /api/focus-sessions/active` returns in-progress session for refresh recovery
- [ ] `GET /api/focus-sessions` returns session history (paginated)
- [ ] Pause duration tracked and stored accurately
- [ ] API integration tests for all session lifecycle events
- [ ] Session history viewable (basic) in dashboard

### Exit Criteria

- Sessions recorded correctly for all completion scenarios
- Sessions recorded correctly for abandonment
- Pomodoro count incremented on task correctly
- No session data lost on page refresh
- No session data lost on temporary network failure (retry logic)
- Pause duration accurately reflected in actualDuration

---

## Phase 8 — Dashboard

**Objective:** Build the dashboard with real data from the session records.

### Deliverables

- [ ] Dashboard page (`/dashboard`)
- [ ] Today's focus time (derived from sessions)
- [ ] Today's Pomodoro count (derived from sessions)
- [ ] Current streak (derived from sessions)
- [ ] Daily goal progress (derived from sessions + goals)
- [ ] Recent sessions list (last 5)
- [ ] Active/recent tasks list
- [ ] Quick "Start Focus" action → navigates to /focus with task
- [ ] Empty states for each section
- [ ] Responsive dashboard layout (card grid)
- [ ] Data refresh after session completion (TanStack Query invalidation)

### Exit Criteria

- All dashboard numbers are derived from real session records
- No hardcoded or estimated statistics
- Dashboard updates correctly after a session completes
- Empty states render correctly for new users
- Dashboard is readable and actionable on mobile

---

## Phase 9 — Analytics

**Objective:** Build the analytics page with accurate historical session data.

### Deliverables

- [ ] Analytics page (`/analytics`)
- [ ] Period toggle (Today / This Week / This Month)
- [ ] Focus time summary card
- [ ] Session count card (completed vs. abandoned)
- [ ] Daily trend chart (Recharts LineChart)
- [ ] Focus by project chart (Recharts BarChart or PieChart)
- [ ] Streak display (current + longest)
- [ ] Goal completion history
- [ ] Analytics API: `GET /api/analytics?period=week`
- [ ] Analytics derived from real session records only
- [ ] Analytics queries indexed and performant

### Exit Criteria

- All analytics numbers traceable to real session records
- Charts render correctly with real data
- Charts render gracefully with empty data
- Period toggle correctly changes date range
- Analytics queries complete within 500ms for typical user history
- Charts are accessible (not color-only; labeled)

---

## Phase 10 — Settings & Notifications

**Objective:** Complete user settings with persistence and notification system.

### Deliverables

- [ ] Settings page (`/settings`) with tabs:
  - Timer (durations, session count, auto-start)
  - Notifications (browser, sound)
  - Appearance (theme)
  - Account (profile, timezone)
- [ ] Settings form with save confirmation
- [ ] Settings persisted via `PATCH /api/settings`
- [ ] Timer reads settings at session start
- [ ] Notification permission request flow
- [ ] Sound files bundled for notification sounds
- [ ] Profile page (`/profile`) with name/avatar update

### Exit Criteria

- All settings persist correctly across page loads
- Timer duration changes take effect on next session start
- Notification permission is requested only when enabled
- Sound plays on session completion (if enabled)
- Theme persists across sessions
- Account timezone change affects streak and analytics display

---

## Phase 11 — Quality & Hardening

**Objective:** Systematic quality review across all dimensions before deployment.

### Deliverables

- [ ] Security audit (ownership checks, rate limiting, headers)
- [ ] Accessibility audit (axe on all major pages; manual keyboard test)
- [ ] Performance audit (Lighthouse on landing, dashboard, focus, analytics)
- [ ] Responsive design review (320px, 768px, 1024px, 1440px)
- [ ] Database query review (EXPLAIN ANALYZE on analytics queries)
- [ ] Error state review (all loading/empty/error states exist)
- [ ] Test coverage review (timer 90%+, streaks 90%+)
- [ ] TypeScript errors: zero
- [ ] ESLint: zero warnings or justified suppressions
- [ ] Dependency audit: npm audit clean
- [ ] UX consistency pass (spacing, typography, color usage)
- [ ] Documentation updated to reflect implementation

### Exit Criteria

- Zero TypeScript errors
- Zero ESLint warnings (or all suppressed with justification)
- All critical paths have tests
- Lighthouse performance ≥ 80 on all major pages
- No axe accessibility violations on any page
- npm audit: zero high/critical vulnerabilities
- All error states rendered correctly

---

## Phase 12 — Deployment

**Objective:** Production deployment with monitoring and observability.

### Deliverables

- [ ] Production environment variables configured (Vercel)
- [ ] Production PostgreSQL provisioned (Neon)
- [ ] `prisma migrate deploy` in production
- [ ] Sentry configured (DSN in env vars, error boundaries connected)
- [ ] Vercel Speed Insights enabled
- [ ] Health check endpoint (`/api/health`) monitored
- [ ] Production `NEXTAUTH_SECRET` generated securely
- [ ] Custom domain configured (if applicable)
- [ ] `README.md` updated with production setup instructions
- [ ] `docs/deployment.md` written

### Exit Criteria

- Production build deploys successfully
- Database migrations applied
- Landing page loads correctly
- Registration and login work
- Full Pomodoro cycle works in production
- Sentry captures errors correctly
- Health check returns 200

---

## Risk Register

| Risk | Phase | Mitigation |
|---|---|---|
| Timer drift on background | 6 | Timestamp-based; Page Visibility API |
| Session data loss on refresh | 7 | Server-created session; sessionStorage backup |
| Auth.js v5 breaking changes | 4 | Pin version; read migration guide before starting |
| Prisma + Edge Runtime conflict | 2 | Use Node.js runtime for all DB routes |
| shadcn/ui theming complexity | 3 | Set up theme early; test in dark mode from the start |
| Analytics performance | 9 | Add indexes before analytics; test with seeded data |
| Scope creep | All | Phase gate enforced; defer to post-MVP list |

---

## Velocity Estimates

These are rough estimates for a single developer working focused sessions. Adjust based on actual velocity.

| Phase | Estimated Effort |
|---|---|
| 0 — Discovery | 1 day ✅ |
| 1 — Scaffold | 1 day |
| 2 — Database & Domain | 2 days |
| 3 — Design System | 2–3 days |
| 4 — Auth & Onboarding | 2 days |
| 5 — Tasks & Projects | 2–3 days |
| 6 — Timer Engine | 3–4 days |
| 7 — Session Tracking | 1–2 days |
| 8 — Dashboard | 2 days |
| 9 — Analytics | 2 days |
| 10 — Settings | 1–2 days |
| 11 — Hardening | 2–3 days |
| 12 — Deployment | 1 day |
| **Total** | **~25–30 days** |

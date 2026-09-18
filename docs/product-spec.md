# FocusFlow — Product Specification

**Version:** 0.1.0 (Phase 0 — Discovery)
**Date:** 2026-09-17
**Status:** Draft — Pending Review

---

## 1. Product Vision

FocusFlow is a modern, professional productivity platform centered on deep-focus work sessions using the Pomodoro technique. It is designed to help knowledge workers, students, developers, and creators build sustainable focus habits, manage their work, and track meaningful productivity over time.

FocusFlow is not a simple countdown timer. It is a productivity platform that treats the Pomodoro session as the atomic unit of productive work, connecting each session to tasks, projects, analytics, and personal goals.

### 1.1 Mission Statement

> Help people do their most important work through structured focus, clarity, and honest progress tracking.

### 1.2 Core Differentiators

| Feature | Generic Timer Apps | FocusFlow |
|---|---|---|
| Timer engine | Simple setInterval | Timestamp-based state machine |
| Session tracking | None / local only | Persistent, authenticated records |
| Task integration | None | Native task and project management |
| Analytics | None / fake | Derived from real session data |
| Architecture | Demo-grade | Production-grade SaaS foundation |
| Data model | Flat | Relational, multi-user isolated |

---

## 2. User Personas

### Persona 1 — The Developer ("Alex")

- **Age:** 28, software engineer
- **Work pattern:** Long deep-work blocks, multiple projects
- **Pain points:** Context switching, losing track of where time went, task sprawl
- **Goals:** Protect focus time, measure productivity by project
- **Key features:** Project-based focus tracking, analytics by project, keyboard shortcuts

### Persona 2 — The Student ("Priya")

- **Age:** 21, university student
- **Work pattern:** Subject-based study sessions, deadline-driven
- **Pain points:** Procrastination, difficulty sustaining 2–3 hour study blocks
- **Goals:** Study consistently, build a daily streak habit, track subjects
- **Key features:** Streak tracking, daily goals, simple task list per subject

### Persona 3 — The Freelancer ("Jordan")

- **Age:** 34, designer/consultant
- **Work pattern:** Multiple clients, billable-hour awareness
- **Pain points:** Estimating task scope, client billing tracking
- **Goals:** Know how long things actually take, manage multiple client projects
- **Key features:** Project tracking, Pomodoro estimates vs. actuals, session history

### Persona 4 — The Knowledge Worker ("Sam")

- **Age:** 42, product manager at a tech company
- **Work pattern:** Fragmented days, meeting-heavy schedule
- **Pain points:** Finding focus blocks, not knowing if they were productive
- **Goals:** Make daily focus time visible and consistent, build weekly routines
- **Key features:** Dashboard, weekly analytics, goal setting

---

## 3. Core User Journeys

### Journey 1 — First-Time User

```
1. Lands on marketing page (/)
2. Reads value proposition
3. Clicks "Get Started"
4. Registers account (/register)
5. Receives verification / auto-onboards
6. Completes onboarding wizard (/onboarding)
   - Sets focus duration preference
   - Sets break preferences
   - Creates first project (optional)
   - Creates first task (optional)
7. Lands on dashboard (/dashboard)
8. Sees empty state with CTA to start first session
```

### Journey 2 — Daily Returning User

```
1. Opens FocusFlow (auto-logged in)
2. Lands on dashboard
3. Reviews today's focus summary
4. Selects or creates a task
5. Navigates to /focus
6. Selects task, confirms session settings
7. Starts focus session
8. Works for configured duration
9. Session completes — break screen shown
10. Takes break
11. Resumes cycle
12. End of day — reviews analytics
```

### Journey 3 — Project-Focused Work

```
1. User navigates to /projects
2. Creates new project (name, color, description)
3. Adds tasks to project
4. Sets Pomodoro estimates on tasks
5. Selects task before starting timer
6. All sessions recorded against task + project
7. /analytics shows focus time by project
```

### Journey 4 — Analytics Review

```
1. User navigates to /analytics
2. Sees today / this week / this month toggle
3. Reviews total focus time (derived from sessions)
4. Reviews sessions by project (bar/pie chart)
5. Reviews daily trend (line chart)
6. Reviews goal completion
7. Reviews streak record
```

---

## 4. Functional Requirements

### 4.1 Authentication

- FR-AUTH-01: Users can register with email + password
- FR-AUTH-02: Users can log in with email + password
- FR-AUTH-03: Sessions are managed securely (httpOnly cookies or equivalent)
- FR-AUTH-04: Protected routes require authentication
- FR-AUTH-05: Users can log out
- FR-AUTH-06: Passwords are never stored in plaintext
- FR-AUTH-07: Future: OAuth providers (Google, GitHub)

### 4.2 User Profile & Settings

- FR-SET-01: Users can update display name and avatar
- FR-SET-02: Users can set their timezone
- FR-SET-03: Users can configure focus duration (default 25 min)
- FR-SET-04: Users can configure short break duration (default 5 min)
- FR-SET-05: Users can configure long break duration (default 15 min)
- FR-SET-06: Users can configure sessions before long break (default 4)
- FR-SET-07: Users can toggle auto-start breaks
- FR-SET-08: Users can toggle auto-start focus after break
- FR-SET-09: Users can toggle sound notifications
- FR-SET-10: Users can toggle browser notifications
- FR-SET-11: Users can set theme preference (light / dark / system)

### 4.3 Projects

- FR-PROJ-01: Users can create projects (name, description, color)
- FR-PROJ-02: Users can view all their projects
- FR-PROJ-03: Users can edit a project
- FR-PROJ-04: Users can archive/delete a project
- FR-PROJ-05: Projects are private per user (multi-user isolation)
- FR-PROJ-06: Project deletion cascades appropriately

### 4.4 Tasks

- FR-TASK-01: Users can create tasks (title, description, project, priority, due date, Pomodoro estimate)
- FR-TASK-02: Users can view tasks (filterable by project, status, priority)
- FR-TASK-03: Users can edit tasks
- FR-TASK-04: Users can mark tasks complete
- FR-TASK-05: Users can reopen completed tasks
- FR-TASK-06: Users can delete tasks
- FR-TASK-07: Tasks track completed Pomodoro count
- FR-TASK-08: Tasks can exist without a project (inbox)
- FR-TASK-09: Task ownership is validated server-side

### 4.5 Focus Timer

- FR-TIMER-01: Timer operates in three modes: FOCUS, SHORT_BREAK, LONG_BREAK
- FR-TIMER-02: Timer state machine enforces valid transitions
- FR-TIMER-03: Timer uses timestamp-based calculation (not interval accumulation)
- FR-TIMER-04: Timer survives page refresh
- FR-TIMER-05: Timer correctly handles browser tab backgrounding
- FR-TIMER-06: Timer correctly handles laptop sleep/wake
- FR-TIMER-07: Timer supports pause and resume
- FR-TIMER-08: Timer supports reset (abandon session)
- FR-TIMER-09: Timer supports skip (advance to next phase)
- FR-TIMER-10: Session completion is recorded persistently
- FR-TIMER-11: Session abandonment is recorded persistently
- FR-TIMER-12: Timer can auto-transition after completion (based on settings)
- FR-TIMER-13: Multiple browser tabs receive consistent state

### 4.6 Focus Sessions

- FR-SESSION-01: Each session stores: type, plannedDuration, actualDuration, startedAt, endedAt, completed, taskId, projectId
- FR-SESSION-02: Sessions are created at session start
- FR-SESSION-03: Sessions are updated at completion or abandonment
- FR-SESSION-04: Abandoned sessions record actual time worked
- FR-SESSION-05: Analytics derive from real session records

### 4.7 Goals

- FR-GOAL-01: Users can set a daily Pomodoro count goal
- FR-GOAL-02: Users can set a weekly focus-time goal
- FR-GOAL-03: Goal progress is derived from real session data
- FR-GOAL-04: Goals display on dashboard

### 4.8 Streaks

- FR-STREAK-01: Streak increments when user completes at least one focus session per calendar day in their timezone
- FR-STREAK-02: Streak resets if user misses a day
- FR-STREAK-03: Longest streak is tracked
- FR-STREAK-04: Current streak is displayed on dashboard

### 4.9 Analytics

- FR-ANALYTICS-01: Focus time today, this week, this month
- FR-ANALYTICS-02: Sessions completed vs. abandoned
- FR-ANALYTICS-03: Average session duration
- FR-ANALYTICS-04: Focus time by project
- FR-ANALYTICS-05: Daily trend chart
- FR-ANALYTICS-06: Weekly trend chart
- FR-ANALYTICS-07: Goal completion rate
- FR-ANALYTICS-08: All analytics are derived from real session records

### 4.10 Notifications

- FR-NOTIF-01: Browser notification on focus session completion
- FR-NOTIF-02: Browser notification on break completion
- FR-NOTIF-03: Optional sound notification
- FR-NOTIF-04: Behavior controlled by user settings

### 4.11 Dashboard

- FR-DASH-01: Shows current focus status
- FR-DASH-02: Shows active task
- FR-DASH-03: Shows today's Pomodoro count
- FR-DASH-04: Shows today's focus time
- FR-DASH-05: Shows daily goal progress
- FR-DASH-06: Shows current streak
- FR-DASH-07: Shows recent sessions list
- FR-DASH-08: Prioritizes next-action CTA

---

## 5. Non-Functional Requirements

### 5.1 Performance

- NFR-PERF-01: LCP < 2.5s on average connection
- NFR-PERF-02: Timer tick accuracy within ±100ms
- NFR-PERF-03: Dashboard loads < 1s on subsequent navigation
- NFR-PERF-04: Analytics queries < 500ms for typical user history
- NFR-PERF-05: No aggressive polling

### 5.2 Security

- NFR-SEC-01: All user data is multi-tenant isolated
- NFR-SEC-02: Server-side authorization on every authenticated endpoint
- NFR-SEC-03: No secrets in client-side code
- NFR-SEC-04: Input validation on all server endpoints
- NFR-SEC-05: Rate limiting on sensitive endpoints
- NFR-SEC-06: Passwords hashed with bcrypt/argon2 (min cost factor 10)
- NFR-SEC-07: Sessions use secure, httpOnly cookies
- NFR-SEC-08: No raw stack traces exposed to users

### 5.3 Reliability

- NFR-REL-01: Timer state persists across page refresh
- NFR-REL-02: Session records written at session start to prevent data loss
- NFR-REL-03: No focus session data lost on network interruption

### 5.4 Accessibility

- NFR-A11Y-01: WCAG 2.1 AA target
- NFR-A11Y-02: Full keyboard navigation
- NFR-A11Y-03: ARIA labels on interactive elements
- NFR-A11Y-04: Color is not the sole information carrier
- NFR-A11Y-05: Respects prefers-reduced-motion

### 5.5 Responsive Design

- NFR-RESP-01: Mobile-first layout (320px+)
- NFR-RESP-02: Tablet layout (768px+)
- NFR-RESP-03: Desktop layout (1024px+)
- NFR-RESP-04: Timer usable on all breakpoints

### 5.6 Maintainability

- NFR-MAIN-01: TypeScript strict mode throughout
- NFR-MAIN-02: No `any` without explicit justification
- NFR-MAIN-03: Separation of UI, domain logic, and infrastructure
- NFR-MAIN-04: Test coverage on critical domain logic

---

## 6. MVP Definition

The MVP delivers the complete core loop. It is NOT acceptable to ship:
- A timer with no session persistence
- A dashboard with hardcoded data
- Analytics that do not reflect real usage

### MVP Included

| Module | MVP Scope |
|---|---|
| Authentication | Email/password registration, login, logout |
| Onboarding | Settings configuration, first project/task prompts |
| Projects | Create, read, update, archive |
| Tasks | Full CRUD, priority, due date, Pomodoro estimates |
| Timer | State machine, timestamp-based, pause/resume/reset/skip |
| Sessions | Create on start, update on end/abandon, real persistence |
| Dashboard | Real data: today's count, focus time, streak, recent sessions |
| Analytics | Focus time, session counts, daily trend chart |
| Settings | Timer config, notification config, theme |
| Notifications | Browser notification on completion, optional sound |
| Streaks | Daily streak derived from session records |
| Goals | Daily Pomodoro goal, progress on dashboard |

### MVP Excluded

| Feature | Reason |
|---|---|
| OAuth / social login | Email auth sufficient for MVP |
| Team / workspaces | Significant architectural addition |
| Calendar integration | External dependency |
| Recurring tasks | Complex recurrence logic |
| Subtasks / dependencies | Scope expansion |
| Mobile apps | Separate product |
| PWA offline mode | Service worker complexity |
| Advanced productivity insights | Requires more session history |

---

## 7. Feature Prioritization (MoSCoW)

**Must Have (MVP):** Email auth · Projects and tasks · Timestamp-based timer · Session persistence · Dashboard with real data · Basic analytics

**Should Have (Early Post-MVP):** OAuth login · Recurring goals · Weekly analytics charts · Keyboard shortcuts · Mobile-optimized focus view

**Could Have (Growth):** Team workspaces · Calendar view · Task tags/labels · Third-party integrations

**Won't Have Now:** Native mobile apps · AI scheduling · Billing infrastructure

---

## 8. Risks

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| Timer drift on background tab | High | High | Timestamp-based engine + Page Visibility API |
| Data loss on session abandonment | High | Medium | Write session to DB at start; update on end |
| Analytics performance with large history | Medium | Medium | Indexed queries; aggregate caching |
| Auth security vulnerabilities | High | Low | Use mature auth library (Auth.js v5) |
| Multi-timezone streak bugs | Medium | Medium | Normalize all times to user's stored timezone |
| Scope creep | High | High | Strict phase gating; MVP definition enforced |

---

## 9. Edge Cases

### Timer

- Tab backgrounded mid-session — timer continues from correct timestamp on focus restore
- Laptop sleeps mid-session — resume calculates correct remaining time
- Midnight crosses during a session — streak applies to start day
- User changes timezone mid-session — end time UTC; displayed in new tz
- Multiple browser tabs — consistent timer state required (server is authoritative)
- Network offline during session — session data not lost; sync on reconnect
- Session duration changed in settings during active session — current session uses original duration

### Tasks

- Task deleted while session in progress — session records with taskId, cascade to null on deletion
- Task completed with remaining estimated Pomodoros — UI informs, does not force behavior

### Auth

- Session token expires mid-session — graceful re-auth prompt; session data preserved where possible

### Streaks

- User completes session at 23:59 — counts for that calendar day in their timezone
- Session crosses midnight — attributed to start day
- Extreme timezone offsets (UTC±12/14) — always normalized to user's stored timezone

---

## 10. Unresolved Product Decisions

| ID | Question | Default Resolution |
|---|---|---|
| UPD-01 | Do abandoned sessions count toward streaks? | No — only completed sessions |
| UPD-02 | Minimum session to count toward streak? | One completed FOCUS session |
| UPD-03 | Auto-complete tasks when estimate reached? | No — inform user only |
| UPD-04 | Free vs paid tier boundary? | N/A for MVP |
| UPD-05 | Optimistic vs server-confirmed session creation? | Server-confirmed with optimistic UI feedback |

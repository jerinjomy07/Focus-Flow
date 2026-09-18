# FocusFlow — Master Architecture Specification

**Version:** 1.0.0 (Phase 1 — Technical Foundation)  
**Date:** 2026-09-17  
**Status:** Approved Master Architecture  

---

## 1. System Overview

FocusFlow is a modern, production-grade productivity platform centered on deep-work sessions using the Pomodoro technique. The platform integrates:
- An authoritative timestamp-driven focus timer engine
- Relational task and project management
- Multi-session lifecycle tracking with zero data loss
- Real-time derived analytics and calendar-accurate streaks
- Configurable audio and browser notification pipelines
- Cloud-native authentication and persistent multi-tenant data storage

The system is engineered as a robust Software-as-a-Service (SaaS) foundation designed for long-term maintainability, strict type safety, predictable state transitions, and responsive multi-device experiences.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FOCUSFLOW SYSTEM CONTEXT                        │
└────────────────────────────────────────────────────────────────────────┘

 [Browser Client]
   ├── UI: React 19 + Tailwind CSS + shadcn/ui
   ├── Client State: Zustand Timer Store + TanStack Query v5
   └── Engine: Domain State Machine (RAF Loop + BroadcastChannel)
         │
         ▼ HTTPS (TLS 1.3)
 [Vercel Edge Network]
   ├── Global CDN & Static Assets
   └── Edge Middleware (Route Protection & Rate Limiting)
         │
         ▼
 [Next.js App Server (Node.js Serverless)]
   ├── Presentation: React Server Components (RSC) & Streaming
   ├── API Layer: Route Handlers (/api/*)
   ├── Application Layer: Commands, Queries, Orchestration
   ├── Domain Layer: Pure Business Logic (Timer, Streaks, Analytics)
   └── Infrastructure: Auth.js v5 + Prisma ORM + Pino Logger
         │
         ▼ Connection Pool (PgBouncer)
 [Managed PostgreSQL Database (Neon)]
   ├── Multi-tenant tables with cascade rules
   ├── UTC timestamps with IANA timezone conversion
   └── B-tree performance indexes
```

---

## 2. Technology Stack & Decision Matrix

| Concern | Selected Technology | Version | Architectural Justification | Reference ADR |
|---|---|---|---|---|
| **Framework** | **Next.js (App Router)** | 15.x | Server Components reduce client bundle size; Route Handlers co-locate APIs cleanly. | [ADR-001](file:///c:/Users/jerin/OneDrive/Documents/CHATGPT%20CODEX/Focus%20Flow/docs/decisions/ADR-001-nextjs-app-router.md) |
| **Language** | **TypeScript** | 5.x | Strict mode (`strict: true`), zero untyped `any`, end-to-end type safety. | Requirement |
| **Styling & UI** | **Tailwind CSS + shadcn/ui** | Latest | Utility-first styling with accessible Radix UI primitives. No runtime CSS-in-JS overhead. | Architecture |
| **Database** | **PostgreSQL (Neon)** | 16.x | Relational ACID guarantees, robust timestamping, time-series indexing, connection pooling. | [ADR-008](file:///c:/Users/jerin/OneDrive/Documents/CHATGPT%20CODEX/Focus%20Flow/docs/decisions/ADR-008-postgresql-prisma.md) |
| **ORM** | **Prisma ORM** | 5.x | Declarative schema, type-safe query generation, reliable migrations, official Auth.js adapter. | [ADR-008](file:///c:/Users/jerin/OneDrive/Documents/CHATGPT%20CODEX/Focus%20Flow/docs/decisions/ADR-008-postgresql-prisma.md) |
| **Authentication**| **Auth.js (NextAuth)** | v5 | Secure httpOnly session management, CSRF defense, database-backed sessions. | [ADR-002](file:///c:/Users/jerin/OneDrive/Documents/CHATGPT%20CODEX/Focus%20Flow/docs/decisions/ADR-002-authjs-over-clerk.md) |
| **Timer State** | **Zustand** | 4.x | High-frequency selector subscriptions; decoupling timer ticks from React Context renders. | [ADR-003](file:///c:/Users/jerin/OneDrive/Documents/CHATGPT%20CODEX/Focus%20Flow/docs/decisions/ADR-003-zustand-timer-store.md) |
| **Server State** | **TanStack Query** | v5 | Client-side cache, optimistic updates, automatic invalidation on session completion. | Architecture |
| **Validation** | **Zod** | 3.x | Runtime schema validation across API payloads, forms, query params, and domain models. | Architecture |
| **Forms** | **React Hook Form** | 7.x | Uncontrolled inputs, minimal re-renders, integrated Zod resolvers. | Architecture |
| **Charts** | **Recharts** | 2.x | Accessible SVG rendering, declarative composition, responsive container support. | [ADR-004](file:///c:/Users/jerin/OneDrive/Documents/CHATGPT%20CODEX/Focus%20Flow/docs/decisions/ADR-004-recharts.md) |
| **Testing** | **Vitest + Playwright** | Latest | Sub-second pure unit testing in Vitest; realistic cross-browser user journey E2E in Playwright. | Architecture |
| **Logging** | **Pino** | 9.x | High-throughput structured JSON logging with automatic PII redaction. | Architecture |
| **Monitoring** | **Sentry** | 8.x | Real-time unhandled exception tracking across client and server tiers. | Architecture |
| **Deployment** | **Vercel** | — | Native Next.js App Router hosting, Edge CDN, instant rollback, automated preview URLs. | [ADR-009](file:///c:/Users/jerin/OneDrive/Documents/CHATGPT%20CODEX/Focus%20Flow/docs/decisions/ADR-009-deployment-vercel-neon.md) |

---

## 3. Architectural Style: Modular Monolith

FocusFlow is structured as a **modular monolith** ([ADR-005](file:///c:/Users/jerin/OneDrive/Documents/CHATGPT%20CODEX/Focus%20Flow/docs/decisions/ADR-005-modular-monolith.md)). Microservices were explicitly evaluated and rejected due to unnecessary operational complexity, distributed transaction overhead, network latency, and premature optimization.

### Monolith Invariants
1. **Single Deployable Unit:** One codebase, one repository, one unified continuous delivery pipeline.
2. **Explicit Internal Boundaries:** Code is strictly segregated by functional domain (`AUTH`, `USER`, `PROJECT`, `TASK`, `TIMER`, `FOCUS_SESSION`, `GOAL`, `ANALYTICS`, `SETTINGS`, `NOTIFICATION`).
3. **Circular Dependency Prohibition:** Dependencies flow in a strict hierarchy. Domains never import directly from peer domains unless mediated through shared contracts or application services.

---

## 4. Layer Architecture & Separation of Concerns

FocusFlow strictly enforces a four-tier onion architecture:

```
┌────────────────────────────────────────────────────────┐
│ 1. PRESENTATION LAYER                                  │
│    App Router (RSC & Client Components), Layouts,      │
│    shadcn/ui, React Hook Form, Local UI State          │
└──────────────────────────┬─────────────────────────────┘
                           │ Dispatches DTOs / Mutations
┌──────────────────────────▼─────────────────────────────┐
│ 2. APPLICATION LAYER                                   │
│    Route Handlers, Orchestration Services, Auth Guards,│
│    Zod Request/Response Mappers, Cache Invalidation    │
└──────────────────────────┬─────────────────────────────┘
                           │ Calls Business Rules
┌──────────────────────────▼─────────────────────────────┐
│ 3. DOMAIN LAYER (PURE BUSINESS LOGIC)                  │
│    Timer State Machine, Mathematical Calculations,     │
│    Streak Algorithms, Analytics Rollups, Invariants    │
│    * ZERO I/O, ZERO React, ZERO Prisma dependencies    │
└──────────────────────────▲─────────────────────────────┘
                           │ Injected Into
┌──────────────────────────┴─────────────────────────────┐
│ 4. INFRASTRUCTURE LAYER                                │
│    Prisma Client, PostgreSQL Database, Auth.js v5,     │
│    Web Audio API, Pino Logger, Sentry Telemetry        │
└────────────────────────────────────────────────────────┘
```

### Dependency Inversion Rule
- The **Domain Layer** is the innermost layer. It has no imports from Prisma, Next.js, or React. It consists entirely of pure TypeScript functions, value objects, and deterministic state transitions.
- The **Presentation Layer** never issues direct database queries; it talks either to Server Components or Application API Route Handlers.

---

## 5. Domain Architecture & Boundary Definitions

FocusFlow is organized into ten discrete domains:

```
                  ┌────────────────────────┐
                  │      AUTH & USER       │
                  └───────────┬────────────┘
                              │ owns
          ┌───────────────────┼───────────────────┐
          │                   │                   │
┌─────────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐
│     PROJECT      │  │      TASK      │  │    SETTINGS    │
└─────────┬────────┘  └───────┬────────┘  └────────────────┘
          │ groups            │ assigned to
          └───────────┬───────┘
                      │
              ┌───────▼────────┐
              │ FOCUS SESSION  │◀─── controlled by ─── [ TIMER DOMAIN ]
              └───────┬────────┘
                      │ powers
          ┌───────────┴───────────┐
          │                       │
┌─────────▼────────┐      ┌───────▼────────┐
│    ANALYTICS     │      │     GOALS      │
└──────────────────┘      └────────────────┘
```

### 5.1 Domain Boundaries Matrix

| Domain | Core Responsibility | Primary Entities | Key Invariants & Business Rules | Prohibited Knowledge |
|---|---|---|---|---|
| **AUTH** | Authentication, password security, session validation | `User`, `Account`, `Session` | Bcrypt $2b$12$; secure httpOnly cookies; rate-limited registration. | Must NOT know about tasks, projects, or timer mechanics. |
| **USER** | Identity profile, avatar, timezone preferences | `User` | Valid IANA timezone required; unique email enforced. | Must NOT know about specific session calculations. |
| **PROJECT** | Organizational grouping for tasks and time investments | `Project` | User-isolated; soft archive or hard delete sets task FK to null. | Must NOT depend on timer state machine or UI components. |
| **TASK** | Actionable units of work, priority, estimates | `Task` | Priority enum; positive estimated Pomodoros; completed counter incremented. | Must NOT manage session start/pause/end lifecycle. |
| **TIMER** | Real-time countdown engine & state machine | `TimerSessionSnapshot` | Pure domain; timestamp calculations; legal transition enforcement; zero I/O. | Must NOT directly call database or execute network I/O. |
| **FOCUS_SESSION** | Persistent ledger of all work sessions | `FocusSession` | Created at start (`IN_PROGRESS`); ended with actual duration; task pomodoro counter incremented. | Must NOT know about chart rendering or presentation formats. |
| **GOAL** | Daily and weekly productivity targets | `Goal` | Target counts/durations; progress derived from sessions. | Must NOT mutate session records. |
| **ANALYTICS** | Historical productivity aggregation | Analytical DTOs | Real session derivation only; timezone-aware calendar grouping. | Must NOT store redundant or fabricated summary counters. |
| **SETTINGS** | User configuration for timer, audio, appearance | `UserSettings` | Bound to single user; valid duration ranges (1–120m). | Must NOT execute timer transitions. |
| **NOTIFICATION** | Dispatches audio chimes and web push alerts | Event Listeners | Explicit user permission required; non-blocking; decoupled from timer engine. | Must NOT mutate database or block countdown progression. |

---

## 6. End-to-End Data Flow

FocusFlow enforces a unidirectional, predictable data flow across all user interactions:

```
[User Action: e.g. Start Timer]
       │
       ▼
[Presentation Component: FocusTimer]
       │ Dispatches action via useTimer hook
       ▼
[Application API: POST /api/focus-sessions]
       │ 1. Verify session token (Auth.js)
       │ 2. Validate payload schema (Zod)
       │ 3. Check ownership invariants
       ▼
[Database Tier: PostgreSQL (Prisma)]
       │ Inserts FocusSession with status = 'IN_PROGRESS'
       │ Returns created record with session ID
       ▼
[Application Response: 201 Created]
       │
       ▼
[Zustand Timer Store: START]
       │ Initializes session snapshot with authoritative timestamps
       │ Caches snapshot in sessionStorage
       │ Broadcasts event to BroadcastChannel ('focusflow_timer_bus')
       ▼
[RAF Display Loop (~60fps)]
       │ Computes: remainingMs = endTimestamp - Date.now()
       │ Paints: Circular SVG progress ring & timer digits
       ▼ (Timer reaches 0)
[Time Expired Event]
       │ Dispatches PATCH /api/focus-sessions/:id (COMPLETED)
       │ Invalidator invalidates TanStack Query keys: ['tasks'], ['analytics']
       │ Dashboard and Analytics components re-render with verified data
```

---

## 7. Authentication & Authorization Architecture

- Detailed specifications documented in: [`/docs/security-architecture.md`](file:///c:/Users/jerin/OneDrive/Documents/CHATGPT%20CODEX/Focus%20Flow/docs/security-architecture.md)
- **Authentication:** Managed by **Auth.js v5** using credentials (email/password) backed by PostgreSQL database sessions.
- **Authorization:** Scoped at the database layer. Every query includes `WHERE userId = session.user.id`.
- **Anti-Enumeration Invariant:** Accessing an entity belonging to another user returns `404 Not Found` rather than `403 Forbidden`.

---

## 8. API Architecture

- Detailed specifications documented in: [`/docs/api-architecture.md`](file:///c:/Users/jerin/OneDrive/Documents/CHATGPT%20CODEX/Focus%20Flow/docs/api-architecture.md)
- Implemented as Next.js Route Handlers (`app/api/**/route.ts`).
- Standardized response envelopes: `{ data, meta }` on success, `{ error: { code, message, details } }` on failure.
- Every endpoint schema is strictly defined and validated via Zod.

---

## 9. Database Architecture

- Detailed specifications documented in: [`/docs/database-architecture.md`](file:///c:/Users/jerin/OneDrive/Documents/CHATGPT%20CODEX/Focus%20Flow/docs/database-architecture.md)
- **Entities:** `User`, `UserSettings`, `Project`, `Task`, `FocusSession`, `Goal`, `Account`, `Session`, `VerificationToken`.
- **Foreign Key Cascades:** User deletion cascades completely; Project and Task deletion set foreign keys on sessions to `NULL` to preserve historical analytics.
- **Timezone Storage:** UTC storage in PostgreSQL; local grouping via IANA timezone in SQL queries.

---

## 10. Timer Subsystem Architecture

- Detailed specifications documented in: [`/docs/timer-architecture.md`](file:///c:/Users/jerin/OneDrive/Documents/CHATGPT%20CODEX/Focus%20Flow/docs/timer-architecture.md)
- Five discrete states: `IDLE`, `RUNNING`, `PAUSED`, `COMPLETED`, `ABANDONED`.
- Timestamp-based calculation: $\text{remainingMs} = \max(0, \text{endTimestampMs} - \text{Date.now()})$.
- High-frequency display updates driven by `requestAnimationFrame` outside React Context.
- Resilient to background tab throttling, laptop sleep/wake, and page refresh via `sessionStorage` and `GET /api/focus-sessions/active`.

---

## 11. State Management Architecture

- Detailed specifications documented in: [`/docs/state-management.md`](file:///c:/Users/jerin/OneDrive/Documents/CHATGPT%20CODEX/Focus%20Flow/docs/state-management.md)
- Strict segregation across four state categories:
  1. **Local UI State:** React `useState` & React Hook Form
  2. **Server State:** TanStack Query v5 cache
  3. **Persistent Domain State:** PostgreSQL via Prisma
  4. **Timer Engine State:** Zustand store (`stores/timer-store.ts`)

---

## 12. Validation Architecture

Validation operates at the system perimeter before any data reaches business logic or persistence:
1. **Client-Side Form Validation:** React Hook Form bound to Zod resolvers for instant user feedback.
2. **API Boundary Validation:** Route Handlers validate `req.json()` and query parameters via Zod schemas (`lib/validations/*`).
3. **Domain Invariant Validation:** Pure domain functions throw explicit domain exceptions if business rules are violated (e.g. invalid state transition or negative duration).

---

## 13. Error Handling Architecture

A uniform error handling strategy ensures system resilience without exposing internal implementation details:
- **Client Tier:** React Error Boundaries capture rendering crashes; toast notifications alert users to failed API mutations.
- **Server Tier:** Try/catch blocks in Route Handlers map domain exceptions to appropriate HTTP status codes (`400`, `401`, `404`, `409`, `422`).
- **Production Sanitization:** Unhandled exceptions (`500`) are logged to Pino and Sentry with stack traces, while the client receives a safe, sanitized message: `{ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } }`.

---

## 14. Security Architecture

- Detailed specifications documented in: [`/docs/security-architecture.md`](file:///c:/Users/jerin/OneDrive/Documents/CHATGPT%20CODEX/Focus%20Flow/docs/security-architecture.md)
- Zero Trust client philosophy with server-side authorization enforcement.
- Bcrypt work factor 12 password hashing.
- httpOnly, Secure, SameSite=Lax session cookies.
- SQL injection immunity via Prisma parameterized queries.
- XSS prevention via automatic React escaping and strict Content Security Policy (CSP).
- Rate limiting on sensitive authentication and mutation endpoints.

---

## 15. Testing Architecture

- Detailed specifications documented in: [`/docs/testing-architecture.md`](file:///c:/Users/jerin/OneDrive/Documents/CHATGPT%20CODEX/Focus%20Flow/docs/testing-architecture.md)
- Four-tiered testing pyramid:
  - **Unit Tests (Vitest):** Mandatory $\ge 95\%$ coverage on timer calculations, state machine, streak logic, and validations.
  - **Component Tests (Vitest + RTL):** Verifies UI rendering, keyboard navigation, and accessibility.
  - **Integration Tests (Vitest + Test DB):** Validates API Route Handlers, database cascades, and multi-tenant authorization guards.
  - **End-to-End Tests (Playwright):** Exercises complete user journeys with time acceleration (`page.clock`).

---

## 16. Observability Architecture

- Detailed specifications documented in: [`/docs/observability.md`](file:///c:/Users/jerin/OneDrive/Documents/CHATGPT%20CODEX/Focus%20Flow/docs/observability.md)
- High-performance structured JSON logging with **Pino** and automatic PII redaction.
- Crash capture and error alerting via **Sentry**.
- Request correlation using `X-Request-Id` headers.
- System health checks and database latency probes at `/api/health`.
- Database slow-query detection ($\ge 250\text{ms}$) via Prisma event hooks.

---

## 17. Deployment Architecture

- Detailed specifications documented in: [`/docs/deployment-architecture.md`](file:///c:/Users/jerin/OneDrive/Documents/CHATGPT%20CODEX/Focus%20Flow/docs/deployment-architecture.md)
- Application hosted on **Vercel** serverless infrastructure with Edge CDN caching.
- Persistent database hosted on managed **PostgreSQL (Neon)** with connection pooling via PgBouncer.
- Automated CI/CD pipeline enforcing type-checks, linters, unit tests, and pre-deploy database migrations (`prisma migrate deploy`).
- Instant deployment rollbacks (< 5 seconds) without rebuilding.

---

## 18. Scalability & Performance Architecture

The modular monolith is designed to support tens of thousands of active users and millions of focus session records without architectural rewrites:
- **Serverless Scaling:** Route Handlers scale horizontally on demand on Vercel without server management.
- **Connection Pooling:** PgBouncer prevents serverless concurrency spikes from exhausting PostgreSQL connections.
- **Query Optimization:** Heavy analytics queries are indexed on `[userId, startedAt]` and `[userId, type, status]`, executing fast index scans rather than table scans.
- **Frontend Efficiency:** React Server Components (RSC) keep large data-processing dependencies off the browser bundle. Timer display components are isolated leaf nodes preventing parent re-renders.

---

## 19. Major Architectural Tradeoffs

Every architecture requires deliberate engineering tradeoffs:

| Choice | Alternative Considered | Selected Tradeoff & Rationale |
|---|---|---|
| **Modular Monolith** | Microservices | Chosen for lower operational complexity, immediate data integrity, and fast developer velocity. Can be extracted later if specific domain traffic demands it. |
| **Server-Confirmed Sessions** | Optimistic-Only Creation | A 50–150ms network round-trip when clicking "Start" is accepted in exchange for guaranteed session persistence and zero data loss on browser crash. |
| **Zustand for Timer** | React Context | Added a small external dependency (~1.5kB) to eliminate unnecessary context re-renders during high-frequency countdown ticks. |
| **Prisma ORM** | Drizzle ORM / Raw SQL | Accepted slightly higher abstraction overhead for mature Auth.js integration, declarative schema clarity, and reliable automated migrations. |
| **Recharts (SVG)** | Chart.js (Canvas) | Accepted slightly higher DOM node counts for native SVG accessibility (screen-reader compatibility and ARIA compliance). |
| **Node.js Runtime for DB** | Vercel Edge Runtime | Avoided experimental Edge DB proxies by executing Prisma Route Handlers in the standard Node.js serverless runtime with connection pooling. |

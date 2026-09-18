# FocusFlow — Testing Architecture

**Version:** 1.0.0 (Phase 1 — Technical Foundation)  
**Date:** 2026-09-17  
**Status:** Approved Architectural Specification  

---

## 1. Testing Philosophy & Quality Gates

In FocusFlow, automated testing is an integrated engineering discipline, not a deferred milestone. The core domain logic (timer calculations, streak aggregations, tenant authorization, data persistence) requires mathematical certainty and regression protection.

### Guiding Principles
1. **Zero Flakiness Policy:** Tests relying on non-deterministic real timers, unseeded external states, or race conditions are prohibited.
2. **Domain Isolation First:** Pure domain logic has zero external dependencies and must be tested exhaustively with unit tests.
3. **Behavior Over Implementation:** Tests verify input/output contracts, user actions, and state transitions rather than private internal implementation details.
4. **Enforced Gateways in CI:** Code cannot be merged to the mainline repository unless all unit, integration, and type checks pass cleanly.

---

## 2. Testing Pyramid & Tooling Taxonomy

```
                      ▲
                     / \
                    / E2E \          Playwright
                   / Tests \         (Critical user journeys, full stack)
                  /─────────\
                 / Component \       Vitest + React Testing Library
                /    Tests    \      (UI states, accessibility, forms)
               /───────────────\
              /   Integration   \    Vitest + Test PostgreSQL
             /      Tests        \   (API Handlers, Auth, DB cascades)
            /─────────────────────\
           /      Unit Tests       \  Vitest (Pure Domain, Calculations,
          /─────────────────────────\ State Machine, Math, Zod Schemas)
```

| Layer | Primary Framework | Target Scope | Execution Velocity |
|---|---|---|---|
| **Unit** | **Vitest** | `domain/`, `lib/validations/`, pure utilities | Ultra-fast (< 2 seconds for suite) |
| **Integration** | **Vitest** | `app/api/`, Prisma queries, Auth guards | Fast (< 15 seconds against test DB) |
| **Component** | **Vitest + RTL** | `components/timer/`, `components/tasks/` | Fast (< 10 seconds in jsdom) |
| **E2E** | **Playwright** | Complete browser journey (Chrome/Firefox/WebKit) | Comprehensive (< 60 seconds) |

---

## 3. Mandatory Test Matrix (Definition of Done)

Features cannot be marked complete without passing the following mandatory tests:

| Feature / Domain | Test Type | Mandatory Test Cases |
|---|---|---|
| **Timer State Machine** | Unit | - Legal transitions (`IDLE` $\rightarrow$ `RUNNING` $\rightarrow$ `PAUSED` $\rightarrow$ `COMPLETED`)<br>- Rejection of illegal transitions (`IDLE` $\rightarrow$ `PAUSED`, `COMPLETED` $\rightarrow$ `PAUSED`)<br>- Cycle progression (`FOCUS` $\rightarrow$ `SHORT_BREAK` $\rightarrow$ `LONG_BREAK`) |
| **Timer Mathematics** | Unit | - Target end timestamp formula with zero pauses<br>- Remaining time calculation with single and multiple pause intervals<br>- Elapsed active duration calculation on premature abandonment<br>- Clock skew / sleep recovery (negative delta handling) |
| **Streak Engine** | Unit | - Consecutive day accumulation in user timezone<br>- Gap day reset to 0 (or 1 if today completed)<br>- Session crossing midnight attribution to start day<br>- Exclusion of abandoned or break sessions |
| **Analytics Rollups** | Unit | - Correct summation of focus minutes across date ranges<br>- Project distribution percentage calculations<br>- Empty session history graceful default values |
| **Validation Schemas** | Unit | - Rejection of out-of-bound durations (e.g. 0 min focus, negative numbers)<br>- Hex color regex validation<br>- Sanitization of malicious strings |
| **Authorization Guards** | Integration | - Rejection of unauthenticated API requests (`401`)<br>- Rejection of cross-tenant resource reads/mutations (`404`)<br>- Rejection of task assignment to a project owned by another user |
| **Session Lifecycle** | Integration | - `POST /api/focus-sessions` creates `IN_PROGRESS` record<br>- `PATCH /api/focus-sessions/[id]` updates to `COMPLETED`<br>- Automatic increment of `Task.completedPomodoros`<br>- Idempotent session recovery via `GET /api/focus-sessions/active` |
| **Core User Journey** | E2E | - Registration $\rightarrow$ Onboarding $\rightarrow$ Create Project & Task $\rightarrow$ Run Focus Session $\rightarrow$ Complete Session $\rightarrow$ Verify Dashboard & Analytics Updated |

---

## 4. Test Isolation & Mocking Strategy

### 4.1 Time Acceleration in Tests
Because the timer domain uses timestamps (`Date.now()`), unit tests do not sleep or wait for real time to elapse.
- **Vitest Fake Timers:**
  ```typescript
  import { vi, describe, it, expect, beforeEach } from 'vitest';
  import { calculateRemainingMs } from '@/domain/timer/calculations';

  describe('calculateRemainingMs', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-17T12:00:00.000Z'));
    });

    it('derives correct remaining time after 10 simulated minutes', () => {
      const session = {
        startedAtMs: Date.now(),
        plannedDurationSeconds: 1500, // 25 mins
        totalPausedMs: 0,
        pausedAtMs: null
      };

      // Advance clock by 10 minutes without waiting
      vi.advanceTimersByTime(10 * 60 * 1000);

      const remaining = calculateRemainingMs(session, Date.now());
      expect(remaining).toBe(15 * 60 * 1000); // 15 mins remaining
    });
  });
  ```

### 4.2 Playwright Time Acceleration (`page.clock`)
Playwright E2E tests accelerate countdowns to avoid waiting 25 minutes for a Pomodoro to complete:
```typescript
test('complete pomodoro updates task counter', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-17T12:00:00Z') });
  await page.goto('/focus');
  await page.getByRole('button', { name: /start focus/i }).click();

  // Fast-forward 25 minutes instantly
  await page.clock.fastForward('25:01');

  await expect(page.getByText(/session completed/i)).toBeVisible();
});
```

### 4.3 Database Isolation in Integration Tests
- Integration tests execute against a dedicated PostgreSQL test container or isolated schema (`focusflow_test`).
- Before each test suite runs, tables are wiped using a transactional reset or `TRUNCATE ... CASCADE` utility to ensure zero state bleed between tests.

---

## 5. Continuous Integration (CI) Pipeline

Executed on every Pull Request via GitHub Actions:

```yaml
name: CI Pipeline

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: TypeScript Strict Check
        run: npm run type-check

      - name: ESLint Check
        run: npm run lint

      - name: Run Unit & Component Tests
        run: npm run test:unit -- --coverage

      - name: Run Integration Tests
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
        run: npm run test:integration

      - name: Run Playwright E2E Tests
        run: npx playwright test
```

---

## 6. Code Coverage Targets

- **`domain/timer/*`:** Minimum **95%** statement and branch coverage.
- **`domain/streaks/*`:** Minimum **95%** statement and branch coverage.
- **`domain/analytics/*`:** Minimum **90%** statement and branch coverage.
- **`lib/validations/*`:** Minimum **90%** statement and branch coverage.
- **`app/api/*`:** Minimum **85%** coverage across all status code branches.

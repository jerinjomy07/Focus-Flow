# FocusFlow — Testing Strategy

**Version:** 0.1.0 (Phase 0 — Discovery)
**Date:** 2026-09-17
**Status:** Draft

---

## 1. Philosophy

Testing is part of implementation — not an afterthought.

Rules:
- No feature is "done" if critical paths are untested
- Tests for domain logic are written before or alongside implementation (TDD where practical)
- Tests must pass in CI before merge
- No test skipping without a filed issue explaining why

---

## 2. Testing Layers

```
E2E Tests (Playwright)
  ↓ slow, full-stack, user-journey coverage
Integration Tests (Vitest)
  ↓ API routes, database, auth flows
Component Tests (Vitest + Testing Library)
  ↓ React components in isolation
Unit Tests (Vitest)
  ↓ fast, pure functions, domain logic
```

---

## 3. Unit Tests

**Tool:** Vitest  
**Location:** `tests/unit/`  
**Pattern:** Co-locate test files with domain files (e.g., `domain/timer/timer.test.ts`)

### 3.1 Timer Domain

Critical — these tests must exist before the timer is considered complete.

```typescript
// Timer state machine transitions
describe('TimerStateMachine', () => {
  it('transitions IDLE → RUNNING on start')
  it('transitions RUNNING → PAUSED on pause')
  it('transitions PAUSED → RUNNING on resume')
  it('transitions RUNNING → COMPLETED when time expires')
  it('transitions RUNNING → ABANDONED on reset')
  it('transitions PAUSED → ABANDONED on reset')
  it('rejects invalid transition IDLE → PAUSED')
  it('rejects invalid transition COMPLETED → PAUSED')
})

// Time calculations
describe('getRemainingTime', () => {
  it('returns plannedDuration when just started')
  it('decreases correctly as time passes')
  it('returns 0 when past end timestamp')
  it('accounts for total paused duration correctly')
  it('accounts for multiple pause/resume cycles')
  it('handles backgrounding and restoration correctly')
})

// Session type sequencing
describe('getNextSessionType', () => {
  it('returns SHORT_BREAK after FOCUS (sessions 1-3)')
  it('returns LONG_BREAK after FOCUS (session 4)')
  it('returns FOCUS after any break')
  it('resets session counter after long break')
  it('respects sessionsBeforeLongBreak setting')
})
```

### 3.2 Streak Calculation

```typescript
describe('calculateCurrentStreak', () => {
  it('returns 0 when no sessions')
  it('returns 1 when only today has a session')
  it('returns correct count for consecutive days')
  it('breaks streak when a day is missing')
  it('handles timezone boundaries correctly')
  it('attributes midnight-crossing sessions to start day')
  it('does not count break sessions')
  it('does not count abandoned sessions')
})

describe('calculateLongestStreak', () => {
  it('returns 0 when no sessions')
  it('finds the longest consecutive run')
  it('handles gaps between streaks')
})
```

### 3.3 Analytics Calculations

```typescript
describe('calculateFocusTime', () => {
  it('sums actualDuration of completed FOCUS sessions')
  it('excludes abandoned sessions')
  it('excludes break sessions')
  it('filters correctly by date range')
})

describe('groupSessionsByDay', () => {
  it('groups sessions correctly into calendar days')
  it('uses user timezone for day boundary')
})
```

### 3.4 Goal Progress

```typescript
describe('calculateGoalProgress', () => {
  it('calculates Pomodoro count goal correctly')
  it('calculates focus duration goal correctly')
  it('returns 0 progress when no sessions in period')
  it('returns 100% when target exactly met')
  it('caps at 100% when target exceeded')
})
```

### 3.5 Validation Schemas

```typescript
describe('TaskSchema', () => {
  it('rejects empty title')
  it('rejects title over max length')
  it('accepts valid priority values')
  it('rejects invalid priority values')
  it('accepts null projectId')
  it('rejects negative estimatedPomodoros')
})
```

---

## 4. Component Tests

**Tool:** Vitest + React Testing Library  
**Location:** `tests/components/` or co-located with component

Focus on:
- Rendering in various states (loading, empty, error, data)
- User interactions (click, keyboard navigation)
- Accessibility (role, label, ARIA attributes)

```typescript
describe('TimerDisplay', () => {
  it('renders correct time when running')
  it('renders correct time when paused')
  it('shows "00:00" when session completes')
  it('start button has accessible label')
  it('pause button is keyboard focusable')
  it('progress ring updates with time')
})

describe('TaskCard', () => {
  it('renders task title and priority')
  it('shows completed state correctly')
  it('completion checkbox is accessible')
  it('triggers onComplete callback on click')
})
```

---

## 5. Integration Tests

**Tool:** Vitest  
**Location:** `tests/integration/`  
**Database:** Test database (separate from dev/prod); reset per test suite

### 5.1 API Route Tests

Use `@next/test-utils` or direct handler invocation to test Route Handlers.

```typescript
describe('POST /api/focus-sessions', () => {
  it('returns 401 when unauthenticated')
  it('creates session and returns 201 with sessionId')
  it('returns 400 on invalid input')
  it('associates session with task when taskId provided')
  it('validates taskId ownership — rejects other users task')
  it('validates projectId ownership')
})

describe('PATCH /api/focus-sessions/:id', () => {
  it('returns 401 when unauthenticated')
  it('returns 403 when session belongs to another user')
  it('returns 404 when session not found')
  it('updates session to COMPLETED correctly')
  it('updates session to ABANDONED correctly')
  it('increments task.completedPomodoros on FOCUS completion')
})

describe('GET /api/tasks', () => {
  it('returns only tasks belonging to current user')
  it('filters by project correctly')
  it('filters by status correctly')
  it('paginates correctly')
})

describe('POST /api/auth/register', () => {
  it('creates user with hashed password')
  it('creates default UserSettings')
  it('rejects duplicate email')
  it('rejects weak password')
  it('rate limits after N attempts')
})
```

### 5.2 Authorization Tests

Every resource endpoint must have an authorization test:

```typescript
it('cannot access another users task via GET /api/tasks/:id')
it('cannot update another users project via PATCH /api/projects/:id')
it('cannot delete another users focus session')
```

---

## 6. End-to-End Tests

**Tool:** Playwright  
**Location:** `tests/e2e/`  
**Environment:** Staging or local full-stack server with seeded test DB

### Core Flows

```typescript
test('User registration and onboarding', async ({ page }) => {
  await page.goto('/register')
  // Fill registration form
  // Complete onboarding
  // Verify dashboard loads with empty state
})

test('Full Pomodoro session cycle', async ({ page }) => {
  // Login with test user
  // Create a project and task
  // Navigate to /focus
  // Select task
  // Start session (use accelerated timer in test mode)
  // Verify session completes and break screen appears
  // Verify dashboard updates with new session count
  // Verify task.completedPomodoros incremented
})

test('Timer refresh recovery', async ({ page }) => {
  // Start a session
  // Reload the page
  // Verify timer resumes from correct remaining time
})

test('Analytics reflect real session data', async ({ page }) => {
  // Login with user who has known session history
  // Navigate to /analytics
  // Verify focus time matches known total
  // Verify session count is accurate
})

test('Settings persist', async ({ page }) => {
  // Navigate to /settings
  // Change focus duration to 30 min
  // Navigate to /focus
  // Verify timer shows 30:00
})
```

### Accessibility Tests

```typescript
test('Timer page passes axe accessibility scan', async ({ page }) => {
  await page.goto('/focus')
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toHaveLength(0)
})
```

---

## 7. CI Pipeline

```yaml
# On every PR:
steps:
  - Install dependencies
  - Type check (tsc --noEmit)
  - Lint (eslint)
  - Unit tests (vitest run)
  - Component tests (vitest run)
  - Integration tests (vitest run --reporter=verbose)
  - Build (next build)

# On merge to main:
steps:
  - All above
  - E2E tests (playwright)
  - Deploy to staging
```

---

## 8. Test Coverage Goals

| Layer | Target Coverage |
|---|---|
| Timer domain | 90%+ |
| Streak calculation | 90%+ |
| Analytics calculation | 85%+ |
| API route handlers | 80%+ |
| UI components | 60%+ (critical paths) |
| E2E flows | All core user journeys |

Coverage is a guide, not a target. A test that verifies correct behavior is worth more than coverage percentage.

---

## 9. Test Utilities

### Test Database

```typescript
// tests/helpers/db.ts
export async function resetTestDatabase() { ... }
export async function seedTestUser(overrides?: Partial<User>) { ... }
export async function seedTestSession(userId: string, overrides?: Partial<FocusSession>) { ... }
```

### Time Mocking

```typescript
// tests/helpers/time.ts
// Vitest's fake timers for unit tests
// Playwright's clock API for E2E timer acceleration

export function mockCurrentTime(isoString: string) {
  vi.setSystemTime(new Date(isoString))
}
```

### Auth Helpers

```typescript
// tests/helpers/auth.ts
export async function loginAsTestUser(page: Page) { ... }
export async function createAuthenticatedRequest(userId: string) { ... }
```

---

## 10. Known Testing Challenges

| Challenge | Strategy |
|---|---|
| Real-time timer E2E | Use Playwright `page.clock` to accelerate time in tests |
| Browser notification API | Mock in unit/component tests; skip in E2E |
| Timezone-sensitive streak tests | Explicitly set timezone in test environment |
| Database state between integration tests | Transaction rollback per test or dedicated test DB reset |
| Auth.js session in integration tests | Create mock session helper that bypasses real auth |

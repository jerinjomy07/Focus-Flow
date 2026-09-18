# FocusFlow — Database Design

**Version:** 0.1.0 (Phase 0 — Discovery)
**Date:** 2026-09-17
**Status:** Draft — Pending Review

---

## 1. Design Principles

1. **Multi-user isolation** — every table includes `userId`; every query scopes by it
2. **Referential integrity** — foreign keys with explicit cascade behavior
3. **Normalized where appropriate** — avoid redundant data; derive statistics from source records
4. **UTC storage** — all timestamps stored in UTC; timezone handling in application layer
5. **Explicit enums** — no magic strings in the database
6. **Migration-driven** — all schema changes via Prisma Migrate
7. **Indexed for access patterns** — indexes designed from expected queries

---

## 2. Timestamp Strategy

- All `createdAt`, `updatedAt`, `startedAt`, `endedAt` columns store **UTC timestamps**
- `User.timezone` stores IANA timezone string (e.g., `"Asia/Kolkata"`, `"America/New_York"`)
- Streak and goal calculations convert UTC times to user's local timezone **in application logic**
- `updatedAt` is auto-managed by Prisma (`@updatedAt`)
- `createdAt` defaults to `now()`

---

## 3. Deletion Strategy

| Entity | Deletion | Cascade |
|---|---|---|
| User | Hard delete | Cascade delete all owned data |
| Project | Soft delete (status=ARCHIVED) or hard delete | On hard delete: set task.projectId = null |
| Task | Hard delete | Set focusSession.taskId = null (SET NULL) |
| FocusSession | Hard delete | No cascade (leaf entity) |
| Goal | Hard delete | No cascade |
| UserSettings | Hard delete | Cascade from User |

---

## 4. Ownership Rules

- Every resource table has a `userId` column referencing `User.id`
- Every API query includes `WHERE userId = $currentUser`
- No resource is accessible across user accounts (MVP; teams are post-MVP)
- Prisma queries always include `userId` filter — this is enforced by convention and code review

---

## 5. Entity Definitions

### 5.1 User

```prisma
model User {
  id            String   @id @default(cuid())
  name          String?
  email         String   @unique
  emailVerified DateTime?
  image         String?
  timezone      String   @default("UTC")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Auth.js relations
  accounts      Account[]
  sessions      Session[]

  // Application relations
  settings      UserSettings?
  projects      Project[]
  tasks         Task[]
  focusSessions FocusSession[]
  goals         Goal[]

  @@index([email])
}
```

**Notes:**
- `timezone` is an IANA timezone string
- `image` is an avatar URL (null if not set)
- `emailVerified` used by Auth.js credential flow

---

### 5.2 UserSettings

One-to-one with User. Created automatically during onboarding.

```prisma
model UserSettings {
  id                       String   @id @default(cuid())
  userId                   String   @unique
  user                     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Timer
  focusDuration            Int      @default(25)   // minutes
  shortBreakDuration       Int      @default(5)    // minutes
  longBreakDuration        Int      @default(15)   // minutes
  sessionsBeforeLongBreak  Int      @default(4)

  // Automation
  autoStartBreaks          Boolean  @default(false)
  autoStartFocus           Boolean  @default(false)

  // Notifications
  soundEnabled             Boolean  @default(true)
  notificationsEnabled     Boolean  @default(true)

  // Appearance
  theme                    Theme    @default(SYSTEM)

  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt

  @@index([userId])
}

enum Theme {
  LIGHT
  DARK
  SYSTEM
}
```

---

### 5.3 Project

```prisma
model Project {
  id          String        @id @default(cuid())
  userId      String
  user        User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  name        String
  description String?
  color       String        @default("#6366f1")   // hex color
  status      ProjectStatus @default(ACTIVE)

  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  tasks         Task[]
  focusSessions FocusSession[]

  @@index([userId])
  @@index([userId, status])
}

enum ProjectStatus {
  ACTIVE
  ARCHIVED
}
```

**Notes:**
- Color is stored as a hex string; validated in application layer
- Projects are user-scoped; no sharing in MVP

---

### 5.4 Task

```prisma
model Task {
  id                  String       @id @default(cuid())
  userId              String
  user                User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  projectId           String?
  project             Project?     @relation(fields: [projectId], references: [id], onDelete: SetNull)

  title               String
  description         String?
  status              TaskStatus   @default(TODO)
  priority            Priority     @default(MEDIUM)

  estimatedPomodoros  Int?         // null = no estimate
  completedPomodoros  Int          @default(0)

  dueDate             DateTime?

  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt

  focusSessions       FocusSession[]

  @@index([userId])
  @@index([userId, status])
  @@index([userId, projectId])
  @@index([userId, dueDate])
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  COMPLETED
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}
```

**Notes:**
- `projectId` is nullable — tasks without a project belong to "Inbox"
- On project deletion, `projectId` is set to null (SET NULL)
- `completedPomodoros` is incremented when a FOCUS session is completed against this task
- `dueDate` is stored in UTC; displayed in user's timezone

---

### 5.5 FocusSession

```prisma
model FocusSession {
  id              String      @id @default(cuid())
  userId          String
  user            User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  taskId          String?
  task            Task?       @relation(fields: [taskId], references: [id], onDelete: SetNull)

  projectId       String?
  project         Project?    @relation(fields: [projectId], references: [id], onDelete: SetNull)

  type            SessionType
  status          SessionStatus @default(IN_PROGRESS)

  plannedDuration Int         // seconds
  actualDuration  Int?        // seconds; null until session ends

  startedAt       DateTime    // UTC
  endedAt         DateTime?   // UTC; null until session ends

  // Pause tracking
  pausedDuration  Int         @default(0)  // total seconds paused

  createdAt       DateTime    @default(now())

  @@index([userId])
  @@index([userId, startedAt])
  @@index([userId, type, status])
  @@index([userId, projectId])
  @@index([taskId])
}

enum SessionType {
  FOCUS
  SHORT_BREAK
  LONG_BREAK
}

enum SessionStatus {
  IN_PROGRESS
  COMPLETED
  ABANDONED
}
```

**Notes:**
- Session is created at start with `status = IN_PROGRESS`
- Updated to `COMPLETED` or `ABANDONED` when session ends
- `actualDuration` is calculated as `(endedAt - startedAt) - pausedDuration`
- `projectId` is denormalized onto session for efficient analytics without joining through task
- Sessions are the source of truth for all analytics
- `pausedDuration` is accumulated in application layer and written on resume/end

---

### 5.6 Goal

```prisma
model Goal {
  id        String     @id @default(cuid())
  userId    String
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  type      GoalType
  target    Int        // count (Pomodoros) or minutes (focus time)
  period    GoalPeriod

  startDate DateTime
  endDate   DateTime?  // null = recurring/open-ended

  isActive  Boolean    @default(true)

  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  @@index([userId, isActive])
  @@index([userId, period])
}

enum GoalType {
  POMODORO_COUNT    // number of completed focus sessions
  FOCUS_DURATION    // total minutes of focus time
}

enum GoalPeriod {
  DAILY
  WEEKLY
}
```

**Notes:**
- Goal progress is always derived from `FocusSession` records, never stored
- Multiple active goals are allowed (e.g., daily count + weekly time)
- `target` is unitless; interpretation depends on `GoalType` (count vs. minutes)

---

### 5.7 Auth.js Tables (managed by Prisma Adapter)

These are required by Auth.js and managed automatically:

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

---

## 6. Derived vs Persisted Statistics

| Metric | Strategy | Reason |
|---|---|---|
| Today's Pomodoro count | Derived (aggregate query) | Small dataset per day; always accurate |
| Today's focus time | Derived (aggregate query) | Always accurate; no stale risk |
| Current streak | Derived (date-range query) | Small computation; no stale risk |
| Longest streak | Derived (scan) | More expensive; cache at API layer |
| Weekly focus time | Derived (aggregate query) | Indexed on startedAt |
| Monthly focus time | Derived (aggregate query) | Indexed on startedAt |
| Task completedPomodoros | Persisted (incremented at session end) | Needed for task UX without querying sessions |

**Policy:** Statistics are derived wherever the computation is cheap. The only persisted counter is `Task.completedPomodoros` because it is shown inline in the task UI and would require a join per task row if derived.

---

## 7. Index Strategy

Based on expected query patterns:

| Index | Purpose |
|---|---|
| `FocusSession(userId, startedAt)` | Analytics time-range queries |
| `FocusSession(userId, type, status)` | Filter by session type and completion |
| `FocusSession(userId, projectId)` | Project-based analytics |
| `Task(userId, status)` | Active task list |
| `Task(userId, projectId)` | Tasks by project |
| `Task(userId, dueDate)` | Due date filtering |
| `Project(userId, status)` | Active projects |
| `Goal(userId, isActive)` | Active goals lookup |
| `User(email)` | Auth login lookup |

---

## 8. Streak Algorithm

```typescript
// Algorithm: count consecutive calendar days with at least one COMPLETED FOCUS session
// Runs in user's local timezone

async function calculateCurrentStreak(userId: string, timezone: string): Promise<number> {
  // Fetch completed FOCUS session dates (distinct calendar days in user TZ)
  const sessions = await prisma.focusSession.findMany({
    where: {
      userId,
      type: 'FOCUS',
      status: 'COMPLETED',
    },
    select: { startedAt: true },
    orderBy: { startedAt: 'desc' },
  });

  const activeDays = getDistinctCalendarDays(sessions.map(s => s.startedAt), timezone);
  // activeDays: sorted desc array of 'YYYY-MM-DD' strings

  let streak = 0;
  let expectedDay = getTodayInTimezone(timezone); // or yesterday if none today

  for (const day of activeDays) {
    if (day === expectedDay) {
      streak++;
      expectedDay = subtractDay(expectedDay);
    } else {
      break;
    }
  }

  return streak;
}
```

---

## 9. Seed Strategy

The seed file (`prisma/seed.ts`) creates:

1. Two test users (with known credentials) for development
2. Default UserSettings for each user
3. Sample projects and tasks
4. Sample focus sessions across the past 30 days for analytics testing
5. Sample goals

The seed is **never run in production**. Production database starts empty.

---

## 10. Migration Strategy

- All schema changes use `prisma migrate dev` in development
- All production deployments run `prisma migrate deploy` as a pre-deploy step
- Migrations are committed to the repository in `prisma/migrations/`
- Breaking migrations (column drops, renames) require a two-phase deploy:
  1. Deploy code that handles both old and new schema
  2. Deploy schema change
  3. Deploy code cleanup

---

## 11. Future Schema Considerations

The following are NOT implemented in MVP but the schema is designed to accommodate them:

| Future Feature | Schema Impact |
|---|---|
| Teams / Workspaces | Add `Workspace` entity; add `workspaceId` to Project |
| Recurring tasks | Add `RecurrenceRule` entity; add FK from Task |
| Subtasks | Add `parentTaskId` self-reference on Task |
| Task tags | Add `Tag` entity; add TaskTag join table |
| Calendar events | Add `CalendarEvent` entity |
| Integrations | Add `Integration` entity with provider/token |

These additions should not require structural changes to the core tables defined above.

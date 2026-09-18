# FocusFlow — First-Time User Onboarding Architecture

**Version:** 1.0.0 (Phase 4 — Authentication & Onboarding)  
**Date:** 2026-09-17  
**Status:** Implemented & Verified Specification  

---

## 1. Overview & Purpose

The onboarding flow is the critical bridge between user account creation and first value delivery in FocusFlow. Rather than dumping new users into an empty, unconfigured workspace, FocusFlow guides them through an intentional 4-step wizard that:
1. Confirms their local timezone for accurate midnight boundary calculations and streak maintenance.
2. Customizes their focus and break timer intervals according to their work style.
3. Establishes a realistic daily Pomodoro habit goal.
4. Initializes their first project and actionable task so the dashboard immediately contains meaningful state.

Upon completing this wizard, user onboarding state is permanently marked in the database (`User.onboardedAt`), unlocking the core productivity workspace.

---

## 2. The 4-Step Onboarding Wizard

The client-side wizard is hosted at `/onboarding` and structured across four sequential steps:

### Step 1: Timezone Confirmation
- **Why it matters:** FocusFlow relies on timezone-aware midnight boundaries (`00:00:00.000` to `23:59:59.999` in the user's local timezone) to calculate daily streaks, daily focus totals, and goal completion. UTC-only dates cause streaks to break prematurely for users in non-UTC timezones.
- **Detection Mechanism:** The browser's local timezone is automatically extracted using `Intl.DateTimeFormat().resolvedOptions().timeZone` via `React.useSyncExternalStore` (avoiding cascading SSR hydration mismatches).
- **User Override:** Users can select any valid IANA timezone from a curated dropdown list of global regions (e.g. `America/New_York`, `Europe/London`, `Asia/Tokyo`, `Asia/Kolkata`, `Australia/Sydney`, `UTC`).

### Step 2: Timer Duration Preferences
- **Focus Duration:** Range 1..120 minutes (default: 25 minutes).
- **Short Break:** Range 1..60 minutes (default: 5 minutes).
- **Long Break:** Range 1..120 minutes (default: 15 minutes).
- **Quick Presets:** Allows users who prefer 50/10 ("Ultradian rhythm") or 25/5 ("Classic Pomodoro") to quickly dial in their preference.

### Step 3: Daily Productivity Goal
- **Habit Target:** Defines how many completed Pomodoros count toward the user's daily goal.
- **Preset Options:**
  - `2 Pomodoros` (50 min focus) — Light / Beginner habit
  - `4 Pomodoros` (100 min focus) — Balanced / Standard habit (Default)
  - `6 Pomodoros` (150 min focus) — Deep focus / High intensity
- Persisted to the `Goal` table with `type: 'POMODORO_COUNT'`, `target: count`, `period: 'DAILY'`.

### Step 4: Initial Project & Task Provisioning
- **First Project:** User provides a name (default: `"FocusFlow Platform"`).
- **First Task:** User specifies their initial focus task (default: `"Complete my first focus session"`).
- Providing this immediately primes the task list and timer selector so the user is ready to begin a session on their very first dashboard visit.

---

## 3. Atomic Completion API: `POST /api/onboarding/complete`

To guarantee data consistency, onboarding completion executes as an atomic database transaction via `prisma.$transaction`:

```typescript
// ATOMIC ONBOARDING TRANSACTION
await prisma.$transaction(async (tx) => {
  // 1. Persist user timezone and mark onboarding timestamp
  await tx.user.update({
    where: { id: userId },
    data: {
      timezone,
      onboardedAt: new Date(),
    },
  });

  // 2. Persist custom timer settings
  await tx.userSettings.upsert({
    where: { userId },
    update: {
      focusDuration,
      shortBreakDuration,
      longBreakDuration,
    },
    create: {
      userId,
      focusDuration,
      shortBreakDuration,
      longBreakDuration,
      sessionsBeforeLongBreak: 4,
      autoStartBreaks: false,
      autoStartFocus: false,
      soundEnabled: true,
      notificationsEnabled: true,
      theme: 'SYSTEM',
    },
  });

  // 3. Create Daily Pomodoro Goal
  await tx.goal.create({
    data: {
      userId,
      type: 'POMODORO_COUNT',
      target: dailyGoal,
      period: 'DAILY',
      startDate: new Date(),
      isActive: true,
    },
  });

  // 4. Optionally create initial project and task
  let createdProjectId: string | null = null;
  if (firstProjectName?.trim()) {
    const project = await tx.project.create({
      data: {
        userId,
        name: firstProjectName.trim(),
        color: '#6366f1',
        status: 'ACTIVE',
      },
    });
    createdProjectId = project.id;
  }

  if (firstTaskTitle?.trim()) {
    await tx.task.create({
      data: {
        userId,
        projectId: createdProjectId,
        title: firstTaskTitle.trim(),
        priority: 'HIGH',
        status: 'TODO',
        estimatedPomodoros: 2,
        completedPomodoros: 0,
      },
    });
  }
});
```

### Request Payload Validation (`OnboardingCompleteSchema`)
- `timezone`: String validated against `Intl.DateTimeFormat(undefined, { timeZone: tz })`.
- `focusDuration`: Integer between 1 and 120 (defaults to 25).
- `shortBreakDuration`: Integer between 1 and 60 (defaults to 5).
- `longBreakDuration`: Integer between 1 and 120 (defaults to 15).
- `dailyGoal`: Integer between 1 and 50 (defaults to 4).
- `firstProjectName`: Optional string, max 100 characters.
- `firstTaskTitle`: Optional string, max 200 characters.

---

## 4. Session Synchronization & Redirection Rules

### 4.1 Client Session Update
After the API returns `200 OK`, the client invokes NextAuth's `updateSession()`:
```typescript
await updateSession({
  ...session,
  user: {
    ...session?.user,
    timezone,
    onboardedAt: new Date().toISOString(),
  },
});
```
This triggers the Auth.js `jwt` callback (`trigger === 'update'`), synchronizing the server-side JWT cookie without requiring the user to re-authenticate.

### 4.2 Route Redirection Invariants
Enforced inside `src/middleware.ts`:
1. **Uncompleted User accessing Protected App Routes:**  
   If an authenticated user has `user.onboardedAt === null` and attempts to navigate to `/dashboard`, `/focus`, `/tasks`, `/projects`, `/analytics`, or `/settings`, the middleware redirects them to `/onboarding`.
2. **Completed User accessing Onboarding:**  
   If an authenticated user with `user.onboardedAt !== null` attempts to visit `/onboarding`, the middleware redirects them straight to `/dashboard`.
3. **Unauthenticated User accessing Onboarding:**  
   The user is redirected to `/login?callbackUrl=/onboarding`.

---

## 5. Verification & Testing

The onboarding subsystem is verified through unit tests in `src/lib/auth/__tests__/auth.test.ts`:
- **Valid IANA Timezones:** Confirms acceptance of standard international timezones (`America/New_York`, `Europe/London`, `Asia/Tokyo`, `UTC`).
- **Invalid Timezones:** Confirms rejection of fictitious or corrupted timezone identifiers (`Atlantis/NonExistentCity`).
- **Duration Constraints:** Tests lower and upper boundaries for focus, short break, and long break intervals.
- **Daily Goal Constraints:** Validates bounds (1 to 50 Pomodoros).
- **Session State Transitions:** Confirms that `trigger: 'update'` appropriately updates `token.onboardedAt` and `session.user.onboardedAt`.

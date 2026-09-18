// src/domain/streaks/index.ts
// FocusFlow — Streak Domain Logic
//
// Calculates current and longest streaks from FocusSession history.
// All calculations are pure functions — no I/O, no DB access.
// Streak attribution follows the user's local timezone calendar day.

/**
 * Input shape — only what we need to compute streaks.
 * Deliberately minimal to keep this domain decoupled from Prisma.
 */
export interface StreakSessionRecord {
  startedAt: Date; // UTC — will be converted using userTimezone
  type: 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' | 'SKIPPED';
}

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  activeDays: string[]; // ISO date strings in user's timezone, most recent first
}

// ============================================================
// TIMEZONE UTILITIES
// ============================================================

/**
 * Converts a UTC Date to a local date string in the user's timezone.
 * Returns a "YYYY-MM-DD" string representing the calendar day the
 * session started in the user's local timezone.
 *
 * This handles streak attribution correctly across midnight crossings:
 * A session started at 23:58 local time belongs to that calendar day,
 * even if the session ends after midnight.
 *
 * @param utcDate - UTC timestamp
 * @param timezone - IANA timezone string, e.g. "America/New_York"
 */
export function toLocalDateString(utcDate: Date, timezone: string): string {
  return utcDate.toLocaleDateString('en-CA', { timeZone: timezone });
  // en-CA locale produces "YYYY-MM-DD" format (ISO 8601 date format)
}

/**
 * Returns the current date string in the user's timezone.
 * Used to determine whether today has an active streak.
 *
 * @param timezone - IANA timezone string
 * @param now - Optional override for testability (defaults to Date.now())
 */
export function getTodayLocalDateString(timezone: string, now: Date = new Date()): string {
  return toLocalDateString(now, timezone);
}

/**
 * Returns yesterday's date string in the user's timezone.
 * Used to check if the streak extends to yesterday when today has no sessions.
 */
export function getYesterdayLocalDateString(timezone: string, now: Date = new Date()): string {
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return toLocalDateString(yesterday, timezone);
}

// ============================================================
// STREAK CALCULATION (Pure Function)
// ============================================================

/**
 * Calculates current and longest streak from an array of session records.
 *
 * Streak Rules (per UPD-01 and UPD-02 defaults):
 *   1. Only COMPLETED sessions of type FOCUS count toward streaks.
 *   2. Abandoned sessions, break sessions are excluded entirely.
 *   3. A calendar day "has a session" if at least one qualifying session
 *      started within that calendar day (in the user's local timezone).
 *   4. Sessions crossing midnight are attributed to the START day.
 *   5. Multiple sessions on the same day count as ONE day for the streak.
 *   6. A streak breaks if any calendar day (in user's timezone) has no qualifying session.
 *
 * Current streak: consecutive days ending today or yesterday.
 *   - If today has a qualifying session: count includes today.
 *   - If today has no qualifying session but yesterday does: streak carries forward.
 *   - If neither today nor yesterday has a session: current streak = 0.
 *
 * @param sessions - Array of FocusSession records (may be unsorted)
 * @param userTimezone - IANA timezone string for the user
 * @param now - Optional override for deterministic testing
 */
export function calculateStreaks(
  sessions: ReadonlyArray<StreakSessionRecord>,
  userTimezone: string,
  now: Date = new Date()
): StreakResult {
  // Filter: only COMPLETED FOCUS sessions qualify for streaks
  const qualifyingSessions = sessions.filter(
    (s) => s.type === 'FOCUS' && s.status === 'COMPLETED'
  );

  if (qualifyingSessions.length === 0) {
    return { currentStreak: 0, longestStreak: 0, activeDays: [] };
  }

  // Collect all unique calendar days that have at least one qualifying session
  const activeDaySet = new Set<string>();
  for (const session of qualifyingSessions) {
    const localDate = toLocalDateString(session.startedAt, userTimezone);
    activeDaySet.add(localDate);
  }

  // Sort days in descending order (most recent first)
  const activeDays = Array.from(activeDaySet).sort().reverse();

  const today = getTodayLocalDateString(userTimezone, now);
  const yesterday = getYesterdayLocalDateString(userTimezone, now);

  // Determine current streak starting point
  // The streak can only be "current" if it includes today or yesterday
  let currentStreak = 0;
  if (activeDaySet.has(today) || activeDaySet.has(yesterday)) {
    // Walk backward from today or yesterday, counting consecutive days
    let checkDate = activeDaySet.has(today) ? today : yesterday;

    while (activeDaySet.has(checkDate)) {
      currentStreak++;
      checkDate = getPreviousDateString(checkDate);
    }
  }

  // Calculate longest streak: scan all active days for the longest consecutive run
  let longestStreak = 0;
  let runLength = 1;

  for (let i = 0; i < activeDays.length - 1; i++) {
    const current = activeDays[i];
    const next = activeDays[i + 1];

    if (areConsecutiveDays(next, current)) {
      // next is the day before current (since activeDays is descending)
      runLength++;
    } else {
      longestStreak = Math.max(longestStreak, runLength);
      runLength = 1;
    }
  }
  longestStreak = Math.max(longestStreak, runLength);

  return {
    currentStreak,
    longestStreak,
    activeDays,
  };
}

// ============================================================
// DATE ARITHMETIC HELPERS
// ============================================================

/**
 * Returns the previous calendar day as a "YYYY-MM-DD" string.
 * Handles month/year boundaries correctly.
 */
export function getPreviousDateString(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`); // noon UTC to avoid DST boundary issues
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/**
 * Returns true if dayA and dayB are consecutive calendar days (dayA is the day before dayB).
 * Both arguments must be "YYYY-MM-DD" strings.
 */
export function areConsecutiveDays(dayA: string, dayB: string): boolean {
  return getPreviousDateString(dayB) === dayA;
}

/**
 * Counts how many calendar days separate two date strings.
 * Returns positive number if dateB is after dateA.
 */
export function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(`${dateA}T12:00:00Z`);
  const b = new Date(`${dateB}T12:00:00Z`);
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

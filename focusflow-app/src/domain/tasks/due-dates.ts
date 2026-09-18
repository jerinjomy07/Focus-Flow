// src/domain/tasks/due-dates.ts
// FocusFlow — Task Due Date Domain Logic
// Pure domain calculations for timezone-accurate due date classification.
// All calculations use the user's configured IANA timezone — no naive client-local math.

import { toLocalDateString } from '@/domain/streaks';

export type DueDateCategory = 'OVERDUE' | 'TODAY' | 'TOMORROW' | 'UPCOMING' | 'NONE';

/**
 * Parses a "YYYY-MM-DD" string into UTC timestamp milliseconds for safe calendar day arithmetic.
 */
function parseLocalDateToUtcMs(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

/**
 * Categorizes a task's due date relative to the user's local timezone.
 *
 * @param dueDate - UTC Date of the due date (or ISO string / null)
 * @param timezone - IANA timezone string (e.g. "America/New_York", "Asia/Kolkata")
 * @param now - Reference timestamp (defaults to new Date())
 */
export function getDueDateCategory(
  dueDate: Date | string | null | undefined,
  timezone: string,
  now: Date = new Date()
): DueDateCategory {
  if (!dueDate) return 'NONE';

  const dateObj = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  if (isNaN(dateObj.getTime())) return 'NONE';

  const dueDayStr = toLocalDateString(dateObj, timezone);
  const todayStr = toLocalDateString(now, timezone);

  const dueMs = parseLocalDateToUtcMs(dueDayStr);
  const todayMs = parseLocalDateToUtcMs(todayStr);

  const diffDays = Math.round((dueMs - todayMs) / (24 * 60 * 60 * 1000));

  if (diffDays < 0) return 'OVERDUE';
  if (diffDays === 0) return 'TODAY';
  if (diffDays === 1) return 'TOMORROW';
  return 'UPCOMING';
}

/**
 * Returns true if the due date is earlier than today in the user's timezone.
 */
export function isOverdue(
  dueDate: Date | string | null | undefined,
  timezone: string,
  now: Date = new Date()
): boolean {
  return getDueDateCategory(dueDate, timezone, now) === 'OVERDUE';
}

/**
 * Returns true if the due date is today in the user's timezone.
 */
export function isDueToday(
  dueDate: Date | string | null | undefined,
  timezone: string,
  now: Date = new Date()
): boolean {
  return getDueDateCategory(dueDate, timezone, now) === 'TODAY';
}

/**
 * Formats a due date for human-readable display with timezone awareness.
 * Examples: "Today", "Tomorrow", "Overdue (Sep 14)", "Sep 25"
 */
export function formatDueDate(
  dueDate: Date | string | null | undefined,
  timezone: string,
  now: Date = new Date()
): string {
  if (!dueDate) return '';

  const dateObj = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  if (isNaN(dateObj.getTime())) return '';

  const category = getDueDateCategory(dateObj, timezone, now);

  const formattedMonthDay = dateObj.toLocaleDateString('en-US', {
    timeZone: timezone,
    month: 'short',
    day: 'numeric',
  });

  switch (category) {
    case 'OVERDUE':
      return `Overdue (${formattedMonthDay})`;
    case 'TODAY':
      return 'Today';
    case 'TOMORROW':
      return 'Tomorrow';
    case 'UPCOMING':
      return formattedMonthDay;
    default:
      return '';
  }
}

/**
 * Formats a UTC Date (or ISO string) into a "YYYY-MM-DD" string in the user's timezone,
 * suitable for populating <input type="date" /> fields.
 */
export function toLocalDateInputString(
  dueDate: Date | string | null | undefined,
  timezone: string = 'UTC'
): string {
  if (!dueDate) return '';
  const dateObj = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  if (isNaN(dateObj.getTime())) return '';
  return toLocalDateString(dateObj, timezone);
}

/**
 * Converts a "YYYY-MM-DD" local date string into a UTC ISO string
 * positioned at the end of that day (23:59:59.999) in the given IANA timezone.
 *
 * Implements ADR-010: Task Due Date Semantics and Timezone Authority.
 *
 * @param dateStr - "YYYY-MM-DD" string from client date picker
 * @param timezone - User's IANA timezone (e.g. "America/New_York", "UTC")
 */
export function toUtcEndOfDay(dateStr: string, timezone: string = 'UTC'): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date string: expected format YYYY-MM-DD, got ${dateStr}`);
  }

  const [year, month, day] = dateStr.split('-').map(Number);

  try {
    const utcMs = Date.UTC(year, month - 1, day, 23, 59, 59, 999);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });

    const parts = formatter.formatToParts(new Date(utcMs));
    const p: Record<string, number> = {};
    for (const part of parts) {
      if (part.type !== 'literal') {
        p[part.type] = parseInt(part.value, 10);
      }
    }

    const localMs = Date.UTC(
      p.year,
      p.month - 1,
      p.day,
      p.hour === 24 ? 0 : p.hour,
      p.minute,
      p.second,
      999
    );
    const diff = utcMs - localMs;
    const targetUtc = new Date(utcMs + diff);
    return targetUtc.toISOString();
  } catch {
    return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)).toISOString();
  }
}

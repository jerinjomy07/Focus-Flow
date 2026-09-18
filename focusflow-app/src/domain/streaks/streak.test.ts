// src/domain/streaks/streak.test.ts
// FocusFlow — Streak & Timezone Domain Unit Tests
// Tests calendar day grouping, consecutive counting, midnight crossings,
// timezone attribution, and exclusion of abandoned/break sessions.

import { describe, it, expect } from 'vitest';
import {
  calculateStreaks,
  toLocalDateString,
  getTodayLocalDateString,
  getYesterdayLocalDateString,
  getPreviousDateString,
  areConsecutiveDays,
} from './index';
import type { StreakSessionRecord } from './index';

describe('Streak Domain — Date & Timezone Utilities', () => {
  it('correctly maps UTC dates to local date strings in diverse timezones', () => {
    // 2026-09-17 01:30:00 UTC
    const utcDate = new Date('2026-09-17T01:30:00.000Z');

    // In New York (UTC-4 in EDT): this is 2026-09-16 21:30:00 → previous calendar day!
    expect(toLocalDateString(utcDate, 'America/New_York')).toBe('2026-09-16');

    // In Tokyo (UTC+9): this is 2026-09-17 10:30:00 → same calendar day
    expect(toLocalDateString(utcDate, 'Asia/Tokyo')).toBe('2026-09-17');

    // In London (UTC+1 in BST): this is 2026-09-17 02:30:00 → same calendar day
    expect(toLocalDateString(utcDate, 'Europe/London')).toBe('2026-09-17');
  });

  it('computes correct yesterday date string across month/year boundaries', () => {
    // Crossing month boundary
    const oct1 = new Date('2026-10-01T12:00:00.000Z');
    expect(getYesterdayLocalDateString('UTC', oct1)).toBe('2026-09-30');
    expect(getTodayLocalDateString('UTC', oct1)).toBe('2026-10-01');
    expect(getPreviousDateString('2026-10-01')).toBe('2026-09-30');

    // Crossing year boundary
    const jan1 = new Date('2027-01-01T12:00:00.000Z');
    expect(getYesterdayLocalDateString('UTC', jan1)).toBe('2026-12-31');
  });

  it('verifies consecutive calendar days', () => {
    expect(areConsecutiveDays('2026-09-16', '2026-09-17')).toBe(true);
    expect(areConsecutiveDays('2026-09-15', '2026-09-17')).toBe(false);
    expect(areConsecutiveDays('2026-09-30', '2026-10-01')).toBe(true);
  });
});

describe('Streak Domain — calculateStreaks', () => {
  const FIXED_NOW = new Date('2026-09-20T15:00:00.000Z');
  const TIMEZONE = 'UTC';

  it('returns zero streaks when session list is empty', () => {
    const result = calculateStreaks([], TIMEZONE, FIXED_NOW);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.activeDays).toEqual([]);
  });

  it('excludes ABANDONED and BREAK sessions from streak calculations', () => {
    const sessions: StreakSessionRecord[] = [
      // Today: only an abandoned session
      {
        startedAt: new Date('2026-09-20T10:00:00.000Z'),
        type: 'FOCUS',
        status: 'ABANDONED',
      },
      // Today: only a short break
      {
        startedAt: new Date('2026-09-20T11:00:00.000Z'),
        type: 'SHORT_BREAK',
        status: 'COMPLETED',
      },
    ];

    const result = calculateStreaks(sessions, TIMEZONE, FIXED_NOW);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
  });

  it('calculates a 3-day active streak ending today', () => {
    const sessions: StreakSessionRecord[] = [
      // Day 1: 2026-09-18 (completed focus)
      {
        startedAt: new Date('2026-09-18T10:00:00.000Z'),
        type: 'FOCUS',
        status: 'COMPLETED',
      },
      // Day 2: 2026-09-19 (completed focus)
      {
        startedAt: new Date('2026-09-19T14:00:00.000Z'),
        type: 'FOCUS',
        status: 'COMPLETED',
      },
      // Day 3: 2026-09-20 (today - completed focus)
      {
        startedAt: new Date('2026-09-20T09:00:00.000Z'),
        type: 'FOCUS',
        status: 'COMPLETED',
      },
    ];

    const result = calculateStreaks(sessions, TIMEZONE, FIXED_NOW);
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
    expect(result.activeDays).toEqual(['2026-09-20', '2026-09-19', '2026-09-18']);
  });

  it('maintains current streak if user completed yesterday but has not completed today yet', () => {
    // Current time is 2026-09-20. User completed sessions on Sep 18 and Sep 19, but not yet today.
    const sessions: StreakSessionRecord[] = [
      {
        startedAt: new Date('2026-09-18T10:00:00.000Z'),
        type: 'FOCUS',
        status: 'COMPLETED',
      },
      {
        startedAt: new Date('2026-09-19T14:00:00.000Z'),
        type: 'FOCUS',
        status: 'COMPLETED',
      },
    ];

    const result = calculateStreaks(sessions, TIMEZONE, FIXED_NOW);
    // Streak is not broken yet because today is still ongoing!
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(2);
  });

  it('resets current streak to 0 if yesterday was skipped', () => {
    // Sessions on Sep 15, 16, 17. Today is Sep 20.
    // Yesterday (Sep 19) had no sessions → current streak is 0.
    const sessions: StreakSessionRecord[] = [
      { startedAt: new Date('2026-09-15T10:00:00.000Z'), type: 'FOCUS', status: 'COMPLETED' },
      { startedAt: new Date('2026-09-16T10:00:00.000Z'), type: 'FOCUS', status: 'COMPLETED' },
      { startedAt: new Date('2026-09-17T10:00:00.000Z'), type: 'FOCUS', status: 'COMPLETED' },
    ];

    const result = calculateStreaks(sessions, TIMEZONE, FIXED_NOW);
    expect(result.currentStreak).toBe(0);
    // Longest streak preserved as 3
    expect(result.longestStreak).toBe(3);
  });

  it('correctly tracks longest streak separate from current streak', () => {
    // Old 5-day streak, gap, then 2-day current streak
    const sessions: StreakSessionRecord[] = [
      // 5-day historical run: Sep 1 to Sep 5
      { startedAt: new Date('2026-09-01T10:00:00.000Z'), type: 'FOCUS', status: 'COMPLETED' },
      { startedAt: new Date('2026-09-02T10:00:00.000Z'), type: 'FOCUS', status: 'COMPLETED' },
      { startedAt: new Date('2026-09-03T10:00:00.000Z'), type: 'FOCUS', status: 'COMPLETED' },
      { startedAt: new Date('2026-09-04T10:00:00.000Z'), type: 'FOCUS', status: 'COMPLETED' },
      { startedAt: new Date('2026-09-05T10:00:00.000Z'), type: 'FOCUS', status: 'COMPLETED' },
      // Gap: Sep 6–18
      // 2-day current run: Sep 19, 20
      { startedAt: new Date('2026-09-19T10:00:00.000Z'), type: 'FOCUS', status: 'COMPLETED' },
      { startedAt: new Date('2026-09-20T10:00:00.000Z'), type: 'FOCUS', status: 'COMPLETED' },
    ];

    const result = calculateStreaks(sessions, TIMEZONE, FIXED_NOW);
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(5);
  });

  it('counts multiple sessions on the same day as exactly 1 day in the streak', () => {
    const sessions: StreakSessionRecord[] = [
      // 4 sessions on Sep 20
      { startedAt: new Date('2026-09-20T08:00:00.000Z'), type: 'FOCUS', status: 'COMPLETED' },
      { startedAt: new Date('2026-09-20T10:00:00.000Z'), type: 'FOCUS', status: 'COMPLETED' },
      { startedAt: new Date('2026-09-20T12:00:00.000Z'), type: 'FOCUS', status: 'COMPLETED' },
      { startedAt: new Date('2026-09-20T14:00:00.000Z'), type: 'FOCUS', status: 'COMPLETED' },
    ];

    const result = calculateStreaks(sessions, TIMEZONE, FIXED_NOW);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.activeDays).toEqual(['2026-09-20']);
  });
});

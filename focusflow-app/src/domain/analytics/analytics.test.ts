// src/domain/analytics/analytics.test.ts
// FocusFlow — Analytics Domain Unit Tests
// Tests summary computation, daily trend grouping, project breakdowns,
// and goal progress derivation.

import { describe, it, expect } from 'vitest';
import {
  computeAnalyticsSummary,
  computeDailyTrend,
  computeProjectBreakdown,
  computeGoalProgress,
} from './index';
import type { AnalyticsSession } from './index';

describe('Analytics Domain — computeAnalyticsSummary', () => {
  it('computes metrics from an array of sessions correctly', () => {
    const sessions: AnalyticsSession[] = [
      // Completed 25m (1500s)
      {
        startedAt: new Date('2026-09-17T09:00:00Z'),
        type: 'FOCUS',
        status: 'COMPLETED',
        actualDuration: 1500,
        plannedDuration: 1500,
        projectId: 'prj_1',
      },
      // Completed 30m (1800s)
      {
        startedAt: new Date('2026-09-17T11:00:00Z'),
        type: 'FOCUS',
        status: 'COMPLETED',
        actualDuration: 1800,
        plannedDuration: 1800,
        projectId: 'prj_2',
      },
      // Abandoned after 10m (600s)
      {
        startedAt: new Date('2026-09-17T14:00:00Z'),
        type: 'FOCUS',
        status: 'ABANDONED',
        actualDuration: 600,
        plannedDuration: 1500,
        projectId: 'prj_1',
      },
      // Short break — should NOT count toward focus time or focus sessions
      {
        startedAt: new Date('2026-09-17T10:00:00Z'),
        type: 'SHORT_BREAK',
        status: 'COMPLETED',
        actualDuration: 300,
        plannedDuration: 300,
        projectId: null,
      },
    ];

    const summary = computeAnalyticsSummary(sessions);

    // Total focus seconds: 1500 + 1800 = 3300s (55 mins)
    expect(summary.totalFocusSeconds).toBe(3300);
    expect(summary.totalFocusMinutes).toBe(55);
    expect(summary.completedPomodoros).toBe(2);
    expect(summary.abandonedSessions).toBe(1);
    // 2 completed out of 3 focus sessions = 67%
    expect(summary.completionRate).toBe(67);
    // Average session: 3300 / 2 = 1650s
    expect(summary.averageSessionDurationSeconds).toBe(1650);
  });

  it('handles empty session history gracefully with zero values', () => {
    const summary = computeAnalyticsSummary([]);
    expect(summary).toEqual({
      totalFocusSeconds: 0,
      totalFocusMinutes: 0,
      completedPomodoros: 0,
      abandonedSessions: 0,
      completionRate: 0,
      averageSessionDurationSeconds: 0,
    });
  });
});

describe('Analytics Domain — computeDailyTrend', () => {
  it('generates continuous day points including zero-days in order', () => {
    const now = new Date('2026-09-20T12:00:00Z');
    const sessions: AnalyticsSession[] = [
      // Sep 19: 1 completed session (1500s)
      {
        startedAt: new Date('2026-09-19T10:00:00Z'),
        type: 'FOCUS',
        status: 'COMPLETED',
        actualDuration: 1500,
        plannedDuration: 1500,
        projectId: null,
      },
      // Sep 20: 2 completed sessions (3000s)
      {
        startedAt: new Date('2026-09-20T08:00:00Z'),
        type: 'FOCUS',
        status: 'COMPLETED',
        actualDuration: 1500,
        plannedDuration: 1500,
        projectId: null,
      },
      {
        startedAt: new Date('2026-09-20T10:00:00Z'),
        type: 'FOCUS',
        status: 'COMPLETED',
        actualDuration: 1500,
        plannedDuration: 1500,
        projectId: null,
      },
    ];

    const trend = computeDailyTrend(sessions, 'UTC', 3, now);

    // 3 days: Sep 18 (0s), Sep 19 (1500s), Sep 20 (3000s)
    expect(trend).toHaveLength(3);
    expect(trend[0]).toEqual({
      date: '2026-09-18',
      focusSeconds: 0,
      pomodoroCount: 0,
      completedSessions: 0,
    });
    expect(trend[1]).toEqual({
      date: '2026-09-19',
      focusSeconds: 1500,
      pomodoroCount: 1,
      completedSessions: 1,
    });
    expect(trend[2]).toEqual({
      date: '2026-09-20',
      focusSeconds: 3000,
      pomodoroCount: 2,
      completedSessions: 2,
    });
  });
});

describe('Analytics Domain — computeProjectBreakdown', () => {
  it('groups focus duration by project and calculates accurate percentages', () => {
    const sessions: AnalyticsSession[] = [
      // prj_A: 1500s
      { startedAt: new Date(), type: 'FOCUS', status: 'COMPLETED', actualDuration: 1500, plannedDuration: 1500, projectId: 'prj_A' },
      // prj_A: 1500s (total prj_A: 3000s = 75%)
      { startedAt: new Date(), type: 'FOCUS', status: 'COMPLETED', actualDuration: 1500, plannedDuration: 1500, projectId: 'prj_A' },
      // prj_B: 1000s (total prj_B: 1000s = 25%)
      { startedAt: new Date(), type: 'FOCUS', status: 'COMPLETED', actualDuration: 1000, plannedDuration: 1000, projectId: 'prj_B' },
      // Abandoned session — should NOT be included
      { startedAt: new Date(), type: 'FOCUS', status: 'ABANDONED', actualDuration: 500, plannedDuration: 1500, projectId: 'prj_A' },
    ];

    const breakdown = computeProjectBreakdown(sessions);

    expect(breakdown).toHaveLength(2);
    // Highest duration first
    expect(breakdown[0]).toEqual({
      projectId: 'prj_A',
      focusSeconds: 3000,
      sessionCount: 2,
      percentage: 75,
    });
    expect(breakdown[1]).toEqual({
      projectId: 'prj_B',
      focusSeconds: 1000,
      sessionCount: 1,
      percentage: 25,
    });
  });
});

describe('Analytics Domain — computeGoalProgress', () => {
  const sessions: AnalyticsSession[] = [
    { startedAt: new Date(), type: 'FOCUS', status: 'COMPLETED', actualDuration: 1500, plannedDuration: 1500, projectId: null },
    { startedAt: new Date(), type: 'FOCUS', status: 'COMPLETED', actualDuration: 1500, plannedDuration: 1500, projectId: null },
    { startedAt: new Date(), type: 'FOCUS', status: 'COMPLETED', actualDuration: 1800, plannedDuration: 1800, projectId: null },
  ];

  it('calculates POMODORO_COUNT goal progress and percentage', () => {
    // 3 completed sessions against target of 6
    const { progress, percentage } = computeGoalProgress(sessions, 'POMODORO_COUNT', 6);
    expect(progress).toBe(3);
    expect(percentage).toBe(50);
  });

  it('calculates FOCUS_DURATION goal progress in minutes', () => {
    // 1500 + 1500 + 1800 = 4800s = 80 minutes against target of 160 minutes
    const { progress, percentage } = computeGoalProgress(sessions, 'FOCUS_DURATION', 160);
    expect(progress).toBe(80);
    expect(percentage).toBe(50);
  });

  it('caps percentage at 100% when goal is exceeded', () => {
    // 3 completed sessions against target of 2
    const { progress, percentage } = computeGoalProgress(sessions, 'POMODORO_COUNT', 2);
    expect(progress).toBe(3);
    expect(percentage).toBe(100);
  });
});

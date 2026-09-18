// src/domain/productivity/__tests__/calculations.test.ts
// FocusFlow — Pure Productivity Calculations Unit Tests

import { describe, it, expect } from 'vitest';
import {
  calculateCompletedFocusTime,
  calculateAbandonedFocusTime,
  calculateBreakTime,
  calculateCompletionRate,
  calculateProjectPercentage,
  aggregateDailySummary,
  aggregateProjectBreakdown,
  aggregateTaskBreakdown,
} from '../calculations';
import type { FocusSessionRecord } from '../types';

describe('Productivity Pure Calculations', () => {
  const sampleSessions: FocusSessionRecord[] = [
    {
      id: 'sess-1',
      type: 'FOCUS',
      status: 'COMPLETED',
      plannedDuration: 1500,
      actualDuration: 1500,
      startedAt: new Date('2026-09-17T14:00:00.000Z'),
      endedAt: new Date('2026-09-17T14:25:00.000Z'),
      projectId: 'proj-1',
      taskId: 'task-1',
    },
    {
      id: 'sess-2',
      type: 'FOCUS',
      status: 'COMPLETED',
      plannedDuration: 1500,
      actualDuration: 1500,
      startedAt: new Date('2026-09-17T15:00:00.000Z'),
      endedAt: new Date('2026-09-17T15:25:00.000Z'),
      projectId: 'proj-1',
      taskId: 'task-1',
    },
    {
      id: 'sess-3',
      type: 'FOCUS',
      status: 'ABANDONED',
      plannedDuration: 1500,
      actualDuration: 600,
      startedAt: new Date('2026-09-17T16:00:00.000Z'),
      endedAt: new Date('2026-09-17T16:10:00.000Z'),
      projectId: 'proj-2',
      taskId: 'task-2',
    },
    {
      id: 'sess-4',
      type: 'FOCUS',
      status: 'SKIPPED',
      plannedDuration: 1500,
      actualDuration: 120,
      startedAt: new Date('2026-09-17T17:00:00.000Z'),
      endedAt: new Date('2026-09-17T17:02:00.000Z'),
      projectId: null,
      taskId: null,
    },
    {
      id: 'sess-5',
      type: 'SHORT_BREAK',
      status: 'COMPLETED',
      plannedDuration: 300,
      actualDuration: 300,
      startedAt: new Date('2026-09-17T14:25:00.000Z'),
      endedAt: new Date('2026-09-17T14:30:00.000Z'),
      projectId: null,
      taskId: null,
    },
  ];

  describe('calculateCompletedFocusTime', () => {
    it('sums actualDuration exclusively for COMPLETED FOCUS sessions', () => {
      const result = calculateCompletedFocusTime(sampleSessions);
      // sess-1 (1500) + sess-2 (1500) = 3000
      expect(result).toBe(3000);
    });

    it('returns 0 when there are no completed focus sessions', () => {
      const result = calculateCompletedFocusTime([sampleSessions[2], sampleSessions[3], sampleSessions[4]]);
      expect(result).toBe(0);
    });
  });

  describe('calculateAbandonedFocusTime', () => {
    it('sums actualDuration for ABANDONED FOCUS sessions', () => {
      const result = calculateAbandonedFocusTime(sampleSessions);
      // sess-3 (600)
      expect(result).toBe(600);
    });
  });

  describe('calculateBreakTime', () => {
    it('sums actualDuration for completed breaks and excludes focus sessions', () => {
      const result = calculateBreakTime(sampleSessions);
      // sess-5 (300)
      expect(result).toBe(300);
    });
  });

  describe('calculateCompletionRate', () => {
    it('calculates completed / (completed + abandoned) * 100', () => {
      // 2 completed, 1 abandoned -> 2 / 3 * 100 = 66.66666666666666%
      const rate = calculateCompletionRate(2, 1);
      expect(rate).toBeCloseTo(66.6667, 3);
    });

    it('returns 100% when there are completed sessions and 0 abandoned', () => {
      expect(calculateCompletionRate(5, 0)).toBe(100);
    });

    it('returns 0% when there are no completed sessions and 3 abandoned', () => {
      expect(calculateCompletionRate(0, 3)).toBe(0);
    });

    it('returns 0% when both completed and abandoned are 0 (zero denominator)', () => {
      expect(calculateCompletionRate(0, 0)).toBe(0);
    });
  });

  describe('calculateProjectPercentage', () => {
    it('calculates unrounded floating-point percentage derived from duration ratio', () => {
      // 1500s / 4500s produces ~33.3333
      const p1 = calculateProjectPercentage(1500, 4500);
      expect(p1).toBeCloseTo(33.3333, 4);

      // 3000s / 4500s produces ~66.6667
      const p2 = calculateProjectPercentage(3000, 4500);
      expect(p2).toBeCloseTo(66.6667, 4);

      // Three equal projects: 1000 / 3000 -> 33.3333 each
      const p3 = calculateProjectPercentage(1000, 3000);
      expect(p3).toBeCloseTo(33.3333, 4);
    });

    it('returns 0 when totalCompletedFocusDuration is 0', () => {
      expect(calculateProjectPercentage(0, 0)).toBe(0);
      expect(calculateProjectPercentage(100, 0)).toBe(0);
    });
  });

  describe('aggregateDailySummary', () => {
    it('aggregates daily summary for a target date and user timezone', () => {
      const summary = aggregateDailySummary(sampleSessions, '2026-09-17', 'UTC');

      expect(summary.date).toBe('2026-09-17');
      expect(summary.completedFocusSessions).toBe(2);
      expect(summary.completedFocusSeconds).toBe(3000);
      expect(summary.completedFocusMinutes).toBe(50);
      expect(summary.abandonedFocusSessions).toBe(1);
      expect(summary.abandonedFocusSeconds).toBe(600);
      expect(summary.skippedFocusSessions).toBe(1);
      expect(summary.completedBreakSessions).toBe(1);
      expect(summary.completedBreakSeconds).toBe(300);
      expect(summary.totalSessions).toBe(5);
      expect(summary.completionRate).toBeCloseTo(66.6667, 3);
    });

    it('returns zeros for dates with no sessions', () => {
      const summary = aggregateDailySummary(sampleSessions, '2026-09-20', 'UTC');

      expect(summary.completedFocusSessions).toBe(0);
      expect(summary.completedFocusSeconds).toBe(0);
      expect(summary.completionRate).toBe(0);
      expect(summary.totalSessions).toBe(0);
    });
  });

  describe('aggregateProjectBreakdown', () => {
    it('groups completed focus sessions by project and treats null as Unassigned', () => {
      const sessionsWithProjects: Array<
        FocusSessionRecord & {
          project?: { id: string; name: string; color: string | null; status?: string } | null;
        }
      > = [
        {
          ...sampleSessions[0],
          project: { id: 'proj-1', name: 'FocusFlow Core', color: '#6366f1' },
        },
        {
          ...sampleSessions[1],
          project: { id: 'proj-1', name: 'FocusFlow Core', color: '#6366f1' },
        },
        {
          id: 'sess-unassigned',
          type: 'FOCUS',
          status: 'COMPLETED',
          plannedDuration: 1500,
          actualDuration: 1500,
          startedAt: new Date('2026-09-17T18:00:00.000Z'),
          endedAt: new Date('2026-09-17T18:25:00.000Z'),
          projectId: null,
          taskId: null,
          project: null,
        },
      ];

      const breakdown = aggregateProjectBreakdown(sessionsWithProjects);

      expect(breakdown).toHaveLength(2);
      // proj-1: 3000s out of 4500s (66.6667%)
      const proj1 = breakdown.find((p) => p.projectId === 'proj-1');
      expect(proj1).toBeDefined();
      expect(proj1!.actualFocusSeconds).toBe(3000);
      expect(proj1!.completedFocusSessions).toBe(2);
      expect(proj1!.percentage).toBeCloseTo(66.6667, 3);

      // Unassigned: 1500s out of 4500s (33.3333%)
      const unassigned = breakdown.find((p) => p.projectId === null);
      expect(unassigned).toBeDefined();
      expect(unassigned!.projectName).toBe('Unassigned');
      expect(unassigned!.actualFocusSeconds).toBe(1500);
      expect(unassigned!.completedFocusSessions).toBe(1);
      expect(unassigned!.percentage).toBeCloseTo(33.3333, 3);
    });
  });

  describe('aggregateTaskBreakdown', () => {
    it('aggregates task focus time, pomodoro counts, and lastFocusAt', () => {
      const sessionsWithTasks: Array<
        FocusSessionRecord & {
          task?: { id: string; title: string; completedPomodoros?: number } | null;
        }
      > = [
        {
          ...sampleSessions[0],
          task: { id: 'task-1', title: 'Implement History UI', completedPomodoros: 2 },
        },
        {
          ...sampleSessions[1],
          task: { id: 'task-1', title: 'Implement History UI', completedPomodoros: 2 },
        },
      ];

      const taskBreakdown = aggregateTaskBreakdown(sessionsWithTasks);
      expect(taskBreakdown).toHaveLength(1);
      expect(taskBreakdown[0].taskId).toBe('task-1');
      expect(taskBreakdown[0].taskTitle).toBe('Implement History UI');
      expect(taskBreakdown[0].completedFocusSessions).toBe(2);
      expect(taskBreakdown[0].actualFocusSeconds).toBe(3000);
      expect(taskBreakdown[0].actualFocusMinutes).toBe(50);
      expect(taskBreakdown[0].lastFocusAt).toBe('2026-09-17T15:00:00.000Z');
    });
  });
});

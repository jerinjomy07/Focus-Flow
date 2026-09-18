// src/domain/tasks/__tests__/tasks.test.ts
// FocusFlow — Comprehensive Task Domain Unit Tests
// Tests the canonical state transitions, timezone due date logic,
// priority sorting, and validation schemas.

import { describe, it, expect } from 'vitest';
import {
  isValidTaskTransition,
  getReopenedStatus,
  comparePriority,
  sortTasks,
  PRIORITY_ORDER,
} from '../task-state';
import {
  getDueDateCategory,
  isOverdue,
  isDueToday,
  formatDueDate,
  toUtcEndOfDay,
  toLocalDateInputString,
} from '../due-dates';
import {
  TaskListQuerySchema,
  CreateTaskSchema,
  UpdateTaskSchema,
} from '@/lib/validations';
import type { TaskWithProject, TaskStatus } from '@/types/domain';

describe('Task Domain — Canonical State Machine', () => {
  describe('isValidTaskTransition', () => {
    it('allows valid forward and backward transitions in the canonical matrix', () => {
      // From TODO
      expect(isValidTaskTransition('TODO', 'IN_PROGRESS')).toBe(true);
      expect(isValidTaskTransition('TODO', 'COMPLETED')).toBe(true); // Direct completion

      // From IN_PROGRESS
      expect(isValidTaskTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
      expect(isValidTaskTransition('IN_PROGRESS', 'TODO')).toBe(true); // Moved back to backlog

      // From COMPLETED (Reopening)
      expect(isValidTaskTransition('COMPLETED', 'TODO')).toBe(true);
      expect(isValidTaskTransition('COMPLETED', 'IN_PROGRESS')).toBe(true);
    });

    it('rejects self-transitions and unknown states', () => {
      expect(isValidTaskTransition('TODO', 'TODO')).toBe(false);
      expect(isValidTaskTransition('IN_PROGRESS', 'IN_PROGRESS')).toBe(false);
      expect(isValidTaskTransition('COMPLETED', 'COMPLETED')).toBe(false);
      expect(isValidTaskTransition('TODO', 'UNKNOWN' as unknown as TaskStatus)).toBe(false);
    });
  });

  describe('getReopenedStatus', () => {
    it('returns TODO when task has zero completed Pomodoros', () => {
      expect(getReopenedStatus(0)).toBe('TODO');
      expect(getReopenedStatus(undefined)).toBe('TODO');
    });

    it('returns IN_PROGRESS when task has 1 or more completed Pomodoros', () => {
      expect(getReopenedStatus(1)).toBe('IN_PROGRESS');
      expect(getReopenedStatus(4)).toBe('IN_PROGRESS');
    });
  });
});

describe('Task Domain — Timezone-Aware Due Dates', () => {
  // Reference test instant: 2026-09-17 12:00:00 UTC
  const fixedNow = new Date('2026-09-17T12:00:00.000Z');

  describe('getDueDateCategory', () => {
    it('returns NONE for null, undefined, or invalid dates', () => {
      expect(getDueDateCategory(null, 'UTC', fixedNow)).toBe('NONE');
      expect(getDueDateCategory(undefined, 'UTC', fixedNow)).toBe('NONE');
      expect(getDueDateCategory('invalid-date', 'UTC', fixedNow)).toBe('NONE');
    });

    it('identifies TODAY, OVERDUE, TOMORROW, and UPCOMING in UTC', () => {
      // Today in UTC: 2026-09-17
      expect(getDueDateCategory('2026-09-17T23:59:59.999Z', 'UTC', fixedNow)).toBe('TODAY');

      // Yesterday in UTC: 2026-09-16
      expect(getDueDateCategory('2026-09-16T23:59:59.999Z', 'UTC', fixedNow)).toBe('OVERDUE');

      // Tomorrow in UTC: 2026-09-18
      expect(getDueDateCategory('2026-09-18T23:59:59.999Z', 'UTC', fixedNow)).toBe('TOMORROW');

      // 5 days out in UTC: 2026-09-22
      expect(getDueDateCategory('2026-09-22T23:59:59.999Z', 'UTC', fixedNow)).toBe('UPCOMING');
    });

    it('respects timezone differences across midnight boundaries', () => {
      // At UTC 2026-09-17 02:00:00:
      const midnightTestNow = new Date('2026-09-17T02:00:00.000Z');
      // Task due date: 2026-09-16 23:59:59.999 UTC
      const dueUtcMidnight = '2026-09-16T23:59:59.999Z';

      // In UTC: now is Sep 17, due date was Sep 16 -> OVERDUE
      expect(getDueDateCategory(dueUtcMidnight, 'UTC', midnightTestNow)).toBe('OVERDUE');

      // In New York (EDT, UTC-4): now is Sep 16 22:00, due date was Sep 16 19:59 -> TODAY
      expect(getDueDateCategory(dueUtcMidnight, 'America/New_York', midnightTestNow)).toBe('TODAY');
    });
  });

  describe('isOverdue and isDueToday', () => {
    it('matches getDueDateCategory classification', () => {
      expect(isOverdue('2026-09-15T00:00:00.000Z', 'UTC', fixedNow)).toBe(true);
      expect(isOverdue('2026-09-17T23:59:59.000Z', 'UTC', fixedNow)).toBe(false);

      expect(isDueToday('2026-09-17T18:00:00.000Z', 'UTC', fixedNow)).toBe(true);
      expect(isDueToday('2026-09-18T18:00:00.000Z', 'UTC', fixedNow)).toBe(false);
    });
  });

  describe('formatDueDate', () => {
    it('formats display labels accurately', () => {
      expect(formatDueDate('2026-09-17T23:59:59.999Z', 'UTC', fixedNow)).toBe('Today');
      expect(formatDueDate('2026-09-18T23:59:59.999Z', 'UTC', fixedNow)).toBe('Tomorrow');
      expect(formatDueDate('2026-09-14T23:59:59.999Z', 'UTC', fixedNow)).toContain('Overdue');
      expect(formatDueDate('2026-09-25T23:59:59.999Z', 'UTC', fixedNow)).toBe('Sep 25');
      expect(formatDueDate(null, 'UTC', fixedNow)).toBe('');
    });
  });

  describe('toUtcEndOfDay and toLocalDateInputString', () => {
    it('converts local calendar date to UTC end-of-day timestamp', () => {
      const utcIso = toUtcEndOfDay('2026-09-20', 'UTC');
      expect(utcIso).toBe('2026-09-20T23:59:59.999Z');
    });

    it('handles negative timezone offset (e.g. America/New_York UTC-4)', () => {
      const utcIso = toUtcEndOfDay('2026-09-20', 'America/New_York');
      // 23:59:59 EDT is 03:59:59 UTC on next day
      expect(utcIso).toBe('2026-09-21T03:59:59.999Z');

      // Formatting back to local input string should give original date
      const roundTrip = toLocalDateInputString(utcIso, 'America/New_York');
      expect(roundTrip).toBe('2026-09-20');
    });

    it('handles positive timezone offset (e.g. Asia/Tokyo UTC+9)', () => {
      const utcIso = toUtcEndOfDay('2026-09-20', 'Asia/Tokyo');
      // 23:59:59 JST is 14:59:59 UTC on same day
      expect(utcIso).toBe('2026-09-20T14:59:59.999Z');

      // Round trip back
      const roundTrip = toLocalDateInputString(utcIso, 'Asia/Tokyo');
      expect(roundTrip).toBe('2026-09-20');
    });

    it('throws on malformed date string', () => {
      expect(() => toUtcEndOfDay('not-a-date')).toThrow();
    });
  });
});

describe('Task Domain — Priority and Sorting', () => {
  const mockTasks: TaskWithProject[] = [
    {
      id: 'task_1',
      userId: 'u1',
      title: 'Zebra Task',
      description: null,
      status: 'TODO',
      priority: 'LOW',
      estimatedPomodoros: 2,
      completedPomodoros: 0,
      dueDate: new Date('2026-09-25T00:00:00.000Z'),
      projectId: null,
      project: null,
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    },
    {
      id: 'task_2',
      userId: 'u1',
      title: 'Alpha Task',
      description: null,
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      estimatedPomodoros: 4,
      completedPomodoros: 1,
      dueDate: new Date('2026-09-18T00:00:00.000Z'),
      projectId: null,
      project: null,
      createdAt: new Date('2026-09-05T00:00:00.000Z'),
      updatedAt: new Date('2026-09-05T00:00:00.000Z'),
    },
    {
      id: 'task_3',
      userId: 'u1',
      title: 'Beta Task',
      description: null,
      status: 'TODO',
      priority: 'HIGH',
      estimatedPomodoros: 3,
      completedPomodoros: 0,
      dueDate: null, // No due date
      projectId: null,
      project: null,
      createdAt: new Date('2026-09-10T00:00:00.000Z'),
      updatedAt: new Date('2026-09-10T00:00:00.000Z'),
    },
  ];

  it('verifies priority ranking hierarchy', () => {
    expect(PRIORITY_ORDER.URGENT).toBeLessThan(PRIORITY_ORDER.HIGH);
    expect(PRIORITY_ORDER.HIGH).toBeLessThan(PRIORITY_ORDER.MEDIUM);
    expect(PRIORITY_ORDER.MEDIUM).toBeLessThan(PRIORITY_ORDER.LOW);

    expect(comparePriority('URGENT', 'LOW')).toBeLessThan(0);
    expect(comparePriority('LOW', 'URGENT')).toBeGreaterThan(0);
    expect(comparePriority('HIGH', 'HIGH')).toBe(0);
  });

  it('sorts tasks by priority descending (highest priority first)', () => {
    const sorted = sortTasks(mockTasks, 'priority', 'desc');
    expect(sorted.map((t) => t.priority)).toEqual(['URGENT', 'HIGH', 'LOW']);
  });

  it('sorts tasks by title ascending (A-Z)', () => {
    const sorted = sortTasks(mockTasks, 'title', 'asc');
    expect(sorted.map((t) => t.title)).toEqual(['Alpha Task', 'Beta Task', 'Zebra Task']);
  });

  it('sorts tasks by dueDate ascending (earliest first, nulls last)', () => {
    const sorted = sortTasks(mockTasks, 'dueDate', 'asc');
    expect(sorted[0].id).toBe('task_2'); // Sep 18
    expect(sorted[1].id).toBe('task_1'); // Sep 25
    expect(sorted[2].id).toBe('task_3'); // null (last)
  });

  it('sorts tasks by createdAt descending (newest first)', () => {
    const sorted = sortTasks(mockTasks, 'createdAt', 'desc');
    expect(sorted.map((t) => t.id)).toEqual(['task_3', 'task_2', 'task_1']);
  });
});

describe('Task Domain — Validations & Schemas', () => {
  describe('CreateTaskSchema', () => {
    it('accepts valid task payloads', () => {
      const valid = {
        title: 'Complete Phase 5 implementation',
        description: 'Writing unit and integration tests',
        priority: 'HIGH',
        estimatedPomodoros: 4,
        dueDate: '2026-09-20T23:59:59.999Z',
      };
      const result = CreateTaskSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects empty titles or titles exceeding 200 characters', () => {
      expect(CreateTaskSchema.safeParse({ title: '' }).success).toBe(false);
      expect(CreateTaskSchema.safeParse({ title: 'a'.repeat(201) }).success).toBe(false);
    });

    it('enforces estimatedPomodoros bounds (1 to 50)', () => {
      expect(CreateTaskSchema.safeParse({ title: 'T', estimatedPomodoros: 0 }).success).toBe(false);
      expect(CreateTaskSchema.safeParse({ title: 'T', estimatedPomodoros: 51 }).success).toBe(false);
      expect(CreateTaskSchema.safeParse({ title: 'T', estimatedPomodoros: 50 }).success).toBe(true);
    });
  });

  describe('TaskListQuerySchema', () => {
    it('applies default pagination and sorting', () => {
      const result = TaskListQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
      expect(result.sort).toBe('createdAt');
      expect(result.sortOrder).toBe('desc');
      expect(result.dueDateFilter).toBe('all');
    });

    it('validates dueDateFilter enum values', () => {
      expect(TaskListQuerySchema.safeParse({ dueDateFilter: 'today' }).success).toBe(true);
      expect(TaskListQuerySchema.safeParse({ dueDateFilter: 'overdue' }).success).toBe(true);
      expect(TaskListQuerySchema.safeParse({ dueDateFilter: 'invalid' }).success).toBe(false);
    });
  });

  describe('UpdateTaskSchema', () => {
    it('accepts partial updates for task fields', () => {
      const result = UpdateTaskSchema.safeParse({
        title: 'Updated title',
        status: 'IN_PROGRESS',
        priority: 'URGENT',
      });
      expect(result.success).toBe(true);
    });

    it('rejects extra unknown properties due to strict mode', () => {
      const result = UpdateTaskSchema.safeParse({
        title: 'Valid title',
        extraField: 'not allowed',
      });
      expect(result.success).toBe(false);
    });
  });
});

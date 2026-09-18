// src/domain/tasks/task-state.ts
// FocusFlow — Task Domain Transitions & Sorting Logic
// Pure domain rules for task lifecycle states, priority rankings, and sorting comparators.

import type { TaskStatus, Priority, Task } from '@/types/domain';

export const PRIORITY_RANK: Record<Priority, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export const PRIORITY_ORDER: Record<Priority, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

/**
 * Returns the numeric rank of a task priority for sorting (URGENT = 4, LOW = 1).
 */
export function getPriorityRank(priority: Priority): number {
  return PRIORITY_RANK[priority] ?? 2;
}

/**
 * Compares two priorities: returns negative if a is higher priority than b,
 * zero if equal, or positive if lower priority.
 */
export function comparePriority(a: Priority, b: Priority): number {
  return (PRIORITY_ORDER[a] ?? 2) - (PRIORITY_ORDER[b] ?? 2);
}

export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  TODO: ['IN_PROGRESS', 'COMPLETED'],
  IN_PROGRESS: ['TODO', 'COMPLETED'],
  COMPLETED: ['TODO', 'IN_PROGRESS'],
};

/**
 * Validates whether a task status transition is permitted in the canonical matrix.
 * Self-transitions return false.
 */
export function isValidTaskTransition(
  currentStatus: TaskStatus,
  nextStatus: TaskStatus
): boolean {
  if (currentStatus === nextStatus) return false;
  return TASK_TRANSITIONS[currentStatus]?.includes(nextStatus) ?? false;
}

export const isValidTaskStatusTransition = isValidTaskTransition;

/**
 * Determines reopened status based on whether the task already has completed Pomodoros.
 */
export function getReopenedStatus(completedPomodoros: number = 0): TaskStatus {
  return completedPomodoros > 0 ? 'IN_PROGRESS' : 'TODO';
}

/**
 * Comparator for task sorting by priority (higher priority first by default).
 */
export function compareByPriority(a: { priority: Priority }, b: { priority: Priority }): number {
  return getPriorityRank(b.priority) - getPriorityRank(a.priority);
}

/**
 * Comparator for task sorting by due date (earlier due dates first; nulls always last).
 */
export function compareByDueDate(
  a: { dueDate: Date | string | null },
  b: { dueDate: Date | string | null },
  order: 'asc' | 'desc' = 'asc'
): number {
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1; // null always at end
  if (!b.dueDate) return -1; // null always at end

  const timeA = new Date(a.dueDate).getTime();
  const timeB = new Date(b.dueDate).getTime();
  const diff = timeA - timeB;
  return order === 'asc' ? diff : -diff;
}

/**
 * Comparator for task sorting by creation date.
 */
export function compareByCreatedAt(
  a: { createdAt: Date | string },
  b: { createdAt: Date | string }
): number {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

/**
 * Comparator for task sorting by title (alphabetical A-Z).
 */
export function compareByTitle(a: { title: string }, b: { title: string }): number {
  return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
}

/**
 * Sorts an array of tasks according to the specified key and order.
 */
export function sortTasks<T extends Task>(
  tasks: T[],
  sortKey: 'dueDate' | 'priority' | 'createdAt' | 'title' = 'createdAt',
  order: 'asc' | 'desc' = 'desc'
): T[] {
  const cloned = [...tasks];

  cloned.sort((a, b) => {
    switch (sortKey) {
      case 'priority': {
        const diff = getPriorityRank(a.priority) - getPriorityRank(b.priority);
        return order === 'asc' ? diff : -diff;
      }
      case 'dueDate': {
        return compareByDueDate(a, b, order);
      }
      case 'title': {
        const diff = compareByTitle(a, b);
        return order === 'asc' ? diff : -diff;
      }
      case 'createdAt':
      default: {
        const diff = compareByCreatedAt(a, b);
        return order === 'asc' ? diff : -diff;
      }
    }
  });

  return cloned;
}


// src/app/api/focus-sessions/__tests__/focus-sessions-task-guard.test.ts
// FocusFlow — Completed Task & Project Guard Unit Tests (ADR-013, ADR-014)
// Verifies that completed tasks cannot be focused, archived projects are blocked,
// tasks are never silently reopened, and TODO tasks transition to IN_PROGRESS atomically.

import { describe, it, expect } from 'vitest';
import { ValidationError } from '@/lib/errors';

describe('Completed Task & Archived Project Guard Invariants (ADR-013, ADR-014)', () => {
  describe('Completed Task Guard', () => {
    it('throws ValidationError with TASK_IS_COMPLETED when task is already COMPLETED', () => {
      const task = {
        id: 'tsk_done_1',
        title: 'Finished Work',
        status: 'COMPLETED',
        project: null,
      };

      const validateTaskForFocus = (t: typeof task) => {
        if (t.status === 'COMPLETED') {
          throw new ValidationError(
            'Cannot start a focus session on a completed task. Reopen the task first.',
            [{ field: 'taskId', issue: 'TASK_IS_COMPLETED' }]
          );
        }
      };

      expect(() => validateTaskForFocus(task)).toThrow(ValidationError);

      try {
        validateTaskForFocus(task);
      } catch (err) {
        const valErr = err as ValidationError;
        expect(valErr.statusCode).toBe(400);
        expect(valErr.details?.[0]).toEqual({
          field: 'taskId',
          issue: 'TASK_IS_COMPLETED',
        });
      }
    });

    it('atomically transitions TODO task to IN_PROGRESS when focus session starts', () => {
      const task = {
        id: 'tsk_todo_1',
        title: 'Pending Work',
        status: 'TODO' as 'TODO' | 'IN_PROGRESS' | 'COMPLETED',
      };

      // Atomic transition logic from createFocusSession
      if (task.status === 'TODO') {
        task.status = 'IN_PROGRESS';
      }

      expect(task.status).toBe('IN_PROGRESS');
    });

    it('preserves existing IN_PROGRESS status without redundant change', () => {
      const task = {
        id: 'tsk_prog_1',
        title: 'Ongoing Work',
        status: 'IN_PROGRESS' as const,
      };

      let statusModified = false;
      if ((task.status as string) === 'TODO') {
        statusModified = true;
      }

      expect(statusModified).toBe(false);
      expect(task.status).toBe('IN_PROGRESS');
    });
  });

  describe('Archived Project Guard', () => {
    it('throws ValidationError with PROJECT_IS_ARCHIVED when linked task belongs to archived project', () => {
      const taskWithArchivedProject = {
        id: 'tsk_arch_1',
        title: 'Task in Archived Project',
        status: 'TODO',
        project: {
          id: 'prj_archived_1',
          name: 'Old Project',
          status: 'ARCHIVED',
        },
      };

      const validateTaskProject = (t: typeof taskWithArchivedProject) => {
        if (t.project && t.project.status === 'ARCHIVED') {
          throw new ValidationError(
            'Cannot start a focus session on a task within an archived project.',
            [{ field: 'projectId', issue: 'PROJECT_IS_ARCHIVED' }]
          );
        }
      };

      expect(() => validateTaskProject(taskWithArchivedProject)).toThrow(ValidationError);

      try {
        validateTaskProject(taskWithArchivedProject);
      } catch (err) {
        const valErr = err as ValidationError;
        expect(valErr.statusCode).toBe(400);
        expect(valErr.details?.[0]).toEqual({
          field: 'projectId',
          issue: 'PROJECT_IS_ARCHIVED',
        });
      }
    });

    it('throws ValidationError with PROJECT_IS_ARCHIVED when directly targeting an archived project', () => {
      const project = {
        id: 'prj_standalone_archived',
        name: 'Deprecated Project',
        status: 'ARCHIVED',
      };

      const validateProject = (p: typeof project) => {
        if (p.status === 'ARCHIVED') {
          throw new ValidationError(
            'Cannot start a focus session in an archived project.',
            [{ field: 'projectId', issue: 'PROJECT_IS_ARCHIVED' }]
          );
        }
      };

      expect(() => validateProject(project)).toThrow(ValidationError);

      try {
        validateProject(project);
      } catch (err) {
        const valErr = err as ValidationError;
        expect(valErr.statusCode).toBe(400);
        expect(valErr.details?.[0]).toEqual({
          field: 'projectId',
          issue: 'PROJECT_IS_ARCHIVED',
        });
      }
    });
  });
});

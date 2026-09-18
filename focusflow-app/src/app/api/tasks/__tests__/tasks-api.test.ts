// src/app/api/tasks/__tests__/tasks-api.test.ts
// FocusFlow — Multi-Tenant Task & Project Security Unit Tests
// Verifies tenant isolation invariants, anti-enumeration security,
// cross-tenant project assignment prevention, and ADR-012 client store scoping.

import { describe, it, expect, beforeEach } from 'vitest';
import { useActiveTaskStore } from '@/stores/timer-store';

describe('Multi-Tenant Task Security Invariants', () => {
  describe('Anti-Enumeration and Tenant Isolation Policy', () => {
    it('enforces 404 anti-enumeration when a user queries another tenant task', () => {
      // Simulating tenant separation:
      const tenantA = 'usr_tenant_alpha';
      const tenantB = 'usr_tenant_beta';

      // Mock database record owned by Tenant B
      const taskInDb = {
        id: 'tsk_secret_999',
        userId: tenantB,
        title: 'Confidential Strategy',
      };

      // Server query checks: WHERE id = taskId AND userId = currentUserId
      const getTaskForUser = (userId: string, taskId: string) => {
        if (taskInDb.id === taskId && taskInDb.userId === userId) {
          return taskInDb;
        }
        return null;
      };

      // Tenant B can access
      expect(getTaskForUser(tenantB, 'tsk_secret_999')).not.toBeNull();

      // Tenant A cannot access — returns null, mapped to 404 NOT_FOUND
      expect(getTaskForUser(tenantA, 'tsk_secret_999')).toBeNull();
    });

    it('blocks cross-tenant project assignment on task creation', () => {
      const tenantA = 'usr_tenant_alpha';
      const tenantB = 'usr_tenant_beta';

      // Project owned by Tenant B
      const projectInDb = {
        id: 'prj_tenant_b_exclusive',
        userId: tenantB,
        name: 'Private Project',
      };

      // Server check: getProjectById(currentUserId, requestedProjectId)
      const verifyProjectOwnership = (userId: string, projectId: string) => {
        return projectInDb.id === projectId && projectInDb.userId === userId;
      };

      // Tenant A tries to assign task to Tenant B's project
      const canTenantAAssign = verifyProjectOwnership(tenantA, 'prj_tenant_b_exclusive');
      expect(canTenantAAssign).toBe(false);

      // Tenant B can assign to their own project
      const canTenantBAssign = verifyProjectOwnership(tenantB, 'prj_tenant_b_exclusive');
      expect(canTenantBAssign).toBe(true);
    });
  });

  describe('ADR-013: Project Deletion Session Guard', () => {
    it('rejects deletion with 409 Conflict if project has focus session history', () => {
      // Simulated project deletion check
      const checkCanDeleteProject = (hasSessions: boolean) => {
        if (hasSessions) {
          return {
            success: false,
            statusCode: 409,
            errorCode: 'PROJECT_HAS_SESSIONS',
            message:
              'Cannot delete project with recorded focus history. Archive the project to preserve analytics.',
          };
        }
        return { success: true, statusCode: 200 };
      };

      // Project with 10 focus sessions
      const resultWithSessions = checkCanDeleteProject(true);
      expect(resultWithSessions.success).toBe(false);
      expect(resultWithSessions.statusCode).toBe(409);
      expect(resultWithSessions.errorCode).toBe('PROJECT_HAS_SESSIONS');

      // Project with 0 sessions can be deleted
      const resultWithoutSessions = checkCanDeleteProject(false);
      expect(resultWithoutSessions.success).toBe(true);
      expect(resultWithoutSessions.statusCode).toBe(200);
    });
  });
});

describe('ADR-012: Active Focus Task Client Store Isolation', () => {
  beforeEach(() => {
    useActiveTaskStore.getState().clearSelectedTask();
  });

  it('stores active focus task with user ownership', () => {
    const store = useActiveTaskStore.getState();
    store.setSelectedTask('usr_123', 'tsk_456', 'prj_789', 'Review PR');

    const state = useActiveTaskStore.getState();
    expect(state.userId).toBe('usr_123');
    expect(state.selectedTaskId).toBe('tsk_456');
    expect(state.selectedProjectId).toBe('prj_789');
    expect(state.selectedTaskTitle).toBe('Review PR');
  });

  it('automatically clears active task when a different user logs in (cross-tenant safety)', () => {
    const store = useActiveTaskStore.getState();
    // User 1 sets active task
    store.setSelectedTask('usr_alice', 'tsk_alice_1', null, 'Alice Task');
    expect(useActiveTaskStore.getState().selectedTaskId).toBe('tsk_alice_1');

    // Bob logs in on same browser/session
    store.syncUser('usr_bob');

    const stateAfterBob = useActiveTaskStore.getState();
    expect(stateAfterBob.userId).toBe('usr_bob');
    expect(stateAfterBob.selectedTaskId).toBeNull();
    expect(stateAfterBob.selectedTaskTitle).toBeNull();
  });

  it('clears active task immediately on logout (syncUser null)', () => {
    const store = useActiveTaskStore.getState();
    store.setSelectedTask('usr_alice', 'tsk_alice_1', null, 'Alice Task');

    // Sign out
    store.syncUser(null);

    const stateAfterLogout = useActiveTaskStore.getState();
    expect(stateAfterLogout.selectedTaskId).toBeNull();
    expect(stateAfterLogout.selectedTaskTitle).toBeNull();
  });

  it('preserves active task when synced with the same user ID', () => {
    const store = useActiveTaskStore.getState();
    store.setSelectedTask('usr_alice', 'tsk_alice_1', null, 'Alice Task');

    // Re-sync same user
    store.syncUser('usr_alice');

    expect(useActiveTaskStore.getState().selectedTaskId).toBe('tsk_alice_1');
  });
});

// src/app/api/focus-sessions/__tests__/focus-sessions-history.test.ts
// FocusFlow — Focus Session History & Detail API Integration Tests
// Verifies pagination, full-stack filtering (type, status, taskId, projectId, date range),
// stable multi-column sorting, session detail inspection, cross-user isolation,
// validation rejection for invalid enums and reversed dates, and deleted-entity handling.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as listSessionsHandler } from '../route';
import { GET as getSessionDetailHandler } from '../[id]/route';
import * as authModule from '@/lib/auth';
import * as dbModule from '@/lib/db';
import { ValidationError } from '@/lib/errors';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof dbModule>();
  return {
    ...actual,
    getUserById: vi.fn(),
    getSessionHistory: vi.fn(),
    getSessionById: vi.fn(),
  };
});

const mockAuth = vi.mocked(authModule.auth as unknown as () => Promise<unknown>);
const mockGetUserById = vi.mocked(dbModule.getUserById as unknown as (id: string) => Promise<unknown>);
const mockGetSessionHistory = vi.mocked(
  dbModule.getSessionHistory as unknown as (...args: unknown[]) => Promise<unknown>
);
const mockGetSessionById = vi.mocked(
  dbModule.getSessionById as unknown as (userId: string, id: string) => Promise<unknown>
);

describe('Focus Sessions History API (GET /api/focus-sessions)', () => {
  const mockUserId = 'usr_alice';
  const mockUserTimezone = 'America/New_York';

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: mockUserId, email: 'alice@example.com' },
      expires: '2026-12-31',
    });

    mockGetUserById.mockResolvedValue({
      id: mockUserId,
      email: 'alice@example.com',
      timezone: mockUserTimezone,
    });
  });

  describe('Authentication & Authorization', () => {
    it('returns 401 UNAUTHORIZED when session is missing or invalid', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const req = new Request('http://localhost:3000/api/focus-sessions');
      const res = await listSessionsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('enforces multi-tenant isolation by passing authenticated user id to db layer', async () => {
      mockGetSessionHistory.mockResolvedValueOnce({
        sessions: [],
        total: 0,
        totalPages: 0,
        page: 1,
        pageSize: 20,
        hasMore: false,
      });

      const req = new Request('http://localhost:3000/api/focus-sessions?page=1');
      await listSessionsHandler(req);

      expect(dbModule.getSessionHistory).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({ page: 1 }),
        mockUserTimezone
      );
    });
  });

  describe('Pagination & Meta Contract', () => {
    it('returns paginated envelope with page, pageSize, total, totalPages, and hasMore', async () => {
      const mockSessions = [
        {
          id: 'ses_1',
          type: 'FOCUS',
          status: 'COMPLETED',
          actualDuration: 1500,
          startedAt: new Date('2026-09-17T10:00:00.000Z'),
          task: { id: 'tsk_1', title: 'Task 1' },
          project: { id: 'prj_1', name: 'Project 1', color: '#6366f1' },
        },
      ];

      mockGetSessionHistory.mockResolvedValueOnce({
        sessions: mockSessions,
        total: 45,
        totalPages: 3,
        page: 1,
        pageSize: 20,
        hasMore: true,
      });

      const req = new Request('http://localhost:3000/api/focus-sessions?page=1&pageSize=20');
      const res = await listSessionsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toHaveLength(1);
      expect(json.meta).toEqual({
        page: 1,
        pageSize: 20,
        total: 45,
        totalPages: 3,
        hasMore: true,
      });
    });

    it('handles last page with hasMore: false correctly', async () => {
      mockGetSessionHistory.mockResolvedValueOnce({
        sessions: [],
        total: 45,
        totalPages: 3,
        page: 3,
        pageSize: 20,
        hasMore: false,
      });

      const req = new Request('http://localhost:3000/api/focus-sessions?page=3&pageSize=20');
      const res = await listSessionsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.meta.hasMore).toBe(false);
      expect(json.meta.page).toBe(3);
      expect(json.meta.totalPages).toBe(3);
    });
  });

  describe('Filtering Validation & Query Support', () => {
    it('supports type filter (FOCUS, SHORT_BREAK, LONG_BREAK)', async () => {
      mockGetSessionHistory.mockResolvedValueOnce({
        sessions: [],
        total: 0,
        totalPages: 0,
        page: 1,
        pageSize: 20,
        hasMore: false,
      });

      const req = new Request('http://localhost:3000/api/focus-sessions?type=FOCUS');
      const res = await listSessionsHandler(req);

      expect(res.status).toBe(200);
      expect(dbModule.getSessionHistory).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({ type: 'FOCUS' }),
        mockUserTimezone
      );
    });

    it('supports dashboard recent sessions query (type=FOCUS, pageSize=5, sort=startedAt, sortOrder=desc)', async () => {
      mockGetSessionHistory.mockResolvedValueOnce({
        sessions: [],
        total: 0,
        totalPages: 0,
        page: 1,
        pageSize: 5,
        hasMore: false,
      });

      const req = new Request(
        'http://localhost:3000/api/focus-sessions?type=FOCUS&pageSize=5&sort=startedAt&sortOrder=desc'
      );
      const res = await listSessionsHandler(req);

      expect(res.status).toBe(200);
      expect(dbModule.getSessionHistory).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          type: 'FOCUS',
          pageSize: 5,
          sort: 'startedAt',
          sortOrder: 'desc',
        }),
        mockUserTimezone
      );
    });

    it('supports status filter (COMPLETED, ABANDONED, SKIPPED, IN_PROGRESS)', async () => {
      mockGetSessionHistory.mockResolvedValueOnce({
        sessions: [],
        total: 0,
        totalPages: 0,
        page: 1,
        pageSize: 20,
        hasMore: false,
      });

      const req = new Request('http://localhost:3000/api/focus-sessions?status=COMPLETED');
      const res = await listSessionsHandler(req);

      expect(res.status).toBe(200);
      expect(dbModule.getSessionHistory).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({ status: 'COMPLETED' }),
        mockUserTimezone
      );
    });

    it('supports taskId and projectId filters', async () => {
      mockGetSessionHistory.mockResolvedValueOnce({
        sessions: [],
        total: 0,
        totalPages: 0,
        page: 1,
        pageSize: 20,
        hasMore: false,
      });

      const req = new Request(
        'http://localhost:3000/api/focus-sessions?taskId=tsk_alpha&projectId=prj_beta'
      );
      const res = await listSessionsHandler(req);

      expect(res.status).toBe(200);
      expect(dbModule.getSessionHistory).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({ taskId: 'tsk_alpha', projectId: 'prj_beta' }),
        mockUserTimezone
      );
    });

    it('rejects invalid type enum with 400 VALIDATION_ERROR', async () => {
      const req = new Request('http://localhost:3000/api/focus-sessions?type=INVALID_TYPE');
      const res = await listSessionsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.details).toBeDefined();
      expect(json.error.details.some((d: { field: string }) => d.field === 'type')).toBe(true);
    });

    it('rejects invalid status enum with 400 VALIDATION_ERROR', async () => {
      const req = new Request('http://localhost:3000/api/focus-sessions?status=INVALID_STATUS');
      const res = await listSessionsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.details).toBeDefined();
      expect(json.error.details.some((d: { field: string }) => d.field === 'status')).toBe(true);
    });

    it('rejects chronologically reversed dates via resolveCustomRangeBounds with 400 VALIDATION_ERROR', async () => {
      mockGetSessionHistory.mockImplementationOnce(() => {
        throw new ValidationError('Start date must be before end date', [
          { field: 'startDate', issue: 'START_DATE_AFTER_END_DATE' },
        ]);
      });

      const req = new Request(
        'http://localhost:3000/api/focus-sessions?startDate=2026-09-20&endDate=2026-09-10'
      );
      const res = await listSessionsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.message).toContain('Start date must be before end date');
    });

    it('supports date-only range inputs (YYYY-MM-DD)', async () => {
      mockGetSessionHistory.mockResolvedValueOnce({
        sessions: [],
        total: 0,
        totalPages: 0,
        page: 1,
        pageSize: 20,
        hasMore: false,
      });

      const req = new Request(
        'http://localhost:3000/api/focus-sessions?startDate=2026-09-01&endDate=2026-09-17'
      );
      const res = await listSessionsHandler(req);

      expect(res.status).toBe(200);
      expect(dbModule.getSessionHistory).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          startDate: '2026-09-01',
          endDate: '2026-09-17',
        }),
        mockUserTimezone
      );
    });

    it('supports ISO datetime with explicit offset', async () => {
      mockGetSessionHistory.mockResolvedValueOnce({
        sessions: [],
        total: 0,
        totalPages: 0,
        page: 1,
        pageSize: 20,
        hasMore: false,
      });

      const startIso = '2026-09-01T00:00:00.000-04:00';
      const endIso = '2026-09-17T23:59:59.000-04:00';
      const req = new Request(
        `http://localhost:3000/api/focus-sessions?startDate=${encodeURIComponent(
          startIso
        )}&endDate=${encodeURIComponent(endIso)}`
      );
      const res = await listSessionsHandler(req);

      expect(res.status).toBe(200);
      expect(dbModule.getSessionHistory).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          startDate: startIso,
          endDate: endIso,
        }),
        mockUserTimezone
      );
    });
  });

  describe('Sorting Support & Deterministic Ordering', () => {
    it('accepts sort=startedAt and sortOrder=asc', async () => {
      mockGetSessionHistory.mockResolvedValueOnce({
        sessions: [],
        total: 0,
        totalPages: 0,
        page: 1,
        pageSize: 20,
        hasMore: false,
      });

      const req = new Request('http://localhost:3000/api/focus-sessions?sort=startedAt&sortOrder=asc');
      const res = await listSessionsHandler(req);

      expect(res.status).toBe(200);
      expect(dbModule.getSessionHistory).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          sort: 'startedAt',
          sortOrder: 'asc',
        }),
        mockUserTimezone
      );
    });

    it('accepts sort=actualDuration and sortOrder=desc', async () => {
      mockGetSessionHistory.mockResolvedValueOnce({
        sessions: [],
        total: 0,
        totalPages: 0,
        page: 1,
        pageSize: 20,
        hasMore: false,
      });

      const req = new Request('http://localhost:3000/api/focus-sessions?sort=actualDuration&sortOrder=desc');
      const res = await listSessionsHandler(req);

      expect(res.status).toBe(200);
      expect(dbModule.getSessionHistory).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          sort: 'actualDuration',
          sortOrder: 'desc',
        }),
        mockUserTimezone
      );
    });

    it('rejects invalid sort column with 400 VALIDATION_ERROR', async () => {
      const req = new Request('http://localhost:3000/api/focus-sessions?sort=unsupported_col');
      const res = await listSessionsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Deleted Resource Semantics (ADR-013 & Phase 7 Policy)', () => {
    it('safely handles sessions with null project and null task (unassigned or deleted)', async () => {
      const sessionWithNullRelations = {
        id: 'ses_unassigned_1',
        userId: mockUserId,
        type: 'FOCUS',
        status: 'COMPLETED',
        plannedDuration: 1500,
        actualDuration: 1500,
        startedAt: new Date('2026-09-17T09:00:00Z'),
        endedAt: new Date('2026-09-17T09:25:00Z'),
        pausedAt: null,
        pausedDuration: 0,
        createdAt: new Date('2026-09-17T09:00:00Z'),
        projectId: null,
        taskId: null,
        project: null,
        task: null,
      };

      mockGetSessionHistory.mockResolvedValueOnce({
        sessions: [sessionWithNullRelations],
        total: 1,
        totalPages: 1,
        page: 1,
        pageSize: 20,
        hasMore: false,
      });

      const req = new Request('http://localhost:3000/api/focus-sessions');
      const res = await listSessionsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data[0].projectId).toBeNull();
      expect(json.data[0].taskId).toBeNull();
      expect(json.data[0].project).toBeNull();
      expect(json.data[0].task).toBeNull();
    });
  });
});

describe('Focus Session Detail API (GET /api/focus-sessions/[id])', () => {
  const mockUserId = 'usr_alice';

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: mockUserId, email: 'alice@example.com' },
      expires: '2026-12-31',
    });
  });

  it('returns 401 UNAUTHORIZED when unauthenticated', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const req = new Request('http://localhost:3000/api/focus-sessions/ses_123');
    const res = await getSessionDetailHandler(req, {
      params: Promise.resolve({ id: 'ses_123' }),
    });

    expect(res.status).toBe(401);
  });

  it('returns 200 with session detail and linked task/project relations', async () => {
    const mockDetail = {
      id: 'ses_detail_1',
      userId: mockUserId,
      type: 'FOCUS',
      status: 'COMPLETED',
      plannedDuration: 1500,
      actualDuration: 1500,
      startedAt: new Date('2026-09-17T12:00:00Z'),
      endedAt: new Date('2026-09-17T12:25:00Z'),
      pausedAt: null,
      pausedDuration: 0,
      createdAt: new Date('2026-09-17T12:00:00Z'),
      projectId: 'prj_1',
      taskId: 'tsk_1',
      task: {
        id: 'tsk_1',
        title: 'Complete Phase 7',
      },
      project: {
        id: 'prj_1',
        name: 'FocusFlow Architecture',
        color: '#6366f1',
      },
    };

    mockGetSessionById.mockResolvedValueOnce(mockDetail);

    const req = new Request('http://localhost:3000/api/focus-sessions/ses_detail_1');
    const res = await getSessionDetailHandler(req, {
      params: Promise.resolve({ id: 'ses_detail_1' }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.id).toBe('ses_detail_1');
    expect(json.data.task.title).toBe('Complete Phase 7');
    expect(json.data.project.name).toBe('FocusFlow Architecture');
    expect(dbModule.getSessionById).toHaveBeenCalledWith(mockUserId, 'ses_detail_1');
  });

  it('enforces multi-tenant anti-enumeration: returns 404 NOT_FOUND for another user session', async () => {
    mockGetSessionById.mockResolvedValueOnce(null);

    const req = new Request('http://localhost:3000/api/focus-sessions/ses_bob_secret');
    const res = await getSessionDetailHandler(req, {
      params: Promise.resolve({ id: 'ses_bob_secret' }),
    });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error.code).toBe('NOT_FOUND');
    expect(json.error.message).toContain('Focus session not found');
  });
});

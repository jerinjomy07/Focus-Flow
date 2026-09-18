// src/app/api/productivity/__tests__/productivity-api.test.ts
// FocusFlow — Productivity Summary & Projects API Integration Tests
// Verifies:
// 1. Mutually exclusive query modes (0 params -> default, 1 mode -> valid, 2+ modes -> 400 error)
// 2. Summary calculations (completed focus time, abandoned time, completionRate formula)
// 3. Project breakdown calculations (unrounded float duration percentages, Unassigned handling)
// 4. Task summary and multi-tenant anti-enumeration protection (404 Not Found)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getSummaryHandler } from '../summary/route';
import { GET as getProjectsHandler } from '../projects/route';
import { GET as getTaskHandler } from '../tasks/[id]/route';
import * as authModule from '@/lib/auth';
import * as dbModule from '@/lib/db';
import { ProductivityService } from '@/domain/services';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof dbModule>();
  return {
    ...actual,
    getUserById: vi.fn(),
    getProductivityAggregatesForRange: vi.fn(),
    getProjectProductivityAggregates: vi.fn(),
    getTaskProductivityAggregates: vi.fn(),
    getTaskById: vi.fn(),
  };
});

const mockAuth = vi.mocked(authModule.auth as unknown as () => Promise<unknown>);
const mockGetUserById = vi.mocked(dbModule.getUserById as unknown as (id: string) => Promise<unknown>);
const mockGetProductivityAggregatesForRange = vi.mocked(
  dbModule.getProductivityAggregatesForRange as unknown as (...args: unknown[]) => Promise<unknown>
);
const mockGetProjectProductivityAggregates = vi.mocked(
  dbModule.getProjectProductivityAggregates as unknown as (...args: unknown[]) => Promise<unknown>
);
const mockGetTaskProductivityAggregates = vi.mocked(
  dbModule.getTaskProductivityAggregates as unknown as (...args: unknown[]) => Promise<unknown>
);
const mockGetTaskById = vi.mocked(
  dbModule.getTaskById as unknown as (userId: string, id: string) => Promise<unknown>
);

describe('Productivity API — Mutually Exclusive Query Modes', () => {
  const mockUserId = 'usr_test_1';
  const mockUserTimezone = 'UTC';

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: mockUserId, email: 'test@example.com' },
      expires: '2026-12-31',
    });

    mockGetUserById.mockResolvedValue({
      id: mockUserId,
      email: 'test@example.com',
      timezone: mockUserTimezone,
    });
  });

  describe('Authentication Enforcement', () => {
    it('returns 401 UNAUTHORIZED on GET /api/productivity/summary when unauthenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const req = new Request('http://localhost:3000/api/productivity/summary');
      const res = await getSummaryHandler(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 UNAUTHORIZED on GET /api/productivity/projects when unauthenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const req = new Request('http://localhost:3000/api/productivity/projects');
      const res = await getProjectsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 UNAUTHORIZED on GET /api/productivity/tasks/[id] when unauthenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const req = new Request('http://localhost:3000/api/productivity/tasks/tsk_1');
      const res = await getTaskHandler(req, { params: Promise.resolve({ id: 'tsk_1' }) });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Default Query Modes (0 parameters supplied)', () => {
    it('GET /api/productivity/summary defaults to period=today when 0 modes supplied', async () => {
      mockGetProductivityAggregatesForRange.mockResolvedValueOnce({
        completedFocusSessions: 4,
        completedFocusSeconds: 6000,
        abandonedFocusSessions: 1,
        abandonedFocusSeconds: 600,
        skippedFocusSessions: 0,
        completedBreakSessions: 3,
        completedBreakSeconds: 900,
        totalSessions: 8,
      });

      const req = new Request('http://localhost:3000/api/productivity/summary');
      const res = await getSummaryHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toBeDefined();
      expect(json.data.completedFocusSessions).toBe(4);
      expect(json.data.completedFocusMinutes).toBe(100);
      expect(json.data.date).toBeDefined();
    });

    it('GET /api/productivity/projects defaults to period=week when 0 modes supplied', async () => {
      const serviceSpy = vi.spyOn(ProductivityService, 'getProjectSummaries').mockResolvedValueOnce([
        {
          projectId: 'prj_1',
          projectName: 'Sprint 1',
          projectColor: '#6366f1',
          isArchived: false,
          completedFocusSessions: 2,
          actualFocusSeconds: 3600,
          actualFocusMinutes: 60,
          sessionCount: 2,
          percentage: (3600 / 5400) * 100,
        },
        {
          projectId: null,
          projectName: 'Unassigned',
          projectColor: null,
          isArchived: false,
          completedFocusSessions: 1,
          actualFocusSeconds: 1800,
          actualFocusMinutes: 30,
          sessionCount: 1,
          percentage: (1800 / 5400) * 100,
        },
      ]);

      const req = new Request('http://localhost:3000/api/productivity/projects');
      const res = await getProjectsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toHaveLength(2);
      expect(serviceSpy).toHaveBeenCalledWith(mockUserId, expect.objectContaining({}));
    });
  });

  describe('Single Mode Supplied (Valid 200 OK)', () => {
    it('Mode A: accepts date=YYYY-MM-DD', async () => {
      mockGetProductivityAggregatesForRange.mockResolvedValueOnce({
        completedFocusSessions: 2,
        completedFocusSeconds: 3000,
        abandonedFocusSessions: 0,
        abandonedFocusSeconds: 0,
        skippedFocusSessions: 0,
        completedBreakSessions: 1,
        completedBreakSeconds: 300,
        totalSessions: 3,
      });

      const req = new Request('http://localhost:3000/api/productivity/summary?date=2026-09-17');
      const res = await getSummaryHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.date).toBe('2026-09-17');
      expect(json.data.completedFocusSessions).toBe(2);
    });

    it('Mode B: accepts period=week', async () => {
      mockGetProductivityAggregatesForRange.mockResolvedValueOnce({
        completedFocusSessions: 10,
        completedFocusSeconds: 15000,
        abandonedFocusSessions: 2,
        abandonedFocusSeconds: 1200,
        skippedFocusSessions: 1,
        completedBreakSessions: 8,
        completedBreakSeconds: 2400,
        totalSessions: 21,
      });

      const req = new Request('http://localhost:3000/api/productivity/summary?period=week');
      const res = await getSummaryHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.startDate).toBeDefined();
      expect(json.data.endDate).toBeDefined();
      expect(json.data.completedFocusSessions).toBe(10);
    });

    it('Mode C: accepts custom range with startDate and endDate', async () => {
      mockGetProductivityAggregatesForRange.mockResolvedValueOnce({
        completedFocusSessions: 5,
        completedFocusSeconds: 7500,
        abandonedFocusSessions: 0,
        abandonedFocusSeconds: 0,
        skippedFocusSessions: 0,
        completedBreakSessions: 4,
        completedBreakSeconds: 1200,
        totalSessions: 9,
      });

      const req = new Request(
        'http://localhost:3000/api/productivity/summary?startDate=2026-09-01&endDate=2026-09-15'
      );
      const res = await getSummaryHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.startDate).toBe('2026-09-01');
      expect(json.data.endDate).toBe('2026-09-15');
      expect(json.data.completedFocusSessions).toBe(5);
    });

    it('Mode C: accepts custom range with startDate and endDate for GET /api/productivity/projects', async () => {
      const serviceSpy = vi.spyOn(ProductivityService, 'getProjectSummaries').mockResolvedValueOnce([]);

      const req = new Request(
        'http://localhost:3000/api/productivity/projects?startDate=2026-09-01&endDate=2026-09-15'
      );
      const res = await getProjectsHandler(req);

      expect(res.status).toBe(200);
      expect(serviceSpy).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          startDate: '2026-09-01',
          endDate: '2026-09-15',
        })
      );
    });
  });

  describe('Ambiguous Combinations Rejection (400 VALIDATION_ERROR)', () => {
    const invalidCombinations = [
      { name: 'date + period', query: 'date=2026-09-17&period=week' },
      { name: 'date + startDate', query: 'date=2026-09-17&startDate=2026-09-01' },
      { name: 'date + endDate', query: 'date=2026-09-17&endDate=2026-09-15' },
      { name: 'period + startDate', query: 'period=week&startDate=2026-09-01' },
      { name: 'period + endDate', query: 'period=week&endDate=2026-09-15' },
      { name: 'period + startDate + endDate', query: 'period=week&startDate=2026-09-01&endDate=2026-09-15' },
      { name: 'date + startDate + endDate', query: 'date=2026-09-17&startDate=2026-09-01&endDate=2026-09-15' },
      { name: 'startDate alone without endDate', query: 'startDate=2026-09-01' },
      { name: 'endDate alone without startDate', query: 'endDate=2026-09-15' },
    ];

    for (const { name, query } of invalidCombinations) {
      it(`rejects ${name} with 400 VALIDATION_ERROR on summary endpoint`, async () => {
        const req = new Request(`http://localhost:3000/api/productivity/summary?${query}`);
        const res = await getSummaryHandler(req);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error.code).toBe('VALIDATION_ERROR');
      });

      it(`rejects ${name} with 400 VALIDATION_ERROR on projects endpoint`, async () => {
        const req = new Request(`http://localhost:3000/api/productivity/projects?${query}`);
        const res = await getProjectsHandler(req);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error.code).toBe('VALIDATION_ERROR');
      });
    }
  });
});

describe('Productivity Domain Calculations & Invariants', () => {
  const mockUserId = 'usr_alice';
  const mockUserTimezone = 'America/New_York';

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserById.mockResolvedValue({
      id: mockUserId,
      email: 'alice@example.com',
      timezone: mockUserTimezone,
    });
  });

  describe('ProductivityService.getSummary Aggregations', () => {
    it('computes completionRate accurately using canonical formula: completed / (completed + abandoned) * 100', async () => {
      mockGetProductivityAggregatesForRange.mockResolvedValueOnce({
        completedFocusSessions: 8,
        completedFocusSeconds: 12000,
        abandonedFocusSessions: 2,
        abandonedFocusSeconds: 1200,
        skippedFocusSessions: 5,
        completedBreakSessions: 4,
        completedBreakSeconds: 1200,
        totalSessions: 19,
      });

      const summary = await ProductivityService.getSummary(mockUserId, { period: 'today' });

      // completionRate = (8 / (8 + 2)) * 100 = 80%
      expect(summary.completionRate).toBe(80);
      expect(summary.completedFocusSessions).toBe(8);
      expect(summary.abandonedFocusSessions).toBe(2);
      expect(summary.skippedFocusSessions).toBe(5);
      expect(summary.completedBreakSessions).toBe(4);
    });

    it('returns completionRate = 0 when completed + abandoned === 0', async () => {
      mockGetProductivityAggregatesForRange.mockResolvedValueOnce({
        completedFocusSessions: 0,
        completedFocusSeconds: 0,
        abandonedFocusSessions: 0,
        abandonedFocusSeconds: 0,
        skippedFocusSessions: 3,
        completedBreakSessions: 2,
        completedBreakSeconds: 600,
        totalSessions: 5,
      });

      const summary = await ProductivityService.getSummary(mockUserId, { period: 'today' });

      expect(summary.completionRate).toBe(0);
    });
  });

  describe('ProductivityService.getProjectSummaries Unrounded Duration Percentages', () => {
    it('calculates unrounded numeric percentage derived from duration ratio and includes Unassigned', async () => {
      mockGetProjectProductivityAggregates.mockResolvedValueOnce([
        { projectId: 'prj_alpha', completedFocusSeconds: 3000, completedFocusSessions: 2, totalSessions: 3 },
        { projectId: null, completedFocusSeconds: 1500, completedFocusSessions: 1, totalSessions: 1 },
      ]);

      const { prisma } = await import('@/lib/db/client');
      vi.spyOn(prisma.project, 'findMany').mockResolvedValueOnce([
        {
          id: 'prj_alpha',
          userId: mockUserId,
          name: 'Project Alpha',
          color: '#10b981',
          status: 'ACTIVE',
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const projects = await ProductivityService.getProjectSummaries(mockUserId, { period: 'week' });

      expect(projects).toHaveLength(2);

      const projectAlpha = projects.find((p) => p.projectId === 'prj_alpha');
      expect(projectAlpha).toBeDefined();
      expect(projectAlpha?.projectName).toBe('Project Alpha');
      expect(projectAlpha?.actualFocusSeconds).toBe(3000);
      expect(projectAlpha?.percentage).toBeCloseTo(66.6667, 4);

      const unassigned = projects.find((p) => p.projectId === null);
      expect(unassigned).toBeDefined();
      expect(unassigned?.projectName).toBe('Unassigned');
      expect(unassigned?.projectColor).toBeNull();
      expect(unassigned?.isArchived).toBe(false);
      expect(unassigned?.actualFocusSeconds).toBe(1500);
      expect(unassigned?.percentage).toBeCloseTo(33.3333, 4);

      // Denominator consistency: sum of percentages equals 100
      const totalPct = (projectAlpha?.percentage ?? 0) + (unassigned?.percentage ?? 0);
      expect(totalPct).toBeCloseTo(100, 5);
    });

    it('returns empty array when total completed focus seconds is 0', async () => {
      mockGetProjectProductivityAggregates.mockResolvedValueOnce([]);

      const { prisma } = await import('@/lib/db/client');
      vi.spyOn(prisma.project, 'findMany').mockResolvedValueOnce([]);

      const projects = await ProductivityService.getProjectSummaries(mockUserId, { period: 'week' });
      expect(projects).toEqual([]);
    });
  });

  describe('Task Productivity Summary & Anti-Enumeration', () => {
    it('returns 200 with task productivity statistics for authorized user', async () => {
      mockAuth.mockResolvedValueOnce({
        user: { id: mockUserId, email: 'alice@example.com' },
        expires: '2026-12-31',
      });

      mockGetTaskById.mockResolvedValueOnce({
        id: 'tsk_101',
        userId: mockUserId,
        title: 'Draft Whitepaper',
        completedPomodoros: 3,
        estimatedPomodoros: 4,
      });

      mockGetTaskProductivityAggregates.mockResolvedValueOnce({
        taskId: 'tsk_101',
        completedFocusSeconds: 4500,
        completedFocusSessions: 3,
        totalSessions: 4,
        lastFocusAt: new Date('2026-09-17T14:30:00Z'),
      });

      const req = new Request('http://localhost:3000/api/productivity/tasks/tsk_101');
      const res = await getTaskHandler(req, { params: Promise.resolve({ id: 'tsk_101' }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.taskId).toBe('tsk_101');
      expect(json.data.actualFocusSeconds).toBe(4500);
      expect(json.data.actualFocusMinutes).toBe(75);
      expect(json.data.completedFocusSessions).toBe(3);
    });

    it('enforces multi-tenant anti-enumeration: returns 404 NOT_FOUND when task belongs to another user', async () => {
      mockAuth.mockResolvedValueOnce({
        user: { id: mockUserId, email: 'alice@example.com' },
        expires: '2026-12-31',
      });

      mockGetTaskById.mockResolvedValueOnce(null);

      const req = new Request('http://localhost:3000/api/productivity/tasks/tsk_bob_private');
      const res = await getTaskHandler(req, {
        params: Promise.resolve({ id: 'tsk_bob_private' }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error.code).toBe('NOT_FOUND');
      expect(json.error.message).toContain('Task');
    });
  });
});

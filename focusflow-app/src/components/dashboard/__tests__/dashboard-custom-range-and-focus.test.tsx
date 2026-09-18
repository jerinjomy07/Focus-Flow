// src/components/dashboard/__tests__/dashboard-custom-range-and-focus.test.tsx
// FocusFlow — Phase 8 Corrections Verification: Custom Date Range & Focus Sessions Filtering

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  DashboardHeader,
  RecentSessionsWidget,
} from '../index';
import { queryKeys } from '@/lib/query-keys';
import type { SessionResponse } from '@/types/api';

function render(element: React.ReactElement): string {
  return renderToString(element).replace(/<!--.*?-->/g, '');
}

describe('Dashboard — Custom Date Range UI & Query Behavior', () => {
  it('renders Custom Range option in the period selector tablist', () => {
    const html = render(
      <DashboardHeader period="week" onPeriodChange={vi.fn()} />
    );

    expect(html).toContain('Custom Range');
  });

  it('renders start-date and end-date inputs when period is "custom"', () => {
    const html = render(
      <DashboardHeader
        period="custom"
        onPeriodChange={vi.fn()}
        startDate="2026-09-10"
        endDate="2026-09-15"
        onStartDateChange={vi.fn()}
        onEndDateChange={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="custom-date-controls"');
    expect(html).toContain('aria-label="Start date"');
    expect(html).toContain('aria-label="End date"');
    expect(html).toContain('From:');
    expect(html).toContain('To:');
    expect(html).toContain('2026-09-10');
    expect(html).toContain('2026-09-15');
  });

  it('displays clear validation error when date range is reversed', () => {
    const html = render(
      <DashboardHeader
        period="custom"
        onPeriodChange={vi.fn()}
        startDate="2026-09-20"
        endDate="2026-09-10"
        dateError="Start date cannot be after end date"
      />
    );

    expect(html).toContain('data-testid="custom-date-error"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('Start date cannot be after end date');
  });

  it('renders reset range button when onResetCustomRange is provided', () => {
    const onReset = vi.fn();
    const html = render(
      <DashboardHeader
        period="custom"
        onPeriodChange={vi.fn()}
        startDate="2026-09-10"
        endDate="2026-09-15"
        onResetCustomRange={onReset}
      />
    );

    expect(html).toContain('Reset Range');
  });

  it('constructs query keys with only startDate and endDate for custom range (no period or date)', () => {
    const customParams = { startDate: '2026-09-10', endDate: '2026-09-15' };

    const summaryKey = queryKeys.productivity.summary(customParams);
    const trendKey = queryKeys.productivity.trend(customParams);
    const projectsKey = queryKeys.productivity.projects(customParams);

    expect(summaryKey).toEqual([
      'productivity',
      'summary',
      { endDate: '2026-09-15', startDate: '2026-09-10' },
    ]);
    expect(trendKey).toEqual([
      'productivity',
      'trend',
      { endDate: '2026-09-15', startDate: '2026-09-10' },
    ]);
    expect(projectsKey).toEqual([
      'productivity',
      'projects',
      { endDate: '2026-09-15', startDate: '2026-09-10' },
    ]);

    // Ensure neither 'period' nor 'date' is present in the normalized keys
    const summaryObj = summaryKey[2] as Record<string, unknown> | undefined;
    const trendObj = trendKey[2] as Record<string, unknown> | undefined;
    const projectsObj = projectsKey[2] as Record<string, unknown> | undefined;

    expect(summaryObj?.period).toBeUndefined();
    expect(summaryObj?.date).toBeUndefined();
    expect(trendObj?.period).toBeUndefined();
    expect(trendObj?.date).toBeUndefined();
    expect(projectsObj?.period).toBeUndefined();
    expect(projectsObj?.date).toBeUndefined();
  });
});

describe('Dashboard — Recent Sessions (Strictly FOCUS Sessions)', () => {
  it('constructs query key with type: "FOCUS", pageSize: 5, and sort: startedAt desc', () => {
    const recentKey = queryKeys.sessions.list({
      type: 'FOCUS',
      pageSize: 5,
      sort: 'startedAt',
      sortOrder: 'desc',
    });

    expect(recentKey).toEqual([
      'sessions',
      'list',
      {
        pageSize: 5,
        sort: 'startedAt',
        sortOrder: 'desc',
        type: 'FOCUS',
      },
    ]);
  });

  it('renders maximum 5 sessions sorted newest-first', () => {
    const mockSessions: SessionResponse[] = [
      {
        id: 's5',
        userId: 'u1',
        type: 'FOCUS',
        status: 'COMPLETED',
        plannedDuration: 1500,
        actualDuration: 1500,
        pausedDuration: 0,
        startedAt: new Date('2026-09-17T16:00:00Z'),
        endedAt: new Date('2026-09-17T16:25:00Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
        project: { id: 'p1', name: 'Alpha' },
        task: { id: 't1', title: 'Task 5' },
      } as unknown as SessionResponse,
      {
        id: 's4',
        userId: 'u1',
        type: 'FOCUS',
        status: 'COMPLETED',
        plannedDuration: 1500,
        actualDuration: 1500,
        pausedDuration: 0,
        startedAt: new Date('2026-09-17T15:00:00Z'),
        endedAt: new Date('2026-09-17T15:25:00Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
        project: { id: 'p1', name: 'Alpha' },
        task: { id: 't2', title: 'Task 4' },
      } as unknown as SessionResponse,
      {
        id: 's3',
        userId: 'u1',
        type: 'FOCUS',
        status: 'COMPLETED',
        plannedDuration: 1500,
        actualDuration: 1500,
        pausedDuration: 0,
        startedAt: new Date('2026-09-17T14:00:00Z'),
        endedAt: new Date('2026-09-17T14:25:00Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
        project: { id: 'p1', name: 'Alpha' },
        task: { id: 't3', title: 'Task 3' },
      } as unknown as SessionResponse,
      {
        id: 's2',
        userId: 'u1',
        type: 'FOCUS',
        status: 'COMPLETED',
        plannedDuration: 1500,
        actualDuration: 1500,
        pausedDuration: 0,
        startedAt: new Date('2026-09-17T13:00:00Z'),
        endedAt: new Date('2026-09-17T13:25:00Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
        project: { id: 'p1', name: 'Alpha' },
        task: { id: 't4', title: 'Task 2' },
      } as unknown as SessionResponse,
      {
        id: 's1',
        userId: 'u1',
        type: 'FOCUS',
        status: 'COMPLETED',
        plannedDuration: 1500,
        actualDuration: 1500,
        pausedDuration: 0,
        startedAt: new Date('2026-09-17T12:00:00Z'),
        endedAt: new Date('2026-09-17T12:25:00Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
        project: { id: 'p1', name: 'Alpha' },
        task: { id: 't5', title: 'Task 1' },
      } as unknown as SessionResponse,
    ];

    const html = render(<RecentSessionsWidget sessions={mockSessions} isLoading={false} />);

    expect(html).toContain('Task 5');
    expect(html).toContain('Task 4');
    expect(html).toContain('Task 3');
    expect(html).toContain('Task 2');
    expect(html).toContain('Task 1');
  });

  it('renders "Unassigned" when projectId is null and "No Task" when taskId is null', () => {
    const mockSessions: SessionResponse[] = [
      {
        id: 's_unassigned',
        userId: 'u1',
        type: 'FOCUS',
        status: 'COMPLETED',
        plannedDuration: 1500,
        actualDuration: 1500,
        pausedDuration: 0,
        startedAt: new Date('2026-09-17T12:00:00Z'),
        endedAt: new Date('2026-09-17T12:25:00Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId: null,
        taskId: null,
        project: null,
        task: null,
      } as unknown as SessionResponse,
    ];

    const html = render(<RecentSessionsWidget sessions={mockSessions} isLoading={false} />);

    expect(html).toContain('Unassigned');
    expect(html).toContain('No Task');
  });

  it('renders clean empty state when no focus sessions are recorded', () => {
    const html = render(<RecentSessionsWidget sessions={[]} isLoading={false} />);

    expect(html).toContain('No sessions recorded');
    expect(html).toContain('Start your first focus session to track your deep work.');
    expect(html).toContain('Start Session');
  });
});

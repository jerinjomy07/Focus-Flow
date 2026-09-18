// src/components/dashboard/__tests__/dashboard-components.test.tsx
// FocusFlow — Dashboard Presentation Components Unit Tests (Node/SSR Render-Verified)

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  DashboardHeader,
  ActiveSessionBanner,
  KpiCardGrid,
  FocusTrendChart,
  ProjectDistribution,
  ProductivitySnapshot,
  RecentSessionsWidget,
} from '../index';
import type {
  ActiveSessionResponse,
  DailyProductivitySummaryResponse,
  RangeProductivitySummaryResponse,
  ProductivityTrendResponse,
  ProjectProductivityResponse,
  SessionResponse,
} from '@/types/api';

function render(element: React.ReactElement): string {
  return renderToString(element).replace(/<!--.*?-->/g, '');
}

describe('DashboardHeader Component', () => {
  it('renders title, period tabs, and start session button', () => {
    const html = render(<DashboardHeader period="week" onPeriodChange={vi.fn()} />);

    expect(html).toContain('Dashboard');
    expect(html).toContain('Start Focus Session');
    expect(html).toContain('This Week');
    expect(html).toContain('aria-selected="true"');
  });

  it('marks selected period as active', () => {
    const html = render(<DashboardHeader period="month" onPeriodChange={vi.fn()} />);
    expect(html).toContain('This Month');
  });
});

describe('ActiveSessionBanner Component', () => {
  it('renders skeleton when loading', () => {
    const html = render(<ActiveSessionBanner isLoading={true} />);
    expect(html).toContain('data-testid="active-session-banner-skeleton"');
  });

  it('renders idle quick-start banner when no active session', () => {
    const html = render(<ActiveSessionBanner activeSession={null} isLoading={false} />);
    expect(html).toContain('data-testid="active-session-banner-idle"');
    expect(html).toContain('Ready to enter deep work?');
    expect(html).toContain('Launch Timer');
  });

  it('renders running session details and resume button when active session exists', () => {
    const mockActive: ActiveSessionResponse = {
      id: 'sess_active_1',
      type: 'FOCUS',
      status: 'IN_PROGRESS',
      plannedDuration: 1500, // 25m
      startedAt: new Date(),
      pausedAt: null,
      pausedDuration: 0,
      projectId: 'proj_1',
      taskId: 'task_1',
      project: { id: 'proj_1', name: 'FocusFlow Architecture', color: '#6366f1' },
      task: { id: 'task_1', title: 'Implement Dashboard' },
    };

    const html = render(<ActiveSessionBanner activeSession={mockActive} isLoading={false} />);

    expect(html).toContain('data-testid="active-session-banner-running"');
    expect(html).toContain('Focus Session in Progress');
    expect(html).toContain('FocusFlow Architecture');
    expect(html).toContain('Implement Dashboard');
    expect(html).toContain('Resume Session');
  });
});

describe('KpiCardGrid Component', () => {
  it('renders skeleton cards when loading', () => {
    const html = render(<KpiCardGrid isLoading={true} />);
    expect(html).toContain('data-testid="kpi-grid-skeleton"');
  });

  it('renders error card with retry button when error occurs', () => {
    const html = render(<KpiCardGrid isError={true} onRetry={vi.fn()} />);
    expect(html).toContain('data-testid="kpi-grid-error"');
    expect(html).toContain('Failed to load productivity metrics');
    expect(html).toContain('Retry');
  });

  it('renders formatted focus time, completed sessions, and rounded completion rate', () => {
    const mockSummary: RangeProductivitySummaryResponse = {
      startDate: '2026-09-14',
      endDate: '2026-09-20',
      completedFocusSessions: 12,
      completedFocusSeconds: 9000, // 2h 30m
      completedFocusMinutes: 150,
      abandonedFocusSessions: 2,
      abandonedFocusSeconds: 1200,
      skippedFocusSessions: 1,
      completedBreakSessions: 8,
      completedBreakSeconds: 2400, // 40m
      totalSessions: 23,
      completionRate: 85.714, // Should round to 86% in UI
    };

    const html = render(<KpiCardGrid summary={mockSummary} isLoading={false} periodLabel="this week" />);

    expect(html).toContain('data-testid="kpi-card-grid"');
    expect(html).toContain('2h 30m');
    expect(html).toContain('12');
    expect(html).toContain('86%');
    expect(html).toContain('40m');
  });
});

describe('FocusTrendChart Component', () => {
  it('renders skeleton chart when loading', () => {
    const html = render(<FocusTrendChart isLoading={true} />);
    expect(html).toContain('data-testid="trend-chart-skeleton"');
  });

  it('renders error card when error occurs', () => {
    const html = render(<FocusTrendChart isError={true} onRetry={vi.fn()} />);
    expect(html).toContain('data-testid="trend-chart-error"');
    expect(html).toContain('Failed to load focus trend data');
  });

  it('renders accessible SVG bar chart with points and aria labels', () => {
    const mockTrend: ProductivityTrendResponse = {
      period: 'week',
      startDate: '2026-09-14',
      endDate: '2026-09-20',
      totalFocusSeconds: 7200,
      totalFocusMinutes: 120,
      points: [
        { date: '2026-09-14', focusSeconds: 3600, focusMinutes: 60, completedSessions: 2 },
        { date: '2026-09-15', focusSeconds: 3600, focusMinutes: 60, completedSessions: 2 },
        { date: '2026-09-16', focusSeconds: 0, focusMinutes: 0, completedSessions: 0 },
        { date: '2026-09-17', focusSeconds: 0, focusMinutes: 0, completedSessions: 0 },
        { date: '2026-09-18', focusSeconds: 0, focusMinutes: 0, completedSessions: 0 },
        { date: '2026-09-19', focusSeconds: 0, focusMinutes: 0, completedSessions: 0 },
        { date: '2026-09-20', focusSeconds: 0, focusMinutes: 0, completedSessions: 0 },
      ],
    };

    const html = render(<FocusTrendChart trend={mockTrend} isLoading={false} />);

    expect(html).toContain('data-testid="focus-trend-chart"');
    expect(html).toContain('role="img"');
    expect(html).toContain('120 total focus minutes');
    expect(html).toContain('Mon');
    expect(html).toContain('Tue');
  });

  it('renders empty-state message when all days have 0 minutes', () => {
    const mockTrend: ProductivityTrendResponse = {
      period: 'week',
      startDate: '2026-09-14',
      endDate: '2026-09-20',
      totalFocusSeconds: 0,
      totalFocusMinutes: 0,
      points: [
        { date: '2026-09-14', focusSeconds: 0, focusMinutes: 0, completedSessions: 0 },
      ],
    };

    const html = render(<FocusTrendChart trend={mockTrend} isLoading={false} />);
    expect(html).toContain('No focus sessions completed yet');
  });
});

describe('ProjectDistribution Component', () => {
  it('renders skeleton when loading', () => {
    const html = render(<ProjectDistribution isLoading={true} />);
    expect(html).toContain('data-testid="project-distribution-skeleton"');
  });

  it('renders empty state when no project focus recorded', () => {
    const html = render(<ProjectDistribution projects={[]} isLoading={false} />);
    expect(html).toContain('No project focus recorded');
  });

  it('renders project list with rounded percentages and durations', () => {
    const mockProjects: ProjectProductivityResponse[] = [
      {
        projectId: 'p1',
        projectName: 'Frontend UI',
        projectColor: '#3b82f6',
        isArchived: false,
        completedFocusSessions: 4,
        actualFocusSeconds: 5400,
        actualFocusMinutes: 90, // 1h 30m
        sessionCount: 4,
        percentage: 60.25, // should round to 60%
      },
      {
        projectId: null,
        projectName: 'Unassigned',
        projectColor: null,
        isArchived: false,
        completedFocusSessions: 2,
        actualFocusSeconds: 3600,
        actualFocusMinutes: 60, // 1h
        sessionCount: 2,
        percentage: 39.75, // should round to 40%
      },
    ];

    const html = render(<ProjectDistribution projects={mockProjects} isLoading={false} />);

    expect(html).toContain('data-testid="project-distribution"');
    expect(html).toContain('Frontend UI');
    expect(html).toContain('Unassigned');
    expect(html).toContain('1h 30m');
    expect(html).toContain('60%');
    expect(html).toContain('40%');
  });
});

describe('ProductivitySnapshot Component', () => {
  it('renders skeleton when loading', () => {
    const html = render(<ProductivitySnapshot isLoading={true} />);
    expect(html).toContain('data-testid="snapshot-skeleton"');
  });

  it('renders snapshot session breakdown counters', () => {
    const mockSummary: DailyProductivitySummaryResponse = {
      date: '2026-09-17',
      completedFocusSessions: 5,
      completedFocusSeconds: 7500,
      completedFocusMinutes: 125,
      abandonedFocusSessions: 1,
      abandonedFocusSeconds: 600,
      skippedFocusSessions: 2,
      completedBreakSessions: 4,
      completedBreakSeconds: 1200,
      totalSessions: 12,
      completionRate: 83.33,
    };

    const html = render(<ProductivitySnapshot summary={mockSummary} isLoading={false} />);

    expect(html).toContain('data-testid="productivity-snapshot"');
    expect(html).toContain('Total Sessions');
    expect(html).toContain('12');
    expect(html).toContain('Break Sessions');
    expect(html).toContain('4');
    expect(html).toContain('Skipped Focus');
    expect(html).toContain('2');
    expect(html).toContain('Abandoned Focus');
    expect(html).toContain('1');
  });
});

describe('RecentSessionsWidget Component', () => {
  it('renders skeleton when loading', () => {
    const html = render(<RecentSessionsWidget isLoading={true} />);
    expect(html).toContain('data-testid="recent-sessions-skeleton"');
  });

  it('renders empty state when session list is empty', () => {
    const html = render(<RecentSessionsWidget sessions={[]} isLoading={false} />);
    expect(html).toContain('No sessions recorded');
    expect(html).toContain('Start Session');
  });

  it('renders list of sessions with status, project, and duration', () => {
    const mockSessions: SessionResponse[] = [
      {
        id: 'sess_1',
        userId: 'usr_1',
        taskId: 'task_1',
        projectId: 'proj_1',
        type: 'FOCUS',
        status: 'COMPLETED',
        plannedDuration: 1500,
        actualDuration: 1500,
        pausedDuration: 0,
        startedAt: new Date('2026-09-17T14:30:00Z'),
        endedAt: new Date('2026-09-17T14:55:00Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
        project: { id: 'proj_1', name: 'Design System', color: '#6366f1' },
        task: { id: 'task_1', title: 'Button Component' },
      } as unknown as SessionResponse,
    ];

    const html = render(<RecentSessionsWidget sessions={mockSessions} isLoading={false} />);

    expect(html).toContain('data-testid="recent-sessions-widget"');
    expect(html).toContain('Recent Focus Sessions');
    expect(html).toContain('View full history');
    expect(html).toContain('Design System');
    expect(html).toContain('Button Component');
    expect(html).toContain('25m');
    expect(html).toContain('completed');
  });
});

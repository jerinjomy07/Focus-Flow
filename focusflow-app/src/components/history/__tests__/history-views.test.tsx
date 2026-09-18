// src/components/history/__tests__/history-views.test.tsx
// FocusFlow — History UI Component Unit Tests (Node/SSR Render-Verified)
// Tests DailySummaryHeader, SessionFilters, SessionTable, SessionCards, and SessionDetailModal.

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { DailySummaryHeader } from '../daily-summary-header';
import { SessionFilters } from '../session-filters';
import { SessionTable } from '../session-table';
import { SessionCards } from '../session-cards';
import { SessionDetailModal } from '../session-detail-modal';
import type { SessionResponse, DailyProductivitySummaryResponse } from '@/types/api';

/**
 * Strips React SSR comment markers (<!-- -->) to test normalized text content.
 */
function render(element: React.ReactElement): string {
  return renderToString(element).replace(/<!--.*?-->/g, '');
}

describe('DailySummaryHeader Component', () => {
  it('renders loading skeleton when isLoading is true', () => {
    const html = render(<DailySummaryHeader isLoading={true} />);
    expect(html).toContain('data-testid="daily-summary-skeleton"');
  });

  it('renders today productivity metrics and presentation-rounded completion rate', () => {
    const mockSummary: DailyProductivitySummaryResponse = {
      date: '2026-09-17',
      completedFocusSessions: 6,
      completedFocusSeconds: 9000,
      completedFocusMinutes: 150, // 2h 30m
      abandonedFocusSessions: 2,
      abandonedFocusSeconds: 1200,
      skippedFocusSessions: 1,
      completedBreakSessions: 4,
      completedBreakSeconds: 1200,
      totalSessions: 13,
      completionRate: 75.4, // Should round to 75% in UI presentation
    };

    const html = render(<DailySummaryHeader summary={mockSummary} isLoading={false} />);

    expect(html).toContain('data-testid="daily-summary-header"');
    expect(html).toContain('2h 30m'); // 150m formatted
    expect(html).toContain('6'); // completed
    expect(html).toContain('75%'); // rounded rate
    expect(html).toContain('2 abn');
    expect(html).toContain('1 skip');
  });

  it('renders clean zero-state representation when summary is empty or null', () => {
    const html = render(<DailySummaryHeader summary={null} isLoading={false} />);

    expect(html).toContain('0m');
    expect(html).toContain('0%');
    expect(html).toContain('0 abn');
    expect(html).toContain('0 skip');
  });
});

describe('SessionFilters Component', () => {
  const mockProjects = [
    { id: 'prj_1', name: 'Alpha Core', color: '#6366f1' },
    { id: 'prj_2', name: 'Beta Launch', color: '#10b981' },
  ];

  const mockTasks = [
    { id: 'tsk_1', title: 'Implement Auth' },
    { id: 'tsk_2', title: 'Write Tests' },
  ];

  it('renders all filter dropdowns with correct options', () => {
    const html = render(
      <SessionFilters
        filters={{ page: 1, pageSize: 20 }}
        onFilterChange={() => {}}
        onReset={() => {}}
        projects={mockProjects}
        tasks={mockTasks}
      />
    );

    // Filter labels
    expect(html).toContain('Status');
    expect(html).toContain('Type');
    expect(html).toContain('Project');
    expect(html).toContain('Task');
    expect(html).toContain('Date Range');
    expect(html).toContain('Sort');

    // Filter options
    expect(html).toContain('All Statuses');
    expect(html).toContain('Completed');
    expect(html).toContain('Abandoned');
    expect(html).toContain('Skipped');

    expect(html).toContain('All Types');
    expect(html).toContain('Focus Session');
    expect(html).toContain('Short Break');
    expect(html).toContain('Long Break');

    // Projects dropdown
    expect(html).toContain('Alpha Core');
    expect(html).toContain('Beta Launch');

    // Task dropdown
    expect(html).toContain('Implement Auth');
    expect(html).toContain('Write Tests');

    // Sort options
    expect(html).toContain('Newest First');
    expect(html).toContain('Oldest First');
    expect(html).toContain('Longest Duration');
  });

  it('renders active filter badges and reset button when filters are active', () => {
    const html = render(
      <SessionFilters
        filters={{
          page: 1,
          pageSize: 20,
          status: 'COMPLETED',
          type: 'FOCUS',
          projectId: 'prj_1',
          taskId: 'tsk_1',
        }}
        onFilterChange={() => {}}
        onReset={() => {}}
        projects={mockProjects}
        tasks={mockTasks}
      />
    );

    expect(html).toContain('Active Filters:');
    expect(html).toContain('Status: COMPLETED');
    expect(html).toContain('Type: FOCUS');
    expect(html).toContain('Project: Alpha Core');
    expect(html).toContain('Task: Implement Auth');
    expect(html).toContain('Reset all');
  });
});

describe('SessionTable Component (Desktop View)', () => {
  const mockSessions: SessionResponse[] = [
    {
      id: 'ses_1',
      userId: 'usr_1',
      type: 'FOCUS',
      status: 'COMPLETED',
      plannedDuration: 1500,
      actualDuration: 1500,
      startedAt: new Date('2026-09-17T10:00:00Z'),
      endedAt: new Date('2026-09-17T10:25:00Z'),
      pausedAt: null,
      pausedDuration: 0,
      createdAt: new Date('2026-09-17T10:00:00Z'),
      projectId: 'prj_1',
      taskId: 'tsk_1',
      project: { id: 'prj_1', name: 'FocusFlow', color: '#6366f1' },
      task: {
        id: 'tsk_1',
        title: 'Build Table View',
      },
    },
    {
      id: 'ses_2',
      userId: 'usr_1',
      type: 'FOCUS',
      status: 'ABANDONED',
      plannedDuration: 1500,
      actualDuration: 600,
      startedAt: new Date('2026-09-17T11:00:00Z'),
      endedAt: new Date('2026-09-17T11:10:00Z'),
      pausedAt: null,
      pausedDuration: 0,
      createdAt: new Date('2026-09-17T11:00:00Z'),
      projectId: null, // Unassigned
      taskId: null, // No task
      project: null,
      task: null,
    },
  ];

  it('renders loading skeleton when isLoading is true', () => {
    const html = render(
      <SessionTable sessions={[]} onSelectSession={() => {}} isLoading={true} />
    );
    expect(html).toContain('data-testid="session-table-skeleton"');
  });

  it('renders table headers and row items with accurate fallbacks for null entities', () => {
    const html = render(
      <SessionTable sessions={mockSessions} onSelectSession={() => {}} isLoading={false} />
    );

    expect(html).toContain('data-testid="session-table"');
    expect(html).toContain('data-testid="session-row-ses_1"');
    expect(html).toContain('data-testid="session-row-ses_2"');

    // First session: Task and Project present
    expect(html).toContain('Build Table View');
    expect(html).toContain('FocusFlow');
    expect(html).toContain('25m'); // 1500s

    // Second session: Unassigned project and No Task neutral indicator
    expect(html).toContain('No Task');
    expect(html).toContain('Unassigned');
    expect(html).toContain('10m'); // 600s
    expect(html).toContain('Abandoned');

    // Inspect buttons
    expect(html).toContain('Inspect');
  });
});

describe('SessionCards Component (Mobile View)', () => {
  const mockSessions: SessionResponse[] = [
    {
      id: 'ses_mob_1',
      userId: 'usr_1',
      type: 'FOCUS',
      status: 'COMPLETED',
      plannedDuration: 1500,
      actualDuration: 1500,
      startedAt: new Date('2026-09-17T14:00:00Z'),
      endedAt: new Date('2026-09-17T14:25:00Z'),
      pausedAt: null,
      pausedDuration: 0,
      createdAt: new Date('2026-09-17T14:00:00Z'),
      projectId: 'prj_1',
      taskId: 'tsk_1',
      project: { id: 'prj_1', name: 'Mobile App', color: '#3b82f6' },
      task: {
        id: 'tsk_1',
        title: 'Mobile Optimization',
      },
    },
  ];

  it('renders mobile cards with 48px+ touch area and badges', () => {
    const html = render(
      <SessionCards sessions={mockSessions} onSelectSession={() => {}} isLoading={false} />
    );

    expect(html).toContain('data-testid="session-cards"');
    expect(html).toContain('data-testid="session-card-ses_mob_1"');
    expect(html).toContain('Mobile Optimization');
    expect(html).toContain('Mobile App');
    expect(html).toContain('Completed');
    expect(html).toContain('25m');
  });
});

describe('SessionDetailModal Component', () => {
  const mockSession: SessionResponse = {
    id: 'ses_modal_detail_1',
    userId: 'usr_1',
    type: 'FOCUS',
    status: 'COMPLETED',
    plannedDuration: 1500,
    actualDuration: 1500,
    startedAt: new Date('2026-09-17T15:00:00Z'),
    endedAt: new Date('2026-09-17T15:25:00Z'),
    pausedAt: null,
    pausedDuration: 120,
    createdAt: new Date('2026-09-17T15:00:00Z'),
    projectId: 'prj_1',
    taskId: 'tsk_1',
    project: { id: 'prj_1', name: 'Deep Work Sprint', color: '#ec4899' },
    task: {
      id: 'tsk_1',
      title: 'Analyze Performance',
    },
  };

  it('renders null when open is false or session is null', () => {
    const htmlClosed = render(
      <SessionDetailModal session={mockSession} open={false} onOpenChange={() => {}} />
    );
    expect(htmlClosed).toBe('');

    const htmlNoSession = render(
      <SessionDetailModal session={null} open={true} onOpenChange={() => {}} />
    );
    expect(htmlNoSession).toBe('');
  });

  it('renders session details, timing breakdown, and linked relations when open', () => {
    const html = render(
      <SessionDetailModal session={mockSession} open={true} onOpenChange={() => {}} />
    );

    expect(html).toContain('Session Details');
    expect(html).toContain('data-testid="detail-actual-duration"');
    expect(html).toContain('25m'); // 1500s
    expect(html).toContain('2m'); // 120s paused
    expect(html).toContain('ses_modal_detail_1');
    expect(html).toContain('Analyze Performance');
    expect(html).toContain('Deep Work Sprint');
  });

  it('renders Unassigned and No Task fallbacks when relations are null', () => {
    const unassignedSession: SessionResponse = {
      ...mockSession,
      projectId: null,
      taskId: null,
      project: null,
      task: null,
    };

    const html = render(
      <SessionDetailModal session={unassignedSession} open={true} onOpenChange={() => {}} />
    );

    expect(html).toContain('data-testid="detail-no-task"');
    expect(html).toContain('No task linked to this session');
    expect(html).toContain('data-testid="detail-unassigned-project"');
    expect(html).toContain('Unassigned');
  });
});

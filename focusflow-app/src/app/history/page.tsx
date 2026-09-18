'use client';

// src/app/history/page.tsx
// FocusFlow — Focus Session History & Productivity Foundation Page
// Displays daily productivity summary, query toolbar with Status, Type, Project, Task,
// Date Range, and Sort filters, responsive table and card views, inspection modal, and pagination.

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { History, Timer, ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { DailySummaryHeader } from '@/components/history/daily-summary-header';
import { SessionFilters } from '@/components/history/session-filters';
import { SessionTable } from '@/components/history/session-table';
import { SessionCards } from '@/components/history/session-cards';
import { SessionDetailModal } from '@/components/history/session-detail-modal';
import { queryKeys } from '@/lib/query-keys';
import type { SessionListQuery, SessionResponse, DailyProductivitySummaryResponse } from '@/types/api';

export default function HistoryPage() {
  // Query Filters State
  const [filters, setFilters] = React.useState<SessionListQuery>({
    page: 1,
    pageSize: 20,
    sort: 'startedAt',
    sortOrder: 'desc',
  });

  // Modal State
  const [selectedSession, setSelectedSession] = React.useState<SessionResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  // 1. Fetch Today's Daily Summary
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
  } = useQuery<{ data: DailyProductivitySummaryResponse }>({
    queryKey: queryKeys.productivity.summary({ period: 'today' }),
    queryFn: async () => {
      const res = await fetch('/api/productivity/summary?period=today');
      if (!res.ok) throw new Error('Failed to fetch productivity summary');
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  // 2. Fetch Projects for Filter Dropdown
  const { data: projectsData } = useQuery<{ data: Array<{ id: string; name: string; color: string }> }>({
    queryKey: queryKeys.projects.list('ACTIVE'),
    queryFn: async () => {
      const res = await fetch('/api/projects');
      if (!res.ok) return { data: [] };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // 3. Fetch Tasks for Filter Dropdown
  const { data: tasksData } = useQuery<{ data: Array<{ id: string; title: string }> }>({
    queryKey: queryKeys.tasks.list(),
    queryFn: async () => {
      const res = await fetch('/api/tasks?pageSize=100');
      if (!res.ok) return { data: [] };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // 4. Build API Query URL for Sessions
  const queryString = React.useMemo(() => {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
    if (filters.type) params.set('type', filters.type);
    if (filters.status) params.set('status', filters.status);
    if (filters.projectId) params.set('projectId', filters.projectId);
    if (filters.taskId) params.set('taskId', filters.taskId);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    return params.toString();
  }, [filters]);

  // 5. Fetch Session History
  const {
    data: sessionsResponse,
    isLoading: isSessionsLoading,
    isError: isSessionsError,
    refetch: refetchSessions,
  } = useQuery<{
    data: SessionResponse[];
    meta: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
  }>({
    queryKey: queryKeys.sessions.list(filters),
    queryFn: async () => {
      const res = await fetch(`/api/focus-sessions?${queryString}`);
      if (!res.ok) throw new Error('Failed to load focus sessions');
      return res.json();
    },
  });

  // Filter change helper: updates filter and resets page to 1
  const handleFilterChange = (newFilters: Partial<SessionListQuery>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      page: 1, // reset page on any filter change
    }));
  };

  // Reset all filters
  const handleResetFilters = () => {
    setFilters({
      page: 1,
      pageSize: 20,
      sort: 'startedAt',
      sortOrder: 'desc',
    });
  };

  const handleSelectSession = (session: SessionResponse) => {
    setSelectedSession(session);
    setIsModalOpen(true);
  };

  const sessions = sessionsResponse?.data ?? [];
  const meta = sessionsResponse?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const currentPage = meta?.page ?? 1;

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Page Header */}
        <PageHeader
          title="Session History"
          description="View and inspect all recorded focus sessions, breaks, and daily productivity outcomes."
        >
          <Link href="/focus">
            <Button size="sm" className="gap-2">
              <Timer className="h-4 w-4" />
              <span>Start Focus</span>
            </Button>
          </Link>
        </PageHeader>

        {/* Daily Summary Header */}
        <DailySummaryHeader
          summary={summaryData?.data}
          isLoading={isSummaryLoading}
        />

        {/* Filters Toolbar */}
        <SessionFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
          projects={projectsData?.data || []}
          tasks={tasksData?.data || []}
        />

        {/* Content Section */}
        {isSessionsError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
            <h3 className="font-semibold text-foreground">Failed to load session history</h3>
            <p className="text-xs text-muted-foreground">
              An error occurred while fetching your sessions. Please check your connection and try again.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchSessions()}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </Button>
          </div>
        ) : !isSessionsLoading && sessions.length === 0 ? (
          <EmptyState
            icon={History}
            title="No sessions found"
            description={
              Object.keys(filters).some(
                (k) =>
                  !['page', 'pageSize', 'sort', 'sortOrder'].includes(k) &&
                  filters[k as keyof SessionListQuery]
              )
                ? 'No focus sessions match the active filters. Try adjusting or clearing your filters.'
                : 'You have not recorded any focus sessions yet. Complete your first session with the Pomodoro timer.'
            }
            action={
              <Link href="/focus">
                <Button className="gap-2">
                  <Timer className="h-4 w-4" />
                  <span>Start a Focus Session</span>
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {/* Desktop Table View */}
            <SessionTable
              sessions={sessions}
              onSelectSession={handleSelectSession}
              isLoading={isSessionsLoading}
            />

            {/* Mobile Cards View */}
            <SessionCards
              sessions={sessions}
              onSelectSession={handleSelectSession}
              isLoading={isSessionsLoading}
            />

            {/* Pagination Controls */}
            {meta && meta.total > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>
                    Showing {Math.min((currentPage - 1) * (filters.pageSize || 20) + 1, meta.total)} to{' '}
                    {Math.min(currentPage * (filters.pageSize || 20), meta.total)} of {meta.total} sessions
                  </span>
                  <span>•</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">Page size:</span>
                    <Select
                      className="h-8 w-20 text-xs"
                      value={String(filters.pageSize || 20)}
                      onChange={(e) =>
                        handleFilterChange({
                          pageSize: Number(e.target.value),
                          page: 1,
                        })
                      }
                      aria-label="Items per page"
                    >
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 gap-1"
                    disabled={currentPage <= 1 || isSessionsLoading}
                    onClick={() => setFilters((prev) => ({ ...prev, page: currentPage - 1 }))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>

                  <span className="text-xs font-medium text-foreground px-2">
                    Page {currentPage} of {totalPages || 1}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 gap-1"
                    disabled={currentPage >= totalPages || isSessionsLoading}
                    onClick={() => setFilters((prev) => ({ ...prev, page: currentPage + 1 }))}
                    aria-label="Next page"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Session Detail Modal */}
        <SessionDetailModal
          session={selectedSession}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
        />
      </div>
    </AppShell>
  );
}

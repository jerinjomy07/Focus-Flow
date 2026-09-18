'use client';

// src/app/dashboard/page.tsx
// FocusFlow — Authoritative Productivity Dashboard
// Read-only presentation layer over Phase 7 productivity data foundation.
// Powered by TanStack Query, accessible SVG visualizations, and isolated error boundaries.

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/app-shell';
import {
  DashboardHeader,
  ActiveSessionBanner,
  KpiCardGrid,
  FocusTrendChart,
  ProjectDistribution,
  ProductivitySnapshot,
  RecentSessionsWidget,
  type DashboardPeriod,
} from '@/components/dashboard';
import { queryKeys } from '@/lib/query-keys';
import type {
  ActiveSessionResponse,
  DailyProductivitySummaryResponse,
  RangeProductivitySummaryResponse,
  ProductivityTrendResponse,
  ProjectProductivityResponse,
  SessionResponse,
  ProductivitySummaryQuery,
} from '@/types/api';

export default function DashboardPage() {
  const [period, setPeriod] = React.useState<DashboardPeriod>('week');
  const [customStartDate, setCustomStartDate] = React.useState<string>('');
  const [customEndDate, setCustomEndDate] = React.useState<string>('');

  // Custom Range Validation
  const isCustom = period === 'custom';
  const isCustomComplete = Boolean(customStartDate && customEndDate);
  const isCustomReversed = isCustomComplete && customStartDate > customEndDate;
  const isCustomValid = isCustomComplete && !isCustomReversed;

  const dateError = isCustomReversed
    ? 'Start date cannot be after end date'
    : null;

  const handleResetCustomRange = () => {
    setCustomStartDate('');
    setCustomEndDate('');
    setPeriod('week');
  };

  // Build query parameter objects and URL query strings
  // When custom range is active, send ONLY startDate and endDate (never period or date)
  const queryParams: ProductivitySummaryQuery | undefined = isCustom
    ? isCustomValid
      ? { startDate: customStartDate, endDate: customEndDate }
      : undefined
    : { period };

  const queryUrlString = isCustom
    ? isCustomValid
      ? `startDate=${customStartDate}&endDate=${customEndDate}`
      : ''
    : `period=${period}`;

  // Only fire productivity analytical queries if non-custom OR if custom range is completely valid
  const isQueryEnabled = !isCustom || isCustomValid;

  // 1. Fetch Active Session
  const { data: activeData, isLoading: isActiveLoading } = useQuery<{
    data: ActiveSessionResponse | null;
  }>({
    queryKey: queryKeys.sessions.active,
    queryFn: async () => {
      const res = await fetch('/api/focus-sessions/active');
      if (!res.ok) return { data: null };
      return res.json();
    },
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  });

  // 2. Fetch Productivity Summary
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useQuery<{ data: DailyProductivitySummaryResponse | RangeProductivitySummaryResponse }>({
    queryKey: queryKeys.productivity.summary(queryParams),
    queryFn: async () => {
      const res = await fetch(`/api/productivity/summary?${queryUrlString}`);
      if (!res.ok) throw new Error('Failed to fetch productivity summary');
      return res.json();
    },
    staleTime: 60 * 1000,
    enabled: isQueryEnabled,
  });

  // 3. Fetch Daily Productivity Trend
  const {
    data: trendData,
    isLoading: isTrendLoading,
    isError: isTrendError,
    refetch: refetchTrend,
  } = useQuery<{ data: ProductivityTrendResponse }>({
    queryKey: queryKeys.productivity.trend(queryParams),
    queryFn: async () => {
      const res = await fetch(`/api/productivity/trend?${queryUrlString}`);
      if (!res.ok) throw new Error('Failed to fetch productivity trend');
      return res.json();
    },
    staleTime: 60 * 1000,
    enabled: isQueryEnabled,
  });

  // 4. Fetch Project Allocation Breakdown
  const {
    data: projectsData,
    isLoading: isProjectsLoading,
    isError: isProjectsError,
    refetch: refetchProjects,
  } = useQuery<{ data: ProjectProductivityResponse[] }>({
    queryKey: queryKeys.productivity.projects(queryParams),
    queryFn: async () => {
      const res = await fetch(`/api/productivity/projects?${queryUrlString}`);
      if (!res.ok) throw new Error('Failed to fetch project distribution');
      return res.json();
    },
    staleTime: 60 * 1000,
    enabled: isQueryEnabled,
  });

  // 5. Fetch 5 Recent FOCUS Sessions (strictly FOCUS type, newest first)
  const {
    data: recentSessionsData,
    isLoading: isRecentLoading,
    isError: isRecentError,
    refetch: refetchRecent,
  } = useQuery<{ data: SessionResponse[] }>({
    queryKey: queryKeys.sessions.list({ type: 'FOCUS', pageSize: 5, sort: 'startedAt', sortOrder: 'desc' }),
    queryFn: async () => {
      const res = await fetch('/api/focus-sessions?type=FOCUS&pageSize=5&sort=startedAt&sortOrder=desc');
      if (!res.ok) throw new Error('Failed to fetch recent focus sessions');
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const periodLabel = isCustom
    ? isCustomValid
      ? `${customStartDate} to ${customEndDate}`
      : 'custom range'
    : period === 'week'
    ? 'this week'
    : period === 'month'
    ? 'this month'
    : period === 'today'
    ? 'today'
    : 'yesterday';

  return (
    <AppShell>
      <div className="space-y-8" data-testid="dashboard-page">
        {/* Header with period toggle, custom date inputs, & session launch button */}
        <DashboardHeader
          period={period}
          onPeriodChange={setPeriod}
          startDate={customStartDate}
          endDate={customEndDate}
          onStartDateChange={setCustomStartDate}
          onEndDateChange={setCustomEndDate}
          dateError={dateError}
          onResetCustomRange={handleResetCustomRange}
        />

        {/* Active Session Detection / Quick Launch Banner */}
        <ActiveSessionBanner
          activeSession={activeData?.data}
          isLoading={isActiveLoading}
        />

        {/* Primary KPI Stat Cards */}
        <KpiCardGrid
          summary={summaryData?.data}
          isLoading={isCustom && !isCustomValid ? false : isSummaryLoading}
          isError={isSummaryError}
          onRetry={() => refetchSummary()}
          periodLabel={periodLabel}
        />

        {/* Asymmetrical 2-Column Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column (2/3 width on desktop): Trend Chart & Recent Sessions */}
          <div className="lg:col-span-2 space-y-6">
            <FocusTrendChart
              trend={trendData?.data}
              isLoading={isCustom && !isCustomValid ? false : isTrendLoading}
              isError={isTrendError}
              onRetry={() => refetchTrend()}
            />

            <RecentSessionsWidget
              sessions={recentSessionsData?.data}
              isLoading={isRecentLoading}
              isError={isRecentError}
              onRetry={() => refetchRecent()}
            />
          </div>

          {/* Sidebar Column (1/3 width on desktop): Project Distribution & Snapshot */}
          <div className="space-y-6">
            <ProjectDistribution
              projects={projectsData?.data}
              isLoading={isCustom && !isCustomValid ? false : isProjectsLoading}
              isError={isProjectsError}
              onRetry={() => refetchProjects()}
            />

            <ProductivitySnapshot
              summary={summaryData?.data}
              isLoading={isCustom && !isCustomValid ? false : isSummaryLoading}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

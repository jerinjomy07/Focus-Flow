'use client';

// src/app/analytics/page.tsx
// FocusFlow — Advanced Analytics Page (Phase 9)
// Deterministic, query-first analytics dashboard driven by PostgreSQL aggregations.

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/app-shell';
import { ErrorState } from '@/components/common/error-state';
import {
  AnalyticsHeader,
  OverviewKpiGrid,
  PeakFocusBanner,
  SecondaryMetricsBar,
  WeekdayDistributionChart,
  HourlyDistributionChart,
  AnalyticsProjectDistribution,
  ConsistencyWidget,
  type AnalyticsPeriod,
} from '@/components/analytics';
import { queryKeys } from '@/lib/query-keys';
import type {
  AnalyticsOverviewResponse,
  AnalyticsDistributionsResponse,
  ProductivitySummaryQuery,
} from '@/types/api';

export default function AnalyticsPage() {
  const [period, setPeriod] = React.useState<AnalyticsPeriod>('week');
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

  const isQueryEnabled = !isCustom || isCustomValid;

  // 1. Fetch Analytics Overview
  const {
    data: overviewData,
    isLoading: isOverviewLoading,
    isError: isOverviewError,
    refetch: refetchOverview,
  } = useQuery<{ data: AnalyticsOverviewResponse }>({
    queryKey: queryKeys.analytics.overview(queryParams),
    queryFn: async () => {
      const res = await fetch(`/api/analytics/overview?${queryUrlString}`);
      if (!res.ok) throw new Error('Failed to fetch analytics overview');
      return res.json();
    },
    staleTime: 60 * 1000,
    enabled: isQueryEnabled,
  });

  // 2. Fetch Analytics Distributions (Weekday, Hourly, Projects)
  const {
    data: distributionsData,
    isLoading: isDistributionsLoading,
    isError: isDistributionsError,
    refetch: refetchDistributions,
  } = useQuery<{ data: AnalyticsDistributionsResponse }>({
    queryKey: queryKeys.analytics.distributions(queryParams),
    queryFn: async () => {
      const res = await fetch(`/api/analytics/distributions?${queryUrlString}`);
      if (!res.ok) throw new Error('Failed to fetch analytics distributions');
      return res.json();
    },
    staleTime: 60 * 1000,
    enabled: isQueryEnabled,
  });

  const isAnyError = isOverviewError || isDistributionsError;
  const handleRetryAll = () => {
    refetchOverview();
    refetchDistributions();
  };

  const overview = overviewData?.data ?? null;
  const distributions = distributionsData?.data ?? null;

  return (
    <AppShell>
      <div className="space-y-6 pb-12">
        {/* Header with period switcher and accessible date inputs */}
        <AnalyticsHeader
          period={period}
          onPeriodChange={setPeriod}
          startDate={customStartDate}
          endDate={customEndDate}
          onStartDateChange={setCustomStartDate}
          onEndDateChange={setCustomEndDate}
          dateError={dateError}
          onResetCustomRange={handleResetCustomRange}
        />

        {/* Global Error State */}
        {isAnyError ? (
          <ErrorState
            title="Failed to load analytics"
            description="We were unable to aggregate your productivity data. Please try refreshing or check your connection."
            onRetry={handleRetryAll}
            retryText="Retry Analytics"
          />
        ) : (
          <div className="space-y-6">
            {/* 1. Primary KPI Grid (with Period-over-Period Deltas) */}
            <OverviewKpiGrid
              overview={overview}
              isLoading={isOverviewLoading}
            />

            {/* 2. Peak Focus Highlights Banner */}
            <PeakFocusBanner
              peakWeekday={distributions?.peakWeekday ?? null}
              peakHour={distributions?.peakHour ?? null}
              isLoading={isDistributionsLoading}
            />

            {/* 3. Secondary Performance Metrics Bar */}
            <SecondaryMetricsBar
              overview={overview}
              isLoading={isOverviewLoading}
            />

            {/* 4. Temporal Distributions (Weekday 7-bar & 24-hour Histogram) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <WeekdayDistributionChart
                weekdayData={distributions?.weekday}
                peakWeekday={distributions?.peakWeekday ?? null}
                isLoading={isDistributionsLoading}
              />
              <HourlyDistributionChart
                hourlyData={distributions?.hourly}
                peakHour={distributions?.peakHour ?? null}
                isLoading={isDistributionsLoading}
              />
            </div>

            {/* 5. Project Allocation & Consistency Meter */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AnalyticsProjectDistribution
                projects={distributions?.projects}
                isLoading={isDistributionsLoading}
              />
              <ConsistencyWidget
                activeFocusDays={overview?.activeFocusDays ?? 0}
                totalDaysInRange={overview?.totalDaysInRange ?? 0}
                consistencyRate={overview?.consistencyRate ?? 0}
                isLoading={isOverviewLoading}
              />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

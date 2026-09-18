'use client';

// src/components/dashboard/kpi-card-grid.tsx
// FocusFlow — Primary Productivity KPI Stat Cards Grid
// Displays Total Focus Time, Completed Sessions, Completion Rate, and Break Time.

import * as React from 'react';
import { Clock, CheckCircle2, Percent, Coffee, AlertCircle, RefreshCw } from 'lucide-react';
import { StatCard } from '@/components/common/stat-card';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type {
  DailyProductivitySummaryResponse,
  RangeProductivitySummaryResponse,
} from '@/types/api';

export interface KpiCardGridProps {
  summary?: DailyProductivitySummaryResponse | RangeProductivitySummaryResponse | null;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  periodLabel?: string;
}

function formatDurationSeconds(seconds: number): string {
  if (seconds <= 0) return '0m';
  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function KpiCardGrid({
  summary,
  isLoading = false,
  isError = false,
  onRetry,
  periodLabel = 'period',
}: KpiCardGridProps) {
  if (isLoading) {
    return (
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        data-testid="kpi-grid-skeleton"
      >
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-20 mt-2" />
            <Skeleton className="h-3 w-32 mt-2" />
          </Card>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 p-6" data-testid="kpi-grid-error">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Failed to load productivity metrics</span>
          </div>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
          )}
        </div>
      </Card>
    );
  }

  const completedFocusSeconds = summary?.completedFocusSeconds ?? 0;
  const completedSessions = summary?.completedFocusSessions ?? 0;
  const completionRate = summary?.completionRate ?? 0;
  const breakSeconds = summary?.completedBreakSeconds ?? 0;
  const roundedRate = `${Math.round(completionRate)}%`;

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      data-testid="kpi-card-grid"
    >
      <StatCard
        label="Total Focus Time"
        value={formatDurationSeconds(completedFocusSeconds)}
        description={`Completed focus for ${periodLabel}`}
        icon={Clock}
      />
      <StatCard
        label="Completed Sessions"
        value={completedSessions}
        description={`Target focus blocks completed`}
        icon={CheckCircle2}
      />
      <StatCard
        label="Completion Rate"
        value={roundedRate}
        description={`Focus completed vs abandoned`}
        icon={Percent}
      />
      <StatCard
        label="Break Time"
        value={formatDurationSeconds(breakSeconds)}
        description={`Rest and recovery duration`}
        icon={Coffee}
      />
    </div>
  );
}

'use client';

// src/components/analytics/overview-kpi-grid.tsx
// FocusFlow — Analytics KPI Grid with Period-over-Period Deltas (Phase 9)

import * as React from 'react';
import {
  Clock,
  CheckCircle2,
  CalendarCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { AnalyticsOverviewResponse, AnalyticsComparison } from '@/types/api';

export interface OverviewKpiGridProps {
  overview?: AnalyticsOverviewResponse | null;
  isLoading?: boolean;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0 && minutes === 0) return '0m';
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function DeltaBadge({
  comparison,
  unit = '%',
  isAbsolutePts = false,
  inverse = false,
}: {
  comparison?: AnalyticsComparison;
  unit?: string;
  isAbsolutePts?: boolean;
  inverse?: boolean;
}) {
  if (!comparison) return null;

  const { direction, percentageDelta, absoluteDelta } = comparison;

  if (direction === 'unchanged' || (percentageDelta === 0 && absoluteDelta === 0)) {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-xs text-muted-foreground font-medium"
        data-testid="delta-unchanged"
      >
        <Minus className="h-3 w-3" />
        0{unit} vs prev
      </span>
    );
  }

  const isPositiveDirection = direction === 'up';
  // inverse means "down" is good (e.g. abandoned sessions)
  const isGood = inverse ? !isPositiveDirection : isPositiveDirection;

  let text = '';
  if (isAbsolutePts) {
    text = `${absoluteDelta > 0 ? '+' : ''}${absoluteDelta.toFixed(1)}% pts`;
  } else if (percentageDelta !== null) {
    text = `${percentageDelta > 0 ? '+' : ''}${Math.round(percentageDelta)}%`;
  } else {
    // previous was 0
    text = `+${Math.round(absoluteDelta)} vs 0`;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        isGood
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-rose-600 dark:text-rose-400'
      )}
      data-testid={isPositiveDirection ? 'delta-up' : 'delta-down'}
    >
      {isPositiveDirection ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      <span>{text} vs prev</span>
    </span>
  );
}

export function OverviewKpiGrid({ overview, isLoading }: OverviewKpiGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpi-grid-skeleton">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 w-24 bg-muted rounded mb-3" />
              <div className="h-8 w-20 bg-muted rounded mb-2" />
              <div className="h-3 w-32 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const focusSeconds = overview?.completedFocusSeconds ?? 0;
  const completedSessions = overview?.completedFocusSessions ?? 0;
  const completionRate = overview?.completionRate ?? 0;
  const consistencyRate = overview?.consistencyRate ?? 0;
  const activeFocusDays = overview?.activeFocusDays ?? 0;
  const totalDaysInRange = overview?.totalDaysInRange ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="overview-kpi-grid">
      {/* 1. Total Focus Time */}
      <Card className="overflow-hidden hover:border-border/80 transition-all">
        <CardContent className="p-6">
          <div className="flex items-center justify-between pb-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Focus Time
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {formatDuration(focusSeconds)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <DeltaBadge comparison={overview?.comparisons.focusTime} />
            <span className="text-[11px] text-muted-foreground">
              {overview?.completedFocusMinutes ?? 0}m total
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Completed Sessions */}
      <Card className="overflow-hidden hover:border-border/80 transition-all">
        <CardContent className="p-6">
          <div className="flex items-center justify-between pb-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Completed Blocks
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {completedSessions}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <DeltaBadge comparison={overview?.comparisons.completedSessions} />
            <span className="text-[11px] text-muted-foreground">
              {overview?.totalSessions ?? 0} total started
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 3. Completion Rate */}
      <Card className="overflow-hidden hover:border-border/80 transition-all">
        <CardContent className="p-6">
          <div className="flex items-center justify-between pb-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Completion Rate
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {completionRate.toFixed(1)}%
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <DeltaBadge
              comparison={overview?.comparisons.completionRate}
              isAbsolutePts={true}
            />
            <span className="text-[11px] text-muted-foreground">
              {overview?.abandonedFocusSessions ?? 0} abandoned
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 4. Focus Consistency */}
      <Card className="overflow-hidden hover:border-border/80 transition-all">
        <CardContent className="p-6">
          <div className="flex items-center justify-between pb-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Consistency Rate
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <CalendarCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {consistencyRate.toFixed(1)}%
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xs text-muted-foreground">
              {activeFocusDays} of {totalDaysInRange} days with completed focus
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

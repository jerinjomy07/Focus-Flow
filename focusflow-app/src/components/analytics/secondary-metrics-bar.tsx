'use client';

// src/components/analytics/secondary-metrics-bar.tsx
// FocusFlow — Secondary Session Performance Metrics (Phase 9)

import * as React from 'react';
import { Timer, Award, AlertTriangle, Coffee, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { AnalyticsOverviewResponse, AnalyticsComparison } from '@/types/api';

export interface SecondaryMetricsBarProps {
  overview?: AnalyticsOverviewResponse | null;
  isLoading?: boolean;
}

function formatMinutesOrSeconds(seconds: number): string {
  if (seconds <= 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

function AbandonedDeltaBadge({ comparison }: { comparison?: AnalyticsComparison }) {
  if (!comparison) return null;

  const { direction, percentageDelta, absoluteDelta } = comparison;

  if (direction === 'unchanged' || (percentageDelta === 0 && absoluteDelta === 0)) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground font-medium">
        <Minus className="h-3 w-3" /> 0% vs prev
      </span>
    );
  }

  // Note: For abandoned sessions, an increase is bad (red) and decrease is good (green)
  const isIncrease = direction === 'up';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[11px] font-medium',
        isIncrease ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
      )}
    >
      {isIncrease ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      <span>
        {percentageDelta !== null
          ? `${isIncrease ? '+' : ''}${Math.round(percentageDelta)}%`
          : `+${Math.round(absoluteDelta)}`}{' '}
        vs prev
      </span>
    </span>
  );
}

export function SecondaryMetricsBar({ overview, isLoading }: SecondaryMetricsBarProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="secondary-metrics-skeleton">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse bg-muted/20">
            <CardContent className="p-4">
              <div className="h-3 w-20 bg-muted rounded mb-2" />
              <div className="h-6 w-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const avgSession = overview?.averageCompletedSessionSeconds ?? 0;
  const longestSession = overview?.longestCompletedSessionSeconds ?? 0;
  const abandonedCount = overview?.abandonedFocusSessions ?? 0;
  const breakSeconds = overview?.totalBreakSeconds ?? 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="secondary-metrics-bar">
      {/* 1. Average Session Duration */}
      <Card className="bg-muted/10 border-border/60 hover:border-border transition-all">
        <CardContent className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
            <Timer className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Avg Duration</span>
          </div>
          <p className="text-lg font-bold text-foreground">
            {formatMinutesOrSeconds(avgSession)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">per completed block</p>
        </CardContent>
      </Card>

      {/* 2. Longest Single Session */}
      <Card className="bg-muted/10 border-border/60 hover:border-border transition-all">
        <CardContent className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
            <Award className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-medium">Longest Session</span>
          </div>
          <p className="text-lg font-bold text-foreground">
            {formatMinutesOrSeconds(longestSession)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">single deep focus block</p>
        </CardContent>
      </Card>

      {/* 3. Abandoned Sessions */}
      <Card className="bg-muted/10 border-border/60 hover:border-border transition-all">
        <CardContent className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
            <span className="text-xs font-medium">Abandoned Blocks</span>
          </div>
          <p className="text-lg font-bold text-foreground">{abandonedCount}</p>
          <div className="mt-0.5">
            <AbandonedDeltaBadge comparison={overview?.comparisons.abandonedSessions} />
          </div>
        </CardContent>
      </Card>

      {/* 4. Total Break Time */}
      <Card className="bg-muted/10 border-border/60 hover:border-border transition-all">
        <CardContent className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
            <Coffee className="h-3.5 w-3.5 text-teal-500" />
            <span className="text-xs font-medium">Rest & Breaks</span>
          </div>
          <p className="text-lg font-bold text-foreground">
            {formatMinutesOrSeconds(breakSeconds)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">logged recovery time</p>
        </CardContent>
      </Card>
    </div>
  );
}

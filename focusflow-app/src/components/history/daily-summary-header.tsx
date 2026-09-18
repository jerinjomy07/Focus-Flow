'use client';

// src/components/history/daily-summary-header.tsx
// FocusFlow — Lightweight Daily Productivity Summary Header
// Displays today's key productivity metrics: completed sessions, focus time,
// completion rate, abandoned and skipped counts, with loading skeleton states.

import * as React from 'react';
import { CheckCircle2, Clock, XCircle, Flame } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DailyProductivitySummaryResponse } from '@/types/api';

export interface DailySummaryHeaderProps {
  summary?: DailyProductivitySummaryResponse | null;
  isLoading?: boolean;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

export function DailySummaryHeader({ summary, isLoading = false }: DailySummaryHeaderProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4" data-testid="daily-summary-skeleton">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-4 bg-card/60 backdrop-blur-xs">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const completedSessions = summary?.completedFocusSessions ?? 0;
  const completedMinutes = summary?.completedFocusMinutes ?? 0;
  const abandonedSessions = summary?.abandonedFocusSessions ?? 0;
  const skippedSessions = summary?.skippedFocusSessions ?? 0;
  const completionRate = summary?.completionRate ?? 0;
  // Presentation rounding in UI only
  const formattedRate = `${Math.round(completionRate)}%`;

  return (
    <div className="space-y-3" data-testid="daily-summary-header">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground uppercase tracking-wider">
            Today&apos;s Focus Summary
          </h2>
          <p className="text-xs text-muted-foreground">
            Authoritative session statistics for today in your local timezone
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Focus Time */}
        <Card className="p-4 hover:shadow-xs transition-shadow">
          <CardContent className="p-0 flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Focus Time</p>
              <p className="text-xl font-bold tracking-tight text-foreground" data-testid="summary-focus-time">
                {formatDuration(completedMinutes)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Completed Sessions */}
        <Card className="p-4 hover:shadow-xs transition-shadow">
          <CardContent className="p-0 flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Completed</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold tracking-tight text-foreground" data-testid="summary-completed">
                  {completedSessions}
                </span>
                <span className="text-xs text-muted-foreground">sessions</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Completion Rate */}
        <Card className="p-4 hover:shadow-xs transition-shadow">
          <CardContent className="p-0 flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Completion Rate</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold tracking-tight text-foreground" data-testid="summary-rate">
                  {formattedRate}
                </span>
                <span className="text-xs text-muted-foreground">success</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Abandoned / Skipped */}
        <Card className="p-4 hover:shadow-xs transition-shadow">
          <CardContent className="p-0 flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Abandoned / Skipped</p>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-foreground" data-testid="summary-abandoned">
                  {abandonedSessions} abn
                </span>
                <span className="text-xs text-muted-foreground">/</span>
                <span className="text-sm font-semibold text-foreground" data-testid="summary-skipped">
                  {skippedSessions} skip
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

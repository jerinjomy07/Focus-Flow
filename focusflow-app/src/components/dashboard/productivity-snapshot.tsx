'use client';

// src/components/dashboard/productivity-snapshot.tsx
// FocusFlow — Secondary Productivity Snapshot Metrics Card
// Displays total sessions, break sessions, skipped sessions, and abandoned sessions.

import * as React from 'react';
import { Activity, Coffee, SkipForward, XCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  DailyProductivitySummaryResponse,
  RangeProductivitySummaryResponse,
} from '@/types/api';

export interface ProductivitySnapshotProps {
  summary?: DailyProductivitySummaryResponse | RangeProductivitySummaryResponse | null;
  isLoading?: boolean;
}

export function ProductivitySnapshot({
  summary,
  isLoading = false,
}: ProductivitySnapshotProps) {
  if (isLoading) {
    return (
      <Card className="p-6 space-y-4" data-testid="snapshot-skeleton">
        <Skeleton className="h-5 w-44" />
        <div className="grid grid-cols-2 gap-3 pt-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  const totalSessions = summary?.totalSessions ?? 0;
  const breakSessions = summary?.completedBreakSessions ?? 0;
  const skippedSessions = summary?.skippedFocusSessions ?? 0;
  const abandonedSessions = summary?.abandonedFocusSessions ?? 0;

  const items = [
    {
      label: 'Total Sessions',
      value: totalSessions,
      icon: Activity,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Break Sessions',
      value: breakSessions,
      icon: Coffee,
      color: 'text-secondary-foreground',
      bg: 'bg-secondary',
    },
    {
      label: 'Skipped Focus',
      value: skippedSessions,
      icon: SkipForward,
      color: 'text-muted-foreground',
      bg: 'bg-muted',
    },
    {
      label: 'Abandoned Focus',
      value: abandonedSessions,
      icon: XCircle,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
    },
  ];

  return (
    <Card data-testid="productivity-snapshot">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Session Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card/60 transition-all hover:bg-card"
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-md ${item.bg} ${item.color} shrink-0`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground font-mono">
                    {item.value}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {item.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

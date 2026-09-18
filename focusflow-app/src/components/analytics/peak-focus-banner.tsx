'use client';

// src/components/analytics/peak-focus-banner.tsx
// FocusFlow — Peak Productivity Windows Highlight (Phase 9)

import * as React from 'react';
import { Zap, Sun, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { WeekdayAnalyticsPoint, HourlyAnalyticsPoint } from '@/types/api';

export interface PeakFocusBannerProps {
  peakWeekday: WeekdayAnalyticsPoint | null;
  peakHour: HourlyAnalyticsPoint | null;
  isLoading?: boolean;
}

const WEEKDAY_NAMES: Record<number, string> = {
  0: 'Monday',
  1: 'Tuesday',
  2: 'Wednesday',
  3: 'Thursday',
  4: 'Friday',
  5: 'Saturday',
  6: 'Sunday',
};

function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(hour).padStart(2, '0')}:00 (${displayHour}:00 ${period})`;
}

export function PeakFocusBanner({
  peakWeekday,
  peakHour,
  isLoading,
}: PeakFocusBannerProps) {
  if (isLoading) {
    return (
      <Card className="animate-pulse bg-muted/20 border-border/60" data-testid="peak-banner-skeleton">
        <CardContent className="p-4 sm:p-6">
          <div className="h-6 w-48 bg-muted rounded mb-2" />
          <div className="h-4 w-72 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const hasData = Boolean(peakWeekday || peakHour);

  if (!hasData) {
    return (
      <Card className="border-border/60 bg-muted/20" data-testid="peak-focus-banner-empty">
        <CardContent className="p-4 sm:p-5 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Peak Focus Discovery</h4>
            <p className="text-xs text-muted-foreground">
              Complete verified focus sessions to unlock insights into your most productive days and hours.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="border-primary/20 bg-gradient-to-r from-primary/5 via-primary/[0.02] to-transparent shadow-xs"
      data-testid="peak-focus-banner"
    >
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center gap-2 pb-3 border-b border-border/50 mb-4">
          <Zap className="h-4 w-4 text-primary fill-primary/20" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
            Peak Productivity Insights
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Peak Weekday */}
          <div className="flex items-start gap-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Most Productive Day</p>
              {peakWeekday ? (
                <>
                  <p className="text-base font-bold text-foreground">
                    {WEEKDAY_NAMES[peakWeekday.weekday] ?? peakWeekday.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {peakWeekday.completedFocusMinutes}m of deep work across {peakWeekday.completedSessions}{' '}
                    {peakWeekday.completedSessions === 1 ? 'block' : 'blocks'}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic">No sessions recorded</p>
              )}
            </div>
          </div>

          {/* Peak Hour */}
          <div className="flex items-start gap-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Sun className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Optimal Focus Window</p>
              {peakHour ? (
                <>
                  <p className="text-base font-bold text-foreground">
                    {formatHourLabel(peakHour.hour)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {peakHour.completedFocusMinutes}m focused across {peakHour.completedSessions}{' '}
                    {peakHour.completedSessions === 1 ? 'session' : 'sessions'}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic">No sessions recorded</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

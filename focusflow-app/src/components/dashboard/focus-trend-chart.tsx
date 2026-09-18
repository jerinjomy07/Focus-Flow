'use client';

// src/components/dashboard/focus-trend-chart.tsx
// FocusFlow — Accessible Focus Activity Trend Bar Chart
// Renders daily focus minutes across the active period with zero external charting dependencies.
// Adheres to WAI-ARIA standards (role="img", semantic labels, keyboard tooltips).

import * as React from 'react';
import { BarChart3, AlertCircle, RefreshCw, Calendar } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ProductivityTrendResponse, ProductivityTrendPoint } from '@/types/api';

export interface FocusTrendChartProps {
  trend?: ProductivityTrendResponse | null;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

function formatWeekday(dateStr: string): string {
  // Parse date string without timezone drift
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

function formatShortDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number);
  return `${month}/${day}`;
}

export function FocusTrendChart({
  trend,
  isLoading = false,
  isError = false,
  onRetry,
}: FocusTrendChartProps) {
  const [activePoint, setActivePoint] = React.useState<ProductivityTrendPoint | null>(null);

  if (isLoading) {
    return (
      <Card className="p-6 space-y-4" data-testid="trend-chart-skeleton">
        <div className="flex items-center justify-between pb-2 border-b">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="h-52 flex items-end justify-between gap-2 pt-6">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <Skeleton className="w-full rounded-t-md" style={{ height: `${20 + (i % 3) * 35}%` }} />
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 p-6" data-testid="trend-chart-error">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Failed to load focus trend data</span>
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

  const points = trend?.points ?? [];
  const maxMinutes = Math.max(...points.map((p) => p.focusMinutes), 60);
  const totalMinutes = trend?.totalFocusMinutes ?? 0;
  const isAllZero = points.every((p) => p.focusMinutes === 0);

  return (
    <Card className="overflow-hidden" data-testid="focus-trend-chart">
      <CardHeader className="pb-3 border-b flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Focus Activity Trend
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalMinutes > 0
              ? `${totalMinutes} total focus minutes across ${points.length} days`
              : 'Daily focus duration across active period'}
          </p>
        </div>
        {activePoint && (
          <div className="text-right text-xs bg-muted/60 px-2.5 py-1 rounded-md border text-foreground animate-in fade-in">
            <span className="font-semibold">{activePoint.date}</span>: {activePoint.focusMinutes}m (
            {activePoint.completedSessions} sessions)
          </div>
        )}
      </CardHeader>

      <CardContent className="p-6">
        {points.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-4 text-muted-foreground">
            <Calendar className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No trend data available for this range</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Accessible SVG Bar Visualization */}
            <div
              role="img"
              aria-label={`Focus activity chart from ${trend?.startDate} to ${trend?.endDate}. Total focus: ${totalMinutes} minutes.`}
              className="h-52 flex items-end justify-between gap-1.5 sm:gap-3 pt-6 px-1 relative"
            >
              {/* Background Reference Lines */}
              <div className="absolute inset-x-0 top-6 border-b border-dashed border-border/40" />
              <div className="absolute inset-x-0 top-1/2 border-b border-dashed border-border/40" />

              {points.map((pt) => {
                const heightPercent = maxMinutes > 0 ? (pt.focusMinutes / maxMinutes) * 100 : 0;
                const isHovered = activePoint?.date === pt.date;
                const isMonth = points.length > 14;
                const label = isMonth ? formatShortDate(pt.date) : formatWeekday(pt.date);

                return (
                  <div
                    key={pt.date}
                    className="flex-1 h-full flex flex-col items-center justify-end group relative cursor-pointer"
                    onMouseEnter={() => setActivePoint(pt)}
                    onMouseLeave={() => setActivePoint(null)}
                    onFocus={() => setActivePoint(pt)}
                    onBlur={() => setActivePoint(null)}
                    tabIndex={0}
                    aria-label={`${pt.date}: ${pt.focusMinutes} focus minutes, ${pt.completedSessions} completed sessions`}
                  >
                    {/* Bar Column */}
                    <div className="w-full flex items-end justify-center h-40">
                      <div
                        className={cn(
                          'w-full max-w-[36px] rounded-t-sm transition-all duration-200',
                          pt.focusMinutes > 0
                            ? isHovered
                              ? 'bg-primary'
                              : 'bg-primary/80 group-hover:bg-primary'
                            : 'bg-muted/40 h-1'
                        )}
                        style={{
                          height: pt.focusMinutes > 0 ? `${Math.max(heightPercent, 5)}%` : '2px',
                        }}
                      />
                    </div>

                    {/* Bottom Label */}
                    <span
                      className={cn(
                        'text-[10px] mt-2 font-medium tracking-tight truncate w-full text-center transition-colors',
                        isHovered
                          ? 'text-foreground font-bold'
                          : 'text-muted-foreground group-hover:text-foreground'
                      )}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Empty state alert when all 0 */}
            {isAllZero && (
              <p className="text-center text-xs text-muted-foreground italic pt-2">
                No focus sessions completed yet in this period. Launch the timer to start your trend.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

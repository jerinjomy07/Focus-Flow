'use client';

// src/components/analytics/weekday-distribution-chart.tsx
// FocusFlow — Accessible SVG Weekday Focus Distribution Chart (Phase 9)

import * as React from 'react';
import { BarChart2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { WeekdayAnalyticsPoint } from '@/types/api';

export interface WeekdayDistributionChartProps {
  weekdayData?: WeekdayAnalyticsPoint[];
  peakWeekday?: WeekdayAnalyticsPoint | null;
  isLoading?: boolean;
}

export function WeekdayDistributionChart({
  weekdayData = [],
  peakWeekday,
  isLoading,
}: WeekdayDistributionChartProps) {
  const [hoveredDay, setHoveredDay] = React.useState<WeekdayAnalyticsPoint | null>(null);

  if (isLoading) {
    return (
      <Card className="animate-pulse" data-testid="weekday-chart-skeleton">
        <CardHeader className="pb-2">
          <div className="h-5 w-40 bg-muted rounded" />
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-56 bg-muted/30 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const maxMinutes = Math.max(
    1,
    ...weekdayData.map((d) => d.completedFocusMinutes)
  );

  const hasAnyData = weekdayData.some((d) => d.completedFocusSeconds > 0);

  return (
    <Card className="flex flex-col" data-testid="weekday-distribution-chart">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Weekday Distribution</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground font-medium">Minutes focused</span>
        </div>
      </CardHeader>
      <CardContent className="pt-2 flex-1 flex flex-col justify-end">
        {!hasAnyData ? (
          <div className="h-56 flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/10 p-6 text-center">
            <BarChart2 className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium text-foreground">No weekday focus data</p>
            <p className="text-xs text-muted-foreground max-w-xs mt-1">
              Sessions logged in this interval will be aggregated by day of the week.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* SVG Chart Container */}
            <div className="relative h-48 w-full">
              <svg
                viewBox="0 0 350 160"
                className="h-full w-full overflow-visible"
                role="img"
                aria-label="Bar chart showing focus minutes per day of week"
              >
                {/* Background horizontal gridlines */}
                <line x1="0" y1="20" x2="350" y2="20" stroke="currentColor" strokeDasharray="3 3" className="text-border/40" />
                <line x1="0" y1="70" x2="350" y2="70" stroke="currentColor" strokeDasharray="3 3" className="text-border/40" />
                <line x1="0" y1="120" x2="350" y2="120" stroke="currentColor" strokeDasharray="3 3" className="text-border/40" />

                {/* 7 Bars (Mon..Sun) */}
                {weekdayData.map((d, index) => {
                  const barWidth = 32;
                  const gap = 16;
                  const x = index * (barWidth + gap) + 10;
                  const isPeak = peakWeekday?.weekday === d.weekday && d.completedFocusMinutes > 0;
                  const barHeight = Math.round((d.completedFocusMinutes / maxMinutes) * 100);
                  const clampedHeight = Math.max(d.completedFocusMinutes > 0 ? 4 : 1, barHeight);
                  const y = 120 - clampedHeight;

                  return (
                    <g
                      key={d.weekday}
                      className="cursor-pointer group"
                      onMouseEnter={() => setHoveredDay(d)}
                      onMouseLeave={() => setHoveredDay(null)}
                      tabIndex={0}
                      role="graphics-symbol"
                      aria-label={`${d.label}: ${d.completedFocusMinutes} minutes, ${d.completedSessions} sessions`}
                    >
                      {/* Bar */}
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={clampedHeight}
                        rx="4"
                        className={cn(
                          'transition-all duration-200',
                          isPeak
                            ? 'fill-primary'
                            : d.completedFocusMinutes > 0
                            ? 'fill-primary/60 hover:fill-primary/80'
                            : 'fill-muted/40'
                        )}
                      />

                      {/* Value label on top of bar if active */}
                      {d.completedFocusMinutes > 0 && (
                        <text
                          x={x + barWidth / 2}
                          y={y - 5}
                          textAnchor="middle"
                          className="text-[10px] fill-muted-foreground font-semibold"
                        >
                          {d.completedFocusMinutes}m
                        </text>
                      )}

                      {/* Day Label */}
                      <text
                        x={x + barWidth / 2}
                        y="140"
                        textAnchor="middle"
                        className={cn(
                          'text-[11px] font-medium transition-colors',
                          isPeak
                            ? 'fill-primary font-bold'
                            : 'fill-muted-foreground group-hover:fill-foreground'
                        )}
                      >
                        {d.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Hover details summary bar */}
            <div className="h-6 flex items-center justify-between text-xs px-2 rounded bg-muted/20">
              {hoveredDay ? (
                <>
                  <span className="font-semibold text-foreground">{hoveredDay.label}</span>
                  <span className="text-muted-foreground">
                    {hoveredDay.completedFocusMinutes}m focused ({hoveredDay.completedSessions}{' '}
                    {hoveredDay.completedSessions === 1 ? 'session' : 'sessions'})
                  </span>
                </>
              ) : peakWeekday && peakWeekday.completedFocusMinutes > 0 ? (
                <>
                  <span className="text-muted-foreground">Peak Day:</span>
                  <span className="font-semibold text-primary">
                    {peakWeekday.label} ({peakWeekday.completedFocusMinutes}m)
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Hover over any day to inspect details</span>
              )}
            </div>

            {/* Screen reader accessible fallback table */}
            <div className="sr-only">
              <table>
                <caption>Focus time by day of the week</caption>
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Minutes</th>
                    <th>Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {weekdayData.map((d) => (
                    <tr key={d.weekday}>
                      <td>{d.label}</td>
                      <td>{d.completedFocusMinutes}</td>
                      <td>{d.completedSessions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

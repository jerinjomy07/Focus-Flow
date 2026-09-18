'use client';

// src/components/analytics/hourly-distribution-chart.tsx
// FocusFlow — Accessible SVG 24-Hour Productivity Histogram (Phase 9)

import * as React from 'react';
import { Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { HourlyAnalyticsPoint } from '@/types/api';

export interface HourlyDistributionChartProps {
  hourlyData?: HourlyAnalyticsPoint[];
  peakHour?: HourlyAnalyticsPoint | null;
  isLoading?: boolean;
}

export function HourlyDistributionChart({
  hourlyData = [],
  peakHour,
  isLoading,
}: HourlyDistributionChartProps) {
  const [hoveredHour, setHoveredHour] = React.useState<HourlyAnalyticsPoint | null>(null);

  if (isLoading) {
    return (
      <Card className="animate-pulse" data-testid="hourly-chart-skeleton">
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
    ...hourlyData.map((d) => d.completedFocusMinutes)
  );

  const hasAnyData = hourlyData.some((d) => d.completedFocusSeconds > 0);

  return (
    <Card className="flex flex-col" data-testid="hourly-distribution-chart">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">24-Hour Focus Rhythm</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground font-medium">Time of day</span>
        </div>
      </CardHeader>
      <CardContent className="pt-2 flex-1 flex flex-col justify-end">
        {!hasAnyData ? (
          <div className="h-56 flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/10 p-6 text-center">
            <Clock className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium text-foreground">No hourly activity recorded</p>
            <p className="text-xs text-muted-foreground max-w-xs mt-1">
              Complete sessions at different times to see your energy and focus peaks across the day.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* SVG Chart Container */}
            <div className="relative h-48 w-full">
              <svg
                viewBox="0 0 480 160"
                className="h-full w-full overflow-visible"
                role="img"
                aria-label="Histogram showing focus minutes across 24 hours of the day"
              >
                {/* Background horizontal gridlines */}
                <line x1="0" y1="20" x2="480" y2="20" stroke="currentColor" strokeDasharray="3 3" className="text-border/40" />
                <line x1="0" y1="70" x2="480" y2="70" stroke="currentColor" strokeDasharray="3 3" className="text-border/40" />
                <line x1="0" y1="120" x2="480" y2="120" stroke="currentColor" strokeDasharray="3 3" className="text-border/40" />

                {/* 24 Bars (00:00 to 23:00) */}
                {hourlyData.map((d) => {
                  const barWidth = 14;
                  const gap = 5.5;
                  const x = d.hour * (barWidth + gap) + 6;
                  const isPeak = peakHour?.hour === d.hour && d.completedFocusMinutes > 0;
                  const barHeight = Math.round((d.completedFocusMinutes / maxMinutes) * 100);
                  const clampedHeight = Math.max(d.completedFocusMinutes > 0 ? 3 : 1, barHeight);
                  const y = 120 - clampedHeight;

                  return (
                    <g
                      key={d.hour}
                      className="cursor-pointer group"
                      onMouseEnter={() => setHoveredHour(d)}
                      onMouseLeave={() => setHoveredHour(null)}
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
                        rx="2"
                        className={cn(
                          'transition-all duration-150',
                          isPeak
                            ? 'fill-amber-500'
                            : d.completedFocusMinutes > 0
                            ? 'fill-primary/60 hover:fill-primary'
                            : 'fill-muted/30'
                        )}
                      />
                    </g>
                  );
                })}

                {/* Key X-Axis Interval Labels (00:00, 06:00, 12:00, 18:00, 23:00) */}
                {[0, 6, 12, 18, 23].map((hr) => {
                  const barWidth = 14;
                  const gap = 5.5;
                  const x = hr * (barWidth + gap) + 6 + barWidth / 2;
                  const label = `${String(hr).padStart(2, '0')}:00`;

                  return (
                    <text
                      key={hr}
                      x={x}
                      y="140"
                      textAnchor="middle"
                      className="text-[10px] fill-muted-foreground font-medium"
                    >
                      {label}
                    </text>
                  );
                })}
              </svg>
            </div>

            {/* Hover details summary bar */}
            <div className="h-6 flex items-center justify-between text-xs px-2 rounded bg-muted/20">
              {hoveredHour ? (
                <>
                  <span className="font-semibold text-foreground">{hoveredHour.label}</span>
                  <span className="text-muted-foreground">
                    {hoveredHour.completedFocusMinutes}m focused ({hoveredHour.completedSessions}{' '}
                    {hoveredHour.completedSessions === 1 ? 'session' : 'sessions'})
                  </span>
                </>
              ) : peakHour && peakHour.completedFocusMinutes > 0 ? (
                <>
                  <span className="text-muted-foreground">Peak Window:</span>
                  <span className="font-semibold text-amber-500">
                    {peakHour.label} ({peakHour.completedFocusMinutes}m)
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Hover over any bar to inspect hourly focus</span>
              )}
            </div>

            {/* Screen reader accessible fallback table */}
            <div className="sr-only">
              <table>
                <caption>Focus minutes by hour of the day</caption>
                <thead>
                  <tr>
                    <th>Hour</th>
                    <th>Minutes</th>
                    <th>Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {hourlyData.map((d) => (
                    <tr key={d.hour}>
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

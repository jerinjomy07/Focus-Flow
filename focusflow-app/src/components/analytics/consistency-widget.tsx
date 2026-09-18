'use client';

// src/components/analytics/consistency-widget.tsx
// FocusFlow — Factual Consistency Meter (Phase 9)
// Purely descriptive and deterministic — no qualitative habit tiers, scoring, or judgment.

import * as React from 'react';
import { CalendarCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export interface ConsistencyWidgetProps {
  activeFocusDays?: number;
  totalDaysInRange?: number;
  consistencyRate?: number;
  isLoading?: boolean;
}

export function ConsistencyWidget({
  activeFocusDays = 0,
  totalDaysInRange = 0,
  consistencyRate = 0,
  isLoading,
}: ConsistencyWidgetProps) {
  if (isLoading) {
    return (
      <Card className="animate-pulse" data-testid="consistency-widget-skeleton">
        <CardHeader className="pb-2">
          <div className="h-5 w-36 bg-muted rounded" />
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-6 w-20 bg-muted rounded mb-3" />
          <div className="h-3 w-full bg-muted/40 rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="consistency-widget">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Focus Consistency</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground font-mono" data-testid="consistency-ratio">
            {activeFocusDays} / {totalDaysInRange} active focus days
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-2 space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold text-foreground" data-testid="consistency-percentage">
            {consistencyRate.toFixed(1)}%
          </span>
          <span className="text-xs text-muted-foreground font-medium">
            {activeFocusDays} of {totalDaysInRange} calendar days
          </span>
        </div>

        {/* Deterministic Meter Bar */}
        <div className="h-2.5 w-full rounded-full bg-muted/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, consistencyRate))}%` }}
            role="progressbar"
            aria-valuenow={consistencyRate}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Focus consistency percentage"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Calculated as active local calendar days containing at least one verified completed focus block out of total calendar days in the selected range.
        </p>
      </CardContent>
    </Card>
  );
}

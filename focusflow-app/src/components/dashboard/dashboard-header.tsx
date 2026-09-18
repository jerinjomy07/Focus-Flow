'use client';

// src/components/dashboard/dashboard-header.tsx
// FocusFlow — Dashboard Page Header & Period Filter Toolbar
// Supports predefined periods (today, yesterday, week, month) and accessible custom date ranges.

import * as React from 'react';
import Link from 'next/link';
import { Play, Calendar, AlertCircle, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type DashboardPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export interface DashboardHeaderProps {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (date: string) => void;
  onEndDateChange?: (date: string) => void;
  dateError?: string | null;
  onResetCustomRange?: () => void;
}

const PERIOD_OPTIONS: Array<{ value: DashboardPeriod; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom Range' },
];

export function DashboardHeader({
  period,
  onPeriodChange,
  startDate = '',
  endDate = '',
  onStartDateChange,
  onEndDateChange,
  dateError,
  onResetCustomRange,
}: DashboardHeaderProps) {
  return (
    <div className="space-y-4" data-testid="dashboard-header">
      <PageHeader
        title="Dashboard"
        description="Overview of your focus blocks, project allocations, and daily productivity trends."
      >
        <Link href="/focus">
          <Button size="sm" className="font-semibold shadow-xs">
            <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
            Start Focus Session
          </Button>
        </Link>
      </PageHeader>

      {/* Period Selection Tabs */}
      <div className="space-y-3 border-b pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Productivity period filter"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground flex-wrap"
          >
            {PERIOD_OPTIONS.map((opt) => {
              const isSelected = period === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => onPeriodChange(opt.value)}
                  className={cn(
                    'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium ring-offset-background transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
                    isSelected
                      ? 'bg-background text-foreground shadow-xs'
                      : 'hover:text-foreground'
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Quick indicator when custom range is active */}
          {period === 'custom' && startDate && endDate && !dateError && (
            <span className="text-xs text-muted-foreground font-mono">
              {startDate} → {endDate}
            </span>
          )}
        </div>

        {/* Custom Date Range Picker Sub-Bar */}
        {period === 'custom' && (
          <div
            className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/40"
            data-testid="custom-date-controls"
          >
            <div className="flex items-center gap-2">
              <label
                htmlFor="dashboard-start-date"
                className="text-xs text-muted-foreground font-medium flex items-center gap-1 shrink-0"
              >
                <Calendar className="h-3.5 w-3.5" /> From:
              </label>
              <Input
                id="dashboard-start-date"
                type="date"
                className="h-8 text-xs w-36"
                value={startDate}
                onChange={(e) => onStartDateChange?.(e.target.value)}
                aria-label="Start date"
                error={Boolean(dateError)}
              />
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="dashboard-end-date"
                className="text-xs text-muted-foreground font-medium shrink-0"
              >
                To:
              </label>
              <Input
                id="dashboard-end-date"
                type="date"
                className="h-8 text-xs w-36"
                value={endDate}
                onChange={(e) => onEndDateChange?.(e.target.value)}
                aria-label="End date"
                error={Boolean(dateError)}
              />
            </div>

            {onResetCustomRange && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={onResetCustomRange}
                aria-label="Reset custom range"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset Range
              </Button>
            )}

            {/* Validation Error Message */}
            {dateError && (
              <div
                role="alert"
                className="flex items-center gap-1.5 text-xs text-destructive font-medium w-full sm:w-auto"
                data-testid="custom-date-error"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{dateError}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

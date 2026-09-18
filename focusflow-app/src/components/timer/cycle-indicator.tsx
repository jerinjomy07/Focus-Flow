'use client';

// src/components/timer/cycle-indicator.tsx
// FocusFlow — Pomodoro Cycle Progress Indicator
// Visually shows completed pomodoro sessions within the current cycle before a long break.

import * as React from 'react';
import type { SessionType, TimerState } from '@/types/domain';
import { cn } from '@/lib/utils';

interface CycleIndicatorProps {
  completedTodayCount: number;
  sessionsBeforeLongBreak?: number;
  currentType: SessionType;
  timerState: TimerState;
  className?: string;
}

export function CycleIndicator({
  completedTodayCount,
  sessionsBeforeLongBreak = 4,
  currentType,
  timerState,
  className,
}: CycleIndicatorProps) {
  const total = Math.max(1, sessionsBeforeLongBreak);
  const completedInCycle = completedTodayCount % total;

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div
        className="flex items-center gap-1.5"
        role="group"
        aria-label={`Pomodoro cycle: ${completedInCycle} of ${total} focus sessions completed`}
      >
        {Array.from({ length: total }, (_, i) => {
          const isDone = i < completedInCycle;
          const isCurrent = i === completedInCycle && currentType === 'FOCUS';

          return (
            <div
              key={i}
              className={cn(
                'h-2 w-8 sm:w-10 rounded-full transition-all duration-200 border',
                isDone
                  ? 'bg-primary border-primary/80 shadow-xs'
                  : isCurrent
                  ? timerState === 'RUNNING'
                    ? 'bg-primary/50 border-primary animate-pulse'
                    : timerState === 'PAUSED'
                    ? 'bg-amber-500/50 border-amber-500'
                    : 'bg-primary/20 border-primary/40'
                  : 'bg-muted border-border/40'
              )}
              title={
                isDone
                  ? `Session ${i + 1} completed`
                  : isCurrent
                  ? `Session ${i + 1} in progress`
                  : `Session ${i + 1} pending`
              }
            />
          );
        })}
      </div>
      <p className="text-2xs font-medium text-muted-foreground uppercase tracking-wider">
        {currentType === 'FOCUS'
          ? `Focus Block ${completedInCycle + 1} of ${total}`
          : currentType === 'SHORT_BREAK'
          ? 'Short Break'
          : 'Long Break'}
        {completedTodayCount > 0 && ` • 🍅 ${completedTodayCount} today`}
      </p>
    </div>
  );
}

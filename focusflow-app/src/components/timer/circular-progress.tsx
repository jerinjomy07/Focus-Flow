'use client';

// src/components/timer/circular-progress.tsx
// FocusFlow — SVG Circular Progress Ring & Monospace Countdown
// Smooth mathematical progress animation driven by pure elapsed percentage.

import * as React from 'react';
import type { SessionType, TimerState } from '@/types/domain';
import { cn } from '@/lib/utils';

interface CircularProgressProps {
  progressPercent: number; // 0 to 100
  timeFormatted: string; // e.g. "24:59"
  sessionType: SessionType;
  timerState: TimerState;
  size?: number;
  className?: string;
}

export function CircularProgress({
  progressPercent,
  timeFormatted,
  sessionType,
  timerState,
  size = 300,
  className,
}: CircularProgressProps) {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Invert dash offset so ring fills up clockwise as time elapses
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  // Color theme per session type
  const strokeColor =
    sessionType === 'FOCUS'
      ? 'stroke-primary'
      : sessionType === 'SHORT_BREAK'
      ? 'stroke-emerald-500'
      : 'stroke-sky-500';

  const glowColor =
    sessionType === 'FOCUS'
      ? 'drop-shadow-[0_0_12px_rgba(99,102,241,0.35)]'
      : sessionType === 'SHORT_BREAK'
      ? 'drop-shadow-[0_0_12px_rgba(16,185,129,0.35)]'
      : 'drop-shadow-[0_0_12px_rgba(14,165,233,0.35)]';

  const stateLabel =
    timerState === 'IDLE'
      ? 'Ready to focus'
      : timerState === 'RUNNING'
      ? sessionType === 'FOCUS'
        ? 'Deep Focus'
        : 'Rest & Recharge'
      : timerState === 'PAUSED'
      ? 'Paused'
      : timerState === 'COMPLETED'
      ? 'Session Complete!'
      : timerState === 'SKIPPED'
      ? 'Skipped'
      : 'Reset';

  return (
    <div
      className={cn(
        'relative flex items-center justify-center select-none',
        className
      )}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${sessionType} timer: ${timeFormatted} remaining`}
    >
      <svg
        className="transform -rotate-90 origin-center"
        width={size}
        height={size}
        aria-hidden="true"
      >
        {/* Background track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-muted/50 dark:stroke-muted/30"
          strokeWidth={strokeWidth}
        />

        {/* Dynamic progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={cn(
            strokeColor,
            timerState === 'RUNNING' && glowColor,
            'transition-[stroke-dashoffset] duration-150 ease-linear'
          )}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>

      {/* Centered Digital Countdown & Status */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
        <span className="font-mono text-5xl sm:text-6xl font-bold tracking-tight text-foreground tabular-nums drop-shadow-xs">
          {timeFormatted}
        </span>
        <span
          className={cn(
            'text-xs font-semibold uppercase tracking-widest mt-2.5 transition-colors',
            timerState === 'PAUSED'
              ? 'text-amber-500 animate-pulse font-bold'
              : timerState === 'COMPLETED'
              ? 'text-emerald-500 font-bold'
              : 'text-muted-foreground'
          )}
          aria-live="polite"
        >
          {stateLabel}
        </span>
      </div>
    </div>
  );
}

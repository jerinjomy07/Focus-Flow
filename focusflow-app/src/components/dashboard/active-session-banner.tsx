'use client';

// src/components/dashboard/active-session-banner.tsx
// FocusFlow — Active Focus Session Detection Banner
// Detects in-progress focus/break sessions and offers one-click resumption to /focus.
// If idle, renders the quick-start focus invitation.

import * as React from 'react';
import Link from 'next/link';
import { Timer, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { ActiveSessionResponse } from '@/types/api';

export interface ActiveSessionBannerProps {
  activeSession?: ActiveSessionResponse | null;
  isLoading?: boolean;
}

export function ActiveSessionBanner({
  activeSession,
  isLoading = false,
}: ActiveSessionBannerProps) {
  if (isLoading) {
    return (
      <Card className="border-border/60 bg-card/60 p-6" data-testid="active-session-banner-skeleton">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </Card>
    );
  }

  // State 1: An active session is currently running
  if (activeSession) {
    const isBreak = activeSession.type !== 'FOCUS';
    const typeLabel =
      activeSession.type === 'FOCUS'
        ? 'Focus Session'
        : activeSession.type === 'SHORT_BREAK'
        ? 'Short Break'
        : 'Long Break';

    return (
      <Card
        className="border-primary/40 bg-primary/10 shadow-xs transition-all"
        data-testid="active-session-banner-running"
      >
        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <Timer className="h-5 w-5 animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">
                  {typeLabel} in Progress
                </h3>
                <Badge variant={isBreak ? 'secondary' : 'default'} className="text-[10px] px-1.5 py-0">
                  Active
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                {activeSession.project && (
                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: activeSession.project.color }}
                    />
                    {activeSession.project.name}
                  </span>
                )}
                {activeSession.task && (
                  <span className="truncate max-w-[200px]">
                    • {activeSession.task.title}
                  </span>
                )}
                <span>
                  • Planned: {Math.round(activeSession.plannedDuration / 60)}m
                </span>
              </div>
            </div>
          </div>
          <Link href="/focus">
            <Button size="sm" className="font-semibold shadow-xs">
              Resume Session
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // State 2: No active session — quick start invitation
  return (
    <Card
      className="border-primary/20 bg-primary/5 hover:border-primary/30 transition-all"
      data-testid="active-session-banner-idle"
    >
      <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
            <Timer className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Ready to enter deep work?
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Standard Pomodoro: 25 minutes focus, followed by a 5-minute break.
            </p>
          </div>
        </div>
        <Link href="/focus">
          <Button size="sm" variant="outline">
            Launch Timer
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

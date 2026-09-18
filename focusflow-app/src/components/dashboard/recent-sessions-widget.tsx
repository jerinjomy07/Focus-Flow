'use client';

// src/components/dashboard/recent-sessions-widget.tsx
// FocusFlow — Recent Focus Sessions Dashboard Widget
// Displays the 5 most recent focus sessions with status, project tags, duration, and link to /history.

import * as React from 'react';
import Link from 'next/link';
import { History, ArrowRight, Timer, AlertCircle, RefreshCw, Plus } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { SessionResponse } from '@/types/api';

export interface RecentSessionsWidgetProps {
  sessions?: SessionResponse[] | null;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

function formatSessionDuration(actualSeconds: number | null, plannedSeconds: number): string {
  const sec = actualSeconds ?? plannedSeconds;
  const mins = Math.max(1, Math.round(sec / 60));
  return `${mins}m`;
}

function formatSessionTime(dateString: string | Date): string {
  const d = new Date(dateString);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatSessionDate(dateString: string | Date): string {
  const d = new Date(dateString);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function RecentSessionsWidget({
  sessions,
  isLoading = false,
  isError = false,
  onRetry,
}: RecentSessionsWidgetProps) {
  if (isLoading) {
    return (
      <Card className="p-6 space-y-4" data-testid="recent-sessions-skeleton">
        <div className="flex items-center justify-between pb-2 border-b">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="space-y-3 pt-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-card/60">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-md" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 p-6" data-testid="recent-sessions-error">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Failed to load recent sessions</span>
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

  const list = sessions ?? [];

  return (
    <Card className="overflow-hidden" data-testid="recent-sessions-widget">
      <CardHeader className="pb-3 border-b flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          Recent Focus Sessions
        </CardTitle>
        <Link href="/history">
          <Button variant="ghost" size="sm" className="text-xs h-8">
            View full history
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>

      <CardContent className="p-6">
        {list.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3 text-muted-foreground">
            <Timer className="h-8 w-8 opacity-40" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No sessions recorded</p>
              <p className="text-xs">Start your first focus session to track your deep work.</p>
            </div>
            <Link href="/focus">
              <Button size="sm" variant="outline">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Start Session
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {list.map((session) => {
              const isFocus = session.type === 'FOCUS';
              const isCompleted = session.status === 'COMPLETED';
              const isAbandoned = session.status === 'ABANDONED';

              const statusBadgeVariant = isCompleted
                ? 'default'
                : isAbandoned
                ? 'destructive'
                : 'secondary';

              return (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card/60 hover:bg-card transition-all gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0 font-medium text-xs">
                      {formatSessionDuration(session.actualDuration, session.plannedDuration)}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Badge variant={isFocus ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0 shrink-0">
                          {isFocus ? 'Focus' : 'Break'}
                        </Badge>
                        <span className="text-xs font-medium text-foreground truncate">
                          {session.project?.name ?? 'Unassigned'}
                        </span>
                        <span className="text-xs text-muted-foreground truncate max-w-[160px] hidden sm:inline">
                          • {session.task?.title ?? 'No Task'}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <span>{formatSessionDate(session.startedAt)}</span>
                        <span>at</span>
                        <span>{formatSessionTime(session.startedAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <Badge variant={statusBadgeVariant} className="text-[10px] px-1.5 py-0 capitalize">
                      {session.status.toLowerCase()}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

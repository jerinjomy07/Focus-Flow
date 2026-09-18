'use client';

// src/components/history/session-cards.tsx
// FocusFlow — Mobile Compact Session History Cards View
// Designed for touch devices with 48px+ tap targets, clear badges, and quick inspection.

import * as React from 'react';
import { Clock, Calendar, CheckSquare, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { SessionResponse } from '@/types/api';

export interface SessionCardsProps {
  sessions: SessionResponse[];
  onSelectSession: (session: SessionResponse) => void;
  isLoading?: boolean;
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds === 0) return '0m';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function formatStartTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'COMPLETED':
      return <Badge variant="success" className="text-[10px] px-2 py-0.5">Completed</Badge>;
    case 'ABANDONED':
      return <Badge variant="destructive" className="text-[10px] px-2 py-0.5">Abandoned</Badge>;
    case 'SKIPPED':
      return <Badge variant="secondary" className="text-[10px] px-2 py-0.5">Skipped</Badge>;
    case 'IN_PROGRESS':
      return <Badge variant="warning" className="text-[10px] px-2 py-0.5">In Progress</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px] px-2 py-0.5">{status}</Badge>;
  }
}

function getTypeBadge(type: string) {
  switch (type) {
    case 'FOCUS':
      return <Badge variant="default" className="text-[10px] px-2 py-0.5">Focus</Badge>;
    case 'SHORT_BREAK':
      return <Badge variant="secondary" className="text-[10px] px-2 py-0.5">Short Break</Badge>;
    case 'LONG_BREAK':
      return <Badge variant="secondary" className="text-[10px] px-2 py-0.5">Long Break</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px] px-2 py-0.5">{type}</Badge>;
  }
}

export function SessionCards({
  sessions,
  onSelectSession,
  isLoading = false,
}: SessionCardsProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 md:hidden" data-testid="session-cards-skeleton">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-40" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 md:hidden" data-testid="session-cards">
      {sessions.map((session) => (
        <Card
          key={session.id}
          onClick={() => onSelectSession(session)}
          className="p-4 cursor-pointer hover:border-primary/50 transition-colors active:scale-[0.99] touch-manipulation min-h-[56px]"
          data-testid={`session-card-${session.id}`}
        >
          <CardContent className="p-0 space-y-2.5">
            {/* Header: Type and Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getTypeBadge(session.type)}
                {getStatusBadge(session.status)}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Task & Project */}
            <div>
              {session.task ? (
                <p className="font-semibold text-sm text-foreground flex items-center gap-1.5 truncate">
                  <CheckSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {session.task.title}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground italic">No Task</p>
              )}

              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                {session.project ? (
                  <>
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: session.project.color || '#6366f1' }}
                    />
                    <span className="truncate">{session.project.name}</span>
                  </>
                ) : (
                  <span className="italic">Unassigned</span>
                )}
              </div>
            </div>

            {/* Timing Footer */}
            <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatStartTime(session.startedAt)}
              </span>
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {formatDuration(session.actualDuration)}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

'use client';

// src/components/history/session-table.tsx
// FocusFlow — Responsive Desktop Session History Table
// Renders tabular session history with type/status badges, task attribution (or 'No Task'),
// project attribution (or 'Unassigned'), formatted durations, and inspection trigger.

import * as React from 'react';
import { Eye, Clock, Calendar, CheckSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { SessionResponse } from '@/types/api';

export interface SessionTableProps {
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
      return <Badge variant="success">Completed</Badge>;
    case 'ABANDONED':
      return <Badge variant="destructive">Abandoned</Badge>;
    case 'SKIPPED':
      return <Badge variant="secondary">Skipped</Badge>;
    case 'IN_PROGRESS':
      return <Badge variant="warning">In Progress</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getTypeBadge(type: string) {
  switch (type) {
    case 'FOCUS':
      return <Badge variant="default">Focus</Badge>;
    case 'SHORT_BREAK':
      return <Badge variant="secondary">Short Break</Badge>;
    case 'LONG_BREAK':
      return <Badge variant="secondary">Long Break</Badge>;
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
}

export function SessionTable({
  sessions,
  onSelectSession,
  isLoading = false,
}: SessionTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2" data-testid="session-table-skeleton">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border border-border/40 p-3 bg-card/40"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="hidden md:block rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" data-testid="session-table">
          <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <tr>
              <th scope="col" className="py-3 px-4">Type</th>
              <th scope="col" className="py-3 px-4">Status</th>
              <th scope="col" className="py-3 px-4">Task / Project</th>
              <th scope="col" className="py-3 px-4">Started</th>
              <th scope="col" className="py-3 px-4">Duration</th>
              <th scope="col" className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sessions.map((session) => (
              <tr
                key={session.id}
                onClick={() => onSelectSession(session)}
                className="hover:bg-muted/50 cursor-pointer transition-colors group"
                data-testid={`session-row-${session.id}`}
              >
                {/* Type */}
                <td className="py-3 px-4 whitespace-nowrap">
                  {getTypeBadge(session.type)}
                </td>

                {/* Status */}
                <td className="py-3 px-4 whitespace-nowrap">
                  {getStatusBadge(session.status)}
                </td>

                {/* Task / Project */}
                <td className="py-3 px-4 max-w-xs">
                  <div className="flex flex-col">
                    {session.task ? (
                      <span className="font-medium text-foreground truncate flex items-center gap-1.5" title={session.task.title}>
                        <CheckSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {session.task.title}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        No Task
                      </span>
                    )}

                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
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
                </td>

                {/* Started At */}
                <td className="py-3 px-4 whitespace-nowrap text-muted-foreground text-xs">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{formatStartTime(session.startedAt)}</span>
                  </div>
                </td>

                {/* Actual Duration */}
                <td className="py-3 px-4 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium text-foreground">
                      {formatDuration(session.actualDuration)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      / {formatDuration(session.plannedDuration)}
                    </span>
                  </div>
                </td>

                {/* Actions */}
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-xs text-muted-foreground group-hover:text-foreground gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSession(session);
                    }}
                    aria-label={`Inspect session ${session.id}`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Inspect</span>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';

// src/components/history/session-detail-modal.tsx
// FocusFlow — Accessible Session Detail Inspection Modal
// Provides complete breakdown of a session: timing, outcome, paused time,
// linked task, linked project (with Unassigned fallback), and status badges.

import * as React from 'react';
import { Clock, Calendar, CheckSquare, FolderKanban, PauseCircle, Timer } from 'lucide-react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { SessionResponse } from '@/types/api';

export interface SessionDetailModalProps {
  session: SessionResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatSeconds(seconds: number | null | undefined): string {
  if (seconds == null) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
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
      return <Badge variant="default">Focus Session</Badge>;
    case 'SHORT_BREAK':
      return <Badge variant="secondary">Short Break</Badge>;
    case 'LONG_BREAK':
      return <Badge variant="secondary">Long Break</Badge>;
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
}

export function SessionDetailModal({
  session,
  open,
  onOpenChange,
}: SessionDetailModalProps) {
  if (!session) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="flex items-center justify-between pr-6">
          <DialogTitle className="text-xl font-bold tracking-tight">
            Session Details
          </DialogTitle>
          <div className="flex items-center gap-2">
            {getTypeBadge(session.type)}
            {getStatusBadge(session.status)}
          </div>
        </div>
        <DialogDescription>
          Detailed inspection of session timing, task attribution, and duration.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2 text-sm" data-testid="session-detail-content">
        {/* Timing Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 border border-border/40">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Actual Duration
            </span>
            <p className="text-base font-semibold text-foreground" data-testid="detail-actual-duration">
              {formatSeconds(session.actualDuration)}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5" /> Planned Duration
            </span>
            <p className="text-base font-semibold text-foreground">
              {formatSeconds(session.plannedDuration)}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <PauseCircle className="h-3.5 w-3.5" /> Paused Duration
            </span>
            <p className="text-sm font-medium text-foreground">
              {session.pausedDuration ? formatSeconds(session.pausedDuration) : 'None (0s)'}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Session ID</span>
            <p className="text-xs font-mono text-muted-foreground truncate" title={session.id}>
              {session.id}
            </p>
          </div>
        </div>

        {/* Timestamps */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Started At:
            </span>
            <span className="font-medium text-foreground" data-testid="detail-started-at">
              {formatDate(session.startedAt)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Ended At:
            </span>
            <span className="font-medium text-foreground">
              {session.endedAt ? formatDate(session.endedAt) : 'Session in progress'}
            </span>
          </div>
        </div>

        <Separator />

        {/* Task Attribution */}
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <CheckSquare className="h-3.5 w-3.5" /> Linked Task
          </span>
          {session.task ? (
            <div className="rounded-lg border border-border/50 bg-background/60 p-2.5">
              <p className="font-medium text-foreground text-sm" data-testid="detail-task-title">
                {session.task.title}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic" data-testid="detail-no-task">
              No task linked to this session
            </p>
          )}
        </div>

        {/* Project Attribution */}
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <FolderKanban className="h-3.5 w-3.5" /> Linked Project
          </span>
          {session.project ? (
            <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/60 p-2.5">
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: session.project.color || '#6366f1' }}
              />
              <span className="font-medium text-foreground text-sm" data-testid="detail-project-name">
                {session.project.name}
              </span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic" data-testid="detail-unassigned-project">
              Unassigned
            </p>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

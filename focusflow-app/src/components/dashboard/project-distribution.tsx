'use client';

// src/components/dashboard/project-distribution.tsx
// FocusFlow — Ranked Project Focus Distribution Component
// Displays project focus time breakdowns with color badges, durations, and rounded percentages.

import * as React from 'react';
import { PieChart, AlertCircle, RefreshCw, FolderKanban } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { ProjectProductivityResponse } from '@/types/api';

export interface ProjectDistributionProps {
  projects?: ProjectProductivityResponse[] | null;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

export function ProjectDistribution({
  projects,
  isLoading = false,
  isError = false,
  onRetry,
}: ProjectDistributionProps) {
  if (isLoading) {
    return (
      <Card className="p-6 space-y-4" data-testid="project-distribution-skeleton">
        <div className="flex items-center justify-between pb-2 border-b">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="space-y-4 pt-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 p-6" data-testid="project-distribution-error">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Failed to load project distribution</span>
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

  const list = projects ?? [];
  const hasFocus = list.some((p) => p.actualFocusSeconds > 0);

  return (
    <Card className="overflow-hidden" data-testid="project-distribution">
      <CardHeader className="pb-3 border-b flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <PieChart className="h-4 w-4 text-primary" />
          Project Allocation
        </CardTitle>
        <span className="text-xs text-muted-foreground">{list.length} projects</span>
      </CardHeader>

      <CardContent className="p-6">
        {!hasFocus ? (
          <div className="py-8 flex flex-col items-center justify-center text-center text-muted-foreground space-y-2">
            <FolderKanban className="h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">No project focus recorded</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Assign projects to your focus sessions to visualize your focus distribution.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {list.map((proj) => {
              const roundedPct = Math.round(proj.percentage);
              const color = proj.projectColor || '#94a3b8';

              return (
                <div key={proj.projectId ?? 'unassigned'} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-medium truncate max-w-[180px]">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate text-foreground">
                        {proj.projectName}
                      </span>
                      {proj.isArchived && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          Archived
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted-foreground font-mono">
                        {formatDurationMinutes(proj.actualFocusMinutes)}
                      </span>
                      <span className="font-semibold text-foreground w-9 text-right font-mono">
                        {roundedPct}%
                      </span>
                    </div>
                  </div>
                  <Progress value={roundedPct} max={100} className="h-2" />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

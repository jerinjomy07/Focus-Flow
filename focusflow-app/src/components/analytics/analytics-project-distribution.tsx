'use client';

// src/components/analytics/analytics-project-distribution.tsx
// FocusFlow — Project Focus Allocation Distribution (Phase 9)

import * as React from 'react';
import { FolderKanban } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ProjectAnalyticsPoint } from '@/types/api';

export interface AnalyticsProjectDistributionProps {
  projects?: ProjectAnalyticsPoint[];
  isLoading?: boolean;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0 && minutes === 0) return '0m';
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function AnalyticsProjectDistribution({
  projects = [],
  isLoading,
}: AnalyticsProjectDistributionProps) {
  if (isLoading) {
    return (
      <Card className="animate-pulse" data-testid="project-distribution-skeleton">
        <CardHeader className="pb-2">
          <div className="h-5 w-40 bg-muted rounded" />
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-2 w-full bg-muted/40 rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const activeProjects = projects.filter((p) => p.completedFocusSeconds > 0 || p.sessionCount > 0);

  return (
    <Card data-testid="analytics-project-distribution">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Project Allocation</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            {activeProjects.length} {activeProjects.length === 1 ? 'project' : 'projects'} active
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {activeProjects.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-border/70 rounded-lg bg-muted/10">
            <FolderKanban className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">No project focus recorded</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1">
              Assign tasks to projects before focusing to track your distribution across initiatives.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeProjects.map((p) => {
              const color = p.projectColor || '#64748b';
              const isUnassigned = !p.projectId || p.projectName === 'Unassigned';

              return (
                <div key={p.projectId ?? 'unassigned'} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      <span className="font-medium text-foreground truncate">
                        {p.projectName}
                      </span>
                      {p.isArchived && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                          Archived
                        </Badge>
                      )}
                      {isUnassigned && (
                        <span className="text-[10px] text-muted-foreground italic">(No Project)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-muted-foreground font-mono">
                        {formatDuration(p.completedFocusSeconds)}
                      </span>
                      <span className="text-muted-foreground font-medium">
                        ({p.sessionCount} {p.sessionCount === 1 ? 'block' : 'blocks'})
                      </span>
                      <span className="font-semibold text-foreground min-w-[3rem] text-right">
                        {p.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Allocation Bar */}
                  <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(0, p.percentage))}%`,
                        backgroundColor: color,
                      }}
                    />
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

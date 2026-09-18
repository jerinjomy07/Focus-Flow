'use client';

// src/components/history/session-filters.tsx
// FocusFlow — Comprehensive Session History Filter Toolbar
// Supports Status, Type, Project, Task, Date Range, Sort controls, and Active Filter Badges.

import * as React from 'react';
import { Filter, RotateCcw, X, Calendar } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { SessionListQuery } from '@/types/api';

export interface SessionFiltersProps {
  filters: SessionListQuery;
  onFilterChange: (newFilters: Partial<SessionListQuery>) => void;
  onReset: () => void;
  projects?: Array<{ id: string; name: string; color: string }>;
  tasks?: Array<{ id: string; title: string }>;
}

export function SessionFilters({
  filters,
  onFilterChange,
  onReset,
  projects = [],
  tasks = [],
}: SessionFiltersProps) {
  const [showCustomDates, setShowCustomDates] = React.useState(
    Boolean(filters.startDate || filters.endDate)
  );

  // Date range preset handler
  const handleDatePresetChange = (preset: string) => {
    if (preset === 'all') {
      setShowCustomDates(false);
      onFilterChange({ startDate: undefined, endDate: undefined });
    } else if (preset === 'today') {
      setShowCustomDates(false);
      const todayStr = new Date().toISOString().split('T')[0];
      onFilterChange({ startDate: todayStr, endDate: todayStr });
    } else if (preset === 'yesterday') {
      setShowCustomDates(false);
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yestStr = d.toISOString().split('T')[0];
      onFilterChange({ startDate: yestStr, endDate: yestStr });
    } else if (preset === 'custom') {
      setShowCustomDates(true);
    }
  };

  // Compute active filters count
  const activeFiltersCount = [
    filters.type,
    filters.status,
    filters.projectId,
    filters.taskId,
    filters.startDate,
    filters.endDate,
  ].filter(Boolean).length;

  const currentSortValue = `${filters.sort || 'startedAt'}_${filters.sortOrder || 'desc'}`;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-xs backdrop-blur-xs">
      {/* Top Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Status Filter */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
          <Select
            value={filters.status || ''}
            onChange={(e) =>
              onFilterChange({
                status: (e.target.value as SessionListQuery['status']) || undefined,
              })
            }
            aria-label="Filter by Status"
          >
            <option value="">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="ABANDONED">Abandoned</option>
            <option value="SKIPPED">Skipped</option>
            <option value="IN_PROGRESS">In Progress</option>
          </Select>
        </div>

        {/* Type Filter */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
          <Select
            value={filters.type || ''}
            onChange={(e) =>
              onFilterChange({
                type: (e.target.value as SessionListQuery['type']) || undefined,
              })
            }
            aria-label="Filter by Type"
          >
            <option value="">All Types</option>
            <option value="FOCUS">Focus Session</option>
            <option value="SHORT_BREAK">Short Break</option>
            <option value="LONG_BREAK">Long Break</option>
          </Select>
        </div>

        {/* Project Filter */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Project</label>
          <Select
            value={filters.projectId || ''}
            onChange={(e) => onFilterChange({ projectId: e.target.value || undefined })}
            aria-label="Filter by Project"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Task Filter */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Task</label>
          <Select
            value={filters.taskId || ''}
            onChange={(e) => onFilterChange({ taskId: e.target.value || undefined })}
            aria-label="Filter by Task"
          >
            <option value="">All Tasks</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        </div>

        {/* Date Presets */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Date Range</label>
          <Select
            value={showCustomDates ? 'custom' : filters.startDate ? 'preset' : 'all'}
            onChange={(e) => handleDatePresetChange(e.target.value)}
            aria-label="Filter by Date Range"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="custom">Custom Range...</option>
          </Select>
        </div>

        {/* Sort */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Sort</label>
          <Select
            value={currentSortValue}
            onChange={(e) => {
              const [col, dir] = e.target.value.split('_');
              onFilterChange({
                sort: col as 'startedAt' | 'actualDuration',
                sortOrder: dir as 'asc' | 'desc',
              });
            }}
            aria-label="Sort sessions"
          >
            <option value="startedAt_desc">Newest First</option>
            <option value="startedAt_asc">Oldest First</option>
            <option value="actualDuration_desc">Longest Duration</option>
            <option value="actualDuration_asc">Shortest Duration</option>
          </Select>
        </div>
      </div>

      {/* Custom Date Inputs (Conditional) */}
      {showCustomDates && (
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/40">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> From:
            </span>
            <Input
              type="date"
              className="h-8 text-xs w-36"
              value={filters.startDate || ''}
              onChange={(e) => onFilterChange({ startDate: e.target.value || undefined })}
              aria-label="Start date"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">To:</span>
            <Input
              type="date"
              className="h-8 text-xs w-36"
              value={filters.endDate || ''}
              onChange={(e) => onFilterChange({ endDate: e.target.value || undefined })}
              aria-label="End date"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => {
              setShowCustomDates(false);
              onFilterChange({ startDate: undefined, endDate: undefined });
            }}
          >
            Clear Dates
          </Button>
        </div>
      )}

      {/* Active Filter Badges & Reset */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Filter className="h-3 w-3" /> Active Filters:
          </span>

          {filters.status && (
            <Badge variant="secondary" className="gap-1 text-xs">
              Status: {filters.status}
              <X
                className="h-3 w-3 cursor-pointer hover:text-foreground"
                onClick={() => onFilterChange({ status: undefined })}
              />
            </Badge>
          )}

          {filters.type && (
            <Badge variant="secondary" className="gap-1 text-xs">
              Type: {filters.type}
              <X
                className="h-3 w-3 cursor-pointer hover:text-foreground"
                onClick={() => onFilterChange({ type: undefined })}
              />
            </Badge>
          )}

          {filters.projectId && (
            <Badge variant="secondary" className="gap-1 text-xs">
              Project:{' '}
              {projects.find((p) => p.id === filters.projectId)?.name || filters.projectId}
              <X
                className="h-3 w-3 cursor-pointer hover:text-foreground"
                onClick={() => onFilterChange({ projectId: undefined })}
              />
            </Badge>
          )}

          {filters.taskId && (
            <Badge variant="secondary" className="gap-1 text-xs">
              Task: {tasks.find((t) => t.id === filters.taskId)?.title || filters.taskId}
              <X
                className="h-3 w-3 cursor-pointer hover:text-foreground"
                onClick={() => onFilterChange({ taskId: undefined })}
              />
            </Badge>
          )}

          {(filters.startDate || filters.endDate) && (
            <Badge variant="secondary" className="gap-1 text-xs">
              Date: {filters.startDate || 'start'} → {filters.endDate || 'end'}
              <X
                className="h-3 w-3 cursor-pointer hover:text-foreground"
                onClick={() => {
                  setShowCustomDates(false);
                  onFilterChange({ startDate: undefined, endDate: undefined });
                }}
              />
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            onClick={onReset}
          >
            <RotateCcw className="h-3 w-3" />
            Reset all
          </Button>
        </div>
      )}
    </div>
  );
}

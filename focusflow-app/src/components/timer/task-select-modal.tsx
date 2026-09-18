'use client';

// src/components/timer/task-select-modal.tsx
// FocusFlow — Modal for selecting or linking an active task to focus sessions

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, CheckCircle2, Circle, AlertCircle, X } from 'lucide-react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import type { TaskWithProject } from '@/types/domain';

interface TaskSelectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTaskId: string | null;
  onSelectTask: (task: TaskWithProject | null) => void;
}

export function TaskSelectModal({
  open,
  onOpenChange,
  selectedTaskId,
  onSelectTask,
}: TaskSelectModalProps) {
  const [search, setSearch] = React.useState('');

  const { data: tasksResponse, isLoading, error } = useQuery<{ data: TaskWithProject[] }>({
    queryKey: ['tasks', 'selectable'],
    queryFn: async () => {
      const res = await fetch('/api/tasks?pageSize=50');
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json();
    },
    enabled: open,
  });

  const tasks = tasksResponse?.data ?? [];
  const filteredTasks = tasks.filter((t) => {
    if (search.trim() === '') return true;
    const q = search.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      (t.project?.name && t.project.name.toLowerCase().includes(q))
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Select Focus Task</DialogTitle>
        <DialogDescription>
          Choose a task to track Pomodoro intervals against, or clear to focus freely.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 my-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks or projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-64 overflow-y-auto divide-y divide-border rounded-lg border border-border">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Spinner className="h-6 w-6 text-primary" />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-sm text-destructive flex items-center justify-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Failed to load tasks
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {search ? 'No matching tasks found' : 'No tasks available'}
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isSelected = task.id === selectedTaskId;
              const isCompleted = task.status === 'COMPLETED';

              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    onSelectTask(task);
                    onOpenChange(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 text-left transition-colors hover:bg-muted/50 cursor-pointer ${
                    isSelected ? 'bg-primary/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    {isSelected ? (
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="truncate">
                      <div className="text-sm font-medium text-foreground truncate flex items-center gap-2">
                        <span className={isCompleted ? 'line-through text-muted-foreground' : ''}>
                          {task.title}
                        </span>
                        {isCompleted && (
                          <Badge variant="outline" className="text-2xs py-0 text-muted-foreground">
                            Completed
                          </Badge>
                        )}
                      </div>
                      {task.project && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <span
                            className="inline-block h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: task.project.color }}
                          />
                          <span className="truncate">{task.project.name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono text-muted-foreground">
                      🍅 {task.completedPomodoros}/{task.estimatedPomodoros}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onSelectTask(null);
            onOpenChange(false);
          }}
          className="text-muted-foreground gap-1.5"
        >
          <X className="h-3.5 w-3.5" />
          Clear Selected Task
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

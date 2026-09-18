'use client';

// src/app/projects/[id]/page.tsx
// FocusFlow — Project Detail Page
// Dedicated view showing project metadata, completion metrics, and tasks.

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Sparkles,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useActiveTaskStore } from '@/stores/timer-store';
import { queryKeys } from '@/lib/query-keys';
import { formatDueDate, getDueDateCategory } from '@/domain/tasks/due-dates';
import { cn } from '@/lib/utils';
import type { ProjectDetail, Priority } from '@/types/domain';

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { selectedTaskId, setSelectedTask, clearSelectedTask } = useActiveTaskStore();

  // Dialog & Form state
  const [isCreateTaskOpen, setIsCreateTaskOpen] = React.useState(false);
  const [taskTitle, setTaskTitle] = React.useState('');
  const [taskPriority, setTaskPriority] = React.useState<Priority>('MEDIUM');
  const [taskEstimate, setTaskEstimate] = React.useState<number | ''>(2);
  const [taskDueDate, setTaskDueDate] = React.useState('');
  const [taskDesc, setTaskDesc] = React.useState('');

  // Fetch Project Detail
  const {
    data: project,
    isLoading,
    isError,
    refetch,
  } = useQuery<ProjectDetail>({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error('Project not found');
      const json = await res.json();
      return json.data;
    },
  });

  // Create Task Mutation
  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle.trim(),
          description: taskDesc.trim() || undefined,
          projectId,
          priority: taskPriority,
          estimatedPomodoros: taskEstimate !== '' ? Number(taskEstimate) : undefined,
          dueDate: taskDueDate ? new Date(`${taskDueDate}T23:59:59.999Z`).toISOString() : undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to create task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      setIsCreateTaskOpen(false);
      setTaskTitle('');
      setTaskDesc('');
      setTaskDueDate('');
      toast({
        title: 'Task created',
        description: 'Task added to project.',
        type: 'success',
      });
    },
  });

  // Toggle Complete Task Mutation
  const toggleTaskMutation = useMutation({
    mutationFn: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
      const endpoint = isCompleted
        ? `/api/tasks/${taskId}/reopen`
        : `/api/tasks/${taskId}/complete`;
      const res = await fetch(endpoint, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to update task status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });

  // Delete Task Mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete task');
      return true;
    },
    onSuccess: (_, taskId) => {
      if (selectedTaskId === taskId) clearSelectedTask();
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast({ title: 'Task removed', type: 'info' });
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-6 w-32" />
          <Card className="p-6 space-y-4">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-2 w-full" />
          </Card>
        </div>
      </AppShell>
    );
  }

  if (isError || !project) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Link
            href="/projects"
            className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back to Projects
          </Link>
          <Card className="p-8 text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
            <h3 className="font-semibold text-foreground">Project Not Found</h3>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
              <Button size="sm" onClick={() => router.push('/projects')}>
                View All Projects
              </Button>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  const progressPct =
    project.taskCount > 0
      ? Math.round((project.completedTaskCount / project.taskCount) * 100)
      : 0;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Back navigation */}
        <div>
          <Link
            href="/projects"
            className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back to Projects
          </Link>
        </div>

        {/* Project Header Card */}
        <Card className="border-border/80 shadow-xs">
          <CardContent className="p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  className="h-5 w-5 rounded-full shrink-0 shadow-xs"
                  style={{ backgroundColor: project.color }}
                  aria-hidden="true"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                      {project.name}
                    </h1>
                    <Badge
                      variant={project.status === 'ACTIVE' ? 'default' : 'secondary'}
                      className="text-[10px] uppercase font-semibold"
                    >
                      {project.status}
                    </Badge>
                  </div>
                  {project.description && (
                    <p className="text-xs text-muted-foreground mt-1">{project.description}</p>
                  )}
                </div>
              </div>

              <Button onClick={() => setIsCreateTaskOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-1.5" />
                Add Task
              </Button>
            </div>

            {/* Progress metric */}
            <div className="space-y-1.5 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Completion Status</span>
                <span>
                  {project.completedTaskCount} of {project.taskCount} tasks completed ({progressPct}%)
                </span>
              </div>
              <Progress value={progressPct} max={100} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Task List Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-foreground uppercase tracking-wider text-xs">
              Project Tasks ({project.tasks.length})
            </h2>
          </div>

          {project.tasks.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No tasks in this project yet"
              description="Add actionable units of work to track your focus sessions towards this project."
              action={
                <Button onClick={() => setIsCreateTaskOpen(true)} size="sm">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add First Task
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {project.tasks.map((task) => {
                const isCompleted = task.status === 'COMPLETED';
                const isSelected = selectedTaskId === task.id;
                const dueDateCat = getDueDateCategory(task.dueDate, 'UTC');
                const dueDateText = formatDueDate(task.dueDate, 'UTC');

                return (
                  <Card
                    key={task.id}
                    className={cn(
                      'transition-all duration-150 border-border/70 hover:border-primary/40',
                      isSelected && 'ring-2 ring-primary border-primary bg-primary/5'
                    )}
                  >
                    <div className="p-3.5 flex items-center justify-between gap-3">
                      {/* Checkbox and Title */}
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() =>
                            toggleTaskMutation.mutate({ taskId: task.id, isCompleted })
                          }
                          className="shrink-0 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                          aria-label={isCompleted ? 'Reopen task' : 'Complete task'}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          ) : (
                            <Circle className="h-5 w-5" />
                          )}
                        </button>

                        <div className="min-w-0">
                          <p
                            className={cn(
                              'text-sm font-medium leading-none truncate',
                              isCompleted
                                ? 'line-through text-muted-foreground'
                                : 'text-foreground'
                            )}
                          >
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground truncate mt-1">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Badges and Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Pomodoro count */}
                        <span className="text-[11px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/50">
                          🍅 {task.completedPomodoros}
                          {task.estimatedPomodoros ? `/${task.estimatedPomodoros}` : ''}
                        </span>

                        {/* Priority */}
                        <Badge
                          variant={
                            task.priority === 'URGENT'
                              ? 'destructive'
                              : task.priority === 'HIGH'
                              ? 'default'
                              : 'secondary'
                          }
                          className="text-[10px] uppercase font-semibold"
                        >
                          {task.priority}
                        </Badge>

                        {/* Due Date */}
                        {dueDateText && (
                          <span
                            className={cn(
                              'text-[11px] font-medium flex items-center gap-1 px-1.5 py-0.5 rounded',
                              dueDateCat === 'OVERDUE'
                                ? 'text-destructive bg-destructive/10'
                                : 'text-muted-foreground bg-muted/60'
                            )}
                          >
                            <Calendar className="h-3 w-3" />
                            {dueDateText}
                          </span>
                        )}

                        {/* Focus Action */}
                        {!isCompleted && (
                          <Button
                            variant={isSelected ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={() => {
                              if (isSelected) {
                                clearSelectedTask();
                              } else {
                                setSelectedTask('user', task.id, projectId, task.title);
                                toast({
                                  title: 'Focus target set',
                                  description: `Active task set to "${task.title}".`,
                                  type: 'info',
                                });
                              }
                            }}
                            className="h-7 text-xs px-2"
                          >
                            <Sparkles className="h-3 w-3 mr-1 text-primary" />
                            {isSelected ? 'Focused' : 'Focus'}
                          </Button>
                        )}

                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTaskMutation.mutate(task.id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Create Task Dialog */}
        <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
          <DialogHeader>
            <DialogTitle>Add Task to {project.name}</DialogTitle>
            <DialogDescription>
              Create a work unit with priority and optional Pomodoro estimate.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (taskTitle.trim()) createTaskMutation.mutate();
            }}
            className="space-y-4 py-2"
          >
            <div className="space-y-1.5">
              <label htmlFor="modal-task-title" className="text-xs font-medium text-foreground">
                Task Title <span className="text-destructive">*</span>
              </label>
              <Input
                id="modal-task-title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g. Implement authentication tests"
                required
                maxLength={200}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="modal-task-priority" className="text-xs font-medium text-foreground">
                  Priority
                </label>
                <Select
                  id="modal-task-priority"
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as Priority)}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="modal-task-est" className="text-xs font-medium text-foreground">
                  Est. Pomodoros (25m each)
                </label>
                <Input
                  id="modal-task-est"
                  type="number"
                  min="1"
                  max="50"
                  value={taskEstimate}
                  onChange={(e) =>
                    setTaskEstimate(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  placeholder="e.g. 4"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="modal-task-due" className="text-xs font-medium text-foreground">
                Due Date
              </label>
              <Input
                id="modal-task-due"
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="modal-task-desc" className="text-xs font-medium text-foreground">
                Notes & Context (optional)
              </label>
              <Textarea
                id="modal-task-desc"
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                placeholder="Acceptance criteria or reference links"
                rows={2}
                maxLength={2000}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateTaskOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={createTaskMutation.isPending}>
                Add Task
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      </div>
    </AppShell>
  );
}

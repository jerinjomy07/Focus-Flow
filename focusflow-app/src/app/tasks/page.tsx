'use client';

// src/app/tasks/page.tsx
// FocusFlow — Production Tasks Management View
// Connects to PostgreSQL via real API endpoints with TanStack Query v5.
// Features Quick-Add, rich filtering/search/sort, Active Focus Target state,
// and timezone-aware due date calculations.

import * as React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  CheckSquare,
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  Trash2,
  Edit2,
  Play,
  Target,
  AlertCircle,
  X,
  ArrowRight,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/common/page-header';
import { SearchField } from '@/components/common/search-field';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useActiveTaskStore } from '@/stores/timer-store';
import { queryKeys } from '@/lib/query-keys';
import {
  formatDueDate,
  getDueDateCategory,
  toUtcEndOfDay,
  toLocalDateInputString,
} from '@/domain/tasks/due-dates';
import { cn } from '@/lib/utils';
import type {
  TaskWithProject,
  ProjectWithStats,
  TaskStatus,
  Priority,
} from '@/types/domain';

type DueDateFilterOption = 'all' | 'today' | 'overdue' | 'upcoming' | 'none';
type SortOption = 'createdAt' | 'dueDate' | 'priority' | 'title';

export default function TasksPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const userTimezone = session?.user?.timezone || 'UTC';
  const currentUserId = session?.user?.id || 'anonymous';

  // Active Focus Task state (ADR-012)
  const {
    selectedTaskId,
    selectedTaskTitle,
    setSelectedTask,
    clearSelectedTask,
    syncUser,
  } = useActiveTaskStore();

  React.useEffect(() => {
    if (session?.user?.id) {
      syncUser(session.user.id);
    }
  }, [session?.user?.id, syncUser]);

  // Filters & Controls State
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'ALL' | TaskStatus>('ALL');
  const [projectFilter, setProjectFilter] = React.useState<string>('all');
  const [priorityFilter, setPriorityFilter] = React.useState<string>('all');
  const [dueDateFilter, setDueDateFilter] = React.useState<DueDateFilterOption>('all');
  const [sortBy, setSortBy] = React.useState<SortOption>('createdAt');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<TaskWithProject | null>(null);
  const [taskToDelete, setTaskToDelete] = React.useState<TaskWithProject | null>(null);

  // Quick-Add State
  const [quickTitle, setQuickTitle] = React.useState('');
  const [quickProject, setQuickProject] = React.useState<string>('none');
  const [quickPriority, setQuickPriority] = React.useState<Priority>('MEDIUM');

  // Full Create/Edit Form State
  const [formTitle, setFormTitle] = React.useState('');
  const [formDesc, setFormDesc] = React.useState('');
  const [formProject, setFormProject] = React.useState<string>('none');
  const [formPriority, setFormPriority] = React.useState<Priority>('MEDIUM');
  const [formEstimate, setFormEstimate] = React.useState<number>(2);
  const [formDueDate, setFormDueDate] = React.useState<string>('');
  const [formStatus, setFormStatus] = React.useState<TaskStatus>('TODO');

  // Fetch Projects for dropdown selection
  const { data: projects = [] } = useQuery<ProjectWithStats[]>({
    queryKey: queryKeys.projects.list('ACTIVE'),
    queryFn: async () => {
      const res = await fetch('/api/projects?status=ACTIVE');
      if (!res.ok) return [];
      const json = await res.json();
      return json.data ?? [];
    },
  });

  // Build query string for tasks
  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (projectFilter === 'inbox') params.set('projectId', 'inbox');
    else if (projectFilter !== 'all') params.set('projectId', projectFilter);
    if (priorityFilter !== 'all') params.set('priority', priorityFilter);
    if (dueDateFilter !== 'all') params.set('dueDateFilter', dueDateFilter);
    if (search.trim()) params.set('search', search.trim());
    params.set('sort', sortBy);
    params.set('sortOrder', sortOrder);
    return params.toString();
  }, [statusFilter, projectFilter, priorityFilter, dueDateFilter, search, sortBy, sortOrder]);

  // Fetch Tasks
  const {
    data: tasksData,
    isLoading,
    isError,
    refetch,
  } = useQuery<{ data: TaskWithProject[] }>({
    queryKey: queryKeys.tasks.list({
      status: statusFilter,
      projectId: projectFilter,
      priority: priorityFilter,
      dueDateFilter,
      search,
      sort: sortBy,
      sortOrder,
    }),
    queryFn: async () => {
      const res = await fetch(`/api/tasks?${queryParams}`);
      if (!res.ok) throw new Error('Failed to load tasks');
      return res.json();
    },
  });

  const tasks: TaskWithProject[] = tasksData?.data ?? [];

  const resetModalForm = () => {
    setFormTitle('');
    setFormDesc('');
    setFormProject('none');
    setFormPriority('MEDIUM');
    setFormEstimate(2);
    setFormDueDate('');
    setFormStatus('TODO');
  };

  // Create Task Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: {
      title: string;
      description?: string;
      projectId?: string | null;
      priority: Priority;
      estimatedPomodoros?: number;
      dueDate?: string | null;
    }) => {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || 'Failed to create task');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      setIsCreateOpen(false);
      resetModalForm();
      toast({
        title: 'Task created',
        description: 'New task added to your backlog.',
        type: 'success',
      });
    },
    onError: (err: Error) => {
      toast({
        title: 'Creation failed',
        description: err.message,
        type: 'destructive',
      });
    },
  });

  // Quick Add Handler
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    try {
      await createMutation.mutateAsync({
        title: quickTitle.trim(),
        projectId: quickProject !== 'none' ? quickProject : null,
        priority: quickPriority,
        estimatedPomodoros: 2,
      });
      setQuickTitle('');
    } catch {
      // Error handled by mutation onError
    }
  };

  // Full Create Handler
  const handleModalCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const isoDueDate = formDueDate
      ? toUtcEndOfDay(formDueDate, userTimezone)
      : null;

    createMutation.mutate({
      title: formTitle.trim(),
      description: formDesc.trim() || undefined,
      projectId: formProject !== 'none' ? formProject : null,
      priority: formPriority,
      estimatedPomodoros: formEstimate,
      dueDate: isoDueDate,
    });
  };

  // Update Task Mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        title?: string;
        description?: string | null;
        status?: TaskStatus;
        priority?: Priority;
        projectId?: string | null;
        estimatedPomodoros?: number;
        dueDate?: string | null;
      };
    }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || 'Failed to update task');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      setEditingTask(null);
      resetModalForm();
      toast({
        title: 'Task updated',
        description: 'Changes saved successfully.',
        type: 'success',
      });
    },
    onError: (err: Error) => {
      toast({
        title: 'Update failed',
        description: err.message,
        type: 'destructive',
      });
    },
  });

  const handleModalUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !formTitle.trim()) return;

    const isoDueDate = formDueDate
      ? toUtcEndOfDay(formDueDate, userTimezone)
      : null;

    updateMutation.mutate({
      id: editingTask.id,
      payload: {
        title: formTitle.trim(),
        description: formDesc.trim() || null,
        status: formStatus,
        priority: formPriority,
        projectId: formProject !== 'none' ? formProject : null,
        estimatedPomodoros: formEstimate,
        dueDate: isoDueDate,
      },
    });
  };

  // Toggle Complete / Reopen Mutation
  const toggleCompleteMutation = useMutation({
    mutationFn: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
      const endpoint = isCompleted
        ? `/api/tasks/${taskId}/reopen`
        : `/api/tasks/${taskId}/complete`;
      const res = await fetch(endpoint, { method: 'POST' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || 'Failed to update task state');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
    onError: (err: Error) => {
      toast({
        title: 'Status change failed',
        description: err.message,
        type: 'destructive',
      });
    },
  });

  // Delete Task Mutation
  const deleteMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || 'Failed to delete task');
      }
      return res.json();
    },
    onSuccess: (_, taskId) => {
      if (selectedTaskId === taskId) {
        clearSelectedTask();
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      setTaskToDelete(null);
      toast({
        title: 'Task deleted',
        description: 'The task has been permanently removed.',
        type: 'info',
      });
    },
    onError: (err: Error) => {
      toast({
        title: 'Delete failed',
        description: err.message,
        type: 'destructive',
      });
    },
  });

  // Helper to open Edit Modal
  const openEditModal = (task: TaskWithProject) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDesc(task.description || '');
    setFormProject(task.projectId || 'none');
    setFormPriority(task.priority);
    setFormEstimate(task.estimatedPomodoros ?? 2);
    setFormDueDate(toLocalDateInputString(task.dueDate, userTimezone));
    setFormStatus(task.status);
  };

  // Helper to toggle active focus target
  const handleToggleFocus = (task: TaskWithProject) => {
    if (selectedTaskId === task.id) {
      clearSelectedTask();
      toast({
        title: 'Focus target cleared',
        description: 'Timer is now in unassigned focus mode.',
        type: 'info',
      });
    } else {
      setSelectedTask(currentUserId, task.id, task.projectId, task.title);
      toast({
        title: 'Active focus target selected',
        description: `Set "${task.title}" as active target. Ready for your next session!`,
        type: 'success',
      });
    }
  };

  // Filter counters and reset
  const hasActiveFilters =
    search.trim() !== '' ||
    statusFilter !== 'ALL' ||
    projectFilter !== 'all' ||
    priorityFilter !== 'all' ||
    dueDateFilter !== 'all';

  const resetAllFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setProjectFilter('all');
    setPriorityFilter('all');
    setDueDateFilter('all');
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Tasks"
          description="Organize your actionable units of work, prioritize Pomodoros, and track focus sessions."
        >
          <Button
            onClick={() => {
              resetModalForm();
              setIsCreateOpen(true);
            }}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Task
          </Button>
        </PageHeader>

        {/* Active Focus Target Banner (if a task is actively selected) */}
        {selectedTaskId && (
          <div className="relative overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-background p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
                  <Target className="h-5 w-5 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                      Current Focus Target
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/30">
                      Active
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate mt-0.5">
                    {selectedTaskTitle || 'Selected Task'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <Link href="/focus">
                  <Button size="sm" className="h-8 gap-1.5">
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Open Timer
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearSelectedTask}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Inline Quick-Add Bar */}
        <Card className="border-border/70 shadow-xs">
          <form onSubmit={handleQuickAdd} className="p-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Input
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  placeholder="What needs focus? Press Enter to quick-add..."
                  className="h-9 text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="w-36">
                  <Select
                    value={quickProject}
                    onChange={(e) => setQuickProject(e.target.value)}
                    className="h-9 text-xs"
                    aria-label="Assign project"
                  >
                    <option value="none">Inbox (No Project)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="w-28">
                  <Select
                    value={quickPriority}
                    onChange={(e) => setQuickPriority(e.target.value as Priority)}
                    className="h-9 text-xs"
                    aria-label="Assign priority"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </Select>
                </div>

                <Button
                  type="submit"
                  size="sm"
                  disabled={!quickTitle.trim() || createMutation.isPending}
                  className="h-9 shrink-0"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          </form>
        </Card>

        {/* Filters and Search Toolbar */}
        <div className="space-y-3">
          {/* Top Row: Search and Status Tabs */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search task title or description..."
              className="w-full md:max-w-xs"
            />

            <div
              role="tablist"
              aria-label="Filter tasks by status"
              className="inline-flex items-center rounded-lg bg-muted/60 p-1 border border-border/50 text-xs font-medium overflow-x-auto"
            >
              {(['ALL', 'TODO', 'IN_PROGRESS', 'COMPLETED'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    'px-3 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap',
                    statusFilter === status
                      ? 'bg-background text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {status === 'ALL'
                    ? 'All Tasks'
                    : status === 'TODO'
                    ? 'To Do'
                    : status === 'IN_PROGRESS'
                    ? 'In Progress'
                    : 'Completed'}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Row: Granular Filters (Project, Priority, Due Date, Sort) */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Project Filter */}
            <div className="w-40">
              <Select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="h-8 text-xs"
                aria-label="Filter by project"
              >
                <option value="all">All Projects</option>
                <option value="inbox">Inbox Only</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Priority Filter */}
            <div className="w-32">
              <Select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-8 text-xs"
                aria-label="Filter by priority"
              >
                <option value="all">All Priorities</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </Select>
            </div>

            {/* Due Date Filter */}
            <div className="w-36">
              <Select
                value={dueDateFilter}
                onChange={(e) => setDueDateFilter(e.target.value as DueDateFilterOption)}
                className="h-8 text-xs"
                aria-label="Filter by due date"
              >
                <option value="all">All Deadlines</option>
                <option value="today">Due Today</option>
                <option value="overdue">Overdue</option>
                <option value="upcoming">Upcoming</option>
                <option value="none">No Due Date</option>
              </Select>
            </div>

            {/* Sort Filter */}
            <div className="w-36">
              <Select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-') as [SortOption, 'asc' | 'desc'];
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className="h-8 text-xs"
                aria-label="Sort tasks by"
              >
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="dueDate-asc">Due Date (Earliest)</option>
                <option value="priority-desc">Highest Priority</option>
                <option value="title-asc">Title (A-Z)</option>
              </Select>
            </div>

            {/* Active Filters Clear Button */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetAllFilters}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Clear Filters
              </Button>
            )}

            <div className="ml-auto text-xs text-muted-foreground font-medium">
              {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
            </div>
          </div>
        </div>

        {/* Task Cards List / State views */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="space-y-2.5">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-7 w-20" />
                  </div>
                </Card>
              ))}
            </div>
          ) : isError ? (
            <Card className="p-8 text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
              <h3 className="font-semibold text-foreground">Failed to Load Tasks</h3>
              <p className="text-xs text-muted-foreground">
                An error occurred while fetching your task list. Please check your connection.
              </p>
              <Button size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </Card>
          ) : tasks.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title={hasActiveFilters ? 'No tasks match your filters' : 'Your backlog is empty'}
              description={
                hasActiveFilters
                  ? 'Try adjusting your search keywords, status filter, or deadline criteria.'
                  : 'Add your first task above to start tracking estimated Pomodoros and building focus streaks.'
              }
              action={
                hasActiveFilters ? (
                  <Button onClick={resetAllFilters} size="sm" variant="outline">
                    Reset all filters
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      resetModalForm();
                      setIsCreateOpen(true);
                    }}
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Create first task
                  </Button>
                )
              }
            />
          ) : (
            tasks.map((task) => {
              const isCompleted = task.status === 'COMPLETED';
              const isSelected = selectedTaskId === task.id;
              const dueDateCat = getDueDateCategory(task.dueDate, userTimezone);
              const dueDateText = formatDueDate(task.dueDate, userTimezone);

              return (
                <Card
                  key={task.id}
                  className={cn(
                    'group transition-all duration-150 border-border/70 hover:border-primary/40 shadow-xs',
                    isSelected && 'ring-2 ring-primary border-primary bg-primary/5',
                    isCompleted && 'opacity-70 bg-muted/20'
                  )}
                >
                  <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left: Checkbox + Title & Metadata */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Interactive Completion Button */}
                      <button
                        type="button"
                        onClick={() =>
                          toggleCompleteMutation.mutate({
                            taskId: task.id,
                            isCompleted,
                          })
                        }
                        className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                        aria-label={isCompleted ? 'Reopen task' : 'Mark task completed'}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5 text-primary fill-primary/10" />
                        ) : (
                          <Circle className="h-5 w-5 hover:text-foreground" />
                        )}
                      </button>

                      {/* Content block */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p
                            className={cn(
                              'text-sm font-medium leading-snug break-words',
                              isCompleted
                                ? 'line-through text-muted-foreground'
                                : 'text-foreground'
                            )}
                          >
                            {task.title}
                          </p>

                          {/* Project Tag */}
                          {task.project ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted border border-border/60">
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: task.project.color }}
                                aria-hidden="true"
                              />
                              <span className="truncate max-w-[120px]">{task.project.name}</span>
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground bg-muted/50 border border-border/40">
                              Inbox
                            </span>
                          )}

                          {/* Priority Badge */}
                          <Badge
                            variant={
                              task.priority === 'URGENT'
                                ? 'destructive'
                                : task.priority === 'HIGH'
                                ? 'warning'
                                : task.priority === 'MEDIUM'
                                ? 'secondary'
                                : 'outline'
                            }
                            className="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0"
                          >
                            {task.priority}
                          </Badge>

                          {/* Due Date Badge */}
                          {dueDateText && (
                            <Badge
                              variant={
                                dueDateCat === 'OVERDUE'
                                  ? 'destructive'
                                  : dueDateCat === 'TODAY'
                                  ? 'warning'
                                  : 'outline'
                              }
                              className="text-[10px] gap-1 px-1.5 py-0"
                            >
                              <Calendar className="h-3 w-3" />
                              {dueDateText}
                            </Badge>
                          )}
                        </div>

                        {/* Description (if provided) */}
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                            {task.description}
                          </p>
                        )}

                        {/* Pomodoro Progress Footnote */}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 font-medium">
                            <Clock className="h-3.5 w-3.5 text-primary/70" />
                            <span>
                              {task.completedPomodoros} / {task.estimatedPomodoros} Pomodoros
                            </span>
                          </span>

                          <span className="text-border">•</span>

                          <span className="capitalize text-[11px]">
                            Status: {task.status.toLowerCase().replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      {/* Active Target Focus Button */}
                      {!isCompleted && (
                        <Button
                          size="sm"
                          variant={isSelected ? 'default' : 'outline'}
                          onClick={() => handleToggleFocus(task)}
                          className={cn(
                            'h-8 text-xs font-medium gap-1.5 transition-all',
                            isSelected && 'bg-primary text-primary-foreground shadow-xs'
                          )}
                        >
                          <Target className="h-3.5 w-3.5" />
                          {isSelected ? 'Focused' : 'Focus'}
                        </Button>
                      )}

                      {/* Edit Button */}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditModal(task)}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        aria-label="Edit task"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>

                      {/* Delete Button */}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setTaskToDelete(task)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label="Delete task"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Create Task Modal Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Define your actionable task, assign it to a project, and estimate Pomodoros.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleModalCreate} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label htmlFor="create-task-title" className="text-xs font-medium text-foreground">
                Task Title *
              </label>
              <Input
                id="create-task-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g., Implement OAuth token refresh handler"
                required
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="create-task-desc" className="text-xs font-medium text-foreground">
                Description (Optional)
              </label>
              <Textarea
                id="create-task-desc"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Key requirements, links, or notes..."
                rows={3}
                maxLength={2000}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="create-task-project" className="text-xs font-medium text-foreground">
                  Project
                </label>
                <Select
                  id="create-task-project"
                  value={formProject}
                  onChange={(e) => setFormProject(e.target.value)}
                >
                  <option value="none">Inbox (No Project)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="create-task-priority" className="text-xs font-medium text-foreground">
                  Priority
                </label>
                <Select
                  id="create-task-priority"
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value as Priority)}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="create-task-estimate" className="text-xs font-medium text-foreground">
                  Estimated Pomodoros (25m each)
                </label>
                <Input
                  id="create-task-estimate"
                  type="number"
                  min={1}
                  max={20}
                  value={formEstimate}
                  onChange={(e) => setFormEstimate(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="create-task-due" className="text-xs font-medium text-foreground">
                  Due Date ({userTimezone})
                </label>
                <Input
                  id="create-task-due"
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!formTitle.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Task'}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>

        {/* Edit Task Modal Dialog */}
        <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>
              Update task details, progress status, and target estimates.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleModalUpdate} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label htmlFor="edit-task-title" className="text-xs font-medium text-foreground">
                Task Title *
              </label>
              <Input
                id="edit-task-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-task-desc" className="text-xs font-medium text-foreground">
                Description
              </label>
              <Textarea
                id="edit-task-desc"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                rows={3}
                maxLength={2000}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="edit-task-status" className="text-xs font-medium text-foreground">
                  Status
                </label>
                <Select
                  id="edit-task-status"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as TaskStatus)}
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="edit-task-project" className="text-xs font-medium text-foreground">
                  Project
                </label>
                <Select
                  id="edit-task-project"
                  value={formProject}
                  onChange={(e) => setFormProject(e.target.value)}
                >
                  <option value="none">Inbox (No Project)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="edit-task-priority" className="text-xs font-medium text-foreground">
                  Priority
                </label>
                <Select
                  id="edit-task-priority"
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value as Priority)}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="edit-task-estimate" className="text-xs font-medium text-foreground">
                  Estimated Pomodoros
                </label>
                <Input
                  id="edit-task-estimate"
                  type="number"
                  min={1}
                  max={20}
                  value={formEstimate}
                  onChange={(e) => setFormEstimate(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="edit-task-due" className="text-xs font-medium text-foreground">
                  Due Date ({userTimezone})
                </label>
                <div className="flex items-center gap-1.5">
                  <Input
                    id="edit-task-due"
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="flex-1"
                  />
                  {formDueDate && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormDueDate('')}
                      className="h-9 px-2 text-xs text-muted-foreground"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingTask(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!formTitle.trim() || updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete &quot;{taskToDelete?.title}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTaskToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => taskToDelete && deleteMutation.mutate(taskToDelete.id)}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Task'}
            </Button>
          </DialogFooter>
        </Dialog>
      </div>
    </AppShell>
  );
}


'use client';

// src/app/projects/page.tsx
// FocusFlow — Projects Management Page
// Real multi-tenant project management with TanStack Query v5,
// task completion progress metrics, archiving, and conditional deletion.

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  FolderKanban,
  Archive,
  RotateCcw,
  Trash2,
  Edit2,
  ExternalLink,
  AlertCircle,
  FolderCheck,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/common/page-header';
import { SearchField } from '@/components/common/search-field';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import type { ProjectWithStats, ProjectStatus } from '@/types/domain';

const COLOR_PALETTE = [
  '#6366f1', // Indigo
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#14b8a6', // Teal
  '#ef4444', // Red
];

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<ProjectStatus>('ACTIVE');
  const [search, setSearch] = React.useState('');

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingProject, setEditingProject] = React.useState<ProjectWithStats | null>(null);
  const [projectToDelete, setProjectToDelete] = React.useState<ProjectWithStats | null>(null);

  // Form States
  const [formName, setFormName] = React.useState('');
  const [formDesc, setFormDesc] = React.useState('');
  const [formColor, setFormColor] = React.useState(COLOR_PALETTE[0]);

  // Fetch Projects
  const {
    data: projects = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<ProjectWithStats[]>({
    queryKey: queryKeys.projects.list(activeTab),
    queryFn: async () => {
      const res = await fetch(`/api/projects?status=${activeTab}`);
      if (!res.ok) throw new Error('Failed to load projects');
      const json = await res.json();
      return json.data;
    },
  });

  // Create Project Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; description?: string; color: string }) => {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || 'Failed to create project');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      setIsCreateOpen(false);
      resetForm();
      toast({
        title: 'Project created',
        description: 'New project has been successfully initialized.',
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

  // Update Project Mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: { name: string; description?: string; color: string };
    }) => {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || 'Failed to update project');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      setEditingProject(null);
      resetForm();
      toast({
        title: 'Project updated',
        description: 'Project details have been saved.',
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

  // Archive Project Mutation
  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects/${id}/archive`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to archive project');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast({
        title: 'Project archived',
        description: 'Project has been moved to the archived archive view.',
        type: 'info',
      });
    },
  });

  // Restore Project Mutation
  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects/${id}/restore`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to restore project');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast({
        title: 'Project restored',
        description: 'Project is active again.',
        type: 'success',
      });
    },
  });

  // Delete Project Mutation (ADR-013 Protected)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.status === 409) {
        const json = await res.json();
        throw new Error(json.error?.message || 'Cannot delete project with recorded focus history.');
      }
      if (!res.ok) throw new Error('Failed to delete project');
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      setProjectToDelete(null);
      toast({
        title: 'Project deleted',
        description: 'Project removed. Any remaining tasks have been moved to Inbox.',
        type: 'success',
      });
    },
    onError: (err: Error) => {
      toast({
        title: 'Cannot delete project',
        description: err.message,
        type: 'destructive',
      });
      setProjectToDelete(null);
    },
  });

  const resetForm = () => {
    setFormName('');
    setFormDesc('');
    setFormColor(COLOR_PALETTE[0]);
  };

  const handleOpenEdit = (project: ProjectWithStats) => {
    setEditingProject(project);
    setFormName(project.name);
    setFormDesc(project.description || '');
    setFormColor(project.color);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    createMutation.mutate({
      name: formName.trim(),
      description: formDesc.trim() || undefined,
      color: formColor,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !formName.trim()) return;
    updateMutation.mutate({
      id: editingProject.id,
      payload: {
        name: formName.trim(),
        description: formDesc.trim() || undefined,
        color: formColor,
      },
    });
  };

  // Filter projects by search
  const filteredProjects = projects.filter((p) => {
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query))
    );
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Projects"
          description="Categorize your tasks, allocate focus sessions, and measure completion progress."
        >
          <Button onClick={() => setIsCreateOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            New Project
          </Button>
        </PageHeader>

        {/* Tab & Search Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search projects..."
            className="w-full sm:max-w-xs"
          />

          {/* Active / Archived Tab Selector */}
          <div
            role="tablist"
            aria-label="Filter projects by status"
            className="inline-flex items-center rounded-lg bg-muted/60 p-1 border border-border/50 text-xs font-medium"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'ACTIVE'}
              onClick={() => setActiveTab('ACTIVE')}
              className={cn(
                'px-3.5 py-1.5 rounded-md transition-colors cursor-pointer',
                activeTab === 'ACTIVE'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Active Projects
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'ARCHIVED'}
              onClick={() => setActiveTab('ARCHIVED')}
              className={cn(
                'px-3.5 py-1.5 rounded-md transition-colors cursor-pointer',
                activeTab === 'ARCHIVED'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Archived
            </button>
          </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-5 space-y-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2 w-full mt-4" />
              </Card>
            ))}
          </div>
        ) : isError ? (
          <Card className="p-8 text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
            <h3 className="font-semibold text-foreground">Could not load projects</h3>
            <p className="text-xs text-muted-foreground">
              An error occurred while fetching your project workspace.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try Again
            </Button>
          </Card>
        ) : filteredProjects.length === 0 ? (
          search.trim() ? (
            <EmptyState
              icon={FolderKanban}
              title="No projects match your search"
              description={`No projects found matching "${search}".`}
              action={
                <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                  Clear Search
                </Button>
              }
            />
          ) : activeTab === 'ACTIVE' ? (
            <EmptyState
              icon={FolderKanban}
              title="No active projects yet"
              description="Projects help structure your focus by grouping actionable tasks and aggregating analytical deep-work sessions."
              action={
                <Button onClick={() => setIsCreateOpen(true)} size="sm">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create Your First Project
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={FolderCheck}
              title="No archived projects"
              description="When you finish or retire a major initiative, archiving it keeps your analytics intact while hiding it from daily focus views."
            />
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => {
              const progressPct =
                project.taskCount > 0
                  ? Math.round((project.completedTaskCount / project.taskCount) * 100)
                  : 0;

              return (
                <Card
                  key={project.id}
                  className="overflow-hidden border-border/80 hover:border-primary/40 transition-colors flex flex-col justify-between"
                >
                  <CardContent className="p-5 space-y-4">
                    {/* Color bar & Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-3.5 w-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: project.color }}
                          aria-hidden="true"
                        />
                        <Link
                          href={`/projects/${project.id}`}
                          className="font-semibold text-base text-foreground hover:text-primary transition-colors flex items-center gap-1 group"
                        >
                          <span className="truncate">{project.name}</span>
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </div>

                      <Badge
                        variant={project.status === 'ACTIVE' ? 'default' : 'secondary'}
                        className="text-[10px] uppercase font-semibold"
                      >
                        {project.status}
                      </Badge>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                      {project.description || 'No description provided.'}
                    </p>

                    {/* Completion Metrics */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                        <span>Tasks Completion</span>
                        <span>
                          {project.completedTaskCount}/{project.taskCount} ({progressPct}%)
                        </span>
                      </div>
                      <Progress value={progressPct} max={100} className="h-1.5" />
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center justify-between pt-3 border-t border-border/50 text-xs">
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                      >
                        View Details
                      </Link>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(project)}
                          title="Edit project"
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>

                        {project.status === 'ACTIVE' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => archiveMutation.mutate(project.id)}
                            title="Archive project"
                            className="h-8 w-8 p-0"
                          >
                            <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => restoreMutation.mutate(project.id)}
                            title="Restore project"
                            className="h-8 w-8 p-0"
                          >
                            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setProjectToDelete(project)}
                          title="Delete project"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create Project Modal */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Organize tasks and allocate focused deep work towards strategic objectives.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label htmlFor="create-project-name" className="text-xs font-medium text-foreground">
                Project Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="create-project-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. FocusFlow Platform MVP"
                required
                maxLength={100}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="create-project-desc" className="text-xs font-medium text-foreground">
                Description (optional)
              </label>
              <Textarea
                id="create-project-desc"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Brief purpose, milestones, or deliverables"
                rows={3}
                maxLength={500}
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-medium text-foreground block">Color Tag</span>
              <div className="flex items-center gap-2 pt-1">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormColor(color)}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                    className={`h-7 w-7 rounded-full border-2 transition-transform cursor-pointer ${
                      formColor === color
                        ? 'border-foreground scale-110 shadow-xs'
                        : 'border-transparent hover:scale-105'
                    }`}
                  />
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={createMutation.isPending}>
                Create Project
              </Button>
            </DialogFooter>
          </form>
        </Dialog>

        {/* Edit Project Modal */}
        <Dialog
          open={!!editingProject}
          onOpenChange={(open) => {
            if (!open) {
              setEditingProject(null);
              resetForm();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Modify project details, name, or color indicator.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label htmlFor="edit-project-name" className="text-xs font-medium text-foreground">
                Project Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="edit-project-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                maxLength={100}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-project-desc" className="text-xs font-medium text-foreground">
                Description
              </label>
              <Textarea
                id="edit-project-desc"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                rows={3}
                maxLength={500}
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-medium text-foreground block">Color Tag</span>
              <div className="flex items-center gap-2 pt-1">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormColor(color)}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                    className={`h-7 w-7 rounded-full border-2 transition-transform cursor-pointer ${
                      formColor === color
                        ? 'border-foreground scale-110 shadow-xs'
                        : 'border-transparent hover:scale-105'
                    }`}
                  />
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingProject(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={updateMutation.isPending}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Dialog>

        {/* Delete Confirmation Modal (ADR-013) */}
        <Dialog
          open={!!projectToDelete}
          onOpenChange={(open) => {
            if (!open) setProjectToDelete(null);
          }}
        >
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{projectToDelete?.name}&rdquo;?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs text-muted-foreground">
            <p>
              Note: Hard deletion is permitted only if the project has 0 recorded focus sessions. If focus sessions exist, archiving is required to preserve productivity analytics.
            </p>
            <p>Any remaining tasks will be preserved and reassigned to your Inbox.</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              isLoading={deleteMutation.isPending}
              onClick={() => {
                if (projectToDelete) deleteMutation.mutate(projectToDelete.id);
              }}
            >
              Delete Project
            </Button>
          </DialogFooter>
        </Dialog>
      </div>
    </AppShell>
  );
}

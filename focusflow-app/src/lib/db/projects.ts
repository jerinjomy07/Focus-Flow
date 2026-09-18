// src/lib/db/projects.ts
// FocusFlow — Projects Data Access Layer
// Enforces tenant isolation: all queries require userId.

import { prisma } from './client';
import type {
  Project,
  ProjectWithStats,
  ProjectDetail,
  ProjectStatus,
  CreateProjectInput,
  UpdateProjectInput,
  TaskStatus,
  Priority,
} from '@/types/domain';

/**
 * Retrieves all projects belonging to a user, optionally filtered by status.
 * Enforces multi-tenant isolation via userId.
 */
export async function getProjectsByUserId(
  userId: string,
  status?: ProjectStatus
): Promise<ProjectWithStats[]> {
  const projects = await prisma.project.findMany({
    where: {
      userId,
      ...(status && { status }),
    },
    include: {
      tasks: {
        select: { status: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return projects.map((p) => {
    const taskCount = p.tasks.length;
    const completedTaskCount = p.tasks.filter((t) => t.status === 'COMPLETED').length;

    return {
      id: p.id,
      userId: p.userId,
      name: p.name,
      description: p.description,
      color: p.color,
      status: p.status as ProjectStatus,
      taskCount,
      completedTaskCount,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  });
}

/**
 * Retrieves a single project by ID, verifying ownership.
 * Returns null if not found OR if owned by another user (anti-enumeration).
 */
export async function getProjectById(
  userId: string,
  projectId: string
): Promise<ProjectWithStats | null> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId, // Mandatory ownership constraint
    },
    include: {
      tasks: {
        select: { status: true },
      },
    },
  });

  if (!project) return null;

  const taskCount = project.tasks.length;
  const completedTaskCount = project.tasks.filter((t) => t.status === 'COMPLETED').length;

  return {
    id: project.id,
    userId: project.userId,
    name: project.name,
    description: project.description,
    color: project.color,
    status: project.status as ProjectStatus,
    taskCount,
    completedTaskCount,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

/**
 * Retrieves a project by ID with all its tasks for detailed views.
 * Scoped strictly to the authenticated user.
 */
export async function getProjectDetailById(
  userId: string,
  projectId: string
): Promise<ProjectDetail | null> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId,
    },
    include: {
      tasks: {
        orderBy: [
          { status: 'asc' },
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
      },
    },
  });

  if (!project) return null;

  const taskCount = project.tasks.length;
  const completedTaskCount = project.tasks.filter((t) => t.status === 'COMPLETED').length;

  return {
    id: project.id,
    userId: project.userId,
    name: project.name,
    description: project.description,
    color: project.color,
    status: project.status as ProjectStatus,
    taskCount,
    completedTaskCount,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    tasks: project.tasks.map((t) => ({
      id: t.id,
      userId: t.userId,
      projectId: t.projectId,
      title: t.title,
      description: t.description,
      status: t.status as TaskStatus,
      priority: t.priority as Priority,
      estimatedPomodoros: t.estimatedPomodoros,
      completedPomodoros: t.completedPomodoros,
      dueDate: t.dueDate,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
  };
}

/**
 * Creates a new project for a user.
 */
export async function createProject(
  userId: string,
  data: CreateProjectInput
): Promise<Project> {
  return prisma.project.create({
    data: {
      userId,
      name: data.name.trim(),
      description: data.description?.trim() ?? null,
      color: data.color ?? '#6366f1',
      status: 'ACTIVE',
    },
  }) as Promise<Project>;
}

/**
 * Updates a project, strictly scoped to the owner's userId.
 * Returns null if the project does not exist or belongs to another user.
 */
export async function updateProject(
  userId: string,
  projectId: string,
  data: UpdateProjectInput
): Promise<Project | null> {
  // Use updateMany to ensure atomic ownership check without leaking existence
  const result = await prisma.project.updateMany({
    where: {
      id: projectId,
      userId, // Mandatory tenant isolation check
    },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() ?? null }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.status !== undefined && { status: data.status }),
    },
  });

  if (result.count === 0) return null;

  return prisma.project.findUnique({
    where: { id: projectId },
  }) as Promise<Project | null>;
}

/**
 * Deletes a project, strictly scoped to the owner's userId.
 * Enforces ADR-013: Hard deletion is blocked if the project has recorded focus sessions.
 * In that case, returns { success: false, hasSessions: true } so the route can return 409 Conflict.
 * If 0 sessions exist, deletes the project (tasks have projectId set to null) and returns { success: true }.
 */
export async function deleteProject(
  userId: string,
  projectId: string
): Promise<{ success: boolean; hasSessions?: boolean }> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId,
    },
    include: {
      _count: {
        select: { focusSessions: true },
      },
    },
  });

  if (!project) {
    return { success: false };
  }

  if (project._count.focusSessions > 0) {
    return { success: false, hasSessions: true };
  }

  const result = await prisma.project.deleteMany({
    where: {
      id: projectId,
      userId,
    },
  });

  return { success: result.count > 0 };
}

/**
 * Archives a project, setting status to ARCHIVED.
 * Scoped to userId.
 */
export async function archiveProject(
  userId: string,
  projectId: string
): Promise<Project | null> {
  return updateProject(userId, projectId, { status: 'ARCHIVED' });
}

/**
 * Restores an archived project, setting status to ACTIVE.
 * Scoped to userId.
 */
export async function restoreProject(
  userId: string,
  projectId: string
): Promise<Project | null> {
  return updateProject(userId, projectId, { status: 'ACTIVE' });
}

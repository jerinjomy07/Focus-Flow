// src/lib/db/tasks.ts
// FocusFlow — Tasks Data Access Layer
// Enforces tenant isolation: all queries require userId.
// Verifies that referenced projectId belongs to the same user.

import { prisma } from './client';
import type { Prisma } from '@prisma/client';
import type {
  TaskWithProject,
  CreateTaskInput,
  UpdateTaskInput,
} from '@/types/domain';
import type { TaskListQuery } from '@/types/api';

/**
 * Retrieves tasks for a user with optional filtering by status, project, or priority.
 * Enforces multi-tenant isolation via userId.
 */
export async function getTasksByUserId(
  userId: string,
  query: TaskListQuery = {}
): Promise<{ tasks: TaskWithProject[]; total: number; hasMore: boolean }> {
  const {
    projectId,
    status,
    priority,
    search,
    dueDateFilter,
    sort = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    pageSize = 50,
  } = query;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { userId };

  if (projectId === 'inbox' || projectId === 'none') {
    where.projectId = null;
  } else if (projectId) {
    where.projectId = projectId;
  }

  if (status) {
    where.status = status;
  }

  if (priority) {
    where.priority = priority;
  }

  if (search && search.trim().length > 0) {
    const searchTerm = search.trim();
    where.OR = [
      { title: { contains: searchTerm, mode: 'insensitive' } },
      { description: { contains: searchTerm, mode: 'insensitive' } },
    ];
  }

  if (dueDateFilter === 'none') {
    where.dueDate = null;
  } else if (dueDateFilter === 'overdue') {
    where.dueDate = { lt: new Date() };
    if (!status) {
      where.status = { not: 'COMPLETED' };
    }
  }

  // OrderBy configuration
  let orderBy: Prisma.TaskOrderByWithRelationInput[];
  if (sort === 'priority') {
    orderBy = [{ priority: sortOrder }, { createdAt: 'desc' }];
  } else if (sort === 'dueDate') {
    orderBy = [{ dueDate: { sort: sortOrder, nulls: 'last' } }, { createdAt: 'desc' }];
  } else if (sort === 'title') {
    orderBy = [{ title: sortOrder }];
  } else {
    orderBy = [
      { status: 'asc' },
      { createdAt: sortOrder },
    ];
  }

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy,
      skip,
      take: pageSize,
    }),
    prisma.task.count({ where }),
  ]);

  return {
    tasks: tasks as TaskWithProject[],
    total,
    hasMore: skip + tasks.length < total,
  };
}

/**
 * Retrieves a single task by ID, verifying user ownership.
 * Returns null if missing or owned by another user.
 */
export async function getTaskById(
  userId: string,
  taskId: string
): Promise<TaskWithProject | null> {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      userId,
    },
    include: {
      project: {
        select: { id: true, name: true, color: true },
      },
    },
  });

  return task as TaskWithProject | null;
}

/**
 * Creates a new task.
 * If projectId is provided, verifies that the project belongs to the user.
 */
export async function createTask(
  userId: string,
  data: CreateTaskInput
): Promise<TaskWithProject> {
  // Cross-entity ownership check: ensure the project belongs to this user
  if (data.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: data.projectId, userId },
    });
    if (!project) {
      throw new Error('Project not found or not owned by user');
    }
  }

  const task = await prisma.task.create({
    data: {
      userId,
      title: data.title.trim(),
      description: data.description?.trim() ?? null,
      projectId: data.projectId ?? null,
      priority: data.priority ?? 'MEDIUM',
      status: 'TODO',
      estimatedPomodoros: data.estimatedPomodoros ?? null,
      completedPomodoros: 0,
      dueDate: data.dueDate ?? null,
    },
    include: {
      project: {
        select: { id: true, name: true, color: true },
      },
    },
  });

  return task as TaskWithProject;
}

/**
 * Updates a task, strictly scoped to the owner's userId.
 * Verifies project ownership if projectId is changed.
 */
export async function updateTask(
  userId: string,
  taskId: string,
  data: UpdateTaskInput
): Promise<TaskWithProject | null> {
  // If moving to a new project, verify project ownership
  if (data.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: data.projectId, userId },
    });
    if (!project) {
      return null;
    }
  }

  const result = await prisma.task.updateMany({
    where: {
      id: taskId,
      userId, // Mandatory tenant isolation constraint
    },
    data: {
      ...(data.title !== undefined && { title: data.title.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() ?? null }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.projectId !== undefined && { projectId: data.projectId }),
      ...(data.estimatedPomodoros !== undefined && { estimatedPomodoros: data.estimatedPomodoros }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
    },
  });

  if (result.count === 0) return null;

  return getTaskById(userId, taskId);
}

/**
 * Deletes a task, verifying user ownership.
 */
export async function deleteTask(
  userId: string,
  taskId: string
): Promise<boolean> {
  const result = await prisma.task.deleteMany({
    where: {
      id: taskId,
      userId,
    },
  });

  return result.count > 0;
}

/**
 * Atomically increments completedPomodoros counter on a task.
 * Called when a focus session completes.
 */
export async function incrementTaskPomodoro(taskId: string): Promise<void> {
  await prisma.task.update({
    where: { id: taskId },
    data: {
      completedPomodoros: { increment: 1 },
      // Automatically advance status to IN_PROGRESS if currently TODO
      status: {
        set: 'IN_PROGRESS',
      },
    },
  });
}

/**
 * Marks a task as COMPLETED.
 * Strictly scoped to the owner's userId.
 */
export async function completeTask(
  userId: string,
  taskId: string
): Promise<TaskWithProject | null> {
  const result = await prisma.task.updateMany({
    where: {
      id: taskId,
      userId,
    },
    data: {
      status: 'COMPLETED',
    },
  });

  if (result.count === 0) return null;

  return getTaskById(userId, taskId);
}

/**
 * Reopens a completed task.
 * Sets status to IN_PROGRESS if completedPomodoros > 0, otherwise TODO.
 * Strictly scoped to the owner's userId.
 */
export async function reopenTask(
  userId: string,
  taskId: string
): Promise<TaskWithProject | null> {
  const task = await getTaskById(userId, taskId);
  if (!task) return null;

  const nextStatus = task.completedPomodoros > 0 ? 'IN_PROGRESS' : 'TODO';

  const result = await prisma.task.updateMany({
    where: {
      id: taskId,
      userId,
    },
    data: {
      status: nextStatus,
    },
  });

  if (result.count === 0) return null;

  return getTaskById(userId, taskId);
}

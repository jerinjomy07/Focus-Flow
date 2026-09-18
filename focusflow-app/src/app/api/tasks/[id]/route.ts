// src/app/api/tasks/[id]/route.ts
// FocusFlow — Single Task API Route Handler
// Supports retrieving, updating, and deleting an individual task.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTaskById, updateTask, deleteTask, getProjectById } from '@/lib/db';
import { UpdateTaskSchema } from '@/lib/validations';
import { isValidTaskStatusTransition } from '@/domain/tasks/task-state';
import { toErrorResponse } from '@/lib/errors';
import type { TaskStatus } from '@/types/domain';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const task = await getTaskById(session.user.id, id);

    if (!task) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: task });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { id } = await params;

    let json;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Malformed JSON payload' } },
        { status: 400 }
      );
    }

    const parsed = UpdateTaskSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid update payload',
            details: parsed.error.issues.map((i) => ({
              field: String(i.path[0]),
              issue: i.message,
            })),
          },
        },
        { status: 400 }
      );
    }

    // Fetch existing task to verify ownership and valid status transition
    const existing = await getTaskById(session.user.id, id);
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 }
      );
    }

    // Verify canonical state transition if status is being updated
    if (parsed.data.status && parsed.data.status !== existing.status) {
      if (!isValidTaskStatusTransition(existing.status, parsed.data.status as TaskStatus)) {
        return NextResponse.json(
          {
            error: {
              code: 'INVALID_STATE_TRANSITION',
              message: `Cannot transition task from ${existing.status} to ${parsed.data.status}`,
            },
          },
          { status: 400 }
        );
      }
    }

    // If changing project, ensure target project belongs to the current user
    if (parsed.data.projectId) {
      const project = await getProjectById(session.user.id, parsed.data.projectId);
      if (!project) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid projectId: project not found or access denied',
            },
          },
          { status: 400 }
        );
      }
    }

    const updated = await updateTask(session.user.id, id, {
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status as TaskStatus | undefined,
      priority: parsed.data.priority,
      projectId: parsed.data.projectId,
      estimatedPomodoros: parsed.data.estimatedPomodoros,
      dueDate: parsed.data.dueDate !== undefined
        ? parsed.data.dueDate ? new Date(parsed.data.dueDate) : null
        : undefined,
    });

    if (!updated) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const deleted = await deleteTask(session.user.id, id);

    if (!deleted) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

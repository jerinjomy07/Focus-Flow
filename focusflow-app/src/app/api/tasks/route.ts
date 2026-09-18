// src/app/api/tasks/route.ts
// FocusFlow — Tasks Collection API Handler
// Supports querying tasks (with filtering, search, sorting, and pagination)
// and creating new tasks with cross-tenant project validation.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTasksByUserId, createTask, getProjectById } from '@/lib/db';
import { CreateTaskSchema, TaskListQuerySchema } from '@/lib/validations';
import { toErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const rawQuery = {
      projectId: searchParams.get('projectId') || undefined,
      status: searchParams.get('status') || undefined,
      priority: searchParams.get('priority') || undefined,
      search: searchParams.get('search') || undefined,
      dueDateFilter: searchParams.get('dueDateFilter') || undefined,
      sort: searchParams.get('sort') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
      page: searchParams.get('page') || undefined,
      pageSize: searchParams.get('pageSize') || undefined,
    };

    const parsedQuery = TaskListQuerySchema.safeParse(rawQuery);
    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: parsedQuery.error.issues.map((i) => ({
              field: String(i.path[0]),
              issue: i.message,
            })),
          },
        },
        { status: 400 }
      );
    }

    const { tasks, total, hasMore } = await getTasksByUserId(
      session.user.id,
      parsedQuery.data
    );

    return NextResponse.json({
      data: tasks,
      meta: {
        page: parsedQuery.data.page,
        pageSize: parsedQuery.data.pageSize,
        total,
        hasMore,
      },
    });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    let json;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Malformed JSON payload' } },
        { status: 400 }
      );
    }

    const parsed = CreateTaskSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid task payload',
            details: parsed.error.issues.map((i) => ({
              field: String(i.path[0]),
              issue: i.message,
            })),
          },
        },
        { status: 400 }
      );
    }

    // Verify cross-entity ownership: projectId must belong to current user
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

    const task = await createTask(session.user.id, {
      title: parsed.data.title,
      description: parsed.data.description,
      projectId: parsed.data.projectId,
      priority: parsed.data.priority,
      estimatedPomodoros: parsed.data.estimatedPomodoros,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    });

    return NextResponse.json({ data: task }, { status: 201 });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

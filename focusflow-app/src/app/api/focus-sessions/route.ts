// src/app/api/focus-sessions/route.ts
// FocusFlow — Focus Sessions Collection API Handler
// GET: Query user session history (paginated, filterable by type and status)
// POST: Start a new focus session with database-level single active session guarantee

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createFocusSession, getSessionHistory } from '@/lib/db';
import { StartSessionSchema, SessionListQuerySchema } from '@/lib/validations';
import { toErrorResponse, ActiveSessionConflictError, ValidationError, NotFoundError } from '@/lib/errors';
import { apiLimiter } from '@/lib/rate-limit';

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
      type: searchParams.get('type') || undefined,
      status: searchParams.get('status') || undefined,
      taskId: searchParams.get('taskId') || undefined,
      projectId: searchParams.get('projectId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      sort: searchParams.get('sort') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
      page: searchParams.get('page') || undefined,
      pageSize: searchParams.get('pageSize') || undefined,
    };

    const parsedQuery = SessionListQuerySchema.safeParse(rawQuery);
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

    const { getUserById } = await import('@/lib/db');
    const user = await getUserById(session.user.id);
    const userTimezone = user?.timezone || 'UTC';

    const { sessions, total, totalPages, page, pageSize, hasMore } = await getSessionHistory(
      session.user.id,
      parsedQuery.data,
      userTimezone
    );

    return NextResponse.json({
      data: sessions,
      meta: {
        page,
        pageSize,
        total,
        totalPages,
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

    // Rate limiting — 60 requests per 60 seconds per authenticated user
    const rateLimit = await apiLimiter.check(session.user.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) },
        }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Request body must be valid JSON' } },
        { status: 400 }
      );
    }

    const parsed = StartSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: parsed.error.issues.map((i) => ({
              field: String(i.path[0]),
              issue: i.message,
            })),
          },
        },
        { status: 400 }
      );
    }

    const newSession = await createFocusSession(session.user.id, {
      ...parsed.data,
      startedAt: new Date(parsed.data.startedAt),
    });

    return NextResponse.json(
      { data: newSession },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ActiveSessionConflictError) {
      return NextResponse.json(
        {
          error: {
            code: 'ACTIVE_SESSION_EXISTS',
            message: error.message,
            activeSession: error.activeSession ?? null,
          },
        },
        { status: 409 }
      );
    }

    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
            details: error.details,
          },
        },
        { status: 400 }
      );
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: error.message,
          },
        },
        { status: 404 }
      );
    }

    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

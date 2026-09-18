// src/app/api/notifications/route.ts
// FocusFlow — Notifications Collection API Route Handlers (Phase 10)

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { NotificationService } from '@/domain/services';
import { NotificationListQuerySchema } from '@/lib/validations';
import { toErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

/**
 * GET /api/notifications
 * Retrieves paginated notifications and unread count for the authenticated user.
 * Sorted newest first. Bounded page size (max 50).
 */
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
      page: searchParams.get('page') || undefined,
      pageSize: searchParams.get('pageSize') || undefined,
      unreadOnly: searchParams.get('unreadOnly') || undefined,
    };

    const parsed = NotificationListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: parsed.error.issues.map((i) => ({
              field: String(i.path[0]),
              issue: i.message,
            })),
          },
        },
        { status: 400 }
      );
    }

    const result = await NotificationService.getNotifications(
      session.user.id,
      parsed.data
    );

    return NextResponse.json({
      data: result.notifications.map((n) => ({
        id: n.id,
        userId: n.userId,
        type: n.type,
        title: n.title,
        body: n.body,
        readAt: n.readAt ? n.readAt.toISOString() : null,
        metadata: n.metadata,
        createdAt: n.createdAt.toISOString(),
      })),
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
        hasMore: result.hasMore,
        unreadCount: result.unreadCount,
      },
    });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
// src/app/api/notifications/[id]/read/route.ts
// FocusFlow — Mark Notification as Read Route Handler (Phase 10)

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { NotificationService } from '@/domain/services';
import { toErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

/**
 * PATCH /api/notifications/[id]/read
 * Marks an individual notification as read.
 * Enforces ownership boundary: returns 404 if notification not found or belongs to another user.
 * Idempotent.
 */
export async function PATCH(
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
    const notification = await NotificationService.markAsRead(session.user.id, id);

    return NextResponse.json({
      data: {
        id: notification.id,
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        readAt: notification.readAt ? notification.readAt.toISOString() : null,
        metadata: notification.metadata,
        createdAt: notification.createdAt.toISOString(),
      },
    });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
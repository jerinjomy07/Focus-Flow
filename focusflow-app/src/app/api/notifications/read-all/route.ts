// src/app/api/notifications/read-all/route.ts
// FocusFlow — Mark All Notifications Read Route Handler (Phase 10)

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { NotificationService } from '@/domain/services';
import { toErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

/**
 * POST /api/notifications/read-all
 * Marks all unread notifications read for the authenticated user.
 * Idempotent and returns the count of updated notifications.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const result = await NotificationService.markAllAsRead(session.user.id);

    return NextResponse.json({
      data: {
        count: result.count,
      },
    });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
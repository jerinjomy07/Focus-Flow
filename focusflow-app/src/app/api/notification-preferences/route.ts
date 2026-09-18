// src/app/api/notification-preferences/route.ts
// FocusFlow — Notification Preferences API Route Handlers (Phase 10)

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { NotificationService } from '@/domain/services';
import { UpdateNotificationPreferenceSchema } from '@/lib/validations';
import { toErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

/**
 * GET /api/notification-preferences
 * Retrieves user's notification delivery preferences.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const pref = await NotificationService.getPreferences(session.user.id);

    return NextResponse.json({
      data: {
        focusSessionCompletion: pref.focusSessionCompletion,
      },
    });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

/**
 * PATCH /api/notification-preferences
 * Updates user's notification delivery preferences.
 * Rejects unknown fields and validates booleans strictly.
 */
export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Malformed JSON payload' } },
        { status: 400 }
      );
    }

    const parsed = UpdateNotificationPreferenceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid notification preferences payload',
            details: parsed.error.issues.map((i) => ({
              field: String(i.path[0]),
              issue: i.message,
            })),
          },
        },
        { status: 400 }
      );
    }

    const updated = await NotificationService.updatePreferences(
      session.user.id,
      parsed.data
    );

    return NextResponse.json({
      data: {
        focusSessionCompletion: updated.focusSessionCompletion,
      },
    });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
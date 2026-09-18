// src/app/api/users/me/route.ts
// FocusFlow — Current User Profile API Route Handlers

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import * as db from '@/lib/db';
import { UpdateUserSchema } from '@/lib/validations';
import { toErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

/**
 * GET /api/users/me
 * Retrieves current authenticated user profile and preferences.
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

    const [user, settings] = await Promise.all([
      db.getUserById(session.user.id),
      db.getSettingsByUserId(session.user.id),
    ]);

    if (!user) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'User profile not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        timezone: user.timezone,
        image: user.image,
        onboardedAt: user.onboardedAt,
        settings: settings
          ? {
              focusDuration: settings.focusDuration,
              shortBreakDuration: settings.shortBreakDuration,
              longBreakDuration: settings.longBreakDuration,
              sessionsBeforeLongBreak: settings.sessionsBeforeLongBreak,
              autoStartBreaks: settings.autoStartBreaks,
              autoStartFocus: settings.autoStartFocus,
              soundEnabled: settings.soundEnabled,
              notificationsEnabled: settings.notificationsEnabled,
              theme: settings.theme,
            }
          : null,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

/**
 * PATCH /api/users/me
 * Updates current user profile details (name, timezone).
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

    const parsed = UpdateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid profile update payload',
            details: parsed.error.issues.map((i) => ({
              field: String(i.path[0]),
              issue: i.message,
            })),
          },
        },
        { status: 400 }
      );
    }

    const updated = await db.updateUser(session.user.id, parsed.data);
    if (!updated) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        timezone: updated.timezone,
        image: updated.image,
        onboardedAt: updated.onboardedAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

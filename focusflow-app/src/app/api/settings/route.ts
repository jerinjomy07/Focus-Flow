// src/app/api/settings/route.ts
// FocusFlow — User Settings API Route Handlers

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import * as db from '@/lib/db';
import { UpdateSettingsSchema } from '@/lib/validations';
import { toErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

/**
 * GET /api/settings
 * Retrieves user's timer durations, behavior preferences, and authoritative timezone.
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
        { error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        focusDuration: settings?.focusDuration ?? 25,
        shortBreakDuration: settings?.shortBreakDuration ?? 5,
        longBreakDuration: settings?.longBreakDuration ?? 15,
        sessionsBeforeLongBreak: settings?.sessionsBeforeLongBreak ?? 4,
        autoStartBreaks: settings?.autoStartBreaks ?? false,
        autoStartFocus: settings?.autoStartFocus ?? false,
        soundEnabled: settings?.soundEnabled ?? true,
        notificationsEnabled: settings?.notificationsEnabled ?? true,
        theme: settings?.theme ?? 'SYSTEM',
        timezone: user.timezone ?? 'UTC',
      },
    });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

/**
 * PATCH /api/settings
 * Updates timer durations, preferences, and/or timezone.
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

    const parsed = UpdateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid settings payload',
            details: parsed.error.issues.map((i) => ({
              field: String(i.path[0]),
              issue: i.message,
            })),
          },
        },
        { status: 400 }
      );
    }

    let updatedTimezone: string | undefined;
    if (parsed.data.timezone !== undefined) {
      const updatedUser = await db.updateUser(session.user.id, {
        timezone: parsed.data.timezone,
      });
      updatedTimezone = updatedUser?.timezone;
    }

    const updated = await db.updateSettings(session.user.id, parsed.data);

    if (updatedTimezone === undefined) {
      const user = await db.getUserById(session.user.id);
      updatedTimezone = user?.timezone ?? 'UTC';
    }

    return NextResponse.json({
      data: {
        focusDuration: updated.focusDuration,
        shortBreakDuration: updated.shortBreakDuration,
        longBreakDuration: updated.longBreakDuration,
        sessionsBeforeLongBreak: updated.sessionsBeforeLongBreak,
        autoStartBreaks: updated.autoStartBreaks,
        autoStartFocus: updated.autoStartFocus,
        soundEnabled: updated.soundEnabled,
        notificationsEnabled: updated.notificationsEnabled,
        theme: updated.theme,
        timezone: updatedTimezone,
      },
    });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

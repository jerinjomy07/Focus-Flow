// src/app/api/focus-sessions/[id]/pause/route.ts
// FocusFlow — Pause Focus Session API Handler
// Explicitly pauses an in-progress session. Freezes the countdown and records pausedAt timestamp.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { pauseFocusSession } from '@/lib/db';
import { toErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

export async function POST(
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
    const updated = await pauseFocusSession(session.user.id, id);

    return NextResponse.json({ data: updated });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

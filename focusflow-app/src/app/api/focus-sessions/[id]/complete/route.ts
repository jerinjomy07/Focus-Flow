// src/app/api/focus-sessions/[id]/complete/route.ts
// FocusFlow — Complete Focus Session API Handler
// Finalizes a session upon countdown expiry. Sets status COMPLETED and increments task Pomodoros atomically.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { completeFocusSession } from '@/lib/db';
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
    const updated = await completeFocusSession(session.user.id, id);

    return NextResponse.json({ data: updated });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

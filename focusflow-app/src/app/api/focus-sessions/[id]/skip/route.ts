// src/app/api/focus-sessions/[id]/skip/route.ts
// FocusFlow — Skip Focus Session API Handler
// Explicitly skips an in-progress or paused session to advance to the next cycle interval. Sets status SKIPPED.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { skipFocusSession } from '@/lib/db';
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
    const updated = await skipFocusSession(session.user.id, id);

    return NextResponse.json({ data: updated });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

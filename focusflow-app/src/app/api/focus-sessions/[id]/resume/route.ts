// src/app/api/focus-sessions/[id]/resume/route.ts
// FocusFlow — Resume Focus Session API Handler
// Explicitly resumes a paused session. Adds pause delta to pausedDuration and clears pausedAt.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { resumeFocusSession } from '@/lib/db';
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
    const updated = await resumeFocusSession(session.user.id, id);

    return NextResponse.json({ data: updated });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

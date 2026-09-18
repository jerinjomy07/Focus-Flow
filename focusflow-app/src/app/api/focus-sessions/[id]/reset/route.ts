// src/app/api/focus-sessions/[id]/reset/route.ts
// FocusFlow — Reset Focus Session API Handler
// Abandons an in-progress or paused session. Sets status ABANDONED and calculates active elapsed time.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { resetFocusSession } from '@/lib/db';
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
    const updated = await resetFocusSession(session.user.id, id);

    return NextResponse.json({ data: updated });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

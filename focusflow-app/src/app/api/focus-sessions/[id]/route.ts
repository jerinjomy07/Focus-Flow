// src/app/api/focus-sessions/[id]/route.ts
// FocusFlow — Focus Session Detail API Handler
// GET: Retrieves a single historical or active session by ID scoped to authenticated user

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionById } from '@/lib/db';
import { toErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

export async function GET(
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
    const focusSession = await getSessionById(session.user.id, id);

    if (!focusSession) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Focus session not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: focusSession });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

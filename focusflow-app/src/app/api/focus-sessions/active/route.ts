// src/app/api/focus-sessions/active/route.ts
// FocusFlow — Active Focus Session Query API Handler
// GET: Returns the user's currently active (IN_PROGRESS) session for recovery and multi-tab synchronization.
// Paused sessions never auto-expire. Running sessions past expiration are automatically reconciled.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getActiveSession } from '@/lib/db';
import { toErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const active = await getActiveSession(session.user.id);

    return NextResponse.json({
      data: active,
    });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

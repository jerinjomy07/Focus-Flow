// src/app/api/auth/mobile/session/route.ts
// FocusFlow — Mobile Session Restoration Endpoint
//
// Validates an active Bearer token and returns the current user profile.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { toErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Session is invalid or has expired' } },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        data: {
          user: session.user,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const { statusCode, body: errorBody } = toErrorResponse(error);
    return NextResponse.json(errorBody, { status: statusCode });
  }
}

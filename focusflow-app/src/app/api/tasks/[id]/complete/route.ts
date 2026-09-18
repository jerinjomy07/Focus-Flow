// src/app/api/tasks/[id]/complete/route.ts
// FocusFlow — Task Completion API Route Handler
// Transitions task status to COMPLETED and preserves completed Pomodoros history.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { completeTask } from '@/lib/db';
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
    const task = await completeTask(session.user.id, id);

    if (!task) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: task });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

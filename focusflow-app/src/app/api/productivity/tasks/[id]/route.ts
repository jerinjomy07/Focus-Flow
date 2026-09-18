// src/app/api/productivity/tasks/[id]/route.ts
// FocusFlow — Task Productivity Summary API Handler
// GET: Retrieves task focus statistics and completed pomodoros

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ProductivityService } from '@/domain/services';
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
    const taskSummary = await ProductivityService.getTaskSummary(session.user.id, id);

    return NextResponse.json({ data: taskSummary });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

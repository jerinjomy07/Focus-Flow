// src/app/api/productivity/projects/route.ts
// FocusFlow — Project Productivity Breakdown API Handler
// GET: Aggregates completed focus duration across projects with unrounded percentages

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ProductivityService } from '@/domain/services';
import { ProductivitySummaryQuerySchema } from '@/lib/validations';
import { toErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const rawQuery = {
      period: searchParams.get('period') || undefined,
      date: searchParams.get('date') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    };

    const parsedQuery = ProductivitySummaryQuerySchema.safeParse(rawQuery);
    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: parsedQuery.error.issues.map((i) => ({
              field: String(i.path[0]),
              issue: i.message,
            })),
          },
        },
        { status: 400 }
      );
    }

    const projectSummaries = await ProductivityService.getProjectSummaries(
      session.user.id,
      parsedQuery.data
    );

    return NextResponse.json({ data: projectSummaries });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

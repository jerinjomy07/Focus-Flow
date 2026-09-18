// src/app/api/productivity/trend/route.ts
// FocusFlow — Productivity Trend API Handler
// GET: Aggregates continuous daily focus trend points using mutually exclusive query modes:
// - Mode A: date=YYYY-MM-DD
// - Mode B: period=today|yesterday|week|month (defaults to week if no params)
// - Mode C: startDate & endDate (both required)

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
            message: 'Invalid query parameters: query modes are mutually exclusive',
            details: parsedQuery.error.issues.map((i) => ({
              field: String(i.path[0]),
              issue: i.message,
            })),
          },
        },
        { status: 400 }
      );
    }

    const trend = await ProductivityService.getTrend(
      session.user.id,
      parsedQuery.data
    );

    return NextResponse.json({ data: trend });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

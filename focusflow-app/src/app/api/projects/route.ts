// src/app/api/projects/route.ts
// FocusFlow — Projects Collection API Handler
// Supports listing user projects (filtered by status) and creating projects.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getProjectsByUserId, createProject } from '@/lib/db';
import { CreateProjectSchema, ProjectListQuerySchema } from '@/lib/validations';
import { toErrorResponse } from '@/lib/errors';
import type { ProjectStatus } from '@/types/domain';

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
    const rawStatus = searchParams.get('status') || undefined;

    const queryParsed = ProjectListQuerySchema.safeParse({ status: rawStatus });
    const status = queryParsed.success ? (queryParsed.data.status as ProjectStatus) : undefined;

    const projects = await getProjectsByUserId(session.user.id, status);

    return NextResponse.json({ data: projects });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    let json;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Malformed JSON payload' } },
        { status: 400 }
      );
    }

    const parsed = CreateProjectSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid project payload',
            details: parsed.error.issues.map((i) => ({
              field: String(i.path[0]),
              issue: i.message,
            })),
          },
        },
        { status: 400 }
      );
    }

    const project = await createProject(session.user.id, parsed.data);

    return NextResponse.json({ data: project }, { status: 201 });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

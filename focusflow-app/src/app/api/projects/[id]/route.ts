// src/app/api/projects/[id]/route.ts
// FocusFlow — Single Project API Handler
// Supports retrieving, updating, and conditionally deleting a single project.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getProjectDetailById, updateProject, deleteProject } from '@/lib/db';
import { UpdateProjectSchema } from '@/lib/validations';
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
    const project = await getProjectDetailById(session.user.id, id);

    if (!project) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: project });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function PATCH(
  req: Request,
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

    let json;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Malformed JSON payload' } },
        { status: 400 }
      );
    }

    const parsed = UpdateProjectSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid update payload',
            details: parsed.error.issues.map((i) => ({
              field: String(i.path[0]),
              issue: i.message,
            })),
          },
        },
        { status: 400 }
      );
    }

    const updated = await updateProject(session.user.id, id, parsed.data);

    if (!updated) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function DELETE(
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
    const result = await deleteProject(session.user.id, id);

    // Enforce ADR-013: Block deletion if project has recorded focus sessions
    if (result.hasSessions) {
      return NextResponse.json(
        {
          error: {
            code: 'PROJECT_HAS_SESSIONS',
            message:
              'Cannot delete a project with recorded focus history. Archive the project instead to preserve your productivity analytics.',
          },
        },
        { status: 409 }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// src/app/api/onboarding/complete/route.ts
// FocusFlow — Onboarding Completion API Route Handler
// Atomically persists user preferences, establishes initial projects/tasks,
// and marks onboarding state as completed.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/client';
import { toErrorResponse } from '@/lib/errors';
import { OnboardingCompleteSchema } from '@/lib/validations';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Malformed JSON payload' } },
        { status: 400 }
      );
    }

    const parsed = OnboardingCompleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid onboarding payload',
            details: parsed.error.issues.map((i) => ({
              field: String(i.path[0]),
              issue: i.message,
            })),
          },
        },
        { status: 400 }
      );
    }

    const {
      timezone,
      focusDuration,
      shortBreakDuration,
      longBreakDuration,
      dailyGoal,
      firstProjectName,
      firstTaskTitle,
    } = parsed.data;

    const userId = session.user.id;

    // Atomic completion transaction
    await prisma.$transaction(async (tx) => {
      // 1. Mark user as onboarded and set confirmed timezone
      await tx.user.update({
        where: { id: userId },
        data: {
          timezone,
          onboardedAt: new Date(),
        },
      });

      // 2. Update user settings with chosen durations
      await tx.userSettings.upsert({
        where: { userId },
        update: {
          focusDuration,
          shortBreakDuration,
          longBreakDuration,
        },
        create: {
          userId,
          focusDuration,
          shortBreakDuration,
          longBreakDuration,
          sessionsBeforeLongBreak: 4,
          autoStartBreaks: false,
          autoStartFocus: false,
          soundEnabled: true,
          notificationsEnabled: true,
          theme: 'SYSTEM',
        },
      });

      // 3. Create Daily Pomodoro Goal
      await tx.goal.create({
        data: {
          userId,
          type: 'POMODORO_COUNT',
          target: dailyGoal,
          period: 'DAILY',
          startDate: new Date(),
          isActive: true,
        },
      });

      // 4. Optionally create first project and task
      let createdProjectId: string | null = null;
      if (firstProjectName && firstProjectName.trim().length > 0) {
        const project = await tx.project.create({
          data: {
            userId,
            name: firstProjectName.trim(),
            color: '#6366f1',
            status: 'ACTIVE',
          },
        });
        createdProjectId = project.id;
      }

      if (firstTaskTitle && firstTaskTitle.trim().length > 0) {
        await tx.task.create({
          data: {
            userId,
            projectId: createdProjectId,
            title: firstTaskTitle.trim(),
            priority: 'HIGH',
            status: 'TODO',
            estimatedPomodoros: 2,
            completedPomodoros: 0,
          },
        });
      }
    });

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        timezone: true,
        onboardedAt: true,
      },
    });

    return NextResponse.json({
      data: {
        success: true,
        message: 'Onboarding completed successfully',
        user: updatedUser
          ? {
              id: updatedUser.id,
              name: updatedUser.name,
              email: updatedUser.email,
              timezone: updatedUser.timezone,
              onboardedAt: updatedUser.onboardedAt ? updatedUser.onboardedAt.toISOString() : null,
            }
          : null,
      },
    });
  } catch (error) {
    const { statusCode, body } = toErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

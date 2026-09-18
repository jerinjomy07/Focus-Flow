// src/lib/db/goals.ts
// FocusFlow — Goals Data Access Layer
// Enforces tenant isolation: all queries require userId.

import { prisma } from './client';
import type { Goal, GoalPeriod, CreateGoalInput, UpdateGoalInput } from '@/types/domain';

/**
 * Retrieves all goals for a user, optionally filtered by period (DAILY | WEEKLY).
 */
export async function getGoalsByUserId(
  userId: string,
  period?: GoalPeriod
): Promise<Goal[]> {
  const goals = await prisma.goal.findMany({
    where: {
      userId,
      ...(period && { period }),
      isActive: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return goals as Goal[];
}

/**
 * Retrieves a single goal by ID, verifying user ownership.
 */
export async function getGoalById(
  userId: string,
  goalId: string
): Promise<Goal | null> {
  const goal = await prisma.goal.findFirst({
    where: {
      id: goalId,
      userId,
    },
  });

  return goal as Goal | null;
}

/**
 * Creates a new goal for a user.
 */
export async function createGoal(
  userId: string,
  data: CreateGoalInput
): Promise<Goal> {
  const goal = await prisma.goal.create({
    data: {
      userId,
      type: data.type,
      target: data.target,
      period: data.period,
      startDate: new Date(),
      isActive: true,
    },
  });

  return goal as Goal;
}

/**
 * Updates a goal, strictly scoped to user's ownership.
 */
export async function updateGoal(
  userId: string,
  goalId: string,
  data: UpdateGoalInput
): Promise<Goal | null> {
  const result = await prisma.goal.updateMany({
    where: {
      id: goalId,
      userId,
    },
    data: {
      ...(data.target !== undefined && { target: data.target }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  if (result.count === 0) return null;

  return getGoalById(userId, goalId);
}

/**
 * Deletes a goal, verifying user ownership.
 */
export async function deleteGoal(
  userId: string,
  goalId: string
): Promise<boolean> {
  const result = await prisma.goal.deleteMany({
    where: {
      id: goalId,
      userId,
    },
  });

  return result.count > 0;
}

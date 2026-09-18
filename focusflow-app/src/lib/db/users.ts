// src/lib/db/users.ts
// FocusFlow — User Data Access Layer
// Direct database access functions for User entity.
// Scoped to enforce multi-tenant isolation and security invariants.

import { prisma } from './client';
import type { User } from '@/types/domain';

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  timezone?: string;
}

export interface UpdateUserData {
  name?: string;
  timezone?: string;
  image?: string | null;
  onboardedAt?: Date | null;
}

/**
 * Finds a user by ID.
 * Returns null if not found.
 */
export async function getUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { id },
  });
}

/**
 * Finds a user by normalized lowercase email.
 * Includes passwordHash for authentication routines.
 */
export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
}

/**
 * Creates a new user along with their initial default UserSettings
 * inside an atomic transaction.
 */
export async function createUser(data: CreateUserData): Promise<User> {
  const normalizedEmail = data.email.toLowerCase().trim();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: data.name.trim(),
        email: normalizedEmail,
        passwordHash: data.passwordHash,
        timezone: data.timezone ?? 'UTC',
      },
    });

    // Automatically provision default user settings
    await tx.userSettings.create({
      data: {
        userId: user.id,
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        sessionsBeforeLongBreak: 4,
        autoStartBreaks: false,
        autoStartFocus: false,
        soundEnabled: true,
        notificationsEnabled: true,
        theme: 'SYSTEM',
      },
    });

    return user;
  });
}

/**
 * Updates a user's profile information.
 * Enforces ownership boundary via where: { id }.
 */
export async function updateUser(id: string, data: UpdateUserData): Promise<User | null> {
  try {
    return await prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        ...(data.image !== undefined && { image: data.image }),
        ...(data.onboardedAt !== undefined && { onboardedAt: data.onboardedAt }),
      },
    });
  } catch {
    return null;
  }
}

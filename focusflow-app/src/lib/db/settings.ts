// src/lib/db/settings.ts
// FocusFlow — User Settings Data Access Layer

import { prisma } from './client';
import type { UserSettings, UpdateSettingsInput } from '@/types/domain';

/**
 * Retrieves the settings for a user.
 */
export async function getSettingsByUserId(userId: string): Promise<UserSettings | null> {
  return prisma.userSettings.findUnique({
    where: { userId },
  });
}

/**
 * Updates a user's settings.
 * If settings don't exist yet, creates them with provided values.
 */
export async function updateSettings(
  userId: string,
  data: UpdateSettingsInput
): Promise<UserSettings> {
  return prisma.userSettings.upsert({
    where: { userId },
    update: {
      ...(data.focusDuration !== undefined && { focusDuration: data.focusDuration }),
      ...(data.shortBreakDuration !== undefined && { shortBreakDuration: data.shortBreakDuration }),
      ...(data.longBreakDuration !== undefined && { longBreakDuration: data.longBreakDuration }),
      ...(data.sessionsBeforeLongBreak !== undefined && { sessionsBeforeLongBreak: data.sessionsBeforeLongBreak }),
      ...(data.autoStartBreaks !== undefined && { autoStartBreaks: data.autoStartBreaks }),
      ...(data.autoStartFocus !== undefined && { autoStartFocus: data.autoStartFocus }),
      ...(data.soundEnabled !== undefined && { soundEnabled: data.soundEnabled }),
      ...(data.notificationsEnabled !== undefined && { notificationsEnabled: data.notificationsEnabled }),
      ...(data.theme !== undefined && { theme: data.theme }),
    },
    create: {
      userId,
      focusDuration: data.focusDuration ?? 25,
      shortBreakDuration: data.shortBreakDuration ?? 5,
      longBreakDuration: data.longBreakDuration ?? 15,
      sessionsBeforeLongBreak: data.sessionsBeforeLongBreak ?? 4,
      autoStartBreaks: data.autoStartBreaks ?? false,
      autoStartFocus: data.autoStartFocus ?? false,
      soundEnabled: data.soundEnabled ?? true,
      notificationsEnabled: data.notificationsEnabled ?? true,
      theme: data.theme ?? 'SYSTEM',
    },
  });
}

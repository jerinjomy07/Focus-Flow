// mobile/src/api/settings.ts
// FocusFlow Mobile — Settings API Endpoints

import { api } from './client';
import { UserSettings } from '../types';

export const settingsApi = {
  getSettings: async (): Promise<UserSettings> => {
    const res = await api.get<any>('/settings');
    const raw = res?.settings || res;
    return {
      focusDurationMinutes: raw?.focusDurationMinutes ?? raw?.focusDuration ?? 25,
      shortBreakMinutes: raw?.shortBreakMinutes ?? raw?.shortBreakDuration ?? 5,
      longBreakMinutes: raw?.longBreakMinutes ?? raw?.longBreakDuration ?? 15,
      dailyGoalMinutes: raw?.dailyGoalMinutes ?? 100,
      soundEnabled: raw?.soundEnabled ?? true,
      soundVolume: raw?.soundVolume ?? 80,
      autoStartBreaks: raw?.autoStartBreaks ?? false,
      autoStartFocus: raw?.autoStartFocus ?? false,
      theme: raw?.theme ?? 'SYSTEM',
      timezone: raw?.timezone ?? 'UTC',
    };
  },

  updateSettings: async (data: Partial<UserSettings>): Promise<UserSettings> => {
    const res = await api.patch<any>('/settings', data);
    return res?.settings || res;
  },
};

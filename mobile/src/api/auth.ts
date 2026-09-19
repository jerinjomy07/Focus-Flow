// mobile/src/api/auth.ts
// FocusFlow Mobile — Authentication API Endpoints

import { api } from './client';
import { User } from '../types';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sessionId: string;
  user: User;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sessionId: string;
}

export interface RegisterResponse {
  user: User;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

export const authApi = {
  login: async (credentials: { email: string; password: string; deviceName?: string }): Promise<LoginResponse> => {
    return api.post<LoginResponse>('/auth/mobile/login', credentials);
  },

  resetPassword: async (payload: { email: string; newPassword: string }): Promise<ResetPasswordResponse> => {
    return api.post<ResetPasswordResponse>('/auth/reset-password', payload);
  },

  refresh: async (refreshToken: string): Promise<RefreshResponse> => {
    return api.post<RefreshResponse>('/auth/mobile/refresh', { refreshToken });
  },

  register: async (payload: { name: string; email: string; password: string }): Promise<RegisterResponse> => {
    return api.post<RegisterResponse>('/auth/register', payload);
  },

  restoreSession: async (): Promise<{ user: User }> => {
    return api.get<{ user: User }>('/auth/mobile/session');
  },

  logout: async (payload?: { refreshToken?: string }): Promise<{ success: boolean }> => {
    return api.post<{ success: boolean }>('/auth/mobile/logout', payload);
  },

  completeOnboarding: async (data: {
    timezone: string;
    focusDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
    dailyGoal: number;
    firstProjectName?: string;
  }): Promise<{ user: User }> => {
    return api.post<{ user: User }>('/onboarding/complete', data);
  },
};

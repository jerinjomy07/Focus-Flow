// mobile/src/api/focusSessions.ts
// FocusFlow Mobile — Focus Session Lifecycle API Endpoints

import { api } from './client';
import { FocusSession, SessionType } from '../types';

export interface StartSessionPayload {
  type: SessionType;
  targetDurationMinutes?: number;
  taskId?: string;
  projectId?: string;
}

export const focusSessionsApi = {
  getActiveSession: async (): Promise<FocusSession | null> => {
    const res = await api.get<any>('/focus-sessions/active');
    return res?.session !== undefined ? res.session : res;
  },

  startSession: async (payload: StartSessionPayload): Promise<FocusSession> => {
    const rawType = String(payload.type);
    const type = rawType === 'POMODORO' ? 'FOCUS' : rawType;
    const plannedDuration = payload.targetDurationMinutes
      ? payload.targetDurationMinutes * 60
      : 25 * 60;

    const body: Record<string, any> = {
      type,
      plannedDuration,
      startedAt: new Date().toISOString(),
    };
    if (payload.taskId) {
      body.taskId = payload.taskId;
    }
    if (payload.projectId) {
      body.projectId = payload.projectId;
    }

    const res = await api.post<any>('/focus-sessions', body);
    return res?.session !== undefined ? res.session : res;
  },

  pauseSession: async (id: string): Promise<FocusSession> => {
    const res = await api.post<any>(`/focus-sessions/${id}/pause`);
    return res?.session !== undefined ? res.session : res;
  },

  resumeSession: async (id: string): Promise<FocusSession> => {
    const res = await api.post<any>(`/focus-sessions/${id}/resume`);
    return res?.session !== undefined ? res.session : res;
  },

  completeSession: async (id: string): Promise<FocusSession> => {
    const res = await api.post<any>(`/focus-sessions/${id}/complete`);
    return res?.session !== undefined ? res.session : res;
  },

  skipSession: async (id: string): Promise<FocusSession> => {
    const res = await api.post<any>(`/focus-sessions/${id}/skip`);
    return res?.session !== undefined ? res.session : res;
  },

  resetSession: async (id: string): Promise<FocusSession> => {
    const res = await api.post<any>(`/focus-sessions/${id}/reset`);
    return res?.session !== undefined ? res.session : res;
  },

  getSession: async (id: string): Promise<FocusSession> => {
    const res = await api.get<any>(`/focus-sessions/${id}`);
    return res?.session !== undefined ? res.session : res;
  },
};

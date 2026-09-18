// mobile/src/api/notifications.ts
// FocusFlow Mobile — Notifications API Endpoints

import { api } from './client';
import { NotificationItem, NotificationPreferences } from '../types';

export interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

export const notificationsApi = {
  getNotifications: async (): Promise<NotificationsResponse> => {
    const res = await api.get<NotificationsResponse>('/notifications');
    return res;
  },

  markAsRead: async (id: string): Promise<NotificationItem> => {
    const res = await api.post<{ notification: NotificationItem }>(`/notifications/${id}/read`);
    return res.notification;
  },

  markAllAsRead: async (): Promise<{ count: number }> => {
    const res = await api.post<{ count: number }>('/notifications/read-all');
    return res;
  },

  getPreferences: async (): Promise<NotificationPreferences> => {
    const res = await api.get<{ preferences: NotificationPreferences }>('/notification-preferences');
    return res.preferences;
  },

  updatePreferences: async (preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> => {
    const res = await api.patch<{ preferences: NotificationPreferences }>('/notification-preferences', preferences);
    return res.preferences;
  },
};

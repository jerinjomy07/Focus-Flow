// src/domain/services/__tests__/notification-service.test.ts
// FocusFlow — Notification Domain Service Unit Tests (Phase 10)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from '../notification-service';
import * as db from '@/lib/db';

vi.mock('@/lib/db', () => ({
  getNotifications: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  markNotificationAsRead: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
  getNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}));

describe('NotificationService Domain Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatFocusCompletionNotification', () => {
    it('formats a standard 25-minute focus session correctly', () => {
      const payload = NotificationService.formatFocusCompletionNotification({
        id: 'sess-123',
        plannedDuration: 1500, // 25 min
      });

      expect(payload).toEqual({
        type: 'FOCUS_SESSION_COMPLETED',
        title: 'Focus session completed',
        body: 'Your 25-minute focus session has been completed.',
        metadata: { focusSessionId: 'sess-123' },
        dedupeKey: 'focus-session-completed:sess-123',
      });
    });

    it('formats a 50-minute session correctly', () => {
      const payload = NotificationService.formatFocusCompletionNotification({
        id: 'sess-456',
        plannedDuration: 3000, // 50 min
      });

      expect(payload.body).toBe('Your 50-minute focus session has been completed.');
      expect(payload.dedupeKey).toBe('focus-session-completed:sess-456');
    });

    it('clamps minimum duration to at least 1 minute', () => {
      const payload = NotificationService.formatFocusCompletionNotification({
        id: 'sess-short',
        plannedDuration: 30, // 30s
      });

      expect(payload.body).toBe('Your 1-minute focus session has been completed.');
    });

    it('generates an exact deterministic dedupeKey per session ID', () => {
      const p1 = NotificationService.formatFocusCompletionNotification({
        id: 'session-abc',
        plannedDuration: 1500,
      });
      const p2 = NotificationService.formatFocusCompletionNotification({
        id: 'session-abc',
        plannedDuration: 1500,
      });
      const p3 = NotificationService.formatFocusCompletionNotification({
        id: 'session-xyz',
        plannedDuration: 1500,
      });

      expect(p1.dedupeKey).toBe('focus-session-completed:session-abc');
      expect(p1.dedupeKey).toBe(p2.dedupeKey);
      expect(p1.dedupeKey).not.toBe(p3.dedupeKey);
    });
  });

  describe('delegation to data access layer', () => {
    const userId = 'usr-test-123';

    it('delegates getNotifications with options', async () => {
      const mockResult = {
        notifications: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
        hasMore: false,
        unreadCount: 0,
      };
      vi.mocked(db.getNotifications).mockResolvedValue(mockResult);

      const result = await NotificationService.getNotifications(userId, {
        page: 2,
        pageSize: 10,
        unreadOnly: true,
      });

      expect(db.getNotifications).toHaveBeenCalledWith(userId, {
        page: 2,
        pageSize: 10,
        unreadOnly: true,
      });
      expect(result).toBe(mockResult);
    });

    it('delegates getUnreadCount', async () => {
      vi.mocked(db.getUnreadNotificationCount).mockResolvedValue(4);

      const count = await NotificationService.getUnreadCount(userId);

      expect(db.getUnreadNotificationCount).toHaveBeenCalledWith(userId);
      expect(count).toBe(4);
    });

    it('delegates markAsRead with ownership validation', async () => {
      const mockNotification = {
        id: 'notif-1',
        userId,
        type: 'FOCUS_SESSION_COMPLETED' as const,
        title: 'Focus session completed',
        body: 'Your 25-minute focus session has been completed.',
        readAt: new Date(),
        metadata: { focusSessionId: 'sess-1' },
        dedupeKey: 'focus-session-completed:sess-1',
        createdAt: new Date(),
      };
      vi.mocked(db.markNotificationAsRead).mockResolvedValue(mockNotification);

      const res = await NotificationService.markAsRead(userId, 'notif-1');

      expect(db.markNotificationAsRead).toHaveBeenCalledWith(userId, 'notif-1');
      expect(res).toBe(mockNotification);
    });

    it('delegates markAllAsRead', async () => {
      vi.mocked(db.markAllNotificationsAsRead).mockResolvedValue({ count: 5 });

      const res = await NotificationService.markAllAsRead(userId);

      expect(db.markAllNotificationsAsRead).toHaveBeenCalledWith(userId);
      expect(res).toEqual({ count: 5 });
    });

    it('delegates getPreferences', async () => {
      const mockPref = {
        id: 'pref-1',
        userId,
        focusSessionCompletion: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(db.getNotificationPreferences).mockResolvedValue(mockPref);

      const res = await NotificationService.getPreferences(userId);

      expect(db.getNotificationPreferences).toHaveBeenCalledWith(userId);
      expect(res).toBe(mockPref);
    });

    it('delegates updatePreferences', async () => {
      const mockUpdated = {
        id: 'pref-1',
        userId,
        focusSessionCompletion: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(db.updateNotificationPreferences).mockResolvedValue(mockUpdated);

      const res = await NotificationService.updatePreferences(userId, {
        focusSessionCompletion: false,
      });

      expect(db.updateNotificationPreferences).toHaveBeenCalledWith(userId, {
        focusSessionCompletion: false,
      });
      expect(res).toBe(mockUpdated);
    });
  });
});

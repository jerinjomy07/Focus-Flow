// src/domain/services/notification-service.ts
// FocusFlow — In-App Notification Domain Service (Phase 10)
//
// Encapsulates business rules for in-app notification creation, delivery checks,
// preference enforcement, and read status lifecycle.
// Follows clean architecture: UI/API -> Domain Service -> Database Layer.

import * as db from '@/lib/db';
import type {
  Notification,
  NotificationPreference,
  NotificationType,
} from '@/types/domain';
import type {
  GetNotificationsOptions,
  PaginatedNotificationsResult,
} from '@/lib/db/notifications';

export interface FocusSessionCompletedEventPayload {
  id: string;
  plannedDuration: number; // in seconds
}

export class NotificationService {
  /**
   * Builds canonical notification payload for a completed focus session.
   * Derives human-friendly duration in minutes.
   */
  static formatFocusCompletionNotification(
    session: FocusSessionCompletedEventPayload
  ): {
    type: NotificationType;
    title: string;
    body: string;
    metadata: { focusSessionId: string };
    dedupeKey: string;
  } {
    const plannedMinutes = Math.max(1, Math.round(session.plannedDuration / 60));
    return {
      type: 'FOCUS_SESSION_COMPLETED',
      title: 'Focus session completed',
      body: `Your ${plannedMinutes}-minute focus session has been completed.`,
      metadata: { focusSessionId: session.id },
      dedupeKey: `focus-session-completed:${session.id}`,
    };
  }

  /**
   * Retrieves paginated notifications for the authenticated user, newest first.
   */
  static async getNotifications(
    userId: string,
    options: GetNotificationsOptions = {}
  ): Promise<PaginatedNotificationsResult> {
    return db.getNotifications(userId, options);
  }

  /**
   * Retrieves authoritative unread count for a user.
   */
  static async getUnreadCount(userId: string): Promise<number> {
    return db.getUnreadNotificationCount(userId);
  }

  /**
   * Marks a specific notification as read.
   * Validates user ownership and returns updated notification.
   */
  static async markAsRead(
    userId: string,
    notificationId: string
  ): Promise<Notification> {
    return db.markNotificationAsRead(userId, notificationId);
  }

  /**
   * Marks all unread notifications as read for the user.
   */
  static async markAllAsRead(userId: string): Promise<{ count: number }> {
    return db.markAllNotificationsAsRead(userId);
  }

  /**
   * Retrieves notification preferences for a user.
   */
  static async getPreferences(userId: string): Promise<NotificationPreference> {
    return db.getNotificationPreferences(userId);
  }

  /**
   * Updates notification preferences for a user.
   */
  static async updatePreferences(
    userId: string,
    data: { focusSessionCompletion?: boolean }
  ): Promise<NotificationPreference> {
    return db.updateNotificationPreferences(userId, data);
  }
}
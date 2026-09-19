// mobile/src/services/notificationService.ts
// FocusFlow Mobile — Native Android Notification Service & Deterministic Scheduler
//
// Manages Android notification channels, runtime permissions (Android 13+),
// schedules server-authoritative completion alarms, and guarantees deduplication
// using deterministic notification identifiers derived from server session IDs.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'focusflow_timer_channel';

// Configure foreground notification presentation
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const getDeterministicNotificationId = (sessionId: string): string => {
  return `focusflow-session-${sessionId}`;
};

export const notificationService = {
  /**
   * Initializes Android notification channels and requests permissions (Android 13+)
   */
  init: async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Focus Session Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
        sound: undefined, // Default system notification sound
        enableVibrate: true,
        showBadge: true,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  },

  /**
   * Schedules a deterministic native notification for when an in-progress session reaches expectedEndTime.
   * Cancels any existing notification with the same ID before scheduling to guarantee deduplication.
   */
  scheduleSessionNotification: async (params: {
    sessionId: string;
    expectedEndTime: Date;
    title?: string;
  }): Promise<string | null> => {
    try {
      const hasPermission = await notificationService.init();
      if (!hasPermission) return null;

      const identifier = getDeterministicNotificationId(params.sessionId);
      // Cancel previous scheduled notification with this identifier to prevent duplicates
      await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});

      const delaySeconds = Math.max(1, Math.round((params.expectedEndTime.getTime() - Date.now()) / 1000));

      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: 'Focus Session Completed! 🎯',
          body: `Great focus! You completed your ${params.title || 'Focus Session'}. Time for a break.`,
          data: { sessionId: params.sessionId, type: 'FOCUS_SESSION_COMPLETED' },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: delaySeconds,
          channelId: CHANNEL_ID,
        },
      });

      return identifier;
    } catch {
      return null;
    }
  },

  /**
   * Immediately delivers a notification indicating session completion
   */
  notifySessionCompleted: async (title: string = 'Focus Session'): Promise<string | null> => {
    try {
      const hasPermission = await notificationService.init();
      if (!hasPermission) return null;

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Focus Session Completed! 🎯',
          body: `Great focus! You completed your ${title}. Time for a break.`,
          data: { type: 'FOCUS_SESSION_COMPLETED' },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: null, // Deliver immediately
      });

      return identifier;
    } catch {
      return null;
    }
  },

  /**
   * Immediately cancels the scheduled notification for a session (e.g. on pause, cancel, reset, early completion)
   */
  cancelSessionNotification: async (sessionId: string): Promise<void> => {
    try {
      const identifier = getDeterministicNotificationId(sessionId);
      await Notifications.cancelScheduledNotificationAsync(identifier);
    } catch {
      // Ignored if not scheduled
    }
  },

  /**
   * Reconciles notification schedule against the server's authoritative session state
   */
  reconcileSessionNotification: async (params: {
    sessionId: string;
    status: string;
    expectedEndTime?: Date | null;
    title?: string;
  }): Promise<void> => {
    if (params.status !== 'IN_PROGRESS' || !params.expectedEndTime) {
      await notificationService.cancelSessionNotification(params.sessionId);
      return;
    }

    const now = Date.now();
    if (params.expectedEndTime.getTime() <= now) {
      // Session already concluded while backgrounded
      await notificationService.cancelSessionNotification(params.sessionId);
      return;
    }

    // Still running with future completion time — ensure scheduled accurately
    await notificationService.scheduleSessionNotification({
      sessionId: params.sessionId,
      expectedEndTime: params.expectedEndTime,
      title: params.title,
    });
  },

  /**
   * Subscribes to notification response events (taps)
   */
  addNotificationResponseListener: (onResponse: (data: Record<string, unknown>) => void) => {
    return Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data) {
        onResponse(data as Record<string, unknown>);
      }
    });
  },
};

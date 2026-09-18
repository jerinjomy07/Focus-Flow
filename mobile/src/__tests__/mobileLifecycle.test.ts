// mobile/src/__tests__/mobileLifecycle.test.ts
// FocusFlow Mobile — Session & Platform Lifecycle Unit Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  reconcileSessionTimer,
  formatTimerSeconds,
} from '../services/timerEngine';
import {
  getDeterministicNotificationId,
  notificationService,
} from '../services/notificationService';
import { setAccessToken, getAccessToken } from '../api/client';
import * as Notifications from 'expo-notifications';

vi.mock('expo-notifications', () => ({
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn().mockResolvedValue({}),
  getPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: vi.fn().mockResolvedValue('notif_123'),
  cancelScheduledNotificationAsync: vi.fn().mockResolvedValue(undefined),
  addNotificationResponseReceivedListener: vi.fn(),
  AndroidImportance: { MAX: 5, HIGH: 4 },
  AndroidNotificationPriority: { MAX: 2, HIGH: 1 },
}));

describe('Mobile Session In-Memory Token Management', () => {
  it('stores and retrieves access tokens strictly in memory without persistence', () => {
    setAccessToken('test_jwt_access_token_123');
    expect(getAccessToken()).toBe('test_jwt_access_token_123');

    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });
});

describe('Native Notification Lifecycle & Deduplication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates deterministic notification identifiers based on server session IDs', () => {
    const id1 = getDeterministicNotificationId('sess_abc_123');
    const id2 = getDeterministicNotificationId('sess_abc_123');
    const id3 = getDeterministicNotificationId('sess_other_456');

    expect(id1).toBe('focusflow-session-sess_abc_123');
    expect(id1).toBe(id2);
    expect(id1).not.toBe(id3);
  });

  it('cancels scheduled notification immediately on session pause, cancel, or reset', async () => {
    await notificationService.cancelSessionNotification('sess_active_1');

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'focusflow-session-sess_active_1'
    );
  });

  it('schedules notification for expectedEndTime with deterministic ID', async () => {
    const futureDate = new Date(Date.now() + 25 * 60 * 1000);
    const identifier = await notificationService.scheduleSessionNotification({
      sessionId: 'sess_running_99',
      expectedEndTime: futureDate,
      title: 'Deep Work Sprint',
    });

    expect(identifier).toBe('focusflow-session-sess_running_99');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'focusflow-session-sess_running_99'
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'focusflow-session-sess_running_99',
        content: expect.objectContaining({
          title: 'Focus Session Completed! 🎯',
          body: expect.stringContaining('Deep Work Sprint'),
        }),
      })
    );
  });

  it('reconciles notification on app foreground: cancels if status is not IN_PROGRESS', async () => {
    await notificationService.reconcileSessionNotification({
      sessionId: 'sess_paused_2',
      status: 'PAUSED',
    });

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'focusflow-session-sess_paused_2'
    );
  });

  it('reconciles notification on app foreground: cancels if session already elapsed', async () => {
    const pastDate = new Date(Date.now() - 60 * 1000); // Ended 1 minute ago
    await notificationService.reconcileSessionNotification({
      sessionId: 'sess_done_3',
      status: 'IN_PROGRESS',
      expectedEndTime: pastDate,
    });

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'focusflow-session-sess_done_3'
    );
  });
});

describe('Server-Authoritative Timer Engine Math & Formatting', () => {
  it('returns default IDLE state when no active session exists', () => {
    const state = reconcileSessionTimer(null);
    expect(state.status).toBe('IDLE');
    expect(state.remainingSeconds).toBe(1500); // 25 min default
    expect(state.elapsedSeconds).toBe(0);
    expect(state.progressPercent).toBe(0);
  });

  it('accurately calculates remaining seconds for an in-progress session', () => {
    const startedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min ago
    const state = reconcileSessionTimer({
      id: 'sess_1',
      userId: 'usr_1',
      status: 'ACTIVE',
      type: 'POMODORO',
      targetDurationMinutes: 25,
      startedAt,
      pauseSeconds: 0,
    } as any);

    expect(state.status).toBe('RUNNING');
    expect(state.elapsedSeconds).toBeCloseTo(300, -1);
    expect(state.remainingSeconds).toBeCloseTo(1200, -1);
    expect(state.progressPercent).toBeCloseTo(20, 0);
  });

  it('preserves frozen remaining seconds for a PAUSED session', () => {
    const state = reconcileSessionTimer({
      id: 'sess_paused',
      userId: 'usr_1',
      status: 'PAUSED',
      type: 'POMODORO',
      targetDurationMinutes: 25,
      startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      elapsedSeconds: 420, // 7 minutes were elapsed when paused
    } as any);

    expect(state.status).toBe('PAUSED');
    expect(state.elapsedSeconds).toBe(420);
    expect(state.remainingSeconds).toBe(1500 - 420); // 1080s
    expect(state.progressPercent).toBeCloseTo((420 / 1500) * 100, 1);
  });

  it('formats seconds into clean MM:SS strings', () => {
    expect(formatTimerSeconds(1500)).toBe('25:00');
    expect(formatTimerSeconds(65)).toBe('01:05');
    expect(formatTimerSeconds(0)).toBe('00:00');
    expect(formatTimerSeconds(-5)).toBe('00:00');
  });
});

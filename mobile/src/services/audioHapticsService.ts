// mobile/src/services/audioHapticsService.ts
// FocusFlow Mobile — Native Audio & Haptic Feedback Service
//
// Provides subtle tactile and audio feedback for timer state changes.
// Respects platform settings, user mute preferences, and interruption handling.

import * as Haptics from 'expo-haptics';

export const audioHapticsService = {
  /**
   * Subtle haptic tap on session start
   */
  hapticStart: async (): Promise<void> => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Haptics unavailable on device/simulator
    }
  },

  /**
   * Subtle light haptic tap on pause/resume
   */
  hapticPauseResume: async (): Promise<void> => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics unavailable
    }
  },

  /**
   * Success notification vibration on session completion
   */
  hapticComplete: async (): Promise<void> => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Haptics unavailable
    }
  },

  /**
   * Plays completion feedback (haptics)
   */
  playCompletionChime: async (soundEnabled: boolean = true): Promise<void> => {
    if (!soundEnabled) return;
    try {
      await audioHapticsService.hapticComplete();
    } catch {
      // Feedback unavailable
    }
  },
};

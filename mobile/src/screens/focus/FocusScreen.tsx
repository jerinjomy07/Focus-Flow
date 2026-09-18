// mobile/src/screens/focus/FocusScreen.tsx
// FocusFlow Mobile — Native Pomodoro Focus Timer Screen
//
// Strictly preserves Phase 6 server-authoritative timer semantics.
// Reconciles on app foregrounding, screen lock/unlock, and network recovery.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { focusSessionsApi } from '../../api/focusSessions';
import { tasksApi } from '../../api/tasks';
import { settingsApi } from '../../api/settings';
import { Task, SessionType } from '../../types';
import { colors, spacing, borderRadius, typography, layout } from '../../theme';
import {
  reconcileSessionTimer,
  formatTimerSeconds,
  subscribeToForegroundResume,
  TimerDisplayState,
} from '../../services/timerEngine';
import { audioHapticsService } from '../../services/audioHapticsService';
import { notificationService } from '../../services/notificationService';

export const FocusScreen: React.FC = () => {
  const queryClient = useQueryClient();

  const [selectedType, setSelectedType] = useState<SessionType>('POMODORO');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalVisible, setIsTaskModalVisible] = useState(false);

  // Local tick display state
  const [displayState, setDisplayState] = useState<TimerDisplayState>({
    status: 'IDLE',
    remainingSeconds: 25 * 60,
    elapsedSeconds: 0,
    totalDurationSeconds: 25 * 60,
    progressPercent: 0,
  });

  // 1. Fetch user settings for default duration
  const { data: settings } = useQuery({
    queryKey: ['userSettings'],
    queryFn: () => settingsApi.getSettings(),
  });

  // 2. Fetch active focus session from server
  const { data: activeSession, isLoading: isSessionLoading } = useQuery({
    queryKey: ['activeFocusSession'],
    queryFn: () => focusSessionsApi.getActiveSession(),
    refetchInterval: 10000,
  });

  // 3. Fetch user tasks for session attachment
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', 'TODO'],
    queryFn: () => tasksApi.getTasks({ status: 'TODO' }),
  });

  // Sync display state whenever activeSession changes
  useEffect(() => {
    if (activeSession) {
      const reconciled = reconcileSessionTimer(activeSession);
      setDisplayState(reconciled);
      setSelectedType(activeSession.type);
    } else {
      const defaultDuration = (settings?.focusDurationMinutes || 25) * 60;
      setDisplayState({
        status: 'IDLE',
        remainingSeconds: defaultDuration,
        elapsedSeconds: 0,
        totalDurationSeconds: defaultDuration,
        progressPercent: 0,
      });
    }
  }, [activeSession, settings]);

  // Foreground lifecycle listener
  useEffect(() => {
    const unsubscribe = subscribeToForegroundResume(() => {
      queryClient.invalidateQueries({ queryKey: ['activeFocusSession'] });
    });
    return unsubscribe;
  }, [queryClient]);

  // Foreground 1-second countdown ticker
  useEffect(() => {
    if (displayState.status !== 'RUNNING') return;

    const interval = setInterval(() => {
      setDisplayState((prev) => {
        if (prev.remainingSeconds <= 1) {
          clearInterval(interval);
          // Session completed naturally!
          handleNaturalCompletion();
          return {
            ...prev,
            status: 'COMPLETED',
            remainingSeconds: 0,
            progressPercent: 100,
          };
        }
        const remainingSeconds = prev.remainingSeconds - 1;
        const elapsedSeconds = prev.elapsedSeconds + 1;
        const progressPercent =
          prev.totalDurationSeconds > 0
            ? (elapsedSeconds / prev.totalDurationSeconds) * 100
            : 0;

        return {
          ...prev,
          remainingSeconds,
          elapsedSeconds,
          progressPercent,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [displayState.status]);

  // Natural completion handler
  const handleNaturalCompletion = async () => {
    audioHapticsService.playCompletionChime(settings?.soundEnabled ?? true);
    notificationService.notifySessionCompleted(
      selectedTask?.title || (selectedType === 'POMODORO' ? 'Focus Session' : 'Break')
    );

    if (activeSession?.id) {
      try {
        await focusSessionsApi.completeSession(activeSession.id);
        queryClient.invalidateQueries({ queryKey: ['activeFocusSession'] });
        queryClient.invalidateQueries({ queryKey: ['productivitySummary'] });
      } catch {
        // Handled silently
      }
    }
  };

  // Mutations
  const startMutation = useMutation({
    mutationFn: async () => {
      audioHapticsService.hapticStart();
      const targetMins =
        selectedType === 'POMODORO'
          ? settings?.focusDurationMinutes || 25
          : selectedType === 'SHORT_BREAK'
          ? settings?.shortBreakMinutes || 5
          : settings?.longBreakMinutes || 15;

      return focusSessionsApi.startSession({
        type: selectedType,
        targetDurationMinutes: targetMins,
        taskId: selectedTask?.id,
        projectId: selectedTask?.projectId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeFocusSession'] });
    },
    onError: (err: any) => {
      Alert.alert('Unable to Start Session', err?.message || 'An active session may already exist.');
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async () => {
      if (!activeSession?.id) return;
      audioHapticsService.hapticPauseResume();
      return focusSessionsApi.pauseSession(activeSession.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeFocusSession'] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      if (!activeSession?.id) return;
      audioHapticsService.hapticPauseResume();
      return focusSessionsApi.resumeSession(activeSession.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeFocusSession'] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!activeSession?.id) return;
      audioHapticsService.playCompletionChime(settings?.soundEnabled ?? true);
      notificationService.notifySessionCompleted(activeSession.task?.title || 'Focus Session');
      return focusSessionsApi.completeSession(activeSession.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeFocusSession'] });
      queryClient.invalidateQueries({ queryKey: ['productivitySummary'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!activeSession?.id) return;
      audioHapticsService.hapticPauseResume();
      return focusSessionsApi.resetSession(activeSession.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeFocusSession'] });
    },
  });

  const isBusy =
    startMutation.isPending ||
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    completeMutation.isPending ||
    resetMutation.isPending;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Session Type Switcher (only selectable when IDLE) */}
        {displayState.status === 'IDLE' && (
          <View style={styles.typeSelector}>
            {(['POMODORO', 'SHORT_BREAK', 'LONG_BREAK'] as SessionType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeTab,
                  selectedType === type && styles.typeTabActive,
                ]}
                onPress={() => setSelectedType(type)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${type} interval`}
              >
                <Text
                  style={[
                    styles.typeTabText,
                    selectedType === type && styles.typeTabTextActive,
                  ]}
                >
                  {type === 'POMODORO' ? 'Focus' : type === 'SHORT_BREAK' ? 'Short Break' : 'Long Break'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Active Task / Project Indicator */}
        <TouchableOpacity
          style={styles.taskSelector}
          onPress={() => displayState.status === 'IDLE' && setIsTaskModalVisible(true)}
          disabled={displayState.status !== 'IDLE'}
          accessibilityRole="button"
          accessibilityLabel={selectedTask ? `Active task: ${selectedTask.title}` : 'Attach task'}
        >
          <Text style={styles.taskSelectorLabel}>TARGET TASK</Text>
          <Text style={styles.taskSelectorTitle} numberOfLines={1}>
            {activeSession?.task?.title || selectedTask?.title || 'No task selected (Tap to attach)'}
          </Text>
        </TouchableOpacity>

        {/* Timer Display Display Ring */}
        <View style={styles.timerDisplayContainer}>
          <View style={styles.progressRingOuter}>
            <View style={styles.progressRingInner}>
              <Text
                style={styles.timerText}
                accessibilityRole="text"
                accessibilityLabel={`${formatTimerSeconds(displayState.remainingSeconds)} remaining`}
              >
                {formatTimerSeconds(displayState.remainingSeconds)}
              </Text>
              <Text style={styles.timerStatusBadge}>
                {displayState.status === 'RUNNING'
                  ? '⚡ IN PROGRESS'
                  : displayState.status === 'PAUSED'
                  ? '⏸ PAUSED'
                  : displayState.status === 'COMPLETED'
                  ? '🎉 COMPLETED'
                  : 'READY'}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Controls */}
        <View style={styles.controlsContainer}>
          {displayState.status === 'IDLE' && (
            <View style={styles.actionButtonGroup}>
              <TouchableOpacity
                style={[styles.primaryActionButton, isBusy && styles.buttonDisabled]}
                onPress={() => startMutation.mutate()}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel="Start timer"
                activeOpacity={0.8}
              >
                {isBusy ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={styles.primaryActionText}>Start Session</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {displayState.status === 'RUNNING' && (
            <View style={styles.actionButtonGroup}>
              <TouchableOpacity
                style={[styles.secondaryActionButton, isBusy && styles.buttonDisabled]}
                onPress={() => pauseMutation.mutate()}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel="Pause timer"
              >
                <Text style={styles.secondaryActionText}>Pause ⏸</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryActionButton, isBusy && styles.buttonDisabled]}
                onPress={() => completeMutation.mutate()}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel="Complete session"
              >
                <Text style={styles.primaryActionText}>Complete ✓</Text>
              </TouchableOpacity>
            </View>
          )}

          {displayState.status === 'PAUSED' && (
            <View style={styles.actionButtonGroup}>
              <TouchableOpacity
                style={[styles.primaryActionButton, isBusy && styles.buttonDisabled]}
                onPress={() => resumeMutation.mutate()}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel="Resume timer"
              >
                <Text style={styles.primaryActionText}>Resume ▶</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dangerActionButton, isBusy && styles.buttonDisabled]}
                onPress={() => resetMutation.mutate()}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel="Reset timer session"
              >
                <Text style={styles.dangerActionText}>Reset ↺</Text>
              </TouchableOpacity>
            </View>
          )}

          {displayState.status === 'COMPLETED' && (
            <TouchableOpacity
              style={styles.primaryActionButton}
              onPress={() => {
                queryClient.invalidateQueries({ queryKey: ['activeFocusSession'] });
              }}
              accessibilityRole="button"
              accessibilityLabel="Start another session"
            >
              <Text style={styles.primaryActionText}>Start Next Session →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Task Selection Modal */}
        <Modal
          visible={isTaskModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsTaskModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Attach Task to Session</Text>
                <TouchableOpacity
                  onPress={() => setIsTaskModalVisible(false)}
                  style={styles.modalCloseButton}
                  accessibilityRole="button"
                  accessibilityLabel="Close task selection"
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={tasks}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.modalTaskItem,
                      selectedTask?.id === item.id && styles.modalTaskItemActive,
                    ]}
                    onPress={() => {
                      setSelectedTask(item);
                      setIsTaskModalVisible(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Select task: ${item.title}`}
                  >
                    <Text style={styles.modalTaskTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.project && (
                      <Text style={styles.modalTaskProject}>📁 {item.project.name}</Text>
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.modalEmpty}>
                    <Text style={styles.modalEmptyText}>No pending tasks found.</Text>
                  </View>
                }
              />
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.round,
    padding: spacing.xs,
    width: '100%',
  },
  typeTab: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.round,
  },
  typeTabActive: {
    backgroundColor: colors.primary,
  },
  typeTabText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  typeTabTextActive: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
  },
  taskSelector: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  taskSelectorLabel: {
    ...typography.tiny,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  taskSelectorTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  timerDisplayContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  progressRingOuter: {
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 4,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  progressRingInner: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  timerText: {
    ...typography.timerDisplay,
    color: colors.text,
  },
  timerStatusBadge: {
    ...typography.tiny,
    color: colors.primaryLight,
    letterSpacing: 1,
  },
  controlsContainer: {
    width: '100%',
    paddingBottom: spacing.lg,
  },
  actionButtonGroup: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  primaryActionButton: {
    flex: 1,
    height: layout.minTouchTarget,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryActionText: {
    ...typography.bodyBold,
    color: colors.text,
  },
  secondaryActionButton: {
    flex: 1,
    height: layout.minTouchTarget,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryActionText: {
    ...typography.bodyBold,
    color: colors.text,
  },
  dangerActionButton: {
    flex: 1,
    height: layout.minTouchTarget,
    backgroundColor: colors.dangerMuted,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerActionText: {
    ...typography.bodyBold,
    color: colors.danger,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  modalTaskItem: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  modalTaskItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  modalTaskTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  modalTaskProject: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  modalEmpty: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  modalEmptyText: {
    ...typography.body,
    color: colors.textMuted,
  },
});

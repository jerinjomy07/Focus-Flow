// mobile/src/screens/focus/FocusScreen.tsx
// FocusFlow Mobile — Native Pomodoro Focus Timer Screen (Stitch Redesign)
//
// Source of Truth:
// - Dark: mobile/design/stitch_focusflow_futuristic_redesign/focus_timer_signature/
// - Light: mobile/design/stitch_focusflow_futuristic_redesign/focus_timer_terra_design/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { focusSessionsApi } from '../../api/focusSessions';
import { tasksApi } from '../../api/tasks';
import { settingsApi } from '../../api/settings';
import { Task, SessionType, FocusSession } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import {
  reconcileSessionTimer,
  formatTimerSeconds,
  subscribeToForegroundResume,
  TimerDisplayState,
} from '../../services/timerEngine';
import { audioHapticsService } from '../../services/audioHapticsService';
import { notificationService } from '../../services/notificationService';
import { GlassCard, KineticButton, MetricBadge, ScreenHeader, TelemetryRing } from '../../components';

export const FocusScreen: React.FC = () => {
  const { colors, typography, spacing, borderRadius, isDark } = useTheme();
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
  const { data: activeSession } = useQuery({
    queryKey: ['activeFocusSession'],
    queryFn: () => focusSessionsApi.getActiveSession(),
    refetchInterval: 10000,
  });

  // Keep a stable ref to activeSession for background/ticker reconciliation
  const activeSessionRef = useRef<FocusSession | null>(activeSession || null);
  activeSessionRef.current = activeSession || null;

  // Natural completion handler
  const handleNaturalCompletion = useCallback(async (sessionToComplete?: FocusSession | null) => {
    const targetSession = sessionToComplete || activeSessionRef.current;
    audioHapticsService.playCompletionChime(settings?.soundEnabled ?? true);
    notificationService.notifySessionCompleted(
      targetSession?.task?.title || selectedTask?.title || (selectedType === 'POMODORO' ? 'Focus Session' : 'Break')
    );

    if (targetSession?.id) {
      try {
        await focusSessionsApi.completeSession(targetSession.id);
        await notificationService.cancelSessionNotification(targetSession.id);
        queryClient.invalidateQueries({ queryKey: ['activeFocusSession'] });
        queryClient.invalidateQueries({ queryKey: ['productivitySummary'] });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      } catch {
        // Handled silently
      }
    }
  }, [settings, selectedTask, selectedType, queryClient]);

  // Synchronous wall-clock timer reconciler
  const reconcileTimer = useCallback((session?: FocusSession | null) => {
    const currentSession = session !== undefined ? session : activeSessionRef.current;
    if (currentSession) {
      const reconciled = reconcileSessionTimer(currentSession);
      setDisplayState(reconciled);
      const normalizedType: SessionType =
        (currentSession.type as string) === 'FOCUS' ? 'POMODORO' : currentSession.type;
      setSelectedType(normalizedType);

      // If session completed while backgrounded or sleeping, auto-complete
      if (
        reconciled.status === 'COMPLETED' &&
        (currentSession.status === 'ACTIVE' || (currentSession.status as string) === 'IN_PROGRESS')
      ) {
        handleNaturalCompletion(currentSession);
      }
    } else {
      const isPomodoro = selectedType === 'POMODORO' || (selectedType as string) === 'FOCUS';
      const targetDurationMinutes =
        isPomodoro
          ? settings?.focusDurationMinutes || 25
          : selectedType === 'SHORT_BREAK'
          ? settings?.shortBreakMinutes || 5
          : settings?.longBreakMinutes || 15;
      const defaultDuration = targetDurationMinutes * 60;
      setDisplayState({
        status: 'IDLE',
        remainingSeconds: defaultDuration,
        elapsedSeconds: 0,
        totalDurationSeconds: defaultDuration,
        progressPercent: 0,
      });
    }
  }, [selectedType, settings, handleNaturalCompletion]);

  // Sync display state whenever activeSession or settings change
  useEffect(() => {
    reconcimerSync();
    function reconcimerSync() {
      reconcileTimer(activeSession);
    }
  }, [activeSession, settings, selectedType, reconcileTimer]);

  // Immediate Foreground lifecycle listener — instantly recalculates without waiting for network
  useEffect(() => {
    const unsubscribe = subscribeToForegroundResume(() => {
      // 1. Instantly calculate wall-clock elapsed & remaining time from existing session ref
      reconcileTimer();
      // 2. Also trigger query invalidation to reconcile with any server changes
      queryClient.invalidateQueries({ queryKey: ['activeFocusSession'] });
    });
    return unsubscribe;
  }, [reconcileTimer, queryClient]);

  // Foreground countdown ticker — derives from authoritative session timestamps
  useEffect(() => {
    if (displayState.status !== 'RUNNING') return;

    const interval = setInterval(() => {
      if (activeSessionRef.current && (activeSessionRef.current.status === 'ACTIVE' || (activeSessionRef.current.status as string) === 'IN_PROGRESS')) {
        const reconciled = reconcileSessionTimer(activeSessionRef.current);
        setDisplayState(reconciled);
        if (reconciled.remainingSeconds <= 0) {
          clearInterval(interval);
          handleNaturalCompletion(activeSessionRef.current);
        }
      } else {
        // Fallback local decrement if no active session
        setDisplayState((prev) => {
          if (prev.remainingSeconds <= 1) {
            clearInterval(interval);
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
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [displayState.status, handleNaturalCompletion]);

  // 3. Fetch user tasks for session attachment
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', 'TODO'],
    queryFn: () => tasksApi.getTasks({ status: 'TODO' }),
  });

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

      const newSession = await focusSessionsApi.startSession({
        type: selectedType,
        targetDurationMinutes: targetMins,
        taskId: selectedTask?.id,
        projectId: selectedTask?.projectId || undefined,
      });

      // Schedule native notification for background completion
      if (newSession?.id) {
        const expectedEndTime = new Date(Date.now() + targetMins * 60 * 1000);
        await notificationService.scheduleSessionNotification({
          sessionId: newSession.id,
          expectedEndTime,
          title: selectedTask?.title || (selectedType === 'POMODORO' ? 'Focus Session' : 'Break'),
        });
      }

      return newSession;
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
      // Cancel scheduled notification while paused
      await notificationService.cancelSessionNotification(activeSession.id);
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
      const res = await focusSessionsApi.resumeSession(activeSession.id);
      // Reschedule notification for new expected end time
      const current = reconcileSessionTimer(activeSession);
      if (current.remainingSeconds > 0) {
        const expectedEndTime = new Date(Date.now() + current.remainingSeconds * 1000);
        await notificationService.scheduleSessionNotification({
          sessionId: activeSession.id,
          expectedEndTime,
          title: activeSession.task?.title || selectedTask?.title || 'Focus Session',
        });
      }
      return res;
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
      await notificationService.cancelSessionNotification(activeSession.id);
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
      await notificationService.cancelSessionNotification(activeSession.id);
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

  const targetTaskTitle =
    activeSession?.task?.title || selectedTask?.title || 'No task selected (Tap to attach)';

  const getStatusText = () => {
    if (displayState.status === 'RUNNING') {
      const minutes = Math.round(displayState.totalDurationSeconds / 60);
      return `IN PROGRESS • ${minutes}M DEEP`;
    }
    if (displayState.status === 'PAUSED') return 'PAUSED';
    if (displayState.status === 'COMPLETED') return 'CYCLE COMPLETED';
    return 'READY TO ENGAGE';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.canvas }]} edges={['top']}>
      {/* HUD Screen Header */}
      <ScreenHeader
        title={selectedType === 'POMODORO' ? 'Focus Timer' : 'Rest Interval'}
        statusText="FLOW PROTOCOL"
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.bottomDockHeight + 36 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Session Type Switcher (only selectable when IDLE) */}
        {displayState.status === 'IDLE' && (
          <View style={styles.typeSelectorRow}>
            {(['POMODORO', 'SHORT_BREAK', 'LONG_BREAK'] as SessionType[]).map((type) => {
              const isActive = selectedType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typePill,
                    {
                      backgroundColor: isActive
                        ? colors.primary
                        : isDark
                        ? 'rgba(26, 32, 44, 0.7)'
                        : 'rgba(233, 228, 217, 0.6)',
                      borderColor: isActive ? colors.primaryLight : colors.border,
                    },
                    isActive && isDark && {
                      shadowColor: colors.primary,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.4,
                      shadowRadius: 8,
                      elevation: 3,
                    },
                  ]}
                  onPress={() => setSelectedType(type)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${type} interval`}
                >
                  <Text
                    style={[
                      typography.labelCaps,
                      { color: isActive ? colors.onPrimary : colors.textSecondary },
                    ]}
                  >
                    {type === 'POMODORO' ? 'Focus' : type === 'SHORT_BREAK' ? 'Short Break' : 'Long Break'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Attached Objective Card */}
        <TouchableOpacity
          onPress={() => displayState.status === 'IDLE' && setIsTaskModalVisible(true)}
          disabled={displayState.status !== 'IDLE'}
          activeOpacity={0.8}
        >
          <GlassCard level={1} style={styles.objectiveCard}>
            <View style={styles.objectiveHeader}>
              <MetricBadge type="status" label="ATTACHED OBJECTIVE" color={colors.secondary} />
              {displayState.status === 'IDLE' && (
                <Text style={[typography.caption, { color: colors.primary }]}>
                  SELECT →
                </Text>
              )}
            </View>
            <Text
              style={[typography.bodyBold, styles.objectiveTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {targetTaskTitle}
            </Text>
          </GlassCard>
        </TouchableOpacity>

        {/* Central Futuristic Kinetic Timer Core */}
        <View style={styles.dialWrapper}>
          <TelemetryRing
            progressPercent={displayState.progressPercent}
            timeDisplay={formatTimerSeconds(displayState.remainingSeconds)}
            statusText={getStatusText()}
            cycleText="CYCLE 01 • INTERVAL 04"
            completedIntervals={1}
            totalIntervals={4}
          />
        </View>

        {/* Session Context Chips */}
        <View style={styles.contextGrid}>
          <GlassCard level={1} style={styles.contextChip}>
            <View style={styles.contextRow}>
              <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 10 }]}>
                SOUNDSCAPE
              </Text>
              <MetricBadge type="velocity" color={colors.secondary} />
            </View>
            <Text style={[typography.bodySm, { color: colors.text, fontWeight: '600', marginTop: 4 }]}>
              {settings?.soundEnabled ? 'Chime Active' : 'Silent Focus'}
            </Text>
          </GlassCard>

          <GlassCard level={1} style={styles.contextChip}>
            <View style={styles.contextRow}>
              <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 10 }]}>
                FLOW CONFIG
              </Text>
              <MetricBadge type="session" color={colors.primaryLight} />
            </View>
            <Text style={[typography.bodySm, { color: colors.text, fontWeight: '600', marginTop: 4 }]}>
              {settings?.focusDurationMinutes || 25}M • 5M Break
            </Text>
          </GlassCard>
        </View>

        {/* Kinetic Action Controls */}
        <View style={styles.controlsRow}>
          {displayState.status === 'IDLE' && (
            <KineticButton
              title="ENGAGE FOCUS"
              variant="primary"
              size="lg"
              loading={isBusy}
              style={{ flex: 1 }}
              onPress={() => startMutation.mutate()}
            />
          )}

          {displayState.status === 'RUNNING' && (
            <View style={styles.dualControls}>
              <KineticButton
                title="PAUSE ⏸"
                variant="secondary"
                size="md"
                style={{ flex: 1 }}
                loading={isBusy}
                onPress={() => pauseMutation.mutate()}
              />
              <KineticButton
                title="COMPLETE ✓"
                variant="primary"
                size="md"
                style={{ flex: 1 }}
                loading={isBusy}
                onPress={() => completeMutation.mutate()}
              />
            </View>
          )}

          {displayState.status === 'PAUSED' && (
            <View style={styles.dualControls}>
              <KineticButton
                title="RESUME ▶"
                variant="primary"
                size="md"
                style={{ flex: 1 }}
                loading={isBusy}
                onPress={() => resumeMutation.mutate()}
              />
              <KineticButton
                title="RESET ↺"
                variant="danger"
                size="md"
                style={{ flex: 1 }}
                loading={isBusy}
                onPress={() => resetMutation.mutate()}
              />
            </View>
          )}

          {displayState.status === 'COMPLETED' && (
            <KineticButton
              title="START NEXT SESSION →"
              variant="primary"
              size="lg"
              loading={isBusy}
              style={{ flex: 1 }}
              onPress={() => {
                queryClient.invalidateQueries({ queryKey: ['activeFocusSession'] });
              }}
            />
          )}
        </View>
      </ScrollView>

      {/* Task Attachment Selection Modal */}
      <Modal
        visible={isTaskModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsTaskModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <GlassCard level={3} style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={[typography.headlineSm, { color: colors.text }]}>
                Attach Objective
              </Text>
              <TouchableOpacity
                onPress={() => setIsTaskModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Text style={[typography.bodyBold, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={tasks}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingVertical: 8, gap: 8 }}
              renderItem={({ item }) => {
                const isSelected = selectedTask?.id === item.id;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedTask(item);
                      setIsTaskModalVisible(false);
                    }}
                  >
                    <GlassCard
                      level={isSelected ? 2 : 1}
                      glowColor={isSelected ? colors.secondaryGlow : undefined}
                      style={[
                        styles.modalTaskCard,
                        isSelected && { borderColor: colors.secondary },
                      ]}
                    >
                      <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.project && (
                        <View style={styles.projectTag}>
                          <View style={[styles.projectDot, { backgroundColor: colors.secondary }]} />
                          <Text style={[typography.caption, { color: colors.textSecondary }]}>
                            {item.project.name}
                          </Text>
                        </View>
                      )}
                    </GlassCard>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.modalEmpty}>
                  <Text style={[typography.body, { color: colors.textSecondary }]}>
                    No pending tasks in backlog.
                  </Text>
                </View>
              }
            />
          </GlassCard>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 14,
    alignItems: 'center',
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  typePill: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  objectiveCard: {
    width: '100%',
    padding: 12,
    gap: 4,
  },
  objectiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  objectiveTitle: {
    fontSize: 14,
    marginTop: 2,
  },
  dialWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  contextGrid: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  contextChip: {
    flex: 1,
    padding: 12,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlsRow: {
    width: '100%',
    marginTop: 6,
  },
  dualControls: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '65%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalCloseButton: {
    padding: 6,
  },
  modalTaskCard: {
    padding: 12,
    gap: 6,
  },
  projectTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  projectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  modalEmpty: {
    padding: 24,
    alignItems: 'center',
  },
});

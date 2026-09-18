// mobile/src/screens/home/HomeScreen.tsx
// FocusFlow Mobile — Main Dashboard Screen

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { productivityApi } from '../../api/productivity';
import { focusSessionsApi } from '../../api/focusSessions';
import { tasksApi } from '../../api/tasks';
import { offlineCache } from '../../cache/offlineCache';
import { colors, spacing, borderRadius, typography, layout } from '../../theme';
import { formatTimerSeconds } from '../../services/timerEngine';

export const HomeScreen: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // 1. Productivity Summary Query
  const { data: summary, isLoading: isSummaryLoading, isError: isSummaryError } = useQuery({
    queryKey: ['productivitySummary'],
    queryFn: async () => {
      try {
        const data = await productivityApi.getSummary('TODAY');
        await offlineCache.saveProductivitySummary(data);
        return data;
      } catch (err) {
        const cached = await offlineCache.getCachedProductivitySummary();
        if (cached) return cached;
        throw err;
      }
    },
  });

  // 2. Active Session Query
  const { data: activeSession } = useQuery({
    queryKey: ['activeFocusSession'],
    queryFn: () => focusSessionsApi.getActiveSession(),
    refetchInterval: 5000, // Background poll every 5s for multi-device sync
  });

  // 3. Priority Tasks Query
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', 'TODO'],
    queryFn: async () => {
      try {
        const data = await tasksApi.getTasks({ status: 'TODO' });
        await offlineCache.saveTasks(data);
        return data;
      } catch (err) {
        const cached = await offlineCache.getCachedTasks();
        return cached || [];
      }
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['productivitySummary'] }),
      queryClient.invalidateQueries({ queryKey: ['activeFocusSession'] }),
      queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const topTask = tasks[0];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primaryLight}
            colors={[colors.primary]}
          />
        }
      >
        {/* User Greeting */}
        <View style={styles.header}>
          <Text style={styles.greeting} accessibilityRole="header">
            Welcome, {user?.name || 'Focus Achiever'}
          </Text>
          <Text style={styles.subGreeting}>Here is your productivity snapshot for today.</Text>
        </View>

        {/* Offline Banner if degraded */}
        {isSummaryError && (
          <View style={styles.offlineBanner} accessibilityRole="alert">
            <Text style={styles.offlineText}>⚠️ Displaying offline cached metrics</Text>
          </View>
        )}

        {/* Active Session Card (if session is ongoing) */}
        {activeSession ? (
          <TouchableOpacity
            style={styles.activeSessionCard}
            onPress={() => navigation.navigate('Focus')}
            accessibilityRole="button"
            accessibilityLabel="Active session running. Tap to return to Focus timer"
            activeOpacity={0.8}
          >
            <View style={styles.activeCardHeader}>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>
                  {activeSession.status === 'PAUSED' ? 'PAUSED' : 'SESSION IN PROGRESS'}
                </Text>
              </View>
              <Text style={styles.tapToOpen}>Open Timer →</Text>
            </View>

            <Text style={styles.activeSessionTitle} numberOfLines={1}>
              {activeSession.task?.title || 'General Focus Session'}
            </Text>
            {activeSession.project && (
              <View style={styles.projectBadge}>
                <View style={[styles.projectDot, { backgroundColor: activeSession.project.color }]} />
                <Text style={styles.projectBadgeText}>{activeSession.project.name}</Text>
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.quickStartCard}>
            <View style={styles.quickStartTextContainer}>
              <Text style={styles.quickStartTitle}>Ready to Focus?</Text>
              <Text style={styles.quickStartSubtitle}>
                {topTask ? `Next: "${topTask.title}"` : 'Start a 25-minute Pomodoro session.'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.quickStartButton}
              onPress={() => router.push('/(tabs)/focus')}
              accessibilityRole="button"
              accessibilityLabel="Start focus session"
              activeOpacity={0.8}
            >
              <Text style={styles.quickStartButtonText}>Start ⚡</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Daily Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Today's Focus</Text>
            {isSummaryLoading ? (
              <ActivityIndicator color={colors.primaryLight} size="small" />
            ) : (
              <Text style={styles.statValue}>
                {formatTimerSeconds(summary?.todayFocusSeconds || 0)}
              </Text>
            )}
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Completed</Text>
            {isSummaryLoading ? (
              <ActivityIndicator color={colors.primaryLight} size="small" />
            ) : (
              <Text style={styles.statValue}>
                {summary?.completedSessions || 0} 🍅
              </Text>
            )}
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Completion Rate</Text>
            {isSummaryLoading ? (
              <ActivityIndicator color={colors.primaryLight} size="small" />
            ) : (
              <Text style={styles.statValue}>
                {summary?.completionRate ? `${Math.round(summary.completionRate)}%` : '100%'}
              </Text>
            )}
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Streak</Text>
            {isSummaryLoading ? (
              <ActivityIndicator color={colors.primaryLight} size="small" />
            ) : (
              <Text style={styles.statValue}>
                {summary?.streakCount || 0} {summary?.streakCount === 1 ? 'day' : 'days'} 🔥
              </Text>
            )}
          </View>
        </View>

        {/* Priority Tasks Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Priority Tasks</Text>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/tasks')}
            accessibilityRole="button"
            accessibilityLabel="View all tasks"
          >
            <Text style={styles.seeAllLink}>See all ({tasks.length}) →</Text>
          </TouchableOpacity>
        </View>

        {tasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No pending tasks. You are all caught up!</Text>
          </View>
        ) : (
          tasks.slice(0, 3).map((task) => (
            <TouchableOpacity
              key={task.id}
              style={styles.taskCard}
              onPress={() => router.push('/(tabs)/tasks')}
              accessibilityRole="button"
              accessibilityLabel={`Task: ${task.title}`}
              activeOpacity={0.7}
            >
              <View style={styles.taskInfo}>
                <Text style={styles.taskTitle} numberOfLines={1}>
                  {task.title}
                </Text>
                {task.project && (
                  <Text style={styles.taskProject} numberOfLines={1}>
                    📁 {task.project.name}
                  </Text>
                )}
              </View>
              <View style={styles.taskBadge}>
                <Text style={styles.taskBadgeText}>{task.priority}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.xl,
  },
  header: {
    gap: spacing.xs,
  },
  greeting: {
    ...typography.h2,
    color: colors.text,
  },
  subGreeting: {
    ...typography.body,
    color: colors.textSecondary,
  },
  offlineBanner: {
    backgroundColor: colors.warningMuted,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  offlineText: {
    ...typography.caption,
    color: colors.warning,
    textAlign: 'center',
  },
  activeSessionCard: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  activeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveText: {
    ...typography.tiny,
    color: colors.primaryLight,
    letterSpacing: 0.5,
  },
  tapToOpen: {
    ...typography.caption,
    color: colors.primaryLight,
  },
  activeSessionTitle: {
    ...typography.h3,
    color: colors.text,
  },
  projectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  projectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  projectBadgeText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  quickStartCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickStartTextContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  quickStartTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  quickStartSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  quickStartButton: {
    height: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickStartButtonText: {
    ...typography.bodyBold,
    color: colors.text,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statValue: {
    ...typography.h2,
    color: colors.text,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
  },
  seeAllLink: {
    ...typography.caption,
    color: colors.primaryLight,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
  },
  taskCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: layout.minTouchTarget,
  },
  taskInfo: {
    flex: 1,
    marginRight: spacing.sm,
    gap: spacing.xs,
  },
  taskTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  taskProject: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  taskBadge: {
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  taskBadgeText: {
    ...typography.tiny,
    color: colors.textSecondary,
  },
});

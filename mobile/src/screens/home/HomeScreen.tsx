// mobile/src/screens/home/HomeScreen.tsx
// FocusFlow Mobile — Main Dashboard Screen (Stitch Redesign)
//
// Source of Truth:
// - Dark: mobile/design/stitch_focusflow_futuristic_redesign/dashboard_command_center/
// - Light: mobile/design/stitch_focusflow_futuristic_redesign/dashboard_terra_design/

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
import { useTheme } from '../../context/ThemeContext';
import { productivityApi } from '../../api/productivity';
import { focusSessionsApi } from '../../api/focusSessions';
import { tasksApi } from '../../api/tasks';
import { offlineCache } from '../../cache/offlineCache';
import { formatTimerSeconds } from '../../services/timerEngine';
import { GlassCard, MetricBadge, KineticButton, ScreenHeader } from '../../components';

export const HomeScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors, typography, spacing, borderRadius, isDark } = useTheme();
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
    refetchInterval: 5000,
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
  const completedPomodoros = summary?.completedSessions || 0;
  const targetGoal = summary?.dailyGoalSeconds ? Math.round(summary.dailyGoalSeconds / (25 * 60)) : 4;
  const streakDays = summary?.streakCount || 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.canvas }]} edges={['top']}>
      {/* HUD Header */}
      <ScreenHeader
        title="FocusFlow"
        statusText="SYS.FLOW v4.2"
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.bottomDockHeight + 40 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primaryLight}
            colors={[colors.primary]}
          />
        }
      >
        {/* User Greeting & Sync Status */}
        <View style={styles.greetingSection}>
          <View style={styles.greetingRow}>
            <Text
              style={[
                typography.headlineMd,
                { color: colors.text },
              ]}
              numberOfLines={1}
            >
              Welcome, {user?.name?.split(' ')[0] || 'Alex'}
            </Text>
            <MetricBadge
              type="status"
              label="SYNCED"
              color={colors.secondary}
              variant="secondary"
            />
          </View>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            Here is your tactical productivity snapshot for today.
          </Text>
        </View>

        {/* Offline Banner if degraded */}
        {isSummaryError && (
          <GlassCard level={2} style={styles.bannerCard}>
            <Text style={[typography.caption, { color: colors.warning }]}>
              Telemetry in offline cached state
            </Text>
          </GlassCard>
        )}

        {/* Hero: Tactical Flow Launch Module */}
        <GlassCard level={2} glowColor={colors.primaryGlow} style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.directiveRow}>
              <MetricBadge type="velocity" label="MISSION DIRECTIVE" color={colors.secondary} />
            </View>
            <MetricBadge type="status" label="25M SPRINT" color={colors.primaryLight} />
          </View>

          <Text style={[typography.headlineSm, styles.heroTitle, { color: colors.text }]}>
            {activeSession ? 'Session in Progress' : 'Ready to Focus?'}
          </Text>

          <Text style={[typography.bodySm, { color: colors.textSecondary }]} numberOfLines={2}>
            Next:{' '}
            <Text style={{ color: colors.text, fontWeight: '600' }}>
              "{activeSession?.task?.title || topTask?.title || 'Deep Work Sprint'}"
            </Text>
          </Text>

          <View style={styles.heroActionRow}>
            <KineticButton
              title={activeSession ? 'RESUME FOCUS' : 'ENGAGE FOCUS'}
              variant="primary"
              size="md"
              style={styles.engageButton}
              onPress={() => router.push('/(tabs)/focus')}
            />
          </View>
        </GlassCard>

        {/* Telemetry Matrix (2x2 KPI Grid) */}
        <View style={styles.sectionHeader}>
          <Text style={[typography.labelCaps, { color: colors.textSecondary }]}>
            TELEMETRY SNAPSHOT
          </Text>
        </View>

        <View style={styles.matrixGrid}>
          {/* 1. Today's Focus Time */}
          <GlassCard level={1} style={styles.matrixCard}>
            <Text style={[typography.labelCaps, styles.matrixLabel, { color: colors.textSecondary }]}>
              FOCUS TIME
            </Text>
            {isSummaryLoading ? (
              <ActivityIndicator color={colors.primaryLight} size="small" />
            ) : (
              <Text style={[typography.headlineSm, styles.matrixValue, { color: colors.text }]}>
                {formatTimerSeconds(summary?.todayFocusSeconds || 0)}
              </Text>
            )}
            <View style={styles.matrixSubRow}>
              <MetricBadge type="velocity" value="TODAY" color={colors.secondary} />
            </View>
          </GlassCard>

          {/* 2. Pomodoro Progress */}
          <GlassCard level={1} style={styles.matrixCard}>
            <Text style={[typography.labelCaps, styles.matrixLabel, { color: colors.textSecondary }]}>
              COMPLETED
            </Text>
            {isSummaryLoading ? (
              <ActivityIndicator color={colors.primaryLight} size="small" />
            ) : (
              <Text style={[typography.headlineSm, styles.matrixValue, { color: colors.text }]}>
                {completedPomodoros} / {targetGoal}
              </Text>
            )}
            <View style={styles.matrixSubRow}>
              <MetricBadge type="session" label="INTERVALS" color={colors.primaryLight} />
            </View>
          </GlassCard>

          {/* 3. Streak Count */}
          <GlassCard level={1} style={styles.matrixCard}>
            <Text style={[typography.labelCaps, styles.matrixLabel, { color: colors.textSecondary }]}>
              STREAK
            </Text>
            {isSummaryLoading ? (
              <ActivityIndicator color={colors.primaryLight} size="small" />
            ) : (
              <Text style={[typography.headlineSm, styles.matrixValue, { color: colors.text }]}>
                {streakDays} {streakDays === 1 ? 'DAY' : 'DAYS'}
              </Text>
            )}
            <View style={styles.matrixSubRow}>
              <MetricBadge type="streak" label="ACTIVE" color={colors.tertiary} />
            </View>
          </GlassCard>

          {/* 4. Active Tasks Count */}
          <GlassCard level={1} style={styles.matrixCard}>
            <Text style={[typography.labelCaps, styles.matrixLabel, { color: colors.textSecondary }]}>
              BACKLOG
            </Text>
            <Text style={[typography.headlineSm, styles.matrixValue, { color: colors.text }]}>
              {tasks.length} PENDING
            </Text>
            <View style={styles.matrixSubRow}>
              <MetricBadge type="status" value="QUEUE" color={colors.secondary} />
            </View>
          </GlassCard>
        </View>

        {/* Priority Directives Queue */}
        <View style={styles.sectionHeaderBetween}>
          <Text style={[typography.labelCaps, { color: colors.textSecondary }]}>
            PRIORITY DIRECTIVES
          </Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/tasks')}>
            <Text style={[typography.labelCaps, { color: colors.primary }]}>
              VIEW ALL ({tasks.length}) →
            </Text>
          </TouchableOpacity>
        </View>

        {tasks.length === 0 ? (
          <GlassCard level={1} style={styles.emptyCard}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              No pending tasks. You are ready to configure new directives.
            </Text>
            <KineticButton
              title="ADD OBJECTIVE"
              variant="secondary"
              size="sm"
              style={{ marginTop: 12 }}
              onPress={() => router.push('/(tabs)/tasks')}
            />
          </GlassCard>
        ) : (
          tasks.slice(0, 3).map((task) => (
            <GlassCard key={task.id} level={1} style={styles.taskCard}>
              <View style={styles.taskCardHeader}>
                <View style={styles.taskProjectTag}>
                  <View style={[styles.projectDot, { backgroundColor: colors.secondary }]} />
                  <Text style={[typography.labelCaps, { color: colors.textSecondary }]}>
                    {task.project?.name || 'General Focus'}
                  </Text>
                </View>
                <MetricBadge
                  type="status"
                  label={task.priority}
                  color={task.priority === 'HIGH' ? colors.danger : colors.secondary}
                />
              </View>

              <Text style={[typography.bodyBold, styles.taskTitle, { color: colors.text }]} numberOfLines={1}>
                {task.title}
              </Text>
            </GlassCard>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  greetingSection: {
    gap: 4,
    marginTop: 4,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerCard: {
    padding: 10,
    alignItems: 'center',
  },
  heroCard: {
    padding: 16,
    gap: 10,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  directiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroTitle: {
    letterSpacing: -0.3,
  },
  heroActionRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  engageButton: {
    flex: 1,
  },
  sectionHeader: {
    marginTop: 4,
  },
  sectionHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  matrixGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  matrixCard: {
    width: '48%',
    padding: 14,
    gap: 6,
  },
  matrixLabel: {
    fontSize: 10,
  },
  matrixValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  matrixSubRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  taskCard: {
    padding: 14,
    gap: 8,
  },
  taskCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskProjectTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  projectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  taskTitle: {
    fontSize: 15,
  },
  emptyCard: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

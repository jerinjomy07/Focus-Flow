// mobile/src/screens/history/HistoryScreen.tsx
// FocusFlow Mobile — Session History & Audit Log Screen (Stitch Redesign)
//
// Source of Truth:
// - Dark: mobile/design/stitch_focusflow_futuristic_redesign/history_audit_log_interactive_scroll_motion/
// - Light: mobile/design/stitch_focusflow_futuristic_redesign/history_audit_log_terra_design/

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, CheckCircle2, XCircle, Coffee } from 'lucide-react-native';
import { historyApi } from '../../api/history';
import { productivityApi } from '../../api/productivity';
import { FocusSession } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { formatTimerSeconds } from '../../services/timerEngine';
import { GlassCard, MetricBadge, ScreenHeader } from '../../components';

export const HistoryScreen: React.FC = () => {
  const { colors, typography, spacing, isDark } = useTheme();
  const queryClient = useQueryClient();
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  // 1. Fetch history sessions
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['focusHistory', selectedFilter],
    queryFn: () =>
      historyApi.getSessionHistory({
        limit: 50,
        status: selectedFilter === 'ALL' || selectedFilter === 'BREAK' ? undefined : selectedFilter,
      }),
  });

  // 2. Fetch productivity summary for HUD strip metrics
  const { data: summary } = useQuery({
    queryKey: ['productivitySummary', 'TODAY'],
    queryFn: () => productivityApi.getSummary('TODAY'),
  });

  const rawSessions = historyData?.sessions || [];

  // Filter sessions locally if "BREAK" is selected
  const sessions = useMemo(() => {
    if (selectedFilter === 'BREAK') {
      return rawSessions.filter(
        (s) => s.type === 'SHORT_BREAK' || s.type === 'LONG_BREAK'
      );
    }
    return rawSessions;
  }, [rawSessions, selectedFilter]);

  // Telemetry HUD calculations
  const hudMetrics = useMemo(() => {
    const totalSecs = rawSessions.reduce((acc, s) => {
      if (s.status === 'COMPLETED') {
        const secs =
          (s as any).actualDuration ??
          (s as any).plannedDuration ??
          s.durationSeconds ??
          1500;
        return acc + secs;
      }
      return acc;
    }, 0);

    const completedCount = rawSessions.filter((s) => s.status === 'COMPLETED').length;
    const totalCount = rawSessions.length;
    const successRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;
    const streakDays = summary?.streakCount ?? 0;

    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const loggedText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    return {
      loggedText,
      completedCount,
      totalCount,
      successRate,
      streakDays,
    };
  }, [rawSessions, summary]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['focusHistory'] }),
      queryClient.invalidateQueries({ queryKey: ['productivitySummary'] }),
    ]);
    setRefreshing(false);
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateHeader = (isoString: string) => {
    const d = new Date(isoString);
    const today = new Date();
    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();

    if (isToday) return 'Today';

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return 'Yesterday';

    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  const filterOptions = [
    { key: 'ALL', label: 'ALL' },
    { key: 'COMPLETED', label: 'COMPLETED' },
    { key: 'ABANDONED', label: 'ABANDONED' },
    { key: 'BREAK', label: 'BREAKS' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.canvas }]} edges={['top']}>
      {/* Unified HUD Screen Header */}
      <ScreenHeader
        title="Audit Log"
        subtitle="Telemetry for verified deep-work cycles"
        statusText="CHRONO"
      />

      <View style={styles.mainContent}>
        {/* Telemetry HUD Summary Strip */}
        <GlassCard level={2} style={styles.hudStrip}>
          <View style={styles.hudGrid}>
            <View
              style={[
                styles.hudCell,
                {
                  backgroundColor: isDark
                    ? 'rgba(22, 28, 40, 0.6)'
                    : 'rgba(233, 228, 217, 0.6)',
                },
              ]}
            >
              <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 9 }]}>
                LOGGED
              </Text>
              <Text
                style={[
                  typography.labelTelemetry,
                  { color: colors.text, fontWeight: '700', fontSize: 13, marginTop: 2 },
                ]}
              >
                {hudMetrics.loggedText}
              </Text>
              <Text
                style={[
                  typography.labelTelemetry,
                  { color: colors.secondary, fontSize: 9, marginTop: 1 },
                ]}
              >
                Recorded
              </Text>
            </View>

            <View
              style={[
                styles.hudCell,
                {
                  backgroundColor: isDark
                    ? 'rgba(22, 28, 40, 0.6)'
                    : 'rgba(233, 228, 217, 0.6)',
                },
              ]}
            >
              <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 9 }]}>
                CYCLES
              </Text>
              <Text
                style={[
                  typography.labelTelemetry,
                  { color: colors.primaryLight, fontWeight: '700', fontSize: 13, marginTop: 2 },
                ]}
              >
                {hudMetrics.totalCount}
              </Text>
              <Text
                style={[
                  typography.labelTelemetry,
                  { color: colors.textMuted, fontSize: 9, marginTop: 1 },
                ]}
              >
                {hudMetrics.completedCount} done
              </Text>
            </View>

            <View
              style={[
                styles.hudCell,
                {
                  backgroundColor: isDark
                    ? 'rgba(22, 28, 40, 0.6)'
                    : 'rgba(233, 228, 217, 0.6)',
                },
              ]}
            >
              <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 9 }]}>
                SUCCESS
              </Text>
              <Text
                style={[
                  typography.labelTelemetry,
                  { color: colors.secondary, fontWeight: '700', fontSize: 13, marginTop: 2 },
                ]}
              >
                {hudMetrics.successRate}%
              </Text>
              <Text
                style={[
                  typography.labelTelemetry,
                  { color: colors.secondary, fontSize: 9, marginTop: 1 },
                ]}
              >
                Optimal
              </Text>
            </View>

            <View
              style={[
                styles.hudCell,
                {
                  backgroundColor: isDark
                    ? 'rgba(22, 28, 40, 0.6)'
                    : 'rgba(233, 228, 217, 0.6)',
                },
              ]}
            >
              <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 9 }]}>
                STREAK
              </Text>
              <Text
                style={[
                  typography.labelTelemetry,
                  { color: colors.tertiary, fontWeight: '700', fontSize: 13, marginTop: 2 },
                ]}
              >
                {hudMetrics.streakDays}D
              </Text>
              <Text
                style={[
                  typography.labelTelemetry,
                  { color: colors.tertiary, fontSize: 9, marginTop: 1 },
                ]}
              >
                Active
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* Filter Matrix Pills */}
        <View style={styles.filterRow}>
          {filterOptions.map((opt) => {
            const isActive = selectedFilter === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.filterBtn,
                  {
                    backgroundColor: isActive
                      ? colors.primary
                      : isDark
                      ? 'rgba(22, 28, 40, 0.7)'
                      : 'rgba(233, 228, 217, 0.6)',
                    borderColor: isActive ? colors.primaryLight : colors.border,
                  },
                ]}
                onPress={() => setSelectedFilter(opt.key)}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${opt.label}`}
              >
                <Text
                  style={[
                    typography.labelCaps,
                    {
                      color: isActive ? colors.onPrimary : colors.textMuted,
                      fontSize: 10,
                    },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Timeline Audit Conduit & List */}
        {isLoading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator color={colors.secondary} size="large" />
          </View>
        ) : (
          <View style={styles.timelineContainer}>
            {/* Continuous Vertical Conduit Line */}
            <View
              style={[
                styles.timelineConduitLine,
                {
                  backgroundColor: isDark
                    ? 'rgba(76, 215, 246, 0.25)'
                    : 'rgba(74, 124, 89, 0.25)',
                },
              ]}
            />

            <FlatList
              data={sessions}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: spacing.bottomDockHeight + 40 },
              ]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.secondary}
                  colors={[colors.secondary]}
                />
              }
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => {
                const isCompleted = item.status === 'COMPLETED';
                const isBreak =
                  item.type === 'SHORT_BREAK' || item.type === 'LONG_BREAK';
                const durationSecs =
                  (item as any).actualDuration ??
                  (item as any).plannedDuration ??
                  item.durationSeconds ??
                  1500;
                const durationMins = Math.max(1, Math.round(durationSecs / 60));

                const showDateHeader =
                  index === 0 ||
                  formatDateHeader(item.startedAt) !==
                    formatDateHeader(sessions[index - 1].startedAt);

                const nodeColor = isCompleted
                  ? colors.secondary
                  : isBreak
                  ? colors.tertiary
                  : colors.error;

                return (
                  <View style={styles.timelineItemWrapper}>
                    {/* Date Section Header */}
                    {showDateHeader && (
                      <View style={styles.dateHeaderRow}>
                        <View
                          style={[
                            styles.dateNodeOuter,
                            {
                              backgroundColor: colors.canvas,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.dateNodeInner,
                              { backgroundColor: colors.secondary },
                            ]}
                          />
                        </View>
                        <Text style={[typography.headlineSm, { color: colors.text, fontSize: 14 }]}>
                          {formatDateHeader(item.startedAt)}
                        </Text>
                      </View>
                    )}

                    {/* Timeline Node Dot */}
                    <View style={styles.sessionRowWithNode}>
                      <View
                        style={[
                          styles.timelineNode,
                          {
                            backgroundColor: nodeColor,
                            shadowColor: nodeColor,
                          },
                        ]}
                      />

                      {/* Session Audit GlassCard */}
                      <GlassCard level={1} style={styles.sessionCard}>
                        <View style={styles.cardHeaderRow}>
                          <View style={styles.cardTagGroup}>
                            <View
                              style={[styles.miniDot, { backgroundColor: nodeColor }]}
                            />
                            <Text
                              style={[
                                typography.labelCaps,
                                {
                                  color: isBreak ? colors.tertiary : colors.secondary,
                                  fontSize: 10,
                                },
                              ]}
                            >
                              {isBreak ? 'REST INTERVAL' : item.project?.name?.toUpperCase() || 'DEEP WORK'}
                            </Text>
                          </View>

                          <View style={styles.timeTagGroup}>
                            <Clock size={11} color={colors.textMuted} />
                            <Text
                              style={[
                                typography.labelTelemetry,
                                { color: colors.textSecondary, fontSize: 10 },
                              ]}
                            >
                              {formatTime(item.startedAt)}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.cardBodyRow}>
                          <View style={styles.sessionTitleGroup}>
                            <Text
                              style={[
                                typography.headlineSm,
                                styles.sessionTitle,
                                { color: colors.text },
                              ]}
                              numberOfLines={1}
                            >
                              {item.task?.title ||
                                (isBreak ? 'Neural Reset & Rest' : 'Deep Work Session')}
                            </Text>
                            <Text
                              style={[
                                typography.bodySm,
                                { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
                              ]}
                            >
                              {isCompleted
                                ? 'Verified cycle complete'
                                : item.status === 'ABANDONED'
                                ? 'Session terminated early'
                                : 'Interval skipped'}
                            </Text>
                          </View>

                          <View style={styles.durationBlock}>
                            <Text
                              style={[
                                typography.labelTelemetry,
                                styles.durationText,
                                { color: colors.text },
                              ]}
                            >
                              {durationMins}m
                            </Text>
                            <Text
                              style={[
                                typography.labelCaps,
                                {
                                  color: isCompleted ? colors.secondary : colors.textMuted,
                                  fontSize: 9,
                                },
                              ]}
                            >
                              {isCompleted ? '100% Flow' : item.status}
                            </Text>
                          </View>
                        </View>
                      </GlassCard>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <GlassCard level={1} style={styles.emptyCard}>
                  <Text style={[typography.headlineSm, { color: colors.text, textAlign: 'center' }]}>
                    No Verified Cycles
                  </Text>
                  <Text
                    style={[
                      typography.bodySm,
                      { color: colors.textSecondary, textAlign: 'center', marginTop: 6 },
                    ]}
                  >
                    Completed focus sprints will record to this chronological telemetry ledger.
                  </Text>
                </GlassCard>
              }
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  hudStrip: {
    padding: 10,
    marginTop: 4,
    marginBottom: 10,
  },
  hudGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  hudCell: {
    flex: 1,
    padding: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineContainer: {
    flex: 1,
    position: 'relative',
  },
  timelineConduitLine: {
    position: 'absolute',
    left: 9,
    top: 10,
    bottom: 0,
    width: 2,
    borderRadius: 1,
  },
  listContent: {
    gap: 12,
  },
  timelineItemWrapper: {
    gap: 8,
  },
  dateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 0,
    marginTop: 4,
    marginBottom: 2,
  },
  dateNodeOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  dateNodeInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sessionRowWithNode: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    paddingLeft: 24,
  },
  timelineNode: {
    position: 'absolute',
    left: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 3,
  },
  sessionCard: {
    flex: 1,
    padding: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardTagGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  timeTagGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionTitleGroup: {
    flex: 1,
    marginRight: 10,
  },
  sessionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  durationBlock: {
    alignItems: 'flex-end',
  },
  durationText: {
    fontSize: 16,
    fontWeight: '700',
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
});

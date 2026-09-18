// mobile/src/screens/analytics/AnalyticsScreen.tsx
// FocusFlow Mobile — Advanced Productivity Analytics Screen

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { analyticsApi } from '../../api/analytics';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { formatTimerSeconds } from '../../services/timerEngine';

type RangeType = '7D' | '14D' | '30D';

export const AnalyticsScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const [range, setRange] = useState<RangeType>('7D');
  const [refreshing, setRefreshing] = useState(false);

  // 1. Overview Query
  const { data: overview, isLoading: isOverviewLoading } = useQuery({
    queryKey: ['analyticsOverview', range],
    queryFn: () => analyticsApi.getOverview(range),
  });

  // 2. Distributions Query
  const { data: distributions, isLoading: isDistLoading } = useQuery({
    queryKey: ['analyticsDistributions', range],
    queryFn: () => analyticsApi.getDistributions(range),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['analyticsOverview'] }),
      queryClient.invalidateQueries({ queryKey: ['analyticsDistributions'] }),
    ]);
    setRefreshing(false);
  };

  const weekdayData = distributions?.weekday || [];
  const maxWeekdaySeconds = Math.max(...weekdayData.map((d) => d.focusSeconds), 1);

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
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">Analytics</Text>
          <Text style={styles.subtitle}>Deterministic productivity insights and trends.</Text>
        </View>

        {/* Range Selector */}
        <View style={styles.rangeSelector}>
          {(['7D', '14D', '30D'] as RangeType[]).map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.rangeTab, range === r && styles.rangeTabActive]}
              onPress={() => setRange(r)}
              accessibilityRole="button"
              accessibilityLabel={`Select ${r} time range`}
            >
              <Text style={[styles.rangeTabText, range === r && styles.rangeTabTextActive]}>
                {r === '7D' ? 'Last 7 Days' : r === '14D' ? 'Last 14 Days' : 'Last 30 Days'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Overview KPI Cards */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Focus Time</Text>
            {isOverviewLoading ? (
              <ActivityIndicator color={colors.primaryLight} size="small" />
            ) : (
              <Text style={styles.kpiValue}>
                {formatTimerSeconds(overview?.totalFocusSeconds || 0)}
              </Text>
            )}
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Completed Sessions</Text>
            {isOverviewLoading ? (
              <ActivityIndicator color={colors.primaryLight} size="small" />
            ) : (
              <Text style={styles.kpiValue}>
                {overview?.completedSessions || 0} 🍅
              </Text>
            )}
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Consistency</Text>
            {isOverviewLoading ? (
              <ActivityIndicator color={colors.primaryLight} size="small" />
            ) : (
              <>
                <Text style={styles.kpiValue}>
                  {overview?.consistencyRate !== undefined
                    ? `${overview.consistencyRate.toFixed(1)}%`
                    : '0%'}
                </Text>
                <Text style={styles.kpiSubValue}>
                  {overview?.activeDays || 0} / {overview?.totalDays || (range === '7D' ? 7 : range === '14D' ? 14 : 30)} active days
                </Text>
              </>
            )}
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Completion Rate</Text>
            {isOverviewLoading ? (
              <ActivityIndicator color={colors.primaryLight} size="small" />
            ) : (
              <Text style={styles.kpiValue}>
                {overview?.completionRate !== undefined
                  ? `${Math.round(overview.completionRate)}%`
                  : '100%'}
              </Text>
            )}
          </View>
        </View>

        {/* Weekday Distribution Bar Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Weekday Distribution</Text>
          <Text style={styles.chartSubtitle}>Focus volume by day of the week</Text>

          {isDistLoading ? (
            <View style={styles.chartLoader}>
              <ActivityIndicator color={colors.primaryLight} size="small" />
            </View>
          ) : (
            <View style={styles.barChartContainer}>
              {weekdayData.map((d) => {
                const heightPercent = Math.max(8, (d.focusSeconds / maxWeekdaySeconds) * 100);
                const minutes = Math.round(d.focusSeconds / 60);

                return (
                  <View key={d.weekday} style={styles.barColumn}>
                    <Text style={styles.barValueText}>{minutes > 0 ? `${minutes}m` : ''}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { height: `${heightPercent}%` }]} />
                    </View>
                    <Text style={styles.barLabel}>{(d.dayName || '').slice(0, 3)}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
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
  title: {
    ...typography.h2,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  rangeSelector: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
  },
  rangeTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  rangeTabActive: {
    backgroundColor: colors.primary,
  },
  rangeTabText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  rangeTabTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  kpiLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  kpiValue: {
    ...typography.h2,
    color: colors.text,
  },
  kpiSubValue: {
    ...typography.tiny,
    color: colors.textMuted,
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  chartTitle: {
    ...typography.h3,
    color: colors.text,
  },
  chartSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  chartLoader: {
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barChartContainer: {
    flexDirection: 'row',
    height: 140,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barValueText: {
    ...typography.tiny,
    color: colors.textMuted,
    fontSize: 9,
    marginBottom: 4,
  },
  barTrack: {
    width: 14,
    height: 80,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
  },
  barLabel: {
    ...typography.tiny,
    color: colors.textSecondary,
    marginTop: 6,
  },
});

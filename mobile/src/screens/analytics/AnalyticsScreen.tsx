// mobile/src/screens/analytics/AnalyticsScreen.tsx
// FocusFlow Mobile — Advanced Productivity Analytics Screen (Stitch Redesign)
//
// Source of Truth:
// - Dark: mobile/design/stitch_focusflow_futuristic_redesign/analytics_telemetry_obsidian_kinetic/
// - Light: mobile/design/stitch_focusflow_futuristic_redesign/analytics_telemetry_terra_design/

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
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, TrendingUp, CheckCircle2, Award, Zap, Target } from 'lucide-react-native';
import { analyticsApi } from '../../api/analytics';
import { useTheme } from '../../context/ThemeContext';
import { formatTimerSeconds } from '../../services/timerEngine';
import { GlassCard, MetricBadge, ScreenHeader } from '../../components';

type RangeType = '7D' | '14D' | '30D';

export const AnalyticsScreen: React.FC = () => {
  const { colors, typography, spacing, isDark } = useTheme();
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

  // Formatted values
  const totalSeconds = overview?.totalFocusSeconds || 0;
  const totalHours = Math.floor(totalSeconds / 3600);
  const totalRemainingMinutes = Math.floor((totalSeconds % 3600) / 60);
  const totalTimeDisplay =
    totalHours > 0
      ? `${totalHours}h ${totalRemainingMinutes}m`
      : `${totalRemainingMinutes}m`;

  const completedSessions = overview?.completedSessions || 0;
  const consistencyRate = overview?.consistencyRate !== undefined ? Math.round(overview.consistencyRate) : 0;
  const completionRate = overview?.completionRate !== undefined ? Math.round(overview.completionRate) : 100;
  const averageSessionMinutes = overview?.averageSessionDurationMinutes || 25;
  const activeDays = overview?.activeDays || 0;
  const totalDays = overview?.totalDays || (range === '7D' ? 7 : range === '14D' ? 14 : 30);

  // Gauge calculations
  const gaugePercent = Math.min(100, Math.max(0, completionRate));
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * gaugePercent) / 100;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.canvas }]} edges={['top']}>
      {/* Unified HUD Screen Header */}
      <ScreenHeader
        title="Analytics"
        subtitle="Deterministic productivity insights and trends"
        statusText="LIVE SYNC"
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
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
      >
        {/* Segmented Horizon Scope Filter */}
        <View
          style={[
            styles.rangeSelector,
            {
              backgroundColor: isDark ? 'rgba(8, 14, 26, 0.85)' : 'rgba(233, 228, 217, 0.85)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : colors.border,
            },
          ]}
        >
          {(['7D', '14D', '30D'] as RangeType[]).map((r) => {
            const isActive = range === r;
            return (
              <TouchableOpacity
                key={r}
                style={[
                  styles.rangeTab,
                  isActive && [
                    styles.rangeTabActive,
                    {
                      backgroundColor: colors.primary,
                      shadowColor: colors.primary,
                    },
                  ],
                ]}
                onPress={() => setRange(r)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${r} time range`}
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
                  {r === '7D' ? 'LAST 7 DAYS' : r === '14D' ? 'LAST 14 DAYS' : 'LAST 30 DAYS'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Primary Focal Hero Telemetry Card (Glass Level 3) */}
        <GlassCard level={3} style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTextColumn}>
              <View style={styles.heroTagRow}>
                <Clock size={13} color={colors.secondary} />
                <Text
                  style={[
                    typography.labelCaps,
                    { color: colors.secondary, fontSize: 10, letterSpacing: 1 },
                  ]}
                >
                  TOTAL FOCUS VOLUME
                </Text>
              </View>

              {isOverviewLoading ? (
                <ActivityIndicator color={colors.secondary} size="small" style={{ marginVertical: 8 }} />
              ) : (
                <Text
                  style={[
                    typography.headlineLg,
                    styles.heroBigNumber,
                    { color: colors.text },
                  ]}
                >
                  {totalTimeDisplay}
                </Text>
              )}

              <View style={styles.heroTrendRow}>
                <View
                  style={[
                    styles.trendBadge,
                    {
                      backgroundColor: isDark
                        ? 'rgba(76, 215, 246, 0.15)'
                        : 'rgba(74, 124, 89, 0.12)',
                    },
                  ]}
                >
                  <TrendingUp size={11} color={colors.secondary} />
                  <Text
                    style={[
                      typography.labelTelemetry,
                      { color: colors.secondary, fontSize: 10 },
                    ]}
                  >
                    Active
                  </Text>
                </View>
                <Text style={[typography.bodySm, { color: colors.textSecondary, fontSize: 11 }]}>
                  across {range.toLowerCase()} cycle
                </Text>
              </View>
            </View>

            {/* Telemetry Gauge Ring */}
            <View style={styles.gaugeContainer}>
              <Svg width={72} height={72} viewBox="0 0 72 72">
                <Defs>
                  <SvgLinearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor={colors.secondary} />
                    <Stop offset="100%" stopColor={colors.primary} />
                  </SvgLinearGradient>
                </Defs>
                <Circle
                  cx="36"
                  cy="36"
                  r={radius}
                  stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}
                  strokeWidth="5.5"
                  fill="none"
                />
                <Circle
                  cx="36"
                  cy="36"
                  r={radius}
                  stroke="url(#gaugeGrad)"
                  strokeWidth="5.5"
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="none"
                  rotation="-90"
                  origin="36, 36"
                />
              </Svg>
              <View style={styles.gaugeCenterText}>
                <Text style={[typography.labelCaps, { color: colors.text, fontSize: 12, fontWeight: '700' }]}>
                  {completionRate}%
                </Text>
                <Text style={[typography.labelCaps, { color: colors.textMuted, fontSize: 8 }]}>
                  QUOTA
                </Text>
              </View>
            </View>
          </View>

          {/* Secondary Micro Strip inside Hero */}
          <View style={styles.heroMicroGrid}>
            <View
              style={[
                styles.microCell,
                {
                  backgroundColor: isDark
                    ? 'rgba(8, 14, 26, 0.65)'
                    : 'rgba(233, 228, 217, 0.65)',
                },
              ]}
            >
              <View
                style={[
                  styles.microIconBox,
                  { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(74, 124, 89, 0.15)' },
                ]}
              >
                <CheckCircle2 size={13} color={colors.primaryLight} />
              </View>
              <View style={styles.microTextColumn}>
                <Text style={[typography.labelCaps, { color: colors.textMuted, fontSize: 9 }]}>
                  DAILY AVERAGE
                </Text>
                <Text
                  style={[
                    typography.labelTelemetry,
                    { color: colors.text, fontSize: 12, fontWeight: '600' },
                  ]}
                >
                  {Math.round(totalMinutesByDay(totalSeconds, totalDays))}m / day
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.microCell,
                {
                  backgroundColor: isDark
                    ? 'rgba(8, 14, 26, 0.65)'
                    : 'rgba(233, 228, 217, 0.65)',
                },
              ]}
            >
              <View
                style={[
                  styles.microIconBox,
                  { backgroundColor: isDark ? 'rgba(76, 215, 246, 0.2)' : 'rgba(74, 124, 89, 0.15)' },
                ]}
              >
                <Zap size={13} color={colors.secondary} />
              </View>
              <View style={styles.microTextColumn}>
                <Text style={[typography.labelCaps, { color: colors.textMuted, fontSize: 9 }]}>
                  DEEP WORK DENSITY
                </Text>
                <Text
                  style={[
                    typography.labelTelemetry,
                    { color: colors.secondary, fontSize: 12, fontWeight: '600' },
                  ]}
                >
                  {completionRate}% Deep
                </Text>
              </View>
            </View>
          </View>
        </GlassCard>

        {/* Secondary Metrics Grid (2x2 Glass Matrix) */}
        <View style={styles.matrixGrid}>
          {/* Tile 1: Completed */}
          <GlassCard level={2} style={styles.matrixTile}>
            <View style={styles.tileHeader}>
              <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 10 }]}>
                COMPLETED
              </Text>
              <MetricBadge type="session" color={colors.secondary} />
            </View>
            <View style={styles.tileValueRow}>
              <Text style={[typography.headlineLg, { color: colors.text, fontSize: 24 }]}>
                {completedSessions}
              </Text>
              <Text style={[typography.labelCaps, { color: colors.secondary, fontSize: 10, marginLeft: 4 }]}>
                CYCLES
              </Text>
            </View>
            <Text style={[typography.bodySm, { color: colors.textMuted, fontSize: 10, marginTop: 2 }]}>
              {completedSessions > 0 ? 'Verified focus blocks' : 'No cycles completed'}
            </Text>
            <View
              style={[
                styles.tileTrack,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.06)',
                },
              ]}
            >
              <View
                style={[
                  styles.tileFill,
                  {
                    width: `${Math.min(100, completedSessions * 10)}%`,
                    backgroundColor: colors.secondary,
                  },
                ]}
              />
            </View>
          </GlassCard>

          {/* Tile 2: Consistency */}
          <GlassCard level={2} style={styles.matrixTile}>
            <View style={styles.tileHeader}>
              <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 10 }]}>
                CONSISTENCY
              </Text>
              <MetricBadge type="streak" color={colors.primaryLight} />
            </View>
            <View style={styles.tileValueRow}>
              <Text style={[typography.headlineLg, { color: colors.text, fontSize: 24 }]}>
                {consistencyRate}%
              </Text>
            </View>
            <Text style={[typography.bodySm, { color: colors.textMuted, fontSize: 10, marginTop: 2 }]}>
              {activeDays} / {totalDays} active days
            </Text>
            <View style={styles.activeDaysPills}>
              {Array.from({ length: 7 }).map((_, idx) => {
                const isActiveDay = idx < activeDays;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.dayDotPill,
                      {
                        backgroundColor: isActiveDay
                          ? colors.primary
                          : isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.08)',
                      },
                    ]}
                  />
                );
              })}
            </View>
          </GlassCard>

          {/* Tile 3: Execution Rate */}
          <GlassCard level={2} style={styles.matrixTile}>
            <View style={styles.tileHeader}>
              <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 10 }]}>
                EXECUTION
              </Text>
              <Target size={15} color={colors.secondary} />
            </View>
            <View style={styles.tileValueRow}>
              <Text style={[typography.headlineLg, { color: colors.text, fontSize: 24 }]}>
                {completionRate}%
              </Text>
            </View>
            <Text style={[typography.bodySm, { color: colors.secondary, fontSize: 10, marginTop: 2 }]}>
              {completionRate >= 80 ? 'Optimal Flow State' : 'Calibration Mode'}
            </Text>
            <View
              style={[
                styles.tileTrack,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.06)',
                },
              ]}
            >
              <View
                style={[
                  styles.tileFill,
                  {
                    width: `${completionRate}%`,
                    backgroundColor: colors.primary,
                  },
                ]}
              />
            </View>
          </GlassCard>

          {/* Tile 4: Session Mean */}
          <GlassCard level={2} style={styles.matrixTile}>
            <View style={styles.tileHeader}>
              <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 10 }]}>
                SESSION MEAN
              </Text>
              <Clock size={15} color={colors.tertiary} />
            </View>
            <View style={styles.tileValueRow}>
              <Text style={[typography.headlineLg, { color: colors.text, fontSize: 24 }]}>
                {averageSessionMinutes}
              </Text>
              <Text style={[typography.labelCaps, { color: colors.textMuted, fontSize: 10, marginLeft: 4 }]}>
                MIN
              </Text>
            </View>
            <Text style={[typography.bodySm, { color: colors.textMuted, fontSize: 10, marginTop: 2 }]}>
              Standard: 25-30m
            </Text>
            <View
              style={[
                styles.tileTrack,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.06)',
                },
              ]}
            >
              <View
                style={[
                  styles.tileFill,
                  {
                    width: `${Math.min(100, (averageSessionMinutes / 30) * 100)}%`,
                    backgroundColor: colors.tertiary,
                  },
                ]}
              />
            </View>
          </GlassCard>
        </View>

        {/* Weekday Distribution Bar Chart Card */}
        <GlassCard level={2} style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={[typography.headlineSm, { color: colors.text }]}>
                Weekday Distribution
              </Text>
              <Text style={[typography.bodySm, { color: colors.textSecondary, fontSize: 11 }]}>
                Focus volume by day of the cycle
              </Text>
            </View>

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                <Text style={[typography.labelCaps, { color: colors.textMuted, fontSize: 9 }]}>
                  NORMAL
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.secondary }]} />
                <Text style={[typography.labelCaps, { color: colors.secondary, fontSize: 9 }]}>
                  PEAK
                </Text>
              </View>
            </View>
          </View>

          {isDistLoading ? (
            <View style={styles.chartLoader}>
              <ActivityIndicator color={colors.secondary} size="small" />
            </View>
          ) : (
            <View style={styles.barsRow}>
              {weekdayData.map((d) => {
                const heightPercent = Math.max(10, (d.focusSeconds / maxWeekdaySeconds) * 100);
                const minutes = Math.round(d.focusSeconds / 60);
                const isPeak = d.focusSeconds === maxWeekdaySeconds && maxWeekdaySeconds > 0;

                return (
                  <View key={d.weekday} style={styles.barCol}>
                    <Text
                      style={[
                        typography.labelTelemetry,
                        styles.barValue,
                        { color: isPeak ? colors.secondary : colors.textMuted, fontSize: 9 },
                      ]}
                    >
                      {minutes > 0 ? `${minutes}m` : ''}
                    </Text>

                    <View
                      style={[
                        styles.barTrack,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(0, 0, 0, 0.05)',
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: `${heightPercent}%`,
                            backgroundColor: isPeak ? colors.secondary : colors.primary,
                          },
                        ]}
                      />
                    </View>

                    <Text
                      style={[
                        typography.labelCaps,
                        styles.barLabel,
                        {
                          color: isPeak ? colors.secondary : colors.textSecondary,
                          fontSize: 10,
                          fontWeight: isPeak ? '700' : '500',
                        },
                      ]}
                    >
                      {(d.dayName || '').slice(0, 3).toUpperCase()}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
};

function totalMinutesByDay(totalSecs: number, days: number): number {
  if (!days || days <= 0) return 0;
  return Math.round(totalSecs / 60 / days);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  rangeSelector: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 3,
    marginTop: 4,
  },
  rangeTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeTabActive: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  heroCard: {
    padding: 16,
    gap: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTextColumn: {
    flex: 1,
  },
  heroTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  heroBigNumber: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
  },
  heroTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  gaugeContainer: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gaugeCenterText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMicroGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  microCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 10,
  },
  microIconBox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  microTextColumn: {
    flex: 1,
  },
  matrixGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  matrixTile: {
    width: '48.5%',
    padding: 12,
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tileValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  tileTrack: {
    height: 3,
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  tileFill: {
    height: '100%',
    borderRadius: 2,
  },
  activeDaysPills: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 10,
  },
  dayDotPill: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  chartCard: {
    padding: 14,
    gap: 14,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chartLoader: {
    padding: 30,
    alignItems: 'center',
  },
  barsRow: {
    flexDirection: 'row',
    height: 140,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 16,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barValue: {
    marginBottom: 4,
    height: 14,
  },
  barTrack: {
    width: 14,
    height: 90,
    borderRadius: 7,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  barLabel: {
    marginTop: 6,
  },
});

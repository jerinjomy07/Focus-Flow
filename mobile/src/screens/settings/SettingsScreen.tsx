// mobile/src/screens/settings/SettingsScreen.tsx
// FocusFlow Mobile — System Calibration & Settings Screen (Stitch Redesign)
//
// Source of Truth:
// - Dark: mobile/design/stitch_focusflow_futuristic_redesign/settings_preferences_obsidian_kinetic/
// - Light: mobile/design/stitch_focusflow_futuristic_redesign/settings_preferences_terra_design/

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  Palette,
  User,
  Clock,
  Bell,
  Cpu,
  LogOut,
  Sparkles,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { settingsApi } from '../../api/settings';
import { GlassCard, KineticButton, MetricBadge, ScreenHeader } from '../../components';

export const SettingsScreen: React.FC = () => {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { colors, typography, spacing, isDark, themeMode, setThemeMode } = useTheme();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['userSettings'],
    queryFn: () => settingsApi.getSettings(),
  });

  const updateMutation = useMutation({
    mutationFn: (updates: any) => settingsApi.updateSettings(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSettings'] });
    },
  });

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of FocusFlow?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.canvas }]} edges={['top']}>
      {/* Unified HUD Screen Header */}
      <ScreenHeader
        title="Settings"
        subtitle="System configuration & telemetry parameters"
        statusText="SYS.CONFIG"
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: spacing.bottomDockHeight + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator color={colors.secondary} size="large" />
          </View>
        ) : (
          <>
            {/* Visual System / Appearance Selector */}
            <GlassCard level={2} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <Palette size={16} color={colors.secondary} />
                  <Text style={[typography.headlineSm, { color: colors.text, fontSize: 15 }]}>
                    Visual Theme Engine
                  </Text>
                </View>
                <MetricBadge type="status" label="DUAL THEME" color={colors.secondary} />
              </View>
              <Text style={[typography.bodySm, { color: colors.textSecondary, fontSize: 11, marginBottom: 12 }]}>
                Switch between high-contrast kinetic substrates and natural grounded warmth.
              </Text>

              <View
                style={[
                  styles.themePillsRow,
                  {
                    backgroundColor: isDark
                      ? 'rgba(8, 14, 26, 0.85)'
                      : 'rgba(233, 228, 217, 0.85)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : colors.border,
                  },
                ]}
              >
                {[
                  { key: 'obsidian', label: 'OBSIDIAN' },
                  { key: 'terra', label: 'TERRA' },
                  { key: 'system', label: 'SYSTEM' },
                ].map((item) => {
                  const isActive = themeMode === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[
                        styles.themePill,
                        isActive && [
                          styles.themePillActive,
                          {
                            backgroundColor: colors.primary,
                            shadowColor: colors.primary,
                          },
                        ],
                      ]}
                      onPress={() => setThemeMode(item.key as any)}
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
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </GlassCard>

            {/* Account Profile Card */}
            <GlassCard level={2} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <User size={16} color={colors.primaryLight} />
                  <Text style={[typography.headlineSm, { color: colors.text, fontSize: 15 }]}>
                    Pilot Identity
                  </Text>
                </View>
              </View>

              <View style={styles.fieldList}>
                <View style={styles.fieldRow}>
                  <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 11 }]}>
                    NAME
                  </Text>
                  <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>
                    {user?.name || 'Commander'}
                  </Text>
                </View>

                <View style={[styles.fieldRow, styles.fieldDivider, { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }]}>
                  <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 11 }]}>
                    EMAIL
                  </Text>
                  <Text style={[typography.labelTelemetry, { color: colors.textSecondary, fontSize: 12 }]}>
                    {user?.email || '—'}
                  </Text>
                </View>

                <View style={[styles.fieldRow, styles.fieldDivider, { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }]}>
                  <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 11 }]}>
                    TIMEZONE
                  </Text>
                  <Text style={[typography.labelTelemetry, { color: colors.secondary, fontSize: 11 }]}>
                    {settings?.timezone || user?.timezone || 'UTC'}
                  </Text>
                </View>
              </View>
            </GlassCard>

            {/* Session Durations Calibration */}
            <GlassCard level={2} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <Clock size={16} color={colors.secondary} />
                  <Text style={[typography.headlineSm, { color: colors.text, fontSize: 15 }]}>
                    Session Durations
                  </Text>
                </View>
              </View>

              {/* Focus Interval */}
              <View style={styles.intervalBlock}>
                <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 10, marginBottom: 6 }]}>
                  FOCUS INTERVAL
                </Text>
                <View style={styles.pillGroup}>
                  {[25, 45, 50].map((mins) => {
                    const isActive = settings?.focusDurationMinutes === mins;
                    return (
                      <TouchableOpacity
                        key={mins}
                        style={[
                          styles.intervalPill,
                          {
                            backgroundColor: isActive
                              ? colors.primary
                              : isDark
                              ? 'rgba(13, 19, 31, 0.7)'
                              : 'rgba(233, 228, 217, 0.6)',
                            borderColor: isActive ? colors.primaryLight : colors.border,
                          },
                        ]}
                        onPress={() => updateMutation.mutate({ focusDuration: mins })}
                      >
                        <Text
                          style={[
                            typography.labelTelemetry,
                            {
                              color: isActive ? colors.onPrimary : colors.textSecondary,
                              fontSize: 11,
                              fontWeight: '700',
                            },
                          ]}
                        >
                          {mins}m
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Short Break */}
              <View style={styles.intervalBlock}>
                <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 10, marginBottom: 6 }]}>
                  SHORT BREAK
                </Text>
                <View style={styles.pillGroup}>
                  {[5, 10].map((mins) => {
                    const isActive = settings?.shortBreakMinutes === mins;
                    return (
                      <TouchableOpacity
                        key={mins}
                        style={[
                          styles.intervalPill,
                          {
                            backgroundColor: isActive
                              ? colors.primary
                              : isDark
                              ? 'rgba(13, 19, 31, 0.7)'
                              : 'rgba(233, 228, 217, 0.6)',
                            borderColor: isActive ? colors.primaryLight : colors.border,
                          },
                        ]}
                        onPress={() => updateMutation.mutate({ shortBreakDuration: mins })}
                      >
                        <Text
                          style={[
                            typography.labelTelemetry,
                            {
                              color: isActive ? colors.onPrimary : colors.textSecondary,
                              fontSize: 11,
                              fontWeight: '700',
                            },
                          ]}
                        >
                          {mins}m
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Long Break */}
              <View style={styles.intervalBlock}>
                <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 10, marginBottom: 6 }]}>
                  LONG BREAK
                </Text>
                <View style={styles.pillGroup}>
                  {[15, 20, 30].map((mins) => {
                    const isActive = settings?.longBreakMinutes === mins;
                    return (
                      <TouchableOpacity
                        key={mins}
                        style={[
                          styles.intervalPill,
                          {
                            backgroundColor: isActive
                              ? colors.primary
                              : isDark
                              ? 'rgba(13, 19, 31, 0.7)'
                              : 'rgba(233, 228, 217, 0.6)',
                            borderColor: isActive ? colors.primaryLight : colors.border,
                          },
                        ]}
                        onPress={() => updateMutation.mutate({ longBreakDuration: mins })}
                      >
                        <Text
                          style={[
                            typography.labelTelemetry,
                            {
                              color: isActive ? colors.onPrimary : colors.textSecondary,
                              fontSize: 11,
                              fontWeight: '700',
                            },
                          ]}
                        >
                          {mins}m
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </GlassCard>

            {/* Audio & Feedback Signals */}
            <GlassCard level={2} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <Bell size={16} color={colors.secondary} />
                  <Text style={[typography.headlineSm, { color: colors.text, fontSize: 15 }]}>
                    Feedback & Alerts
                  </Text>
                </View>
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchTextCol}>
                  <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>
                    Completion Chime
                  </Text>
                  <Text style={[typography.bodySm, { color: colors.textSecondary, fontSize: 11 }]}>
                    Harmonic frequency chime upon cycle completion
                  </Text>
                </View>
                <Switch
                  value={settings?.soundEnabled ?? true}
                  onValueChange={(val) => updateMutation.mutate({ soundEnabled: val })}
                  trackColor={{
                    false: isDark ? 'rgba(36, 42, 55, 0.6)' : 'rgba(219, 213, 201, 0.6)',
                    true: colors.primary,
                  }}
                  thumbColor={colors.onPrimary}
                />
              </View>

              <View style={[styles.switchRow, styles.fieldDivider, { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }]}>
                <View style={styles.switchTextCol}>
                  <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>
                    Auto-Start Breaks
                  </Text>
                  <Text style={[typography.bodySm, { color: colors.textSecondary, fontSize: 11 }]}>
                    Transition to break interval automatically
                  </Text>
                </View>
                <Switch
                  value={settings?.autoStartBreaks ?? false}
                  onValueChange={(val) => updateMutation.mutate({ autoStartBreaks: val })}
                  trackColor={{
                    false: isDark ? 'rgba(36, 42, 55, 0.6)' : 'rgba(219, 213, 201, 0.6)',
                    true: colors.primary,
                  }}
                  thumbColor={colors.onPrimary}
                />
              </View>
            </GlassCard>

            {/* Application & Calibration Specifications */}
            <GlassCard level={2} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <Cpu size={16} color={colors.secondary} />
                  <Text style={[typography.headlineSm, { color: colors.text, fontSize: 15 }]}>
                    Telemetry Diagnostics
                  </Text>
                </View>
              </View>

              <View style={styles.fieldList}>
                <View style={styles.fieldRow}>
                  <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 11 }]}>
                    BUILD VERSION
                  </Text>
                  <Text style={[typography.labelTelemetry, { color: colors.text, fontSize: 11 }]}>
                    v2.0.0-stitch
                  </Text>
                </View>
                <View style={[styles.fieldRow, styles.fieldDivider, { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }]}>
                  <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 11 }]}>
                    RUNTIME
                  </Text>
                  <Text style={[typography.labelTelemetry, { color: colors.secondary, fontSize: 11 }]}>
                    Hermes Bytecode AOT
                  </Text>
                </View>
                <View style={[styles.fieldRow, styles.fieldDivider, { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }]}>
                  <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 11 }]}>
                    PROTOCOL
                  </Text>
                  <Text style={[typography.labelTelemetry, { color: colors.primaryLight, fontSize: 11 }]}>
                    Server-Authoritative
                  </Text>
                </View>
              </View>
            </GlassCard>

            {/* Sign Out Button */}
            <View style={styles.signOutWrapper}>
              <KineticButton
                title="TERMINATE SESSION (SIGN OUT)"
                variant="danger"
                onPress={handleSignOut}
                icon={<LogOut size={16} color={colors.error} />}
              />
            </View>
          </>
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
    gap: 12,
  },
  card: {
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themePillsRow: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
  },
  themePill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themePillActive: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  fieldList: {
    gap: 10,
    marginTop: 4,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldDivider: {
    paddingTop: 10,
    borderTopWidth: 1,
  },
  intervalBlock: {
    marginTop: 10,
  },
  pillGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  intervalPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  switchTextCol: {
    flex: 1,
    marginRight: 12,
  },
  signOutWrapper: {
    marginTop: 8,
    marginBottom: 16,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
});

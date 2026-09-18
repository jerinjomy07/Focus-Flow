// mobile/src/screens/settings/SettingsScreen.tsx
// FocusFlow Mobile — User Preferences & Account Settings Screen

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
import { useAuth } from '../../context/AuthContext';
import { settingsApi } from '../../api/settings';
import { colors, spacing, borderRadius, typography, layout } from '../../theme';

export const SettingsScreen: React.FC = () => {
  const router = useRouter();
  const { user, logout } = useAuth();
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
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">Settings</Text>
          <Text style={styles.subtitle}>Customize your Pomodoro experience.</Text>
        </View>

        {isLoading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.primaryLight} size="large" />
          </View>
        ) : (
          <>
            {/* Account Profile Card */}
            <View style={styles.card}>
              <Text style={styles.cardHeader}>Account Profile</Text>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Name</Text>
                <Text style={styles.rowValue}>{user?.name || 'User'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Email</Text>
                <Text style={styles.rowValue}>{user?.email || '—'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Timezone</Text>
                <Text style={styles.rowValue}>{settings?.timezone || user?.timezone || 'UTC'}</Text>
              </View>
            </View>

            {/* Timer Durations */}
            <View style={styles.card}>
              <Text style={styles.cardHeader}>Session Durations</Text>
              <View style={styles.durationRow}>
                <Text style={styles.rowLabel}>Focus Interval</Text>
                <View style={styles.pillGroup}>
                  {[25, 45, 50].map((mins) => (
                    <TouchableOpacity
                      key={mins}
                      style={[
                        styles.pill,
                        settings?.focusDurationMinutes === mins && styles.pillActive,
                      ]}
                      onPress={() => updateMutation.mutate({ focusDuration: mins })}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          settings?.focusDurationMinutes === mins && styles.pillTextActive,
                        ]}
                      >
                        {mins}m
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.durationRow}>
                <Text style={styles.rowLabel}>Short Break</Text>
                <View style={styles.pillGroup}>
                  {[5, 10].map((mins) => (
                    <TouchableOpacity
                      key={mins}
                      style={[
                        styles.pill,
                        settings?.shortBreakMinutes === mins && styles.pillActive,
                      ]}
                      onPress={() => updateMutation.mutate({ shortBreakDuration: mins })}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          settings?.shortBreakMinutes === mins && styles.pillTextActive,
                        ]}
                      >
                        {mins}m
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.durationRow}>
                <Text style={styles.rowLabel}>Long Break</Text>
                <View style={styles.pillGroup}>
                  {[15, 20, 30].map((mins) => (
                    <TouchableOpacity
                      key={mins}
                      style={[
                        styles.pill,
                        settings?.longBreakMinutes === mins && styles.pillActive,
                      ]}
                      onPress={() => updateMutation.mutate({ longBreakDuration: mins })}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          settings?.longBreakMinutes === mins && styles.pillTextActive,
                        ]}
                      >
                        {mins}m
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Sound & Notifications */}
            <View style={styles.card}>
              <Text style={styles.cardHeader}>Feedback & Alerts</Text>
              <View style={styles.switchRow}>
                <View style={styles.switchTextContainer}>
                  <Text style={styles.rowLabel}>Completion Chime</Text>
                  <Text style={styles.switchSubtext}>Play sound when timer finishes</Text>
                </View>
                <Switch
                  value={settings?.soundEnabled ?? true}
                  onValueChange={(val) => updateMutation.mutate({ soundEnabled: val })}
                  trackColor={{ false: colors.surfaceLight, true: colors.primary }}
                  thumbColor={colors.text}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchTextContainer}>
                  <Text style={styles.rowLabel}>Auto-Start Breaks</Text>
                  <Text style={styles.switchSubtext}>Transition to break automatically</Text>
                </View>
                <Switch
                  value={settings?.autoStartBreaks ?? false}
                  onValueChange={(val) => updateMutation.mutate({ autoStartBreaks: val })}
                  trackColor={{ false: colors.surfaceLight, true: colors.primary }}
                  thumbColor={colors.text}
                />
              </View>
            </View>

            {/* App Info & Sign Out */}
            <View style={styles.card}>
              <Text style={styles.cardHeader}>Application</Text>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Version</Text>
                <Text style={styles.rowValue}>1.0.0 (Standalone Android)</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Package</Text>
                <Text style={styles.rowValue}>com.focusflow.app</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out of FocusFlow"
              activeOpacity={0.8}
            >
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </>
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
  title: {
    ...typography.h2,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  loader: {
    padding: spacing.xxxl,
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeader: {
    ...typography.caption,
    color: colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  rowLabel: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  rowValue: {
    ...typography.body,
    color: colors.textSecondary,
  },
  pillGroup: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceLight,
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  pillText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  switchTextContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  switchSubtext: {
    ...typography.tiny,
    color: colors.textMuted,
    marginTop: 2,
  },
  signOutButton: {
    height: layout.minTouchTarget,
    backgroundColor: colors.dangerMuted,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  signOutText: {
    ...typography.bodyBold,
    color: colors.danger,
  },
});

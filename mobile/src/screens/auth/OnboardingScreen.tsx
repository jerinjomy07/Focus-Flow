// mobile/src/screens/auth/OnboardingScreen.tsx
// FocusFlow Mobile — Initial User Onboarding & Goal Setup Screen

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, borderRadius, typography, layout } from '../../theme';
import { ApiClientError } from '../../api/client';

export const OnboardingScreen: React.FC = () => {
  const router = useRouter();
  const { completeOnboarding } = useAuth();
  const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const [timezone] = useState(detectedTz);
  const [focusDuration, setFocusDuration] = useState<number>(25);
  const [dailyGoal, setDailyGoal] = useState<number>(4);
  const [firstProjectName, setFirstProjectName] = useState<string>('Deep Work');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleComplete = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      await completeOnboarding({
        timezone,
        focusDuration,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        dailyGoal,
        firstProjectName: firstProjectName.trim() || undefined,
      });
      router.replace('/(tabs)');
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to complete onboarding. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.badge}>Quick Setup</Text>
          <Text style={styles.title} accessibilityRole="header">Personalize FocusFlow</Text>
          <Text style={styles.subtitle}>Configure your default Pomodoro session intervals.</Text>
        </View>

        {errorMessage && (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Standard Focus Duration</Text>
          <View style={styles.optionRow}>
            {[25, 45, 50].map((mins) => (
              <TouchableOpacity
                key={mins}
                style={[
                  styles.optionButton,
                  focusDuration === mins && styles.optionButtonActive,
                ]}
                onPress={() => setFocusDuration(mins)}
                accessibilityRole="button"
                accessibilityLabel={`${mins} minutes focus duration`}
              >
                <Text
                  style={[
                    styles.optionText,
                    focusDuration === mins && styles.optionTextActive,
                  ]}
                >
                  {mins} min
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Daily Target (Completed Pomodoros)</Text>
          <View style={styles.optionRow}>
            {[2, 4, 6, 8].map((target) => (
              <TouchableOpacity
                key={target}
                style={[
                  styles.optionButton,
                  dailyGoal === target && styles.optionButtonActive,
                ]}
                onPress={() => setDailyGoal(target)}
                accessibilityRole="button"
                accessibilityLabel={`${target} sessions daily goal`}
              >
                <Text
                  style={[
                    styles.optionText,
                    dailyGoal === target && styles.optionTextActive,
                  ]}
                >
                  {target} 🍅
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Your First Project Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Deep Work, Research, Project Alpha"
            placeholderTextColor={colors.textMuted}
            value={firstProjectName}
            onChangeText={setFirstProjectName}
            accessibilityLabel="First project name input"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Detected Timezone</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>🌐 {timezone}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.buttonDisabled]}
          onPress={handleComplete}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel="Complete onboarding"
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Start Focusing →</Text>
          )}
        </TouchableOpacity>
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
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
    gap: spacing.xl,
  },
  header: {
    gap: spacing.xs,
  },
  badge: {
    ...typography.tiny,
    color: colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  errorBanner: {
    backgroundColor: colors.dangerMuted,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  optionButton: {
    flex: 1,
    height: layout.minTouchTarget,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionButtonActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  optionText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  optionTextActive: {
    ...typography.bodyBold,
    color: colors.primaryLight,
  },
  input: {
    height: layout.minTouchTarget,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    ...typography.body,
    color: colors.text,
  },
  infoBox: {
    height: layout.minTouchTarget,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  infoText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  submitButton: {
    height: layout.minTouchTarget,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...typography.bodyBold,
    color: colors.text,
  },
});

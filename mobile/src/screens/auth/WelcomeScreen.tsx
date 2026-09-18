// mobile/src/screens/auth/WelcomeScreen.tsx
// FocusFlow Mobile — Welcome & Onboarding Gateway Screen

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, borderRadius, typography, layout } from '../../theme';

type Props = {
  navigation?: any;
};

export const WelcomeScreen: React.FC<Props> = ({ navigation }) => {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <View style={styles.content}>
        {/* Brand Icon & Heading */}
        <View style={styles.brandContainer}>
          <View style={styles.iconCircle} accessibilityRole="image" accessibilityLabel="FocusFlow logo">
            <Text style={styles.iconText}>⚡</Text>
          </View>
          <Text style={styles.title} accessibilityRole="header">FocusFlow</Text>
          <Text style={styles.tagline}>
            Professional Pomodoro productivity engine. Master your deep work sessions with science-backed intervals.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => (navigation?.navigate ? navigation.navigate('Login') : router.push('/(auth)/login'))}
            accessibilityRole="button"
            accessibilityLabel="Log In to your existing account"
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Log In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => (navigation?.navigate ? navigation.navigate('Register') : router.push('/(auth)/register'))}
            accessibilityRole="button"
            accessibilityLabel="Create a new FocusFlow account"
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>Create Account</Text>
          </TouchableOpacity>
        </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
  },
  brandContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryMuted,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconText: {
    fontSize: 36,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.md,
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 24,
  },
  actionContainer: {
    width: '100%',
    gap: spacing.md,
  },
  primaryButton: {
    height: layout.minTouchTarget,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    ...typography.bodyBold,
    color: colors.text,
  },
  secondaryButton: {
    height: layout.minTouchTarget,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    ...typography.bodyBold,
    color: colors.textSecondary,
  },
});

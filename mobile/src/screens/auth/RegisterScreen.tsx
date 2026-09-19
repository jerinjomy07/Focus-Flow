// mobile/src/screens/auth/RegisterScreen.tsx
// FocusFlow Mobile — User Registration Screen (Stitch Redesign)

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Lock, Mail, User } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ApiClientError } from '../../api/client';
import { GlassCard, KineticButton, MetricBadge } from '../../components';

type Props = {
  navigation?: any;
};

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const router = useRouter();
  const { register } = useAuth();
  const { colors, typography, isDark } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      router.replace('/(tabs)');
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to create account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.canvas }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity
              style={[
                styles.backButton,
                {
                  backgroundColor: isDark ? 'rgba(22, 28, 40, 0.7)' : 'rgba(233, 228, 217, 0.7)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.border,
                },
              ]}
              onPress={() => (navigation?.goBack ? navigation.goBack() : router.back())}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={18} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.badgeWrap}>
              <MetricBadge type="session" label="NEW PROTOCOL" color={colors.primaryLight} />
            </View>

            <Text style={[typography.headlineLg, styles.title, { color: colors.text }]}>
              Create Pilot Account
            </Text>
            <Text style={[typography.bodySm, styles.subtitle, { color: colors.textSecondary }]}>
              Begin telemetry tracking and deep focus orchestration.
            </Text>
          </View>

          {/* Accessible Error Alert Banner */}
          {errorMessage && (
            <View
              style={[
                styles.errorBanner,
                {
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(186, 26, 26, 0.12)',
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(186, 26, 26, 0.25)',
                },
              ]}
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
            >
              <Text style={[typography.bodySm, { color: colors.error }]}>{errorMessage}</Text>
            </View>
          )}

          {/* Form Fields Card */}
          <GlassCard level={2} style={styles.formCard}>
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <User size={13} color={colors.textSecondary} />
                <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 10 }]}>
                  PILOT NAME
                </Text>
              </View>
              <TextInput
                style={[
                  typography.body,
                  styles.input,
                  {
                    backgroundColor: isDark ? 'rgba(8, 14, 26, 0.8)' : 'rgba(233, 228, 217, 0.8)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Jane Doe"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                accessibilityLabel="Pilot Name input"
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Mail size={13} color={colors.textSecondary} />
                <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 10 }]}>
                  EMAIL ADDRESS
                </Text>
              </View>
              <TextInput
                style={[
                  typography.body,
                  styles.input,
                  {
                    backgroundColor: isDark ? 'rgba(8, 14, 26, 0.8)' : 'rgba(233, 228, 217, 0.8)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                accessibilityLabel="Email Address input"
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Lock size={13} color={colors.textSecondary} />
                <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 10 }]}>
                  PASSWORD (MIN. 8 CHARS)
                </Text>
              </View>
              <TextInput
                style={[
                  typography.body,
                  styles.input,
                  {
                    backgroundColor: isDark ? 'rgba(8, 14, 26, 0.8)' : 'rgba(233, 228, 217, 0.8)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                accessibilityLabel="Password input"
              />
            </View>

            <View style={styles.actionRow}>
              <KineticButton
                title="REGISTER TELEMETRY PROTOCOL"
                variant="primary"
                onPress={handleRegister}
                loading={isLoading}
              />
            </View>
          </GlassCard>

          <View style={styles.footer}>
            <Text style={[typography.bodySm, { color: colors.textSecondary }]}>
              Already have an account?{' '}
            </Text>
            <TouchableOpacity
              onPress={() => (navigation?.navigate ? navigation.navigate('Login') : router.push('/(auth)/login'))}
              accessibilityRole="button"
              accessibilityLabel="Navigate to sign in"
            >
              <Text style={[typography.bodySm, { color: colors.primary, fontWeight: '700' }]}>
                Sign in
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 20,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  badgeWrap: {
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
  },
  errorBanner: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  formCard: {
    padding: 18,
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  actionRow: {
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
});

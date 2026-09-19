// mobile/src/screens/auth/LoginScreen.tsx
// FocusFlow Mobile — Native User Login Screen (Stitch Redesign)

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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Lock, Mail, KeyRound, X } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { authApi } from '../../api/auth';
import { ApiClientError } from '../../api/client';
import { GlassCard, KineticButton, MetricBadge } from '../../components';

type Props = {
  navigation?: any;
};

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const router = useRouter();
  const { login } = useAuth();
  const { colors, typography, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot / Reset Password state
  const [isResetModalVisible, setIsResetModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await login({ email: email.trim(), password });
      router.replace('/(tabs)');
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to sign in. Please verify your credentials and network connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail.trim()) {
      setResetError('Please enter your account email address.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setResetError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match. Please verify.');
      return;
    }

    setIsResetting(true);
    setResetError(null);
    setResetSuccess(null);

    try {
      await authApi.resetPassword({
        email: resetEmail.trim(),
        newPassword,
      });

      setResetSuccess('Password reset! Signing you in...');

      // Auto sign-in with newly reset credentials
      await login({ email: resetEmail.trim(), password: newPassword });
      setIsResetModalVisible(false);
      router.replace('/(tabs)');
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setResetError(err.message);
      } else {
        setResetError('Failed to reset password. Please check your credentials and network connection.');
      }
    } finally {
      setIsResetting(false);
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
              <MetricBadge type="status" label="SECURE ACCESS" color={colors.secondary} />
            </View>

            <Text style={[typography.headlineLg, styles.title, { color: colors.text }]}>
              Welcome Back
            </Text>
            <Text style={[typography.bodySm, styles.subtitle, { color: colors.textSecondary }]}>
              Sign in to resume your calibrated focus streaks.
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
              <View style={styles.labelRowBetween}>
                <View style={styles.labelRow}>
                  <Lock size={13} color={colors.textSecondary} />
                  <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 10 }]}>
                    PASSWORD
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setResetEmail(email.trim());
                    setNewPassword('');
                    setConfirmPassword('');
                    setResetError(null);
                    setResetSuccess(null);
                    setIsResetModalVisible(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Forgot Password? Reset your credentials"
                >
                  <Text style={[typography.labelCaps, { color: colors.secondary, fontSize: 10, letterSpacing: 0.5 }]}>
                    FORGOT PASSWORD?
                  </Text>
                </TouchableOpacity>
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
                title="INITIALIZE SESSION (SIGN IN)"
                variant="primary"
                onPress={handleLogin}
                loading={isLoading}
              />
            </View>
          </GlassCard>

          <View style={styles.footer}>
            <Text style={[typography.bodySm, { color: colors.textSecondary }]}>
              Don't have an account?{' '}
            </Text>
            <TouchableOpacity
              onPress={() => (navigation?.navigate ? navigation.navigate('Register') : router.push('/(auth)/register'))}
              accessibilityRole="button"
              accessibilityLabel="Navigate to registration"
            >
              <Text style={[typography.bodySm, { color: colors.primary, fontWeight: '700' }]}>
                Create one
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Credential Recovery / Password Reset Modal */}
      <Modal
        visible={isResetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsResetModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboardAvoid}
          >
            <GlassCard level={3} glowColor={colors.primaryGlow} style={styles.modalCard}>
              <View style={styles.modalHeaderTop}>
                <MetricBadge type="status" label="CREDENTIAL RECOVERY" color={colors.secondary} />
                <TouchableOpacity
                  onPress={() => setIsResetModalVisible(false)}
                  style={[
                    styles.modalCloseBtn,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Close password reset modal"
                >
                  <X size={16} color={colors.text} />
                </TouchableOpacity>
              </View>

              <Text style={[typography.headlineSm, { color: colors.text, marginTop: 10 }]}>
                Reset Password
              </Text>
              <Text style={[typography.bodySm, { color: colors.textSecondary, marginTop: 4, marginBottom: 12 }]}>
                Enter your registered email address and choose a new password.
              </Text>

              {resetError && (
                <View
                  style={[
                    styles.modalAlert,
                    {
                      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(186, 26, 26, 0.12)',
                      borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(186, 26, 26, 0.25)',
                    },
                  ]}
                >
                  <Text style={[typography.bodySm, { color: colors.error }]}>{resetError}</Text>
                </View>
              )}

              {resetSuccess && (
                <View
                  style={[
                    styles.modalAlert,
                    {
                      backgroundColor: isDark ? 'rgba(76, 215, 246, 0.15)' : 'rgba(45, 90, 67, 0.12)',
                      borderColor: isDark ? 'rgba(76, 215, 246, 0.3)' : 'rgba(45, 90, 67, 0.25)',
                    },
                  ]}
                >
                  <Text style={[typography.bodySm, { color: colors.secondary }]}>{resetSuccess}</Text>
                </View>
              )}

              <View style={styles.modalInputGroup}>
                <View style={styles.labelRow}>
                  <Mail size={13} color={colors.textSecondary} />
                  <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 10 }]}>
                    ACCOUNT EMAIL
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
                  value={resetEmail}
                  onChangeText={(text) => {
                    setResetEmail(text);
                    if (resetError) setResetError(null);
                  }}
                  accessibilityLabel="Reset Email input"
                />
              </View>

              <View style={styles.modalInputGroup}>
                <View style={styles.labelRow}>
                  <KeyRound size={13} color={colors.textSecondary} />
                  <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 10 }]}>
                    NEW PASSWORD
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
                  placeholder="Minimum 8 characters"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  autoCapitalize="none"
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    if (resetError) setResetError(null);
                  }}
                  accessibilityLabel="New Password input"
                />
              </View>

              <View style={styles.modalInputGroup}>
                <View style={styles.labelRow}>
                  <Lock size={13} color={colors.textSecondary} />
                  <Text style={[typography.labelCaps, { color: colors.textSecondary, fontSize: 10 }]}>
                    CONFIRM NEW PASSWORD
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
                  placeholder="Re-enter new password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  autoCapitalize="none"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (resetError) setResetError(null);
                  }}
                  accessibilityLabel="Confirm New Password input"
                />
              </View>

              <View style={{ marginTop: 16 }}>
                <KineticButton
                  title="RESET PASSWORD & SIGN IN"
                  variant="primary"
                  onPress={handleResetPassword}
                  loading={isResetting}
                />
              </View>
            </GlassCard>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
  labelRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 12, 0.82)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalKeyboardAvoid: {
    width: '100%',
  },
  modalCard: {
    padding: 20,
    borderRadius: 20,
  },
  modalHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAlert: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  modalInputGroup: {
    gap: 6,
    marginBottom: 12,
  },
});

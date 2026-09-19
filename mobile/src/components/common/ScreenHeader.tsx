// mobile/src/components/common/ScreenHeader.tsx
// FocusFlow Mobile — Unified HUD Screen Header

import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { ThemeMorphIcon } from './ThemeMorphIcon';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  showStatusIndicator?: boolean;
  statusText?: string;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  rightAction,
  showStatusIndicator = true,
  statusText = 'SYS.FLOW v4.2',
}) => {
  const router = useRouter();
  const { colors, typography, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'J';

  // Scale animation for button press tactile feedback
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleToggleTheme = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.75,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();

    toggleTheme();
  };

  const handleAvatarPress = () => {
    try {
      router.push('/(tabs)/settings');
    } catch {
      // Handled silently
    }
  };

  return (
    <View style={styles.headerContainer}>
      <View style={styles.topRow}>
        <View style={styles.titleGroup}>
          {showStatusIndicator && (
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: colors.secondary,
                  shadowColor: colors.secondary,
                },
              ]}
            />
          )}
          <Text
            style={[
              typography.headlineSm,
              { color: colors.text },
            ]}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {title}
          </Text>
        </View>

        <View style={styles.rightGroup}>
          {statusText && (
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: isDark
                    ? 'rgba(36, 42, 55, 0.7)'
                    : 'rgba(233, 228, 217, 0.8)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.pulseMicroDot,
                  { backgroundColor: colors.secondary },
                ]}
              />
              <Text
                style={[
                  typography.labelTelemetry,
                  styles.statusPillText,
                  { color: colors.textSecondary },
                ]}
              >
                {statusText}
              </Text>
            </View>
          )}

          {/* Dedicated Mode Switch Button with SVG Morphing */}
          <TouchableOpacity
            onPress={handleToggleTheme}
            activeOpacity={0.7}
            style={[
              styles.themeModeBtn,
              {
                backgroundColor: isDark
                  ? 'rgba(26, 31, 46, 0.85)'
                  : 'rgba(233, 228, 217, 0.95)',
                borderColor: isDark
                  ? 'rgba(255, 255, 255, 0.14)'
                  : 'rgba(45, 90, 67, 0.22)',
                shadowColor: isDark ? colors.secondary : colors.primary,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${isDark ? 'Light (Terra)' : 'Dark (Obsidian)'} mode`}
            accessibilityHint="Toggles between dark and light themes with SVG morphing"
          >
            <Animated.View
              style={{
                transform: [{ scale: scaleAnim }],
              }}
            >
              <ThemeMorphIcon isDark={isDark} size={17} />
            </Animated.View>
          </TouchableOpacity>

          {/* User Profile Avatar Pill ('J') */}
          {rightAction || (
            <TouchableOpacity
              onPress={handleAvatarPress}
              activeOpacity={0.8}
              style={[
                styles.avatarCircle,
                {
                  backgroundColor: colors.primary,
                  shadowColor: colors.primary,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`User profile: ${user?.name || 'Pilot'}. Tap to open settings.`}
            >
              <Text style={[styles.avatarText, { color: colors.onPrimary }]}>
                {userInitial}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {subtitle && (
        <Text
          style={[
            typography.bodySm,
            styles.subtitle,
            { color: colors.textSecondary },
          ]}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 3,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  pulseMicroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  themeModeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
  },
});

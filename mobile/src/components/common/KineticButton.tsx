// mobile/src/components/common/KineticButton.tsx
// FocusFlow Mobile — Precision Kinetic Action Button Component

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface KineticButtonProps {
  onPress: () => void;
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

export const KineticButton: React.FC<KineticButtonProps> = ({
  onPress,
  title,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
  accessibilityLabel,
}) => {
  const { colors, typography, borderRadius, isDark } = useTheme();

  const getContainerStyle = (): ViewStyle => {
    const height = size === 'sm' ? 36 : size === 'lg' ? 54 : 48;
    const paddingHorizontal = size === 'sm' ? 12 : size === 'lg' ? 24 : 18;

    if (variant === 'primary') {
      return {
        height,
        paddingHorizontal,
        backgroundColor: colors.primary,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.4)',
        borderWidth: 1,
        borderRadius: borderRadius.md,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: isDark ? 0.45 : 0.2,
        shadowRadius: 14,
        elevation: 4,
      };
    }

    if (variant === 'danger') {
      return {
        height,
        paddingHorizontal,
        backgroundColor: colors.dangerMuted,
        borderColor: colors.danger,
        borderWidth: 1,
        borderRadius: borderRadius.md,
        shadowColor: colors.danger,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 2,
      };
    }

    if (variant === 'ghost') {
      return {
        height,
        paddingHorizontal,
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        borderRadius: borderRadius.md,
      };
    }

    // Secondary (default)
    return {
      height,
      paddingHorizontal,
      backgroundColor: isDark ? 'rgba(18, 26, 43, 0.65)' : 'rgba(240, 236, 228, 0.8)',
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: borderRadius.md,
    };
  };

  const getTextColor = (): string => {
    if (variant === 'primary') return colors.onPrimary;
    if (variant === 'danger') return colors.danger;
    if (variant === 'ghost') return colors.textSecondary;
    return colors.text;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      style={[
        styles.baseButton,
        getContainerStyle(),
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {/* Specular top border highlight on primary */}
      {variant === 'primary' && (
        <View
          style={[
            styles.primaryGlint,
            { backgroundColor: colors.specularGlint },
          ]}
        />
      )}

      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <View style={styles.contentRow}>
          {icon && <View style={styles.iconWrapper}>{icon}</View>}
          <Text
            style={[
              typography.labelCaps,
              { color: getTextColor(), fontSize: size === 'sm' ? 11 : 12 },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  baseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryGlint: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 1,
    opacity: 0.5,
  },
  disabled: {
    opacity: 0.5,
  },
});

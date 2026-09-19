// mobile/src/components/common/GlassCard.tsx
// FocusFlow Mobile — Multi-Tiered Glass Substrate Card Component

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface GlassCardProps {
  children: React.ReactNode;
  level?: 1 | 2 | 3;
  style?: StyleProp<ViewStyle>;
  glowColor?: string;
  hasSpecularGlint?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  level = 1,
  style,
  glowColor,
  hasSpecularGlint = true,
}) => {
  const { colors, borderRadius, isDark } = useTheme();

  const backgroundColor =
    level === 1
      ? colors.glassL1
      : level === 2
      ? colors.glassL2
      : colors.glassL3;

  const borderColor =
    level === 3
      ? colors.secondary
      : level === 2
      ? colors.borderAccent
      : colors.border;

  return (
    <View
      style={[
        styles.baseCard,
        {
          backgroundColor,
          borderColor,
          borderRadius: borderRadius.lg,
        },
        isDark && glowColor
          ? {
              shadowColor: glowColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.35,
              shadowRadius: 12,
              elevation: 4,
            }
          : !isDark
          ? styles.terraShadow
          : styles.darkShadow,
        style,
      ]}
    >
      {/* Top Hairline Specular Glint */}
      {hasSpecularGlint && (
        <View
          style={[
            styles.specularGlint,
            {
              backgroundColor: colors.specularGlint,
              borderTopLeftRadius: borderRadius.lg,
              borderTopRightRadius: borderRadius.lg,
            },
          ]}
        />
      )}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  baseCard: {
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  specularGlint: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 1,
    opacity: 0.6,
  },
  darkShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 6,
  },
  terraShadow: {
    shadowColor: '#2E3230',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
});

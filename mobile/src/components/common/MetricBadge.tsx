// mobile/src/components/common/MetricBadge.tsx
// FocusFlow Mobile — Laser-Cut HUD Telemetry Vector Badges (Replacing Emojis)
//
// Complies with Obsidian Kinetic & Terra design specs:
// - 'streak': Angular diamond-vector glyph framed in a micro-chip container
// - 'session': Concentric segmented orbit ring with active slices
// - 'velocity': Sharp 45-degree ray vector
// - 'status': General uppercase telemetry pill badge

import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';

export type MetricBadgeType = 'streak' | 'session' | 'velocity' | 'status' | 'custom';

interface MetricBadgeProps {
  type: MetricBadgeType;
  label?: string | number;
  value?: string | number;
  color?: string;
  variant?: 'primary' | 'secondary' | 'accent' | 'neutral' | 'error';
  style?: StyleProp<ViewStyle>;
}

export const MetricBadge: React.FC<MetricBadgeProps> = ({
  type,
  label,
  value,
  color,
  variant = 'secondary',
  style,
}) => {
  const { colors, typography, isDark } = useTheme();

  const badgeColor =
    color ||
    (variant === 'primary'
      ? colors.primary
      : variant === 'secondary'
      ? colors.secondary
      : variant === 'accent'
      ? colors.tertiary
      : variant === 'error'
      ? colors.danger
      : colors.textSecondary);

  const containerBg = isDark
    ? 'rgba(26, 32, 44, 0.7)'
    : 'rgba(233, 228, 217, 0.6)';

  const renderIcon = () => {
    switch (type) {
      case 'streak':
        // Angular diamond-vector glyph
        return (
          <Svg width={14} height={14} viewBox="0 0 16 16" style={styles.icon}>
            <Path
              d="M8 1L14 8L8 15L2 8Z"
              fill={badgeColor}
              fillOpacity={0.25}
              stroke={badgeColor}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
            <Circle cx={8} cy={8} r={2} fill={badgeColor} />
          </Svg>
        );

      case 'session':
        // Concentric segmented orbit ring
        return (
          <Svg width={14} height={14} viewBox="0 0 16 16" style={styles.icon}>
            <Circle
              cx={8}
              cy={8}
              r={6}
              stroke={badgeColor}
              strokeWidth={1.5}
              strokeDasharray="4 2"
              fill="none"
              strokeOpacity={0.8}
            />
            <Circle cx={8} cy={8} r={2.5} fill={badgeColor} />
          </Svg>
        );

      case 'velocity':
        // Sharp 45-degree ray vector
        return (
          <Svg width={14} height={14} viewBox="0 0 16 16" style={styles.icon}>
            <Path
              d="M9 1L3 9H8L7 15L13 7H8L9 1Z"
              fill={badgeColor}
              stroke={badgeColor}
              strokeWidth={1}
              strokeLinejoin="round"
            />
          </Svg>
        );

      default:
        return (
          <View
            style={[
              styles.pulseDot,
              { backgroundColor: badgeColor },
            ]}
          />
        );
    }
  };

  return (
    <View
      style={[
        styles.badgeContainer,
        {
          backgroundColor: containerBg,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.border,
        },
        style,
      ]}
    >
      {renderIcon()}
      {label !== undefined && (
        <Text
          style={[
            typography.labelCaps,
            styles.labelText,
            { color: colors.textSecondary },
          ]}
        >
          {label}
        </Text>
      )}
      {value !== undefined && (
        <Text
          style={[
            typography.labelTelemetry,
            styles.valueText,
            { color: badgeColor },
          ]}
        >
          {value}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    gap: 5,
  },
  icon: {
    marginRight: 2,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  labelText: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
  valueText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

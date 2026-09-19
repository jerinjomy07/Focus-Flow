// mobile/src/components/timer/TelemetryRing.tsx
// FocusFlow Mobile — Precision Concentric Kinetic Timer Dial (SVG Native)
//
// Source of Truth:
// - mobile/design/stitch_focusflow_futuristic_redesign/focus_timer_signature/code.html
// - mobile/design/stitch_focusflow_futuristic_redesign/focus_timer_terra_design/code.html

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Circle,
  G,
} from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';

interface TelemetryRingProps {
  progressPercent: number; // 0 to 100
  timeDisplay: string; // e.g. "24:48"
  statusText: string; // e.g. "IN PROGRESS • 25M DEEP"
  cycleText?: string; // e.g. "CYCLE 01 • INTERVAL 04"
  completedIntervals?: number; // e.g. 1 to 4
  totalIntervals?: number; // default 4
  size?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DEFAULT_SIZE = Math.min(SCREEN_WIDTH - 64, 300);

export const TelemetryRing: React.FC<TelemetryRingProps> = ({
  progressPercent,
  timeDisplay,
  statusText,
  cycleText = 'CYCLE 01 • INTERVAL 04',
  completedIntervals = 1,
  totalIntervals = 4,
  size = DEFAULT_SIZE,
}) => {
  const { colors, typography, isDark } = useTheme();

  const strokeWidth = 5;
  const radius = 130;
  const center = 150;
  const circumference = 2 * Math.PI * radius; // ~816.81

  // Clamp progress to 0..100
  const clampedProgress = Math.max(0, Math.min(100, progressPercent));
  const strokeDashoffset = circumference * (1 - clampedProgress / 100);

  // Calculate orbital head position (starts at -90 deg / top)
  const angleDeg = (clampedProgress / 100) * 360 - 90;
  const angleRad = (angleDeg * Math.PI) / 180;
  const headX = center + radius * Math.cos(angleRad);
  const headY = center + radius * Math.sin(angleRad);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Native SVG Concentric Rings */}
      <Svg
        width={size}
        height={size}
        viewBox="0 0 300 300"
        style={styles.svgOverlay}
      >
        <Defs>
          <LinearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={colors.timerGradient[0]} />
            <Stop offset="50%" stopColor={colors.timerGradient[1]} />
            <Stop offset="100%" stopColor={colors.timerGradient[2]} />
          </LinearGradient>
        </Defs>

        {/* 1. Inactive Background Track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.timerTrack}
          strokeWidth={strokeWidth}
          fill="none"
          opacity={0.8}
        />

        {/* 2. Outer Fine Reticle / Sub-interval Calibration Dots */}
        <Circle
          cx={center}
          cy={center}
          r={radius + 12}
          stroke={colors.timerTick}
          strokeWidth={1}
          strokeDasharray="1.5 12"
          fill="none"
          opacity={isDark ? 0.6 : 0.3}
        />

        {/* 3. Segmented Calibration Arc Accents */}
        <Circle
          cx={center}
          cy={center}
          r={radius - 12}
          stroke={colors.timerTick}
          strokeWidth={1.5}
          strokeDasharray="3 24"
          fill="none"
          opacity={isDark ? 0.4 : 0.2}
        />

        {/* 4. Active Kinetic Progress Arc */}
        <G rotation="-90" origin={`${center}, ${center}`}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke="url(#timerGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
          />
        </G>

        {/* 5. Precision Luminous Orbital Head Indicator */}
        {clampedProgress > 0 && (
          <Circle
            cx={headX}
            cy={headY}
            r={5}
            fill={colors.secondary}
          />
        )}
        {clampedProgress > 0 && (
          <Circle
            cx={headX}
            cy={headY}
            r={2}
            fill={colors.canvas}
          />
        )}
      </Svg>

      {/* Inner High-Diffusion Glass Substrate Core */}
      <View
        style={[
          styles.innerGlassCore,
          {
            backgroundColor: isDark
              ? 'rgba(22, 28, 40, 0.72)'
              : 'rgba(255, 255, 255, 0.92)',
            borderColor: isDark
              ? 'rgba(255, 255, 255, 0.08)'
              : 'rgba(210, 204, 192, 0.6)',
            width: size * 0.76,
            height: size * 0.76,
            borderRadius: (size * 0.76) / 2,
          },
          isDark ? styles.coreShadowDark : styles.coreShadowTerra,
        ]}
      >
        {/* Micro Horizon Sub-indicator */}
        <View style={styles.horizonRow}>
          <View style={[styles.horizonDot, { backgroundColor: colors.secondary }]} />
          <Text
            style={[
              typography.labelTelemetry,
              styles.cycleText,
              { color: colors.textSecondary },
            ]}
          >
            {cycleText}
          </Text>
          <View style={[styles.horizonDot, { backgroundColor: colors.secondary }]} />
        </View>

        {/* High-Precision Digital Numerical Readout */}
        <Text
          style={[
            typography.displayTimerMobile,
            styles.timerNumbers,
            { color: colors.text },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {timeDisplay}
        </Text>

        {/* Telemetry Status Micro-Pill */}
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: isDark
                ? 'rgba(36, 42, 55, 0.85)'
                : 'rgba(240, 236, 228, 0.9)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: colors.secondary },
            ]}
          />
          <Text
            style={[
              typography.labelCaps,
              styles.statusPillText,
              { color: colors.secondary },
            ]}
          >
            {statusText}
          </Text>
        </View>

        {/* Session Progress Segment Bar */}
        <View style={styles.segmentRow}>
          {Array.from({ length: totalIntervals }).map((_, index) => {
            const isFilled = index < completedIntervals;
            return (
              <View
                key={index}
                style={[
                  styles.segmentBar,
                  {
                    backgroundColor: isFilled
                      ? colors.secondary
                      : isDark
                      ? 'rgba(51, 57, 71, 0.5)'
                      : 'rgba(210, 204, 192, 0.5)',
                  },
                  isFilled && isDark && {
                    shadowColor: colors.secondary,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.8,
                    shadowRadius: 4,
                    elevation: 2,
                  },
                ]}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  svgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  innerGlassCore: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    padding: 12,
  },
  coreShadowDark: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
    elevation: 8,
  },
  coreShadowTerra: {
    shadowColor: '#2E3230',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  horizonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  horizonDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  cycleText: {
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  timerNumbers: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1,
    marginVertical: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  segmentBar: {
    width: 16,
    height: 4,
    borderRadius: 2,
  },
});

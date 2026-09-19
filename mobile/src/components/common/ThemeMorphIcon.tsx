// mobile/src/components/common/ThemeMorphIcon.tsx
// FocusFlow Mobile — Geometric SVG Morphing Theme Toggle Icon
// Smoothly morphs between Celestial Crescent Moon (Dark) and Radiant Solar Sphere (Light)

import React, { useRef, useEffect, useState } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';
import Svg, { Defs, Mask, Rect, Circle, Line, G } from 'react-native-svg';

interface ThemeMorphIconProps {
  isDark: boolean;
  size?: number;
  duration?: number;
}

// 8 radial sun rays at 45-degree intervals
const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export const ThemeMorphIcon: React.FC<ThemeMorphIconProps> = ({
  isDark,
  size = 18,
  duration = 320,
}) => {
  // 0 = Dark / Moon (Obsidian), 1 = Light / Sun (Terra)
  const animValue = useRef(new Animated.Value(isDark ? 0 : 1)).current;
  const [progress, setProgress] = useState(isDark ? 0 : 1);

  useEffect(() => {
    const listenerId = animValue.addListener(({ value }) => {
      setProgress(value);
    });

    Animated.timing(animValue, {
      toValue: isDark ? 0 : 1,
      duration,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      useNativeDriver: false,
    }).start();

    return () => {
      animValue.removeListener(listenerId);
    };
  }, [isDark, animValue, duration]);

  const p = progress;

  // 1. Center circle radius: 8.5 (Moon) down to 5.0 (Sun)
  const centerR = 8.5 - 3.5 * p;

  // 2. Cutout mask circle coordinates
  // Moon (p=0): cx=16.5, cy=7.2, r=7.2 (sharp crescent cutout)
  // Sun (p=1): cx=32, cy=-2, r=5 (well outside 24x24 bounds)
  const maskCx = 16.5 + 15.5 * p;
  const maskCy = 7.2 - 9.2 * p;
  const maskR = 7.2 - 2.2 * p;

  // 3. Sun rays expansion & opacity
  const rayOpacity = Math.max(0, Math.min(1, (p - 0.25) / 0.75));
  const innerR = 6.8 + 1.2 * p;
  const rayLength = 2.8 * p;
  const outerR = innerR + rayLength;

  // 4. Smooth RGB color interpolation
  // Moon: #4CD7F6 (76, 215, 246) -> Sun: #F59E0B (245, 158, 11)
  const r = Math.round(76 + (245 - 76) * p);
  const g = Math.round(215 + (158 - 215) * p);
  const b = Math.round(246 + (11 - 246) * p);
  const currentColor = `rgb(${r}, ${g}, ${b})`;

  // 5. Kinetic rotation: 40deg in Moon state up to 135deg in Sun state
  const rotationDeg = 40 + p * 95;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          transform: [{ rotate: `${rotationDeg}deg` }],
        },
      ]}
      pointerEvents="none"
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Defs>
          <Mask id="theme-crescent-mask">
            {/* White reveals the main body */}
            <Rect x="0" y="0" width="24" height="24" fill="#FFFFFF" />
            {/* Black carves out the moon's inner curvature */}
            <Circle cx={maskCx} cy={maskCy} r={maskR} fill="#000000" />
          </Mask>
        </Defs>

        {/* Morphing Center Body (Crescent Moon <-> Solar Sphere) */}
        <Circle
          cx="12"
          cy="12"
          r={centerR}
          fill={currentColor}
          mask="url(#theme-crescent-mask)"
        />

        {/* 8 Radial Solar Rays (Contract/Fade into Moon, Expand/Radiate into Sun) */}
        {rayOpacity > 0.01 && (
          <G opacity={rayOpacity}>
            {RAY_ANGLES.map((angle) => {
              const rad = (angle * Math.PI) / 180;
              const x1 = 12 + innerR * Math.cos(rad);
              const y1 = 12 + innerR * Math.sin(rad);
              const x2 = 12 + outerR * Math.cos(rad);
              const y2 = 12 + outerR * Math.sin(rad);

              return (
                <Line
                  key={angle}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={currentColor}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                />
              );
            })}
          </G>
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

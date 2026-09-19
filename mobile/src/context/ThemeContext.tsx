// mobile/src/context/ThemeContext.tsx
// FocusFlow Mobile — Dynamic Theme Management (Obsidian Kinetic & Terra)

import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import {
  useColorScheme,
  Animated,
  Easing,
  StyleSheet,
  View,
  Platform,
  UIManager,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ThemeColors,
  obsidianKineticColors,
  terraColors,
  spacing,
  borderRadius,
  typography,
  layout,
} from '../theme/tokens';

export type ThemeMode = 'obsidian' | 'terra' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  themeName: 'Obsidian Kinetic' | 'Terra';
  colors: ThemeColors;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  typography: typeof typography;
  layout: typeof layout;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const THEME_STORAGE_KEY = '@focusflow_theme_mode';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('obsidian');
  const [isLoaded, setIsLoaded] = useState(false);
  const [overlayColor, setOverlayColor] = useState<string>(obsidianKineticColors.canvas);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isTransitioningRef = useRef(false);

  useEffect(() => {
    const loadPersistedTheme = async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'obsidian' || stored === 'terra' || stored === 'system') {
          setThemeModeState(stored as ThemeMode);
        } else {
          // Default to Obsidian Kinetic (dark)
          setThemeModeState('obsidian');
        }
      } catch {
        setThemeModeState('obsidian');
      } finally {
        setIsLoaded(true);
      }
    };

    loadPersistedTheme();
  }, []);

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemColorScheme !== 'light';
    }
    return themeMode === 'obsidian';
  }, [themeMode, systemColorScheme]);

  const colors = useMemo(() => {
    return isDark ? obsidianKineticColors : terraColors;
  }, [isDark]);

  const themeName = useMemo(() => {
    return isDark ? 'Obsidian Kinetic' : 'Terra';
  }, [isDark]);

  const runThemeTransition = (targetMode: ThemeMode) => {
    return new Promise<void>((resolve) => {
      // Determine what darkness state targetMode will produce
      let willBeDark: boolean;
      if (targetMode === 'system') {
        willBeDark = systemColorScheme !== 'light';
      } else {
        willBeDark = targetMode === 'obsidian';
      }

      // If already matching both themeMode and darkness, no transition needed
      if (targetMode === themeMode && willBeDark === isDark) {
        resolve();
        return;
      }

      if (isTransitioningRef.current) {
        resolve();
        return;
      }
      isTransitioningRef.current = true;

      const nextOverlay = willBeDark ? obsidianKineticColors.canvas : terraColors.canvas;
      setOverlayColor(nextOverlay);

      // Light tactile feedback on theme switch
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      // Phase 1: Smooth fade-in of transition overlay (130ms)
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 130,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        // Peak reached: flip theme state underneath
        if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
          UIManager.setLayoutAnimationEnabledExperimental(true);
        }
        setThemeModeState(targetMode);
        AsyncStorage.setItem(THEME_STORAGE_KEY, targetMode).catch(() => {});

        // Phase 2: Smooth fade-out to reveal new theme (200ms)
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }).start(() => {
          isTransitioningRef.current = false;
          resolve();
        });
      });
    });
  };

  const setThemeMode = async (mode: ThemeMode) => {
    await runThemeTransition(mode);
  };

  const toggleTheme = async () => {
    const nextMode: ThemeMode = isDark ? 'terra' : 'obsidian';
    await runThemeTransition(nextMode);
  };

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        isDark,
        themeName,
        colors,
        spacing,
        borderRadius,
        typography,
        layout,
        setThemeMode,
        toggleTheme,
      }}
    >
      <View style={[styles.rootContainer, { backgroundColor: colors.canvas }]}>
        {children}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.transitionOverlay,
            {
              backgroundColor: overlayColor,
              opacity: fadeAnim,
            },
          ]}
        />
      </View>
    </ThemeContext.Provider>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  transitionOverlay: {
    zIndex: 99999,
    elevation: 99999,
  },
});

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback to Obsidian Kinetic default if outside provider
    return {
      themeMode: 'obsidian',
      isDark: true,
      themeName: 'Obsidian Kinetic',
      colors: obsidianKineticColors,
      spacing,
      borderRadius,
      typography,
      layout,
      setThemeMode: async () => {},
      toggleTheme: async () => {},
    };
  }
  return context;
};

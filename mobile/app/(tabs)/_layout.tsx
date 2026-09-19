// mobile/app/(tabs)/_layout.tsx
// FocusFlow Mobile — Main Bottom Tab Navigation Layout (Stitch Redesign)
//
// Implements the floating frosted glass substrate navigation dock.
// Conforms to WCAG 48dp minimum touch targets and TalkBack accessibility standards.

import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { LayoutDashboard, Timer, CheckSquare, Clock, BarChart3, Settings } from 'lucide-react-native';
import { useTheme } from '../../src/context/ThemeContext';

export default function TabLayout() {
  const { colors, isDark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: Platform.OS === 'android' ? 10 : 18,
          left: 12,
          right: 12,
          backgroundColor: isDark ? 'rgba(13, 19, 31, 0.94)' : 'rgba(244, 240, 233, 0.95)',
          borderRadius: 20,
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
          borderTopWidth: 1,
          borderWidth: 1,
          borderTopColor: isDark ? 'rgba(99, 102, 241, 0.22)' : 'rgba(74, 124, 89, 0.2)',
          borderColor: isDark ? 'rgba(99, 102, 241, 0.22)' : 'rgba(74, 124, 89, 0.2)',
          elevation: 10,
          shadowColor: isDark ? '#000000' : '#2D5A43',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.45 : 0.15,
          shadowRadius: 12,
        },
        tabBarActiveTintColor: isDark ? colors.secondary : colors.primary,
        tabBarInactiveTintColor: isDark ? colors.textMuted : colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarAccessibilityLabel: 'Dashboard Tab',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="focus"
        options={{
          title: 'Focus',
          tabBarAccessibilityLabel: 'Focus Timer Tab',
          tabBarIcon: ({ color, size }) => <Timer size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarAccessibilityLabel: 'Tasks & Projects Tab',
          tabBarIcon: ({ color, size }) => <CheckSquare size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarAccessibilityLabel: 'Session History Tab',
          tabBarIcon: ({ color, size }) => <Clock size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarAccessibilityLabel: 'Analytics Tab',
          tabBarIcon: ({ color, size }) => <BarChart3 size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Settings Tab',
          tabBarIcon: ({ color, size }) => <Settings size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}

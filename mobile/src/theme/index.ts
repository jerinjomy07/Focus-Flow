// mobile/src/theme/index.ts
// FocusFlow Mobile — Visual Design Tokens & Theme Foundation

export * from './tokens';
export { ThemeProvider, useTheme, ThemeMode } from '../context/ThemeContext';

// Default static exports (Obsidian Kinetic) for direct token usage
import {
  obsidianKineticColors,
  spacing as tokenSpacing,
  borderRadius as tokenBorderRadius,
  typography as tokenTypography,
  layout as tokenLayout,
} from './tokens';

export const colors = {
  ...obsidianKineticColors,
  // Backwards compatibility mappings for existing codebase references
  background: obsidianKineticColors.canvas,
  surface: obsidianKineticColors.surface,
  surfaceLight: obsidianKineticColors.surfaceContainerHigh,
  surfaceHighlight: obsidianKineticColors.surfaceContainerHighest,
  primaryDark: obsidianKineticColors.primaryDark,
  primaryLight: obsidianKineticColors.primaryLight,
  primaryMuted: 'rgba(99, 102, 241, 0.15)',
  successMuted: 'rgba(16, 185, 129, 0.15)',
  warningMuted: 'rgba(245, 158, 11, 0.15)',
  dangerMuted: obsidianKineticColors.dangerMuted,
  info: obsidianKineticColors.secondary,
  textInverse: '#0F172A',
  timerFocus: obsidianKineticColors.primary,
  timerShortBreak: obsidianKineticColors.secondary,
  timerLongBreak: obsidianKineticColors.tertiary,
};

export const spacing = tokenSpacing;
export const borderRadius = tokenBorderRadius;
export const typography = tokenTypography;
export const layout = tokenLayout;
